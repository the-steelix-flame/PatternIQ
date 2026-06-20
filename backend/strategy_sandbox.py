"""
Strategy sandbox for the backtesting engine.

Replaces the old `exec(code, globals(), local_scope)` (a remote-code-execution hole
that exposed os/requests/Firebase and every secret to untrusted LLM- or user-supplied
code). Defence is layered:

  1. AST allowlist: only the node types `find_signals` needs are permitted.
  2. No app globals / no modules in scope (so `pd.read_csv('/proc/self/environ')` is
     impossible), and a minimal __builtins__.
  3. Attribute control: reject every underscore attribute, an explicit escape denylist
     (frame walk, ctypes), and ALL pandas/numpy I/O-ish methods by prefix
     (to_*/read_*/from_*) plus render/plot writers (style/plot/savefig/...). This closes
     the arbitrary-file-write / SSRF surface (e.g. data.to_html(path), data.to_xml(url)).
  4. Isolation + limits: the strategy runs in a separate process with a hard wall-clock
     timeout and best-effort CPU/memory rlimits, so an infinite loop or memory bomb can
     only take down that throwaway process, never the API worker.

In-process Python is not a perfect trust boundary (CPython's own rexec/Bastion were
removed for this reason); the subprocess isolation in (4) is what makes the DoS surface
safe, while (1)-(3) keep secrets and the filesystem out of reach.
"""

from __future__ import annotations

import ast
import logging
import multiprocessing as mp
from queue import Empty

import pandas as pd

logger = logging.getLogger(__name__)

CPU_SECONDS = 10                       # child RLIMIT_CPU (Linux best-effort)
MEM_BYTES = 1536 * 1024 * 1024         # child RLIMIT_AS ~1.5 GB (Linux best-effort)
DEFAULT_TIMEOUT = 12                   # hard wall-clock timeout (seconds)

# AST node types the strategy code is allowed to use.
ALLOWED_NODES = {
    ast.Module, ast.FunctionDef, ast.arguments, ast.arg, ast.Return,
    ast.Assign, ast.AnnAssign, ast.AugAssign, ast.Expr, ast.Pass,
    ast.If, ast.For, ast.While, ast.Break, ast.Continue,
    ast.BoolOp, ast.BinOp, ast.UnaryOp, ast.Compare, ast.IfExp,
    ast.Call, ast.Attribute, ast.Subscript, ast.Slice, ast.Name,
    ast.Load, ast.Store, ast.Del, ast.Constant,
    ast.List, ast.Tuple, ast.Dict, ast.Set,
    ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp, ast.comprehension,
    ast.Starred, ast.keyword,
    ast.And, ast.Or, ast.Add, ast.Sub, ast.Mult, ast.Div, ast.FloorDiv,
    ast.Mod, ast.Pow, ast.LShift, ast.RShift, ast.BitOr, ast.BitXor, ast.BitAnd,
    ast.MatMult, ast.USub, ast.UAdd, ast.Not, ast.Invert,
    ast.Eq, ast.NotEq, ast.Lt, ast.LtE, ast.Gt, ast.GtE,
    ast.Is, ast.IsNot, ast.In, ast.NotIn,
}
if hasattr(ast, "Index"):  # Python <3.9 subscript node
    ALLOWED_NODES.add(ast.Index)

# Names that recover imports/builtins or otherwise escape the sandbox.
DENIED_NAMES = {
    "eval", "exec", "compile", "open", "input", "breakpoint", "help", "license",
    "__import__", "getattr", "setattr", "delattr", "hasattr", "vars", "globals",
    "locals", "memoryview", "type", "object", "super", "classmethod", "staticmethod",
    "property", "dir", "reload", "exit", "quit", "format", "format_map", "__builtins__",
}
# Non-underscore attributes that enable escape (frame walk, ctypes) or file/plot writes.
DENIED_ATTRS = {
    "gi_frame", "gi_code", "gi_yieldfrom", "cr_frame", "cr_code",
    "f_back", "f_globals", "f_locals", "f_builtins", "f_code",
    "ctypes", "query", "eval",
    "tofile", "fromfile", "memmap", "load", "save", "dump",
    "style", "plot", "plotting", "savefig", "hist", "boxplot",
    "get_figure", "figure",
}
# The only to_/read_/from_ methods allowed (pure data structure conversions, no I/O).
SAFE_CONVERTERS = {
    "to_numpy", "to_list", "to_frame", "to_dict", "to_series",
    "to_period", "to_timestamp",
}
SAFE_BUILTIN_NAMES = [
    "abs", "min", "max", "sum", "len", "round", "range", "enumerate", "zip",
    "map", "filter", "sorted", "reversed", "all", "any", "int", "float", "bool",
    "str", "list", "tuple", "dict", "set", "frozenset", "divmod", "pow", "isinstance",
]


