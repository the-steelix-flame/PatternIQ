"""
Adversarial tests for the strategy sandbox. Run from the backend/ directory:

    python test_strategy_sandbox.py

Exits non-zero if any escape is NOT blocked or any legitimate strategy fails.
"""

import sys

import numpy as np
import pandas as pd

from strategy_sandbox import safe_execute_strategy

# Windows consoles default to cp1252; force UTF-8 so check marks render.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

# A small OHLCV frame with the indicator columns a strategy would reference.
idx = pd.date_range("2024-01-01", periods=40, freq="D")
DATA = pd.DataFrame({
    "Open": np.linspace(100, 140, 40),
    "High": np.linspace(101, 142, 40),
    "Low": np.linspace(99, 138, 40),
    "Close": np.linspace(100, 141, 40),
    "Volume": np.linspace(1e6, 2e6, 40),
    "RSI_14": np.linspace(20, 80, 40),
    "SMA_50": np.linspace(100, 139, 40),
}, index=idx)

# (label, code) — every one of these MUST be rejected.
MALICIOUS = [
    ("import os", "def find_signals(data):\n    import os\n    return data['Close'] > 0"),
    ("__import__", "def find_signals(data):\n    __import__('os').system('echo hi')\n    return data['Close'] > 0"),
    ("subclasses walk", "def find_signals(data):\n    x = ().__class__.__base__.__subclasses__()\n    return data['Close'] > 0"),
    ("builtins via class", "def find_signals(data):\n    return ''.__class__.__mro__[1].__subclasses__()"),
    ("generator frame walk", "def find_signals(data):\n    g = (i for i in [1])\n    return g.gi_frame.f_back.f_globals"),
    ("getattr escape", "def find_signals(data):\n    return getattr(data, 'to' + '_csv')('/tmp/x')"),
    ("eval", "def find_signals(data):\n    return eval(\"__import__('os').getcwd()\")"),
    ("exec", "def find_signals(data):\n    exec(\"x=1\")\n    return data['Close'] > 0"),
    ("open file", "def find_signals(data):\n    open('/etc/passwd').read()\n    return data['Close'] > 0"),
    ("pandas read_csv env", "def find_signals(data):\n    return data.read_csv('/proc/self/environ')"),
    ("dataframe to_csv write", "def find_signals(data):\n    data.to_csv('/tmp/leak.csv')\n    return data['Close'] > 0"),
    ("numpy ctypes", "def find_signals(data):\n    return data['Close'].values.ctypes"),
    ("dunder name", "def find_signals(data):\n    return __builtins__\n"),
    ("query engine", "def find_signals(data):\n    return data.query('Close > 0')"),
    ("no function", "x = 1 + 1"),
    ("lambda", "find_signals = lambda data: data['Close'] > 0"),  # Lambda node not allowed
    ("f-string", "def find_signals(data):\n    s = f'{data.__class__}'\n    return data['Close'] > 0"),
    # Arbitrary filesystem write / SSRF via pandas/Styler/matplotlib writers (review finding #3/#6).
    ("to_html write", "def find_signals(data):\n    data.to_html('/tmp/x.html')\n    return data['Close'] > 0"),
    ("to_xml ssrf", "def find_signals(data):\n    data.to_xml(stylesheet='http://127.0.0.1/x')\n    return data['Close'] > 0"),
    ("to_latex write", "def find_signals(data):\n    data.to_latex('/tmp/x.tex')\n    return data['Close'] > 0"),
    ("to_string buf", "def find_signals(data):\n    data.to_string('/tmp/x.txt')\n    return data['Close'] > 0"),
    ("to_pickle write", "def find_signals(data):\n    data.to_pickle('/tmp/x.pkl')\n    return data['Close'] > 0"),
    ("style.to_html", "def find_signals(data):\n    data.style.to_html('/tmp/x.html')\n    return data['Close'] > 0"),
    ("plot savefig", "def find_signals(data):\n    data['Close'].plot().get_figure().savefig('/tmp/x.png')\n    return data['Close'] > 0"),
]

# (label, code) — every one of these MUST run and yield a boolean Series.
LEGIT = [
    ("rsi threshold", "def find_signals(data):\n    return data['RSI_14'] < 30"),
    ("crossover", "def find_signals(data):\n    return (data['Close'] > data['SMA_50']) & (data['RSI_14'] < 70)"),
    ("rolling mean", "def find_signals(data):\n    ma = data['Close'].rolling(5).mean()\n    return data['Close'] > ma"),
    ("shift compare", "def find_signals(data):\n    return data['Close'] > data['Close'].shift(1)"),
    ("abs builtin", "def find_signals(data):\n    return abs(data['Close'] - data['SMA_50']) > 2"),
    ("to_numpy allowed", "def find_signals(data):\n    arr = data['Close'].to_numpy()\n    return data['Close'] > arr.mean()"),
    ("helper + loop", (
        "def find_signals(data):\n"
        "    out = data['Close'] > 0\n"
        "    for col in ['RSI_14']:\n"
        "        out = out & (data[col] < 75)\n"
        "    return out\n"
    )),
]


def main():
    failures = []

    for label, code in MALICIOUS:
        try:
            safe_execute_strategy(code, DATA.copy())
            failures.append(f"NOT BLOCKED: {label}")
        except Exception as e:
            print(f"  blocked  ✓  {label:<24} -> {type(e).__name__}: {str(e)[:60]}")

    for label, code in LEGIT:
        try:
            res = safe_execute_strategy(code, DATA.copy())
            assert isinstance(res, pd.Series), "result is not a Series"
            assert res.dtype == bool, f"result dtype is {res.dtype}, not bool"
            assert len(res) == len(DATA), "result length mismatch"
            print(f"  ran      ✓  {label:<24} -> {int(res.sum())}/{len(res)} signals")
        except Exception as e:
            failures.append(f"LEGIT FAILED: {label} -> {type(e).__name__}: {e}")

    # Runtime DoS: an infinite loop must be killed by the wall-clock timeout (review finding #5).
    try:
        safe_execute_strategy("def find_signals(data):\n    while True:\n        pass\n    return data['Close'] > 0", DATA.copy(), seconds=3)
        failures.append("NOT TERMINATED: infinite loop")
    except TimeoutError as e:
        print(f"  killed   ✓  {'infinite loop (timeout)':<24} -> {type(e).__name__}")
    except Exception as e:
        print(f"  killed   ✓  {'infinite loop':<24} -> {type(e).__name__}: {str(e)[:50]}")

    print()
    if failures:
        print(f"FAILED ({len(failures)}):")
        for f in failures:
            print("  -", f)
        raise SystemExit(1)
    print(f"All {len(MALICIOUS)} escapes blocked and all {len(LEGIT)} legit strategies ran. ✅")


if __name__ == "__main__":
    main()
