#!/usr/bin/env python3
"""
PatternIQ Code Navigator generator.

Scans the repository and emits a single self-contained `CODE_NAVIGATOR.html`
at the repo root: a searchable map of every API endpoint, Python function/class,
and React component with its file + line number, plus flags for suspicious
"fake/mock/TODO/exec" lines.

Usage (from anywhere):
    python tools/generate_navigator.py

Re-run this whenever the code changes to keep the navigator in sync.
Standard library only — no dependencies.
"""

from __future__ import annotations

import ast
import json
import re
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "CODE_NAVIGATOR.html"

# Directories we never descend into.
SKIP_DIRS = {
    "node_modules", ".git", "dist", "build", ".vite", "__pycache__",
    "venv", ".venv", "env", "coverage", ".next", ".idea", ".vscode",
    "assets", "public", ".turbo", "out",
}
SOURCE_EXTS = {".py", ".js", ".jsx", ".ts", ".tsx"}
LANG = {".py": "Python", ".js": "JavaScript", ".jsx": "React",
        ".ts": "TypeScript", ".tsx": "React TS"}

# --- Symbol patterns -------------------------------------------------------
RE_PY_ROUTE = re.compile(r'@(?:app|router)\.(get|post|put|delete|patch)\(\s*["\']([^"\']+)["\']')
RE_PY_DEF = re.compile(r'^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(')
RE_PY_CLASS = re.compile(r'^\s*class\s+([A-Za-z_]\w*)')

RE_JS_FUNC = re.compile(r'^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_]\w*)')
RE_JS_CONST = re.compile(r'^\s*(?:export\s+)?(?:default\s+)?const\s+([A-Za-z_]\w*)\s*=\s*'
                         r'(?:React\.)?(?:async\s+)?(?:\([^)]*\)|[A-Za-z_]\w*)\s*=>')
RE_JS_CLASS = re.compile(r'^\s*(?:export\s+)?(?:default\s+)?class\s+([A-Za-z_]\w*)')
RE_JS_DEFAULT_FN = re.compile(r'^\s*export\s+default\s+function\s*([A-Za-z_]\w*)?')
RE_API_CALL = re.compile(r'(?:axios|fetch)\s*\.?\s*(get|post|put|delete|patch)?\s*\(\s*`?[^`"\')]*?(/api/[A-Za-z0-9/_${}.:-]+)')
RE_API_STR = re.compile(r'["\'`](/api/[A-Za-z0-9/_${}.:-]+)')

# --- "Fake / risky" flag patterns (curated to avoid UI-placeholder noise) ---
FLAG_PATTERNS = [
    (re.compile(r'\bexec\s*\(', re.I), "exec", "Arbitrary code execution"),
    (re.compile(r'Math\.random', re.I), "random", "Math.random()"),
    (re.compile(r'\bFALLBACK_[A-Z]', ), "fallback", "Hardcoded fallback data"),
    (re.compile(r'\bmock\b', re.I), "mock", "Mock data"),
    (re.compile(r'\bdummy\b', re.I), "mock", "Dummy data"),
    (re.compile(r'\bfake\b', re.I), "mock", "Fake data"),
    (re.compile(r'\bhardcod', re.I), "mock", "Hardcoded"),
    (re.compile(r'static scenario', re.I), "mock", "Static scenario"),
    (re.compile(r'\bTODO\b'), "todo", "TODO"),
    (re.compile(r'\bFIXME\b'), "todo", "FIXME"),
    (re.compile(r'\bsetTimeout\b'), "timer", "setTimeout (possible simulated delay)"),
]

TYPE_META = {
    "endpoint":  {"label": "Endpoint",  "rank": 0},
    "component": {"label": "Component", "rank": 1},
    "function":  {"label": "Function",  "rank": 2},
    "class":     {"label": "Class",     "rank": 3},
    "api-call":  {"label": "API Call",  "rank": 4},
    "flag":      {"label": "Flag",      "rank": 5},
}


def rel(p: Path) -> str:
    return p.relative_to(ROOT).as_posix()


SELF = Path(__file__).resolve()


def iter_source_files():
    for p in sorted(ROOT.rglob("*")):
        if not p.is_file() or p.suffix not in SOURCE_EXTS:
            continue
        if p.resolve() == SELF:  # don't flag the generator's own regex literals
            continue
        if any(part in SKIP_DIRS for part in p.relative_to(ROOT).parts):
            continue
        yield p


def is_component_name(name: str) -> bool:
    """PascalCase const/function in a React file is treated as a component."""
    return bool(name) and name[0].isupper()


def humanize(name: str) -> str:
    """Turn an identifier into a readable gloss: getDailyQuiz → 'Get daily quiz'."""
    s = re.sub(r"[_\-]+", " ", name)
    s = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", s)        # camelCase boundary
    s = re.sub(r"(?<=[A-Z])(?=[A-Z][a-z])", " ", s)      # ACRONYMWord boundary
    s = re.sub(r"\s+", " ", s).strip().lower()
    return (s[:1].upper() + s[1:]) if s else name