class StrategyValidator(ast.NodeVisitor):
    def generic_visit(self, node):
        if type(node) not in ALLOWED_NODES:
            raise ValueError(f"Disallowed syntax: {type(node).__name__}")
        super().generic_visit(node)

    def visit_Attribute(self, node):
        a = node.attr
        if a.startswith("_") or a in DENIED_ATTRS:
            raise ValueError(f"Disallowed attribute access: '{a}'")
        if (a.startswith("to_") or a.startswith("read_") or a.startswith("from_")) and a not in SAFE_CONVERTERS:
            raise ValueError(f"Disallowed I/O method: '{a}'")
        self.generic_visit(node)

    def visit_Name(self, node):
        if node.id.startswith("__") or node.id in DENIED_NAMES:
            raise ValueError(f"Disallowed name: '{node.id}'")
        self.generic_visit(node)


def validate_strategy(code: str):
    """Raise ValueError if the code is empty, not valid Python, or uses disallowed constructs."""
    if not code or "find_signals" not in code:
        raise ValueError("Your script must define a function named 'find_signals(data)'.")
    try:
        tree = ast.parse(code, mode="exec")
    except SyntaxError as e:
        raise ValueError(f"Syntax error in strategy code: {e}")
    StrategyValidator().visit(tree)
    return tree


def _safe_builtins():
    import builtins as _b
    safe = {name: getattr(_b, name) for name in SAFE_BUILTIN_NAMES if hasattr(_b, name)}
    # numpy/pandas C-internals look up __import__ in the executing frame's builtins.
    # User code can never reference it: the AST validator rejects the name '__import__'
    # (every dunder name and every import statement is blocked), so exposing it is safe.
    safe["__import__"] = _b.__import__
    return safe


def _execute_validated(code: str, data):
    """Compile and run already-validated code in a minimal namespace; returns the raw result."""
    safe_globals = {"__builtins__": _safe_builtins()}  # no app globals, no modules, no secrets
    local_scope: dict = {}
    exec(compile(ast.parse(code, mode="exec"), "<find_signals>", "exec"), safe_globals, local_scope)
    func = local_scope.get("find_signals")
    if not callable(func):
        raise ValueError("Your script must define a function named 'find_signals(data)'.")
    return func(data)


def _worker(code: str, data, out_q):
    """Child-process entrypoint: enforce OS limits, validate, execute, ship the result back."""
    try:
        import resource  # Linux/Unix only
        try:
            resource.setrlimit(resource.RLIMIT_CPU, (CPU_SECONDS, CPU_SECONDS))
        except Exception:
            pass
        try:
            resource.setrlimit(resource.RLIMIT_AS, (MEM_BYTES, MEM_BYTES))
        except Exception:
            pass
    except Exception:
        pass
    try:
        validate_strategy(code)
        out_q.put(("ok", _execute_validated(code, data)))
    except Exception as e:
        out_q.put(("err", f"{type(e).__name__}: {e}"))


def _coerce(signals, data):
    return pd.Series(signals, index=data.index).fillna(False).astype(bool)


def _run_inprocess(code: str, data, seconds: int):
    """Fallback when subprocess isolation is unavailable. Best-effort SIGALRM guard."""
    try:
        import signal
        if hasattr(signal, "SIGALRM"):
            def _handler(signum, frame):
                raise TimeoutError("Strategy execution timed out.")
            old = signal.signal(signal.SIGALRM, _handler)
            signal.alarm(seconds)
            try:
                return _execute_validated(code, data)
            finally:
                signal.alarm(0)
                signal.signal(signal.SIGALRM, old)
    except (ValueError, OSError):
        pass
    return _execute_validated(code, data)


def safe_execute_strategy(code: str, data, seconds: int = DEFAULT_TIMEOUT):
    """Validate then run untrusted find_signals(data) in an isolated, time-bounded process.

    Returns a clean boolean Series aligned to `data`. Raises ValueError for invalid/blocked
    code and TimeoutError if the strategy exceeds the wall-clock budget.
    """
    validate_strategy(code)  # fast fail in the parent (also blocks escapes before any spawn)

    try:
        ctx = mp.get_context()  # fork on Linux (cheap, COW), spawn on Windows
        out_q = ctx.Queue()
        proc = ctx.Process(target=_worker, args=(code, data, out_q), daemon=True)
        proc.start()
    except Exception as e:
        logger.warning(f"Sandbox subprocess unavailable ({e}); running in-process with best-effort guard.")
        return _coerce(_run_inprocess(code, data, seconds), data)

    try:
        status, payload = out_q.get(timeout=seconds)
    except Empty:
        proc.terminate()
        proc.join(2)
        if proc.is_alive():
            proc.kill()
        raise TimeoutError(f"Strategy execution exceeded {seconds}s and was terminated.")
    finally:
        if proc.is_alive():
            proc.join(2)

    if status == "err":
        raise ValueError(payload)
    return _coerce(payload, data)
