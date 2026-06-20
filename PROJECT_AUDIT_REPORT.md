# PatternIQ — "What's Faked" Audit & Enhancement Report

> Generated 2026-06-20. Scope: full repo (`backend/main.py` + `frontend/src/**`).
> Companion artifact: open **`CODE_NAVIGATOR.html`** for a searchable map of every file / symbol / line.

---

## 0. Status update — fixes applied (2026-06-20)

The items below were implemented after this report and verified (backend compiles, frontend builds, sandbox has an adversarial test suite — 24 escape attempts blocked, 7 legit strategies pass, infinite-loop killed by timeout):

| Was | Now |
|---|---|
| 🚨 `exec(code, globals(), …)` RCE in backtester | Replaced by `backend/strategy_sandbox.py`: AST allowlist, minimal `__builtins__`, no app globals/modules, attribute prefix-block (`to_/read_/from_` + render/plot writers) — closes filesystem-write/SSRF — run in an **isolated subprocess** with wall-clock timeout + CPU/mem rlimits, offloaded via `run_in_threadpool`. Tests in `backend/test_strategy_sandbox.py`. |
| Portfolio = hardcoded mock ("Zerodha (Mock)") | Real: manual holdings in Firestore (`/api/portfolio/holdings` CRUD) + live yfinance prices + **computed** risk (sector concentration, position weight, weighted volatility). |
| No broker integration | **Zerodha Kite Connect** connector, env-gated (`KITE_API_KEY`/`KITE_API_SECRET`): `login-url` → `connect` (server-side checksum, secret never leaves server) → holdings import; `disconnect`/`status`. |
| Weekly Debrief = one static scenario | AI-generated scenario **rotating per ISO week**, cached in Firestore; community analyses scoped to each week (feed resets weekly). |
| Anomaly fallback shown as a "live scan" | Honest amber **"Sample data — not live market data"** notice; misleading TypingEffect banner removed. |
| Portfolio "Risk Status: Moderate" hardcoded | Driven by the backend `risk` object (Low/Moderate/High + detail). |
| CORS dead glob `https://*.vercel.app` | `allow_origin_regex` (Starlette has no glob). |

Also fixed from an adversarial code review: single-holding price bug (yfinance MultiIndex), delete/upsert `.NS` mismatch, React StrictMode double-POST of the one-time Kite `request_token`, P&L color at exactly 0, and URL-encoding of delete paths (e.g. `M&M`).

### ⚠️ #1 remaining item — endpoint authentication (NOT yet fixed)
No endpoint verifies identity: `user_id` is taken from the URL/body and trusted directly. Anyone can read/modify another user's holdings or connect/disconnect their broker by supplying a different `user_id`. This is **pre-existing across the whole API**, not introduced here, and fixing it is a cross-cutting change (verify the Firebase ID token on every request via a `Depends`, derive `user_id` from it, and send the token from every frontend `axios` call). Recommended as the next dedicated pass — especially now that the broker endpoints touch real brokerage sessions. See §3.4.

---

## 1. Executive Summary

PatternIQ is **more real than most hackathon projects** — the backtesting engine, anomaly scanner, AI quiz/Arena, community hub, calendar, and Firebase auth are genuinely wired to live data (yfinance), an LLM (OpenRouter / Gemini), and Firestore. It is **not** a clickable mockup.

However, several headline features are **faked, stubbed, or decorative**, and one "real" feature contains a **critical remote-code-execution hole**. The gap between what the landing page *claims* and what the code *does* is the main credibility risk.

### Verdict table

| Area | Verdict | Evidence |
|---|---|---|
| Backtesting engine | ✅ Real (but unsafe + simplistic) | `backend/main.py:276-471` |
| Anomaly scan compute | ✅ Real | `backend/main.py:90-236` |
| Arena quizzes / leaderboard | ✅ Real (AI + Firestore) | `backend/main.py:915-1046` |
| Community hub / debrief submit | ✅ Real (Firestore) | `backend/main.py:652-724` |
| Calendar (AI + user events) | ✅ Real | `backend/main.py:800-888` |
| Auth (Google + Firebase) | ✅ Real | `frontend/src/App.jsx`, `firebase.js` |
| **Portfolio / "broker sync"** | 🔴 **Faked** (hardcoded holdings) | `backend/main.py:507-550` |
| **Weekly Debrief scenario** | 🟠 Faked (static, never rotates) | `backend/main.py:580-589` |
| **Anomaly charts on empty/error** | 🟠 Faked fallback data | `AnomalyScanner.jsx:31-63, 435` |
| **Portfolio "Risk Status"** | 🟠 Faked (hardcoded "Moderate") | `Portfolio.jsx:110-115` |
| **Landing stats (5,200 traders…)** | 🔴 Faked marketing numbers | `StatsSection.tsx:4-11` |
| **Landing testimonials** | 🔴 Fabricated people/quotes | `TestimonialsSection.tsx:4-11` |
| **Pricing plans / limits** | 🟠 Decorative (no payments, no enforcement) | `PricingSection.tsx:5-33, 66` |