def py_docstrings(text: str) -> dict:
    """{lineno: first docstring line} for every def/class, keyed by both the def line
    and its decorator lines (so route endpoints recorded at the decorator pick it up)."""
    out = {}
    try:
        tree = ast.parse(text)
    except SyntaxError:
        return out
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            doc = ast.get_docstring(node)
            first = doc.strip().splitlines()[0].strip() if doc else ""
            if first:
                out[node.lineno] = first
            for dec in getattr(node, "decorator_list", []):
                # Decorated handlers (e.g. @app routes) get the docstring, or a humanized
                # fallback, so the endpoint symbol always describes itself.
                out[getattr(dec, "lineno", node.lineno)] = first or humanize(node.name)
    return out


def js_leading_comment(lines, idx: int):
    """Comment (// run or /* */ block / JSDoc) immediately above a 1-based symbol line."""
    j = idx - 2
    while j >= 0 and lines[j].strip() == "":
        j -= 1
    if j < 0:
        return None
    s = lines[j].strip()
    text = None
    if s.startswith("//"):
        buf = []
        while j >= 0 and lines[j].strip().startswith("//"):
            buf.insert(0, lines[j].strip().lstrip("/").strip())
            j -= 1
        text = " ".join(x for x in buf if x)
    elif s.endswith("*/"):
        buf = []
        while j >= 0:
            t = lines[j].strip()
            buf.insert(0, t)
            if t.startswith("/*"):
                break
            j -= 1
        text = re.sub(r"\s+", " ", " ".join(buf).replace("/**", "").replace("/*", "").replace("*/", "").replace("*", " ")).strip()
    if not text:
        return None
    # Drop decorative dividers (── ──, ===, etc.) with too few real words.
    if len(re.findall(r"[A-Za-z]{2,}", text)) < 2:
        return None
    return text[:160]


def extract(path: Path):
    """Return (symbols, flags, line_count) for one file."""
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()
    ext = path.suffix
    rpath = rel(path)
    symbols, flags = [], []
    seen_api = set()

    for i, line in enumerate(lines, start=1):
        # ---- Python ----
        if ext == ".py":
            m = RE_PY_ROUTE.search(line)
            if m:
                symbols.append({"type": "endpoint", "name": f"{m.group(1).upper()} {m.group(2)}",
                                "file": rpath, "line": i, "sig": line.strip()})
            m = RE_PY_CLASS.match(line)
            if m:
                symbols.append({"type": "class", "name": m.group(1),
                                "file": rpath, "line": i, "sig": line.strip()})
            m = RE_PY_DEF.match(line)
            if m:
                symbols.append({"type": "function", "name": m.group(1),
                                "file": rpath, "line": i, "sig": line.strip()[:120]})

        # ---- JS / TS / React ----
        else:
            name = None
            m = RE_JS_DEFAULT_FN.match(line)
            if m and m.group(1):
                name = m.group(1)
            if not name:
                m = RE_JS_FUNC.match(line)
                if m:
                    name = m.group(1)
            if not name:
                m = RE_JS_CONST.match(line)
                if m:
                    name = m.group(1)
            if name:
                t = "component" if (ext in (".jsx", ".tsx") and is_component_name(name)) else "function"
                symbols.append({"type": t, "name": name, "file": rpath, "line": i, "sig": line.strip()[:120]})
            else:
                m = RE_JS_CLASS.match(line)
                if m:
                    symbols.append({"type": "class", "name": m.group(1),
                                    "file": rpath, "line": i, "sig": line.strip()[:120]})

            # API calls (frontend -> backend mapping)
            for rx in (RE_API_CALL, RE_API_STR):
                for am in rx.finditer(line):
                    url = am.group(am.lastindex)
                    if url.startswith("/api/") and url not in seen_api:
                        seen_api.add(url)
                        symbols.append({"type": "api-call", "name": url,
                                        "file": rpath, "line": i, "sig": line.strip()[:120]})

        # ---- Flags (any language) ----
        for rx, cat, label in FLAG_PATTERNS:
            if rx.search(line):
                flags.append({"type": "flag", "cat": cat, "name": label,
                              "file": rpath, "line": i, "sig": line.strip()[:160]})

    # ---- Describe each symbol: docstring / leading comment, else humanized name ----
    docs = py_docstrings(text) if ext == ".py" else {}
    for s in symbols:
        if s["type"] == "api-call":
            s["desc"] = ""
            continue
        d = docs.get(s["line"], "") if ext == ".py" else (js_leading_comment(lines, s["line"]) or "")
        if not d and s["type"] != "endpoint":   # endpoints fall back to their route+method line
            d = humanize(s["name"])
        s["desc"] = d

    return symbols, flags, len(lines)


# --------------------------------------------------------------------------
# Feature / architecture map. Mostly auto-derived: backend endpoints + the
# services each touches (from an AST scan of main.py), frontend api-call URLs
# matched to routes, and cross-feature links. The feature groupings + one-line
# descriptions below are curated; everything else regenerates from the code.
# --------------------------------------------------------------------------
SERVICE_MARKERS = [
    (("yf.", "fetch_prices_and_vol", "analyze_index_data", "build_portfolio", "scan_stocks_for_anomalies"), "Market Data (yfinance)"),
    (("call_openrouter", "generate_weekly_scenario"), "AI (OpenRouter)"),
    (("db.collection", "firestore", "get_broker_connection"), "Firestore"),
    (("safe_execute_strategy",), "Strategy Sandbox"),
    (("fetch_kite_holdings", "KITE_", "/api/broker/kite"), "Zerodha Kite"),
]

FEATURES = [
    {"key": "auth", "title": "Auth & Profile", "color": "#5b9dff",
     "what": "Google / email-password sign-in (Firebase) with email verification and forgot-password, plus per-user profile creation.",
     "prefixes": ["/api/users/profile"],
     "components": ["App.jsx", "LoginPage.jsx", "AccountSettings.jsx"],
     "extraServices": ["Firebase Auth", "Firestore"]},
    {"key": "backtest", "title": "AI Backtesting", "color": "#0EA5FF",
     "what": "User describes a strategy in plain English (or uploads Python); the AI parses it, a sandbox runs the signals over historical data, and the AI explains the results.",
     "prefixes": ["/api/backtest"],
     "components": ["BacktestDashboard.jsx", "Dashboard.jsx"]},
    {"key": "scanner", "title": "Anomaly Scanner", "color": "#00E5CC",
     "what": "Scans an index for volume spikes, breakouts, RSI extremes and MACD crosses; live alerts stream from Firestore (falls back to clearly-labelled sample data).",
     "prefixes": ["/api/scan-anomalies"],
     "components": ["AnomalyScanner.jsx"]},
    {"key": "arena", "title": "Arena (Quiz)", "color": "#7C6FFF",
     "what": "AI-generated daily quizzes by difficulty tier, scoring, a live leaderboard and per-user history.",
     "prefixes": ["/api/arena"],
     "components": ["Arena.jsx"]},
    {"key": "community", "title": "Community Hub", "color": "#3ad0c0",
     "what": "Discussion + shared-strategy feed with tag search and up/down votes.",
     "prefixes": ["/api/community"],
     "components": ["CommunityHub.jsx"]},
    {"key": "debrief", "title": "Weekly Debrief", "color": "#ffb454",
     "what": "A fresh AI-generated macro scenario each ISO week; users post a stance and vote on others. Analyses are scoped per week.",
     "prefixes": ["/api/debrief"],
     "components": ["WeeklyDebrief.jsx", "CommunityHub.jsx"]},
    {"key": "calendar", "title": "Traders' Calendar", "color": "#00E676",
     "what": "AI-generated market events (cached daily) plus the user's personal events (full CRUD).",
     "prefixes": ["/api/calendar"],
     "components": ["TradersCalendar.jsx", "AddEditEventModal.jsx"]},
    {"key": "portfolio", "title": "Portfolio & Broker", "color": "#FF5F5F",
     "what": "Manual holdings or a live Zerodha Kite import, priced via yfinance, with computed P&L, sector allocation and a real risk score; AI risk audit.",
     "prefixes": ["/api/get-portfolio", "/api/portfolio", "/api/broker"],
     "components": ["Portfolio.jsx"]},
    {"key": "strategies", "title": "Saved Strategies", "color": "#9aa7bd",
     "what": "Persist full backtest results per user and revisit them later.",
     "prefixes": ["/api/user/strategies"],
     "components": ["AccountSettings.jsx", "BacktestDashboard.jsx"]},
]


def analyze_backend_endpoints():
    """AST-scan backend/main.py → {route: {method, line, fn, services[]}}."""
    path = ROOT / "backend" / "main.py"
    if not path.exists():
        return {}
    src = path.read_text(encoding="utf-8", errors="replace")
    lines = src.splitlines()
    try:
        tree = ast.parse(src)
    except SyntaxError:
        return {}
    out = []  # list, not dict — PUT and DELETE can share a path
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for dec in node.decorator_list:
            if (isinstance(dec, ast.Call) and isinstance(dec.func, ast.Attribute)
                    and isinstance(dec.func.value, ast.Name) and dec.func.value.id in ("app", "router")
                    and dec.args and isinstance(dec.args[0], ast.Constant)
                    and isinstance(dec.args[0].value, str)):
                route = dec.args[0].value
                end = getattr(node, "end_lineno", node.lineno)
                body = "\n".join(lines[node.lineno - 1:end])
                services = []
                for markers, name in SERVICE_MARKERS:
                    if any(m in body for m in markers) and name not in services:
                        services.append(name)
                out.append({"route": route, "method": dec.func.attr.upper(),
                            "line": node.lineno, "fn": node.name, "services": services})
    return out


def _norm_url(u):
    parts = []
    for s in u.split("?")[0].split("/"):
        parts.append("*" if (s.startswith("{") or s.startswith(":") or "${" in s) else s)
    return "/".join(parts).rstrip("/") or "/"