Severity legend: 🔴 misleads the user/judge about a core capability · 🟠 cosmetic or fallback fakery.

---

## 2. What Is Faked (in detail)

### 2.1 🔴 Portfolio "broker sync" is 100% mock
`backend/main.py:507-550` — `GET /api/get-portfolio/{user_id}` ignores `user_id` entirely and returns the **same five hardcoded holdings** for everyone. The code itself is honest about it:

```python
# Simulated mock broker data (In a real app, this would hit the Zerodha/Upstox API)
holdings = [ {"symbol": "RELIANCE", "quantity": 50, "avg_price": 2800.00, ...}, ... ]
...
"broker": "Zerodha (Mock)",
"status": "Connected",
```

The UI then renders `"Connected"` and a Zerodha-style P&L screen (`Portfolio.jsx`), which reads to a user as a real linked brokerage account. **`current_price` is also hardcoded** (line 511-515) — the P&L never moves.

### 2.2 🟠 Portfolio "Risk Status" is a hardcoded label
`Portfolio.jsx:110-115` — the third KPI card always says `value="Moderate"` / `subtext="Based on Sector Volatility"`, regardless of the actual (mock) portfolio. Nothing computes it.

### 2.3 🟠 Anomaly Scanner shows fabricated charts when there's no live data
`AnomalyScanner.jsx:31-63` defines `FALLBACK_SCATTER`, `FALLBACK_RSI`, `FALLBACK_DISTRIBUTION`, `FALLBACK_SECTORS`, `FALLBACK_RADAR` — fully invented numbers (e.g. `ADANIENT priceChange 4.5, volumeSpike 250`). These render whenever the API returns empty/errors, and the banner at `:435` even narrates it as real:

```
Live <INDEX> scan completed. Awaiting live data feed — displaying historical pattern structure.
```

A viewer can't tell "live scan" from "canned demo data." (The actual `/api/scan-anomalies` compute is real — only the *fallback* is fake.) There's also a cosmetic `setTimeout(..., 3000)` at `:223` to simulate a scan delay on the error path.

### 2.4 🟠 "Weekly Debrief" never changes
`backend/main.py:580-589` — `GET /api/debrief/current` returns one hardcoded scenario ("The Global Rate Cut Dilemma"). The comment admits it: *"For this version, we serve a highly relevant static scenario."* The "weekly" framing implies rotation that doesn't exist (the AI generation is left as a Phase-2 TODO). Submissions/votes on it *are* real.

### 2.5 🔴 Landing-page social proof is fabricated
- `StatsSection.tsx:4-11` — "5,200+ Active Traders", "1.2M Backtests Completed", "98.7% Platform Uptime", "47ms Avg. Signal Latency". Animated counters make invented numbers feel measured.
- `TestimonialsSection.tsx:4-11` — six named people ("Arjun Mehta, Swing Trader, Mumbai", etc.) with specific quantified claims ("reduced volatility by 35%", "win rate improved 20%"), under the heading **"Real results from real traders."** These are invented.

This is normal marketing-copy on a launched product, but on a hackathon/SEBI-investor-education project it directly undercuts trust if a judge checks.

### 2.6 🟠 Pricing is decorative
`PricingSection.tsx:5-33` lists Free/Pro (₹999)/Institutional tiers with quotas ("5 backtests per day", "Strategy Vault (50 slots)"). The CTA buttons (`:66`) have **no `onClick`, no payment integration**, and **none of the quotas are enforced** anywhere in the backend. It's a static price table.