def build_feature_map(symbols, files_meta):
    endpoints = analyze_backend_endpoints()
    calls = [e for e in symbols if e["type"] == "api-call"]

    norm_to_route = {}
    for ep in endpoints:
        norm_to_route.setdefault(_norm_url(ep["route"]), ep["route"])

    def match_route(url):
        n = _norm_url(url)
        if n in norm_to_route:
            return norm_to_route[n]
        for rn, r in norm_to_route.items():
            if n.startswith(rn) or rn.startswith(n):
                return r
        return None

    def basename(p):
        return p.rsplit("/", 1)[-1]

    def find_file(bn):
        for f in files_meta:
            if f["file"].endswith("/" + bn) or f["file"] == bn:
                return f["file"]
        return None

    def feature_of_route(route):
        best, best_len = None, -1
        for feat in FEATURES:
            for pre in feat["prefixes"]:
                if (route == pre or route.startswith(pre + "/") or route.startswith(pre)) and len(pre) > best_len:
                    best, best_len = feat["key"], len(pre)
        return best

    home = {}
    for feat in FEATURES:
        for c in feat["components"]:
            home.setdefault(c, feat["key"])

    feat_by_key = {f["key"]: f for f in FEATURES}
    result = {f["key"]: {"key": f["key"], "title": f["title"], "color": f["color"],
                         "what": f["what"], "components": [], "endpoints": [],
                         "services": list(f.get("extraServices", [])), "connectsTo": []}
              for f in FEATURES}

    for ep in sorted(endpoints, key=lambda e: (e["route"], e["method"])):
        fk = feature_of_route(ep["route"])
        if not fk:
            continue
        result[fk]["endpoints"].append({"route": ep["route"], "method": ep["method"],
                                        "line": ep["line"], "file": "backend/main.py",
                                        "services": ep["services"]})
        for s in ep["services"]:
            if s not in result[fk]["services"]:
                result[fk]["services"].append(s)

    for feat in FEATURES:
        for c in feat["components"]:
            result[feat["key"]]["components"].append({"name": c, "file": find_file(c)})

    method_of = {}
    for ep in endpoints:
        method_of.setdefault(ep["route"], ep["method"])

    # Directed edge A→B = a component whose home feature is A calls an endpoint of feature B,
    # recording HOW (which component, via which METHOD + route).
    edge_via = {}
    for c in calls:
        route = match_route(c.get("name", ""))
        if not route:
            continue
        target = feature_of_route(route)
        src = home.get(basename(c["file"]))
        if not (src and target and src != target):
            continue
        via = {"component": basename(c["file"]), "method": method_of.get(route, ""), "route": route}
        bucket = edge_via.setdefault((src, target), [])
        if via not in bucket:
            bucket.append(via)

    for (a, b), via in sorted(edge_via.items()):
        result[a]["connectsTo"].append({"key": b, "title": feat_by_key[b]["title"], "via": via})

    connections = [{
        "from": a, "fromTitle": feat_by_key[a]["title"], "fromColor": feat_by_key[a]["color"],
        "to": b, "toTitle": feat_by_key[b]["title"], "via": via,
    } for (a, b), via in sorted(edge_via.items())]

    return [result[f["key"]] for f in FEATURES], connections


def build():
    all_symbols, all_flags = [], []
    files_meta = []
    for path in iter_source_files():
        syms, flags, n = extract(path)
        all_symbols.extend(syms)
        all_flags.extend(flags)
        files_meta.append({"file": rel(path), "lang": LANG.get(path.suffix, path.suffix),
                           "lines": n, "symbols": len(syms), "flags": len(flags)})

    entries = all_symbols + all_flags
    counts = {}
    for e in entries:
        counts[e["type"]] = counts.get(e["type"], 0) + 1

    feature_map, connections = build_feature_map(all_symbols, sorted(files_meta, key=lambda f: f["file"]))

    data = {
        "generatedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "root": ROOT.as_posix(),
        "entries": entries,
        "files": sorted(files_meta, key=lambda f: f["file"]),
        "counts": counts,
        "totals": {
            "files": len(files_meta),
            "symbols": len(all_symbols),
            "flags": len(all_flags),
            "lines": sum(f["lines"] for f in files_meta),
        },
        "typeMeta": TYPE_META,
        "featureMap": feature_map,
        "connections": connections,
    }
    OUT.write_text(HTML.replace("__DATA__", json.dumps(data)), encoding="utf-8")
    print(f"Wrote {rel(OUT)}")
    print(f"  files={data['totals']['files']} symbols={data['totals']['symbols']} "
          f"flags={data['totals']['flags']} lines={data['totals']['lines']}")


# --------------------------------------------------------------------------
# Self-contained HTML template. `__DATA__` is replaced with the JSON payload.
# --------------------------------------------------------------------------
HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>PatternIQ — Code Navigator</title>
<style>
  :root{
    --bg:#0a0f1a; --panel:#0f1626; --panel2:#131c30; --border:#1d2840;
    --txt:#e6edf7; --muted:#8aa0c0; --accent:#0EA5FF; --teal:#00E5CC;
    --violet:#7C6FFF; --red:#FF5F5F; --green:#00E676; --amber:#ffb454;
  }
  *{box-sizing:border-box}
  html,body{margin:0;height:100%}
  body{background:var(--bg);color:var(--txt);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  a{color:inherit;text-decoration:none}
  header{padding:18px 22px;border-bottom:1px solid var(--border);background:linear-gradient(180deg,#0d1424,#0a0f1a)}
  h1{margin:0;font-size:18px;letter-spacing:.3px}
  h1 .iq{color:var(--accent)}
  .sub{color:var(--muted);font-size:12px;margin-top:3px}
  .totals{margin-top:10px;display:flex;gap:18px;flex-wrap:wrap;color:var(--muted);font-size:12px}
  .totals b{color:var(--txt)}
  .searchbar{margin-top:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  #q{flex:1;min-width:260px;background:var(--panel2);border:1px solid var(--border);border-radius:10px;
     padding:11px 14px;color:var(--txt);font-size:14px;outline:none}
  #q:focus{border-color:var(--accent);box-shadow:0 0 0 2px rgba(14,165,255,.18)}
  .chips{display:flex;gap:6px;flex-wrap:wrap}
  .chip{padding:6px 11px;border-radius:999px;border:1px solid var(--border);background:var(--panel2);
        color:var(--muted);cursor:pointer;font-size:12px;user-select:none}
  .chip.on{color:#021018;font-weight:600}
  .chip[data-t="endpoint"].on{background:var(--accent);border-color:var(--accent)}
  .chip[data-t="component"].on{background:var(--teal);border-color:var(--teal)}
  .chip[data-t="function"].on{background:var(--violet);border-color:var(--violet);color:#fff}
  .chip[data-t="class"].on{background:#5b9dff;border-color:#5b9dff;color:#fff}
  .chip[data-t="api-call"].on{background:#3ad0c0;border-color:#3ad0c0}
  .chip[data-t="flag"].on{background:var(--red);border-color:var(--red);color:#fff}
  main{display:grid;grid-template-columns:300px 1fr;height:calc(100vh - 197px)}
  .side{border-right:1px solid var(--border);overflow:auto;padding:10px}
  .side h3{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin:8px 8px 6px}
  .frow{display:flex;justify-content:space-between;gap:8px;padding:7px 9px;border-radius:8px;cursor:pointer;font-size:12.5px}
  .frow:hover{background:var(--panel2)}
  .frow.on{background:rgba(14,165,255,.14);outline:1px solid var(--accent)}
  .frow .fname{color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .frow .fmeta{color:var(--muted);flex:none}
  .frow .dot{color:var(--red)}
  .list{overflow:auto;padding:8px 10px}
  .grp{margin-bottom:14px}
  .grp-h{position:sticky;top:0;background:var(--bg);padding:8px 6px;display:flex;justify-content:space-between;
         align-items:center;border-bottom:1px solid var(--border);z-index:2}
  .grp-h .gf{color:var(--accent);font-weight:600;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px}
  .grp-h .gc{color:var(--muted);font-size:11.5px}
  .item{display:grid;grid-template-columns:96px 1fr auto;gap:12px;align-items:baseline;padding:7px 8px;border-radius:8px}
  .item:hover{background:var(--panel2)}
  .badge{font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;text-align:center;border-radius:6px;
         padding:3px 0;font-weight:700;color:#02101a}
  .b-endpoint{background:var(--accent)} .b-component{background:var(--teal)}
  .b-function{background:var(--violet);color:#fff} .b-class{background:#5b9dff;color:#fff}
  .b-api-call{background:#3ad0c0} .b-flag{background:var(--red);color:#fff}
  .nm{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;word-break:break-word}
  .nm .sig{display:block;color:var(--muted);font-size:11.5px;margin-top:2px;font-family:inherit}
  .ln{color:var(--muted);font-size:12px;white-space:nowrap;font-family:ui-monospace,monospace}
  .ln b{color:var(--amber)}
  mark{background:rgba(255,180,84,.32);color:var(--txt);border-radius:3px}
  .empty{color:var(--muted);text-align:center;padding:60px 20px}
  .hint{color:var(--muted);font-size:11px;margin-left:auto}
  kbd{background:var(--panel2);border:1px solid var(--border);border-bottom-width:2px;border-radius:4px;padding:1px 6px;font-size:11px}
  ::-webkit-scrollbar{width:10px;height:10px}
  ::-webkit-scrollbar-thumb{background:#1f2c46;border-radius:6px}
  /* ---- view toggle + feature map ---- */
  .viewtoggle{margin-top:12px;display:inline-flex}
  .vbtn{padding:6px 16px;border:1px solid var(--border);background:var(--panel2);color:var(--muted);
        cursor:pointer;font-size:12.5px;font-weight:600;user-select:none}
  .vbtn:first-child{border-radius:8px 0 0 8px}
  .vbtn:last-child{border-radius:0 8px 8px 0;border-left:0}
  .vbtn.on{background:var(--accent);color:#021018;border-color:var(--accent)}
  body.mapmode main{display:none}
  body.mapmode .searchbar{display:none}
  body:not(.mapmode) #mapview{display:none}
  #mapview{height:calc(100vh - 197px);overflow:auto;padding:18px 22px}
  .legend{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px;color:var(--muted);font-size:12px;align-items:center}
  .fgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(440px,1fr));gap:16px}
  .fcard{background:var(--panel);border:1px solid var(--border);border-left:4px solid var(--accent);
         border-radius:12px;padding:16px 18px;transition:outline .2s}
  .fcard h3{margin:0 0 5px;font-size:15.5px}
  .fcard .what{color:var(--muted);font-size:12.5px;margin-bottom:14px;line-height:1.55}
  .flow{display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap;margin-bottom:9px}
  .flow .lane{font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:var(--muted);
              width:66px;flex:none;padding-top:5px}
  .flowchips{display:flex;gap:6px;flex-wrap:wrap;flex:1}
  .mchip{padding:4px 9px;border-radius:7px;font-size:11.5px;border:1px solid var(--border);
         background:var(--panel2);color:var(--muted);white-space:nowrap}
  .mchip.comp{cursor:pointer;color:var(--teal);border-color:rgba(0,229,204,.3)}
  .mchip.comp:hover{background:rgba(0,229,204,.12)}
  .mchip.ep{cursor:pointer;color:var(--accent);border-color:rgba(14,165,255,.3);font-family:ui-monospace,monospace}
  .mchip.ep:hover{background:rgba(14,165,255,.12)}
  .mchip.svc.s-ai{color:#ffb454;border-color:rgba(255,180,84,.3)}
  .mchip.svc.s-fs{color:#7C6FFF;border-color:rgba(124,111,255,.3)}
  .mchip.svc.s-yf{color:#00E676;border-color:rgba(0,230,118,.3)}
  .mchip.svc.s-kite{color:#FF5F5F;border-color:rgba(255,95,95,.3)}
  .mchip.svc.s-auth{color:#5b9dff;border-color:rgba(91,157,255,.3)}
  .mchip.svc.s-sandbox{color:#00E5CC;border-color:rgba(0,229,204,.3)}
  .connects{margin-top:11px;padding-top:10px;border-top:1px dashed var(--border);font-size:12px;color:var(--muted)}
  .connects .mchip{cursor:pointer;color:var(--txt)}
  .connects .mchip:hover{border-color:var(--accent)}
  /* ---- connection matrix ---- */
  .msec{margin:26px 0 10px}
  .msec h2{font-size:15px;margin:0 0 2px}
  .msec .hintline{color:var(--muted);font-size:12px;margin-bottom:12px}
  .matrix{border-collapse:collapse;font-size:11.5px;margin-bottom:8px}
  .matrix th,.matrix td{border:1px solid var(--border);padding:6px 8px;text-align:center;min-width:30px}
  .matrix thead th{color:var(--muted);font-weight:700;font-family:ui-monospace,monospace;font-size:10.5px}
  .matrix tbody th{text-align:right;color:var(--txt);font-weight:600;white-space:nowrap;font-size:12px}
  .matrix td.diag{background:#0c1424;color:#33405a}
  .matrix td.hit{font-size:15px;cursor:help;font-weight:700}
  .matrix td.hit:hover{background:var(--panel2)}
  .connlist{margin-top:8px}
  .connrow{padding:8px 0;border-bottom:1px solid var(--border);font-size:12.5px;line-height:1.9}
  .connrow .arr{color:var(--muted);margin:0 6px}
</style>
</head>
<body>
<header>
  <h1>Pattern<span class="iq">IQ</span> · Code Navigator</h1>
  <div class="sub" id="meta"></div>
  <div class="totals" id="totals"></div>
  <div class="viewtoggle">
    <span class="vbtn on" id="vb-symbols">⌕ Symbols</span>
    <span class="vbtn" id="vb-map">⬡ Feature Map</span>
  </div>
  <div class="searchbar">
    <input id="q" placeholder="Search symbols, files, endpoints…  (e.g. backtest, /api/arena, exec, Portfolio)" autocomplete="off"/>
    <div class="chips" id="chips"></div>
    <span class="hint">Press <kbd>/</kbd> to search · <kbd>Esc</kbd> to clear</span>
  </div>
</header>
<main>
  <div class="side">
    <h3>Files</h3>
    <div id="files"></div>
  </div>
  <div class="list" id="results"></div>
</main>
<div id="mapview"></div>

<script id="data" type="application/json">__DATA__</script>
<script>
const DATA = JSON.parse(document.getElementById("data").textContent);
const TYPES = Object.keys(DATA.typeMeta);
const state = { q:"", types:new Set(TYPES), file:null };

// ---- header meta ----
document.getElementById("meta").textContent =
  `Generated ${DATA.generatedAt}  ·  root: ${DATA.root}`;
const t = DATA.totals;
document.getElementById("totals").innerHTML =
  `<span><b>${t.files}</b> files</span><span><b>${t.symbols}</b> symbols</span>`+
  `<span><b>${t.flags}</b> flags</span><span><b>${t.lines.toLocaleString()}</b> lines</span>`;

// ---- type chips ----
const chipsEl = document.getElementById("chips");
TYPES.forEach(tp=>{
  const c = DATA.counts[tp]||0;
  const el = document.createElement("span");
  el.className = "chip on"; el.dataset.t = tp;
  el.textContent = `${DATA.typeMeta[tp].label} ${c}`;
  el.onclick = ()=>{ el.classList.toggle("on");
    if(state.types.has(tp)) state.types.delete(tp); else state.types.add(tp);
    render(); };
  chipsEl.appendChild(el);
});

// ---- file sidebar ----
const filesEl = document.getElementById("files");
DATA.files.forEach(f=>{
  const row = document.createElement("div");
  row.className = "frow"; row.dataset.file = f.file;
  row.innerHTML = `<span class="fname" title="${f.file}">${f.file}</span>`+
    `<span class="fmeta">${f.symbols}${f.flags?` <span class="dot">⚑${f.flags}</span>`:""}</span>`;
  row.onclick = ()=>{
    state.file = (state.file===f.file)? null : f.file;
    [...filesEl.children].forEach(r=>r.classList.toggle("on", r.dataset.file===state.file));
    render();
  };
  filesEl.appendChild(row);
});

// ---- search ----
const qEl = document.getElementById("q");
qEl.addEventListener("input", e=>{ state.q = e.target.value.trim().toLowerCase(); render(); });
document.addEventListener("keydown", e=>{
  if(e.key==="/" && document.activeElement!==qEl){ e.preventDefault(); qEl.focus(); }
  if(e.key==="Escape"){ qEl.value=""; state.q=""; render(); qEl.blur(); }
});

function vscodeLink(e){
  // opens the exact file:line in VS Code when the html is opened locally
  return `vscode://file/${DATA.root}/${e.file}:${e.line}`;
}
function esc(s){ return s.replace(/[&<>]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }
function hl(s){
  if(!state.q) return esc(s);
  const i = s.toLowerCase().indexOf(state.q);
  if(i<0) return esc(s);
  return esc(s.slice(0,i))+"<mark>"+esc(s.slice(i,i+state.q.length))+"</mark>"+esc(s.slice(i+state.q.length));
}

function render(){
  const q = state.q;
  let rows = DATA.entries.filter(e=>{
    if(!state.types.has(e.type)) return false;
    if(state.file && e.file!==state.file) return false;
    if(q){
      const hay = (e.name+" "+e.file+" "+e.type+" "+(e.desc||"")+" "+(e.sig||"")).toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });

  // group by file, files in sidebar order; symbols by line
  const order = {}; DATA.files.forEach((f,i)=>order[f.file]=i);
  rows.sort((a,b)=> (order[a.file]-order[b.file]) || (a.line-b.line));

  const res = document.getElementById("results");
  if(!rows.length){
    res.innerHTML = `<div class="empty">No matches for “${esc(q)}”.<br>Try a different term or re-enable type filters.</div>`;
    return;
  }
  let html = "", cur = null;
  for(const e of rows){
    if(e.file!==cur){
      if(cur!==null) html += "</div>";
      cur = e.file;
      const fc = rows.filter(r=>r.file===cur).length;
      html += `<div class="grp"><div class="grp-h"><span class="gf">${esc(cur)}</span>`+
              `<span class="gc">${fc} item${fc>1?"s":""}</span></div>`;
    }
    const lbl = DATA.typeMeta[e.type].label;
    const extra = e.cat? ` · ${esc(e.name)}` : "";
    html += `<a class="item" href="${vscodeLink(e)}" title="Open ${esc(e.file)}:${e.line} in VS Code">`+
      `<span class="badge b-${e.type}">${lbl}</span>`+
      `<span class="nm">${hl(e.cat? e.sig : e.name)}`+
      (e.cat ? `<span class="sig">flag: ${esc(e.name)}</span>`
             : (e.desc ? `<span class="sig">${hl(e.desc)}</span>`
                       : (e.sig && e.type!=="api-call" ? `<span class="sig">${hl(e.sig)}</span>` : "")))+
      `</span>`+
      `<span class="ln">:<b>${e.line}</b></span></a>`;
  }
  html += "</div>";
  res.innerHTML = html;
}

// ---- view toggle (Symbols ⇄ Feature Map) ----
const vbS = document.getElementById("vb-symbols");
const vbM = document.getElementById("vb-map");
function setView(map){
  document.body.classList.toggle("mapmode", map);
  vbS.classList.toggle("on", !map);
  vbM.classList.toggle("on", map);
  if(map) renderMap();
}
vbS.onclick = ()=>setView(false);
vbM.onclick = ()=>setView(true);

// ---- feature map ----
const SVC_CLASS = {
  "AI (OpenRouter)":"s-ai", "Firestore":"s-fs", "Market Data (yfinance)":"s-yf",
  "Zerodha Kite":"s-kite", "Firebase Auth":"s-auth", "Strategy Sandbox":"s-sandbox"
};
let mapDone = false;
function renderMap(){
  if(mapDone) return; mapDone = true;
  const mv = document.getElementById("mapview");
  const fmap = DATA.featureMap || [];
  const legend = Object.keys(SVC_CLASS).map(s=>`<span class="mchip svc ${SVC_CLASS[s]}">${esc(s)}</span>`).join(" ");
  let html = `<div class="legend"><b style="color:var(--txt)">Data flow:</b> User → Frontend (React · Vercel) → API (FastAPI · Hugging Face) → Services. `+
             `Click a <span class="mchip comp">component</span> to jump to its code, or an <span class="mchip ep">endpoint</span> to open it in VS Code.</div>`;
  html += `<div class="legend">${legend}</div>`;
  html += `<div class="fgrid">`;
  for(const f of fmap){
    html += `<div class="fcard" data-key="${f.key}" style="border-left-color:${f.color}">`;
    html += `<h3 style="color:${f.color}">${esc(f.title)}</h3>`;
    html += `<div class="what">${esc(f.what)}</div>`;

    const comps = f.components.filter(c=>c.file);
    html += `<div class="flow"><span class="lane">Frontend</span><span class="flowchips">`+
      (comps.length ? comps.map(c=>`<span class="mchip comp" data-file="${esc(c.file)}">${esc(c.name)}</span>`).join("")
                    : `<span class="mchip">—</span>`)+`</span></div>`;

    html += `<div class="flow"><span class="lane">API</span><span class="flowchips">`+
      (f.endpoints.length ? f.endpoints.map(ep=>`<a class="mchip ep" href="${vscodeLink({file:ep.file,line:ep.line})}" title="${esc(ep.route)} — backend/main.py:${ep.line}">${ep.method} ${esc(ep.route.replace("/api/",""))}</a>`).join("")
                          : `<span class="mchip">no API · client-side only</span>`)+`</span></div>`;

    html += `<div class="flow"><span class="lane">Services</span><span class="flowchips">`+
      (f.services.length ? f.services.map(s=>`<span class="mchip svc ${SVC_CLASS[s]||''}">${esc(s)}</span>`).join("")
                         : `<span class="mchip">—</span>`)+`</span></div>`;

    if(f.connectsTo.length){
      html += `<div class="connects">Connects to: `+
        f.connectsTo.map(c=>`<span class="mchip" data-feat="${c.key}">${esc(c.title)} →</span>`).join(" ")+`</div>`;
    }
    html += `</div>`;
  }
  html += `</div>`;

  // ---- connection matrix (row → column) + readable "how" list ----
  const feats = fmap;
  const conn = DATA.connections || [];
  const cmap = {}; conn.forEach(c=>cmap[c.from+"|"+c.to]=c);
  const routeLine = {};
  feats.forEach(f=>f.endpoints.forEach(ep=>{ routeLine[ep.method+" "+ep.route]=ep.line; routeLine[ep.route]=ep.line; }));

  html += `<div class="msec"><h2>Connection matrix</h2>`+
          `<div class="hintline">Read as <b>row → column</b>: a ● means the row feature calls the column feature. Hover a ● to see how.</div>`;
  html += `<table class="matrix"><thead><tr><th></th>`+
          feats.map(f=>`<th title="${esc(f.title)}"><span style="color:${f.color}">${esc(f.key)}</span></th>`).join("")+
          `</tr></thead><tbody>`;
  for(const a of feats){
    html += `<tr><th style="color:${a.color}">${esc(a.title)}</th>`;
    for(const b of feats){
      if(a.key===b.key){ html += `<td class="diag">·</td>`; continue; }
      const c = cmap[a.key+"|"+b.key];
      if(c){
        const tip = c.via.map(v=>`${v.component}  ${v.method} ${v.route}`).join("\n");
        html += `<td class="hit" style="color:${a.color}" title="${esc(a.title)} → ${esc(b.title)}\n${esc(tip)}">●</td>`;
      } else { html += `<td></td>`; }
    }
    html += `</tr>`;
  }
  html += `</tbody></table>`;

  html += `<div class="connlist"><h2 style="font-size:14px;margin:16px 0 6px">How they connect</h2>`;
  if(conn.length){
    for(const c of conn){
      html += `<div class="connrow"><b style="color:${c.fromColor}">${esc(c.fromTitle)}</b>`+
        `<span class="arr">→</span><b>${esc(c.toTitle)}</b><span class="arr">via</span>`+
        c.via.map(v=>{
          const ln = routeLine[v.method+" "+v.route] || routeLine[v.route] || 1;
          return `<a class="mchip ep" href="${vscodeLink({file:'backend/main.py',line:ln})}" title="open backend/main.py:${ln}">${esc(v.component)} · ${v.method} ${esc(v.route.replace('/api/',''))}</a>`;
        }).join(" ")+`</div>`;
    }
  } else { html += `<div class="connrow">No cross-feature calls detected.</div>`; }
  html += `</div></div>`;

  mv.innerHTML = html;

  // component chip → filter the Symbols view to that file
  mv.querySelectorAll(".mchip.comp[data-file]").forEach(el=>el.onclick=()=>{
    state.file = el.dataset.file;
    [...filesEl.children].forEach(r=>{
      const on = r.dataset.file===state.file;
      r.classList.toggle("on", on);
      if(on) r.scrollIntoView({block:"center"});
    });
    setView(false); render();
  });
  // "connects to" chip → scroll to that feature card
  mv.querySelectorAll(".mchip[data-feat]").forEach(el=>el.onclick=()=>{
    const card = mv.querySelector(`.fcard[data-key="${el.dataset.feat}"]`);
    if(card){ card.scrollIntoView({behavior:"smooth",block:"center"});
      card.style.outline=`2px solid var(--accent)`; setTimeout(()=>card.style.outline="",1200); }
  });
}

render();
</script>
</body>
</html>
"""

if __name__ == "__main__":
    build()