### 2.7 Minor / cosmetic
- `frontend/src/components/ui/sidebar.tsx:536` — `Math.random()` for skeleton-loader widths. Harmless (it's a shadcn UI primitive).
- `input-otp.tsx` "fake caret" — also a harmless shadcn UI detail.

---

## 3. "Real" but Needs Fixing (the dangerous & weak parts)

### 3.1 🚨 CRITICAL — Arbitrary code execution in the backtester
`backend/main.py:343-352`:

```python
exec(code_to_execute, globals(), local_scope)
```

`code_to_execute` is **either an LLM-generated string or a user-uploaded `custom_script`** (`mode == "python"`, `request.custom_script`, line 341). This runs untrusted Python on the server with full `globals()` — `os`, `requests`, Firebase `db`, and env secrets are all in scope. A user can post `{"mode":"python","custom_script":"import os; ...","..."}` and read your `FIREBASE_SERVICE_ACCOUNT` / `OPENROUTER_API_KEY`, exfiltrate data, or wipe Firestore. **This is the single most important issue in the project** and should be fixed before any public exposure.

### 3.2 Backtest realism is thin
`backend/main.py:357-403` — the loop: enters at `Close[i]` the same bar a signal fires (look-ahead-ish fill), **no slippage, no brokerage/STT/charges, no shorting, single position at a time**, position sizing `capital * risk% / sl%` can exceed capital, and `profit_factor` defaults to `999.0` when there are no losses (line 400). Results will look better than reality.

### 3.3 Event-loop blocking
All the heavy endpoints are `async def` but call **blocking** `yf.download(...)` and `requests.post(...)` synchronously (e.g. lines 94, 255, 285). Under concurrent load this freezes the whole FastAPI worker. Wrap in `run_in_threadpool` / use `httpx` async / offload to a worker.

### 3.4 Secrets & config hygiene
- `frontend/.env` is **committed** (`VITE_API_URL`). Not secret, but `.env` shouldn't be tracked.
- `frontend/src/firebase.js` ships the Firebase web config in the bundle — *normal* for Firebase, **but only safe if Firestore Security Rules are locked down.** Every write path (community posts, votes, calendar, debrief) goes through the backend, yet the client also holds `db`; confirm rules don't allow direct client writes/reads of other users' data.
- CORS `allow_origins=["https://*.vercel.app"]` (line 51) — FastAPI does **not** glob-match this; it's silently ineffective. Use `allow_origin_regex`.

### 3.5 Robustness / cost
- No rate limiting on `/api/backtest`, `/api/scan-anomalies`, quiz/calendar generation — each call costs yfinance bandwidth + OpenRouter tokens. Easily abused.
- No tests anywhere in the repo.
- `get_community_feed` / `get_user_community_posts` sort in Python to dodge Firestore composite indexes (lines 703-706, 793-794) — fine for now, won't scale.

---

## 4. Enhancement Roadmap (prioritized)

### P0 — Safety & honesty (do first)
1. **Kill the `exec` RCE.** Remove user-supplied `custom_script` execution, or sandbox it: run in a separate, network-isolated, non-privileged subprocess/container with a restricted builtins whitelist, CPU/мem/time limits, and **no access to `globals()`/secrets**. At minimum, drop `globals()` → use an empty, curated namespace.
2. **Label mock data honestly.** Add a visible "Demo data" badge to the Portfolio screen and Anomaly fallback charts until they're real. Change `"Zerodha (Mock)"`/`"Connected"` → `"Demo Portfolio"`.
3. **Gate or footnote landing-page stats/testimonials** ("illustrative", or pull real counts from Firestore — you already have user + post collections to compute *Active Traders* and *Backtests Completed* for real).

### P1 — Make the faked features real
4. **Real portfolio:** integrate a broker (Zerodha Kite / Upstox / Angel One) OAuth, or — much simpler — let users **manually enter holdings** (store in Firestore under the user), then fetch live prices via the yfinance path you already have. Compute the Risk Status from real sector concentration + volatility instead of the hardcoded "Moderate".
5. **Rotating Weekly Debrief:** the AI + cache pattern already exists for the calendar (`get_ai_events`, line 800) — reuse it to generate a fresh debrief scenario weekly, keyed by ISO week, cached in Firestore.
6. **Enforce pricing tiers** (or remove the price table): wire a real usage counter (Firestore per-user daily counts) for backtests/quizzes, and a Razorpay/Stripe checkout for Pro.

### P2 — Backtest credibility & performance
7. Add **slippage + charges + next-bar fills + position cap**; expose Sharpe/Sortino/expectancy; allow shorts. This is what turns a toy into a tool.
8. Move blocking I/O off the event loop (`run_in_threadpool` / `httpx.AsyncClient`); add **caching** for yfinance pulls (same index scanned repeatedly).
9. Add **rate limiting** (`slowapi`) and a request quota per user.

### P3 — Engineering hygiene
10. Untrack `frontend/.env`; verify/commit Firestore Security Rules; switch CORS to `allow_origin_regex`.
11. Add a **test suite** (pytest for the backtest math + endpoints; a couple of Vitest/RTL tests for the data-fetching components).
12. Split `backend/main.py` (1,053 lines) into routers (`anomaly`, `backtest`, `arena`, `community`, `portfolio`, `calendar`) — the navigator below shows how entangled it currently is.

---

## 5. How to read the companion navigator

`CODE_NAVIGATOR.html` (regenerated by `tools/generate_navigator.py`) is a single, self-contained, searchable map of the codebase:
- every API endpoint, Python function/class, and React component with its **file + line number**,
- a live **search box** (filter by name, file, type, or endpoint path),
- flags for **mock/fake/TODO/`exec`/`Math.random`** lines so this report and the map stay in sync.

Re-run `python tools/generate_navigator.py` after any code change to refresh it.
