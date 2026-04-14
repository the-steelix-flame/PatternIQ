import os
import math
import yfinance as yf
import pandas as pd
import pandas_ta as ta
import requests
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from datetime import datetime, timedelta, date
import firebase_admin
from firebase_admin import credentials, firestore
import json
import logging
import numpy as np
from fastapi import Query

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Firebase Initialization ---
try:
    firebase_secret = os.getenv("FIREBASE_SERVICE_ACCOUNT")
    if firebase_secret:
        # Parse the JSON string from Hugging Face Secrets
        cred_dict = json.loads(firebase_secret)
        cred = credentials.Certificate(cred_dict)
    else:
        # Fallback for local development
        cred = credentials.Certificate("serviceAccountKey.json")
        
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    db = firestore.client()
except Exception as e:
    logger.error(f"Failed to initialize Firebase: {e}")
    db = None

# --- App Configuration ---
load_dotenv()
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

app = FastAPI(title="PatternIQ API")
origins = [
    "http://localhost:5173", 
    "http://localhost:3000",
    "https://patterniq.vercel.app", # Replace with your actual Vercel URL
    "https://*.vercel.app" # Optional: Allows preview deployments
]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# --- Market Index Constituents (NSE Tickers) ---
MARKET_INDICES = {
    # Changed HUL to HINDUNILVR
    "NIFTY_50": ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "HINDUNILVR", "ITC", "SBIN", "BHARTIARTL", "KOTAKBANK", "LT", "AXISBANK", "ASIANPAINT", "MARUTI", "SUNPHARMA", "TITAN", "BAJFINANCE", "TATAMOTORS", "ADANIENT", "TATASTEEL"],
    "NIFTY_BANK": ["HDFCBANK", "ICICIBANK", "SBIN", "AXISBANK", "KOTAKBANK", "INDUSINDBK", "BANKBARODA", "AUBANK", "FEDERALBNK", "IDFCFIRSTB", "PNB", "BANDHANBNK"],
    "NIFTY_IT": ["TCS", "INFY", "HCLTECH", "WIPRO", "TECHM", "LTIM", "COFORGE", "PERSISTENT", "MPHASIS"],
    "NIFTY_FIN_SERVICE": ["HDFCBANK", "ICICIBANK", "BAJFINANCE", "KOTAKBANK", "AXISBANK", "SBIN", "BAJAJFINSV", "CHOLAFIN", "PFC", "RECLTD"],
    "NIFTY_AUTO": ["TATAMOTORS", "MARUTI", "M&M", "BAJAJ-AUTO", "EICHERMOT", "HEROMOTOCO", "TVSMOTOR", "ASHOKLEY", "BOSCHLTD"],
    # Changed HUL to HINDUNILVR
    "NIFTY_FMCG": ["ITC", "HINDUNILVR", "NESTLEIND", "BRITANNIA", "TATACONSUM", "GODREJCP", "DABUR", "MARICO", "COLPAL"],
    "NIFTY_PHARMA": ["SUNPHARMA", "CIPLA", "DRREDDY", "DIVISLAB", "LUPIN", "AUROPHARMA", "TORNTPHARM", "BIOCON", "GLENMARK"],
    "NIFTY_METAL": ["TATASTEEL", "HINDALCO", "JSWSTEEL", "VEDL", "COALINDIA", "JINDALSTEL", "SAIL", "NATIONALUM"],
    "NIFTY_MIDCAP_100": ["TRENT", "TVSMOTOR", "CUMMINSIND", "CGPOWER", "UBL", "IDEA", "SUZLON", "MRF", "ASTRAL"],
    "NIFTY_SMALLCAP_100": ["BSE", "CDSL", "ANGELONE", "KEI", "RADICO", "HAPPSTMNDS", "RENUKA", "NBCC"]
}

SECTOR_MAP = {
    "HDFCBANK": "Banking", "ICICIBANK": "Banking", "SBIN": "Banking", "AXISBANK": "Banking", "KOTAKBANK": "Banking",
    "TCS": "IT", "INFY": "IT", "HCLTECH": "IT", "WIPRO": "IT", "TECHM": "IT",
    # Changed HUL to HINDUNILVR
    "RELIANCE": "Energy", "ITC": "FMCG", "HINDUNILVR": "FMCG", "NESTLEIND": "FMCG",
    "TATAMOTORS": "Auto", "MARUTI": "Auto", "M&M": "Auto", "BAJAJ-AUTO": "Auto",
    "SUNPHARMA": "Pharma", "CIPLA": "Pharma", "DRREDDY": "Pharma",
    "TATASTEEL": "Metal", "HINDALCO": "Metal", "JSWSTEEL": "Metal"
}

def clean_val(val):
    """Helper to prevent FastAPI from crashing on NaN or Infinity values"""
    try:
        if pd.isna(val) or math.isnan(val) or math.isinf(val):
            return 0.0
        return float(val)
    except:
        return 0.0

def analyze_index_data(index_name: str):
    tickers = MARKET_INDICES.get(index_name, MARKET_INDICES["NIFTY_50"])
    yf_tickers = [f"{t}.NS" for t in tickers]
    
    data = yf.download(yf_tickers, period="60d", group_by='ticker', progress=False, auto_adjust=True)
    
    scatter_data, rsi_data, live_alerts = [], [], []
    sector_counts = {}
    anomaly_counts = {"Volume Spikes": 0, "Price Breakouts": 0, "RSI Extremes": 0, "MACD Crossovers": 0}
    radar_metrics = {"volatility": [], "momentum": [], "volume": [], "breadth": 0}
    
    for ticker in tickers:
        try:
            yf_ticker = f"{ticker}.NS"
            df = data[yf_ticker] if len(tickers) > 1 else data
            df = df.dropna()
            
            if len(df) < 35: continue
                
            df['Volume_20SMA'] = ta.sma(df['Volume'], length=20)
            df['RSI_14'] = ta.rsi(df['Close'], length=14)
            macd = ta.macd(df['Close'], fast=12, slow=26, signal=9)
            df = pd.concat([df, macd], axis=1)
            
            latest = df.iloc[-1]
            prev = df.iloc[-2]
            
            # Use clean_val to prevent NaN crashes
            current_vol = clean_val(latest['Volume'])
            avg_vol = clean_val(latest['Volume_20SMA'])
            vol_spike_pct = round((current_vol / avg_vol) * 100, 2) if avg_vol > 0 else 0.0
            
            price_change = round(clean_val(((latest['Close'] - prev['Close']) / prev['Close']) * 100), 2) if clean_val(prev['Close']) > 0 else 0.0
            current_rsi = round(clean_val(latest['RSI_14']), 2)
            
            is_volume_spike = vol_spike_pct > 200
            is_breakout = abs(price_change) > 4.0
            is_rsi_extreme = current_rsi > 70 or current_rsi < 30
            
            macd_line = clean_val(latest.get('MACD_12_26_9', 0))
            signal_line = clean_val(latest.get('MACDs_12_26_9', 0))
            prev_macd = clean_val(prev.get('MACD_12_26_9', 0))
            prev_signal = clean_val(prev.get('MACDs_12_26_9', 0))
            is_macd_cross = (macd_line > signal_line) and (prev_macd <= prev_signal)

            print(f"📊 {ticker:<12} | Price: {price_change:>6}% | Vol: {vol_spike_pct:>5}% | RSI: {current_rsi:>5}")

            if is_volume_spike or is_breakout:
                scatter_data.append({"name": ticker, "priceChange": price_change, "volumeSpike": vol_spike_pct})
            
            if is_rsi_extreme or len(rsi_data) < 5: 
                rsi_data.append({"name": ticker, "rsi": current_rsi})
                
            has_anomaly = False
            if is_volume_spike:
                anomaly_counts["Volume Spikes"] += 1
                has_anomaly = True
                live_alerts.append({"symbol": ticker, "message": f"Volume Spike: Trading at {vol_spike_pct}% of 20-day average.", "type": "Volume"})
            if is_breakout:
                anomaly_counts["Price Breakouts"] += 1
                has_anomaly = True
                live_alerts.append({"symbol": ticker, "message": f"Price Breakout: Moved {price_change}% in a single session.", "type": "Price"})
            if is_rsi_extreme:
                anomaly_counts["RSI Extremes"] += 1
                has_anomaly = True
            if is_macd_cross:
                anomaly_counts["MACD Crossovers"] += 1
                has_anomaly = True
                live_alerts.append({"symbol": ticker, "message": "Golden Cross: MACD crossed above signal line.", "type": "MACD"})

            if has_anomaly:
                sector = SECTOR_MAP.get(ticker, index_name.split("_")[-1].capitalize())
                sector_counts[sector] = sector_counts.get(sector, 0) + 1

            radar_metrics["volatility"].append(abs(price_change))
            radar_metrics["momentum"].append(current_rsi)
            radar_metrics["volume"].append(min(vol_spike_pct, 500)) 
            if clean_val(latest['Close']) > clean_val(ta.sma(df['Close'], length=50).iloc[-1]):
                radar_metrics["breadth"] += 1

        except Exception as e:
            logger.error(f"Error processing {ticker}: {e}")
            continue

    avg_volatility = min(np.mean(radar_metrics["volatility"]) * 20, 100) if radar_metrics["volatility"] else 50
    avg_momentum = np.mean(radar_metrics["momentum"]) if radar_metrics["momentum"] else 50
    avg_volume = min(np.mean(radar_metrics["volume"]) / 2, 100) if radar_metrics["volume"] else 50
    breadth_pct = (radar_metrics["breadth"] / len(tickers)) * 100 if tickers else 50
    trend_strength = (avg_momentum + breadth_pct) / 2

    radar_formatted = [
        {"subject": "Volatility", "value": round(clean_val(avg_volatility)), "fullMark": 100},
        {"subject": "Momentum", "value": round(clean_val(avg_momentum)), "fullMark": 100},
        {"subject": "Volume", "value": round(clean_val(avg_volume)), "fullMark": 100},
        {"subject": "Trend", "value": round(clean_val(trend_strength)), "fullMark": 100},
        {"subject": "Breadth", "value": round(clean_val(breadth_pct)), "fullMark": 100}
    ]

    distribution_formatted = [{"name": k, "value": v} for k, v in anomaly_counts.items() if v > 0]
    sector_formatted = [{"name": k, "anomalies": v} for k, v in sector_counts.items()]

    if not scatter_data: scatter_data = [{"name": index_name.replace("_", " "), "priceChange": 0, "volumeSpike": 100}]
    if not distribution_formatted: distribution_formatted = [{"name": "Stable", "value": 100}]
    if not sector_formatted: sector_formatted = [{"name": "Broad Market", "anomalies": 1}]

    return {
        "scatterData": sorted(scatter_data, key=lambda x: x['volumeSpike'], reverse=True)[:15],
        "rsiData": sorted(rsi_data, key=lambda x: x['rsi'])[:10],
        "distributionData": distribution_formatted,
        "sectorData": sector_formatted,
        "radarData": radar_formatted,
        "live_alerts": live_alerts
    }

@app.get("/api/scan-anomalies")
async def scan_anomalies(index: str = Query("NIFTY_50", description="The market index to scan")):
    try:
        results = analyze_index_data(index)
        
        if db and results["live_alerts"]:
            batch = db.batch()
            alerts_ref = db.collection("alerts")
            
            old_docs = alerts_ref.order_by("timestamp", direction=firestore.Query.DESCENDING).offset(50).stream()
            for doc in old_docs:
                batch.delete(doc.reference)
                
            for alert in results["live_alerts"]:
                new_ref = alerts_ref.document()
                db_alert = alert.copy()
                db_alert["timestamp"] = firestore.SERVER_TIMESTAMP
                batch.set(new_ref, db_alert)
                
            batch.commit()
        
        # Strips out Firebase Sentinel objects so React can read the JSON cleanly
        return {
            "scatterData": results["scatterData"],
            "rsiData": results["rsiData"],
            "distributionData": results["distributionData"],
            "sectorData": results["sectorData"],
            "radarData": results["radarData"]
        }
        
    except Exception as e:
        logger.error(f"Scan failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to run live anomaly scan")

# --- OpenRouter Helper Function ---
def call_openrouter(prompt: str) -> str:
    """Routes the prompt to Gemini 2.5 Flash Lite via OpenRouter REST API."""
    if not OPENROUTER_API_KEY:
        raise ValueError("OPENROUTER_API_KEY is not set in the environment variables.")
        
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }
    
    data = {
        "model": "google/gemini-2.5-flash-lite",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2
    }
    
    response = requests.post(OPENROUTER_URL, headers=headers, json=data)
    response.raise_for_status()  # Will throw an exception for 4xx/5xx errors
    
    return response.json()['choices'][0]['message']['content']


# --- NEW: Updated Pydantic Model for Backtest Request ---
class BacktestRequest(BaseModel):
    symbol: str
    interval: str
    capital: float
    risk_percent: float
    sl_percent: float
    target_percent: float
    mode: str = "ai"           # NEW: 'ai' or 'python'
    strategy_text: str = ""    # Optional now
    custom_script: str = ""    # NEW: Used when mode is 'python'

INDEX_MAP = { "NIFTY": "^NSEI", "NIFTY 50": "^NSEI", "BANKNIFTY": "^NSEBANK", "NIFTY BANK": "^NSEBANK", "SENSEX": "^BSESN" }


@app.post("/api/backtest")
async def perform_backtest(request: BacktestRequest):
    try:
        # --- STAGE 1: Data Fetching (Required for both modes) ---
        ticker = INDEX_MAP.get(request.symbol.upper(), f"{request.symbol.upper()}.NS")
        is_intraday = request.interval in ["1m", "5m", "15m", "30m", "1h"]
        start_date = datetime.now() - timedelta(days=59 if is_intraday else 180)
        end_date = datetime.now()
        
        data = yf.download(ticker, start=start_date, end=end_date, interval=request.interval, auto_adjust=True, progress=False)
        if data.empty: 
            raise HTTPException(404, "No data found for this symbol/timeframe combination.")
        
        # Clean Data
        data.columns = [col[0] if isinstance(col, tuple) else col for col in data.columns]
        data.reset_index(inplace=True)
        date_col = 'Datetime' if 'Datetime' in data.columns else 'Date'
        data.dropna(inplace=True)
        data.reset_index(drop=True, inplace=True)

        code_to_execute = ""
        
        # --- STAGE 2: Code Generation OR Custom Script Loading ---
        if request.mode == "ai":
            # AI as a PROJECT MANAGER (Strategy Parser)
            parsing_prompt = f"""
            You are a trading strategy analysis bot. Parse the user's strategy and convert it into a JSON object.
            Strategy: "{request.strategy_text}"
            Extract:
            1. "entry_condition": Description of entry signal.
            2. "pattern_to_find": Chart pattern name or "none".
            3. "required_indicators": List of indicators (e.g., ["RSI", "MACD", "SMA_50"]).
            Return ONLY the JSON object.
            """
            response_text = call_openrouter(parsing_prompt)
            cleaned_response = response_text.strip().replace('```json', '').replace('```', '')
            params = json.loads(cleaned_response)

            # Append requested indicators
            required_indicators = params.get('required_indicators', [])
            if "RSI" in required_indicators: data.ta.rsi(length=14, append=True)
            if "MACD" in required_indicators: data.ta.macd(append=True)
            if "SMA_50" in required_indicators: data.ta.sma(length=50, append=True)
            
            # AI as a SPECIALIST CODER (TA Code Generator)
            if params.get('pattern_to_find') != "none":
                available_columns = ", ".join(f"'{col}'" for col in data.columns)
                coding_prompt = f"""
                Write a single Python function named `find_signals` that takes a pandas DataFrame `data` as input.
                Analyze the data for: "{params['entry_condition']}".
                CRITICAL: Use ONLY these columns: {available_columns}. Use '{date_col}' for time.
                Return a pandas Series of booleans (True = entry signal).
                Provide ONLY the Python code.
                """
                code_response_text = call_openrouter(coding_prompt)
                code_to_execute = code_response_text.strip().replace('```python', '').replace('```', '')
            else:
                # Fallback for simple conditions
                code_to_execute = f"""def find_signals(data):
    if 'RSI_14' not in data.columns:
        import pandas_ta as ta
        data.ta.rsi(length=14, append=True)
    return data['RSI_14'] < 30"""
        else:
            # mode == 'python' (User provided their own script)
            code_to_execute = request.custom_script

        # --- STAGE 3: Securely Execute the Strategy Script ---
        local_scope = {}
        try:
            # Execute the string as actual Python code
            exec(code_to_execute, globals(), local_scope)
            if 'find_signals' not in local_scope:
                raise ValueError("Your script must define a function named 'find_signals(data)'.")
            
            find_signals_func = local_scope['find_signals']
            entry_signals = find_signals_func(data)
        except Exception as e:
            logger.error(f"Script Execution Error: {e}", exc_info=True)
            raise HTTPException(status_code=400, detail=f"Python Script Error: {str(e)}")

        # --- STAGE 4: Execute Backtest Loop ---
        capital = request.capital
        equity = [capital]
        trades = []
        in_trade = False
        peak_equity = capital
        drawdown_data = [{'date': data[date_col].iloc[0].strftime('%Y-%m-%d %H:%M'), 'drawdown': 0}]
        
        for i in range(1, len(data)):
            if not in_trade and entry_signals.iloc[i]:
                in_trade = True
                entry_price = data['Close'][i]
                stop_loss_price = entry_price * (1 - request.sl_percent / 100)
                target_price = entry_price * (1 + request.target_percent / 100)
                trade_info = {'entry_date': data[date_col][i], 'entry_price': entry_price}

            elif in_trade:
                current_price = data['Close'][i]
                exit_reason = "Target" if current_price >= target_price else "Stop-Loss" if current_price <= stop_loss_price else None
                if exit_reason:
                    pnl_percent = (current_price / entry_price - 1) * 100
                    trade_info.update({'exit_date': data[date_col][i], 'exit_price': current_price, 'pnl_percent': pnl_percent, 'reason': exit_reason})
                    trades.append(trade_info)
                    
                    position_size = capital * (request.risk_percent / 100) / (request.sl_percent / 100) if request.sl_percent > 0 else capital
                    capital += position_size * (pnl_percent / 100)
                    equity.append(capital)
                    
                    peak_equity = max(peak_equity, capital)
                    drawdown = (peak_equity - capital) / peak_equity * 100 if peak_equity > 0 else 0
                    drawdown_data.append({'date': data[date_col][i].strftime('%Y-%m-%d %H:%M'), 'drawdown': drawdown})
                    in_trade = False

        # --- STAGE 5: AI as a BUSINESS ANALYST (Performance Reviewer) ---
        final_equity = equity[-1]
        pnl = final_equity - request.capital
        pnl_percent = (pnl / request.capital) * 100 if request.capital > 0 else 0
        wins = [t for t in trades if t['pnl_percent'] > 0]
        losses = [t for t in trades if t['pnl_percent'] <= 0]
        win_rate = (len(wins) / len(trades)) * 100 if trades else 0
        max_drawdown = max(d['drawdown'] for d in drawdown_data) if drawdown_data else 0
        total_profit = sum(t['pnl_percent'] for t in wins)
        total_loss = abs(sum(t['pnl_percent'] for t in losses))
        profit_factor = total_profit / total_loss if total_loss > 0 else 999.0

        avg_win = (sum(t['pnl_percent'] for t in wins) / len(wins)) if wins else 0
        avg_loss = (abs(sum(t['pnl_percent'] for t in losses)) / len(losses)) if losses else 0

        # Chart Data Formatting
        scatter_data = []
        monthly_pnl_map = {}
        formatted_trades = []
        
        for i, trade in enumerate(trades):
            duration_hours = (trade['exit_date'] - trade['entry_date']).total_seconds() / 3600
            scatter_data.append({"id": i, "x": round(duration_hours, 1), "y": round(trade['pnl_percent'], 2)})
            month_key = trade['exit_date'].strftime('%b %Y')
            monthly_pnl_map[month_key] = monthly_pnl_map.get(month_key, 0) + trade['pnl_percent']
            
            trade_copy = trade.copy()
            trade_copy['entry_date'] = trade['entry_date'].strftime('%Y-%m-%d %H:%M')
            trade_copy['exit_date'] = trade['exit_date'].strftime('%Y-%m-%d %H:%M')
            trade_copy['entry_price'] = round(trade['entry_price'], 2)
            trade_copy['exit_price'] = round(trade['exit_price'], 2)
            trade_copy['pnl_percent'] = round(trade['pnl_percent'], 2)
            formatted_trades.append(trade_copy)

        bar_data = [{"month": k, "pnl": round(v, 2)} for k, v in monthly_pnl_map.items()]
        pie_data = [
            {"id": 0, "value": len(wins), "label": "Winning Trades", "color": "#4caf50"},
            {"id": 1, "value": len(losses), "label": "Losing Trades", "color": "#f44336"}
        ]

        strategy_desc = request.strategy_text if request.mode == 'ai' else "Custom Python Script"
        analysis_prompt = f"""
        Analyze this backtest report in Markdown format.
        **Data:**
        - Symbol: {request.symbol}
        - Strategy: '{strategy_desc}'
        - Final Equity: ₹{final_equity:,.0f}
        - Net P/L: ₹{pnl:,.0f} ({pnl_percent:.2f}%)
        - Win Rate: {win_rate:.2f}%
        - Profit Factor: {profit_factor:.2f}
        - Max Drawdown: {max_drawdown:.2f}%
        
        **Required Output Structure:**
        ### Executive Summary
        [summary]
        ### Performance Breakdown
        [analysis]
        ### Actionable Insight
        [suggestion]
        """
        ai_explanation = call_openrouter(analysis_prompt).strip()
        
        equity_curve_data = [{'date': data[date_col].iloc[0].strftime('%Y-%m-%d %H:%M'), 'equity': request.capital}]
        for i, trade in enumerate(trades):
            equity_curve_data.append({'date': trade['exit_date'].strftime('%Y-%m-%d %H:%M'), 'equity': equity[i+1]})

        # --- STAGE 6: Return Response with Downloadable Python Code ---
        return {
            "pnl": round(pnl, 2), "pnl_percent": round(pnl_percent, 2),
            "win_rate": round(win_rate, 2), "num_trades": len(trades),
            "max_drawdown": round(max_drawdown, 2), "profit_factor": round(profit_factor, 2),
            "avg_win": round(avg_win, 2), "avg_loss": round(avg_loss, 2),
            "equity_curve": equity_curve_data, "drawdown_curve": drawdown_data,
            "scatter_data": scatter_data, "bar_data": bar_data, "pie_data": pie_data,
            "ai_explanation": ai_explanation, "trades": formatted_trades,
            "python_code": code_to_execute # <- THIS ENABLES THE .PY DOWNLOAD BUTTON
        }
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Unexpected server error: {str(e)}")

NIFTY_50_SAMPLE = ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "HINDUNILVR.NS", "ICICIBANK.NS", "BHARTIARTL.NS", "SBIN.NS", "ITC.NS", "LT.NS"]

def scan_stocks_for_anomalies_task():
    if not db: return logger.error("Cannot scan: Firestore not initialized.")
    logger.info("Starting background anomaly scan...")
    for symbol in NIFTY_50_SAMPLE:
        try:
            data = yf.download(symbol, period="22d", interval="1d", auto_adjust=True, progress=False)
            if data.empty or len(data) < 22: continue
            
            data['avg_volume_20d'] = data['Volume'].rolling(window=20).mean()
            
            avg_volume = data['avg_volume_20d'].iloc[-2].item()
            latest_volume = data['Volume'].iloc[-1].item()

            if np.isnan(avg_volume) or avg_volume == 0: continue
            
            threshold = avg_volume * 1.5
            logger.info(f"Checking {symbol.ljust(15)}: Latest Vol={latest_volume:,.0f} | Avg Vol={avg_volume:,.0f} | Threshold={threshold:,.0f}")

            if latest_volume > threshold:
                spike_percentage = (latest_volume / avg_volume) * 100
                message = f"Unusual Volume: Today's volume is {spike_percentage:.0f}% of the 20-day average."
                alert_data = {'symbol': symbol.replace(".NS", ""), 'message': message, 'timestamp': firestore.SERVER_TIMESTAMP}
                db.collection('alerts').add(alert_data)
                logger.info(f"----> ANOMALY FOUND AND LOGGED for {symbol}")
        except Exception as e:
            logger.error(f"Failed to process symbol {symbol} for anomalies: {e}")
    logger.info("Background anomaly scan finished.")

# --- PORTFOLIO & RISK ENDPOINTS ---
class PortfolioAnalysisRequest(BaseModel):
    portfolio_summary: str

@app.get("/api/get-portfolio/{user_id}")
async def get_portfolio(user_id: str):
    # Simulated mock broker data (In a real app, this would hit the Zerodha/Upstox API)
    holdings = [
        {"symbol": "RELIANCE", "quantity": 50, "avg_price": 2800.00, "current_price": 2950.45, "sector": "Energy"},
        {"symbol": "TCS", "quantity": 20, "avg_price": 3800.00, "current_price": 3920.10, "sector": "IT"},
        {"symbol": "HDFCBANK", "quantity": 100, "avg_price": 1450.00, "current_price": 1420.50, "sector": "Financials"},
        {"symbol": "TATAMOTORS", "quantity": 150, "avg_price": 950.00, "current_price": 1010.25, "sector": "Automobile"},
        {"symbol": "LT", "quantity": 30, "avg_price": 3400.00, "current_price": 3650.00, "sector": "Infrastructure"},
    ]
    
    total_invested = 0
    total_current = 0
    sector_allocation = {}
    
    # Calculate live P&L and Sector Weights
    for h in holdings:
        invested = h["quantity"] * h["avg_price"]
        current = h["quantity"] * h["current_price"]
        h["pnl"] = current - invested
        h["pnl_percent"] = (h["pnl"] / invested) * 100
        h["current_value"] = current
        h["invested_value"] = invested
        
        total_invested += invested
        total_current += current
        sector_allocation[h["sector"]] = sector_allocation.get(h["sector"], 0) + current
        
    total_pnl = total_current - total_invested
    total_pnl_percent = (total_pnl / total_invested) * 100 if total_invested > 0 else 0
    
    # Format sector data for the PieChart
    sector_data = [{"id": i, "value": round(v, 2), "label": k} for i, (k, v) in enumerate(sector_allocation.items())]
    
    return {
        "broker": "Zerodha (Mock)",
        "status": "Connected",
        "total_invested": round(total_invested, 2),
        "total_current": round(total_current, 2),
        "total_pnl": round(total_pnl, 2),
        "total_pnl_percent": round(total_pnl_percent, 2),
        "holdings": holdings,
        "sector_data": sector_data
    }

@app.post("/api/portfolio/analyze")
async def analyze_portfolio(req: PortfolioAnalysisRequest):
    try:
        prompt = f"""
        You are a strict quantitative risk officer for a hedge fund. Analyze the following portfolio allocation and provide a brief, professional risk assessment. 
        Focus heavily on Sector Over-concentration and Correlation vulnerabilities. Use Markdown formatting. Keep it to 3 concise paragraphs.
        
        Portfolio Data: {req.portfolio_summary}
        """
        explanation = call_openrouter(prompt)
        return {"analysis": explanation.strip()}
    except Exception as e:
        logger.error(f"AI Risk Analysis failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate risk analysis.")

class UserCalendarEvent(BaseModel):
    userId: str; date: str; title: str; type: str


# --- DEBRIEF PYDANTIC MODELS ---
class DebriefSubmission(BaseModel):
    userId: str
    displayName: str
    picture: str
    analysis: str
    stance: str # 'Bullish', 'Bearish', 'Neutral'

# --- THE WEEKLY DEBRIEF ENDPOINTS ---
@app.get("/api/debrief/current")
async def get_current_debrief():
    # For this version, we serve a highly relevant static scenario.
    # In Phase 2, you can hook this up to your AI to generate a new one every Monday!
    return {
        "id": "current_week_scenario",
        "title": "The Global Rate Cut Dilemma",
        "description": "Global central banks are signaling potential rate cuts, yet domestic inflation remains sticky in certain sectors. Given this macroeconomic divergence, how do you expect the Nifty Bank index to perform over the next two weeks? Support your stance with technical or fundamental logic.",
        "date": str(date.today())
    }

@app.post("/api/debrief/submit")
async def submit_debrief(submission: DebriefSubmission):
    if not db: raise HTTPException(500, "Firestore not initialized.")
    try:
        doc_ref = db.collection('debriefs').document('current_week_scenario').collection('analyses').add({
            'userId': submission.userId,
            'displayName': submission.displayName,
            'picture': submission.picture,
            'analysis': submission.analysis,
            'stance': submission.stance,
            'votes': 0,
            'timestamp': firestore.SERVER_TIMESTAMP
        })
        return {"status": "success", "id": doc_ref[1].id}
    except Exception as e:
        logger.error(f"Debrief submit failed: {e}", exc_info=True)
        raise HTTPException(500, "Failed to submit analysis.")

@app.get("/api/debrief/analyses")
async def get_debrief_analyses():
    if not db: raise HTTPException(500, "Firestore not initialized.")
    try:
        # Fetch all analyses and order them by highest votes first
        docs = db.collection('debriefs').document('current_week_scenario').collection('analyses').order_by('votes', direction=firestore.Query.DESCENDING).stream()
        return [{'id': doc.id, **doc.to_dict()} for doc in docs]
    except Exception as e:
        logger.error(f"Debrief fetch failed: {e}", exc_info=True)
        raise HTTPException(500, "Failed to fetch community analyses.")

@app.post("/api/debrief/vote/{analysis_id}")
async def vote_debrief(analysis_id: str):
    if not db: raise HTTPException(500, "Firestore not initialized.")
    try:
        ref = db.collection('debriefs').document('current_week_scenario').collection('analyses').document(analysis_id)
        ref.update({'votes': firestore.Increment(1)})
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(500, "Failed to register vote.")
    

# --- COMMUNITY HUB MODELS ---
class StrategyData(BaseModel):
    symbol: str
    interval: str
    pnl_percent: float
    win_rate: float
    profit_factor: float

class CommunityPost(BaseModel):
    userId: str
    displayName: str
    picture: str
    type: str # 'discussion', 'strategy', 'debrief'
    title: str
    content: str
    tags: list[str]
    strategyData: dict | None = None

class VoteAction(BaseModel):
    action: str # 'upvote' or 'downvote'

# --- COMMUNITY HUB ENDPOINTS ---
@app.post("/api/community/post")
async def create_community_post(post: CommunityPost):
    if not db: raise HTTPException(500, "Firestore not initialized.")
    try:
        # Convert tags to lowercase for easier searching
        search_tags = [tag.lower().strip() for tag in post.tags]
        
        doc_ref = db.collection('community_posts').add({
            'userId': post.userId,
            'displayName': post.displayName,
            'picture': post.picture,
            'type': post.type,
            'title': post.title,
            'content': post.content,
            'tags': search_tags,
            'strategyData': post.strategyData,
            'upvotes': 0,
            'downvotes': 0,
            'commentsCount': 0,
            'timestamp': firestore.SERVER_TIMESTAMP
        })
        return {"status": "success", "id": doc_ref[1].id}
    except Exception as e:
        logger.error(f"Failed to create post: {e}")
        raise HTTPException(500, "Failed to publish post.")

@app.get("/api/community/feed")
async def get_community_feed(tag: str = None):
    if not db: raise HTTPException(500, "Firestore not initialized.")
    try:
        query = db.collection('community_posts')
        
        # Hashmap/Tag-based search using Firestore's array_contains
        if tag:
            query = query.where('tags', 'array_contains', tag.lower().strip())
        else:
            query = query.order_by('timestamp', direction=firestore.Query.DESCENDING).limit(50)
            
        docs = query.stream()
        
        feed = []
        for doc in docs:
            data = doc.to_dict()
            # Convert timestamp to string for frontend
            if 'timestamp' in data and data['timestamp']:
                data['createdAt'] = data['timestamp'].strftime('%b %d, %Y %H:%M')
            else:
                data['createdAt'] = 'Just now'
            feed.append({'id': doc.id, **data})
            
        # If we used a tag filter, we must sort in Python because Firestore 
        # requires a composite index to where() and order_by() together on different fields.
        if tag:
            feed = sorted(feed, key=lambda x: x.get('upvotes', 0), reverse=True)
            
        return feed
    except Exception as e:
        logger.error(f"Failed to fetch feed: {e}")
        raise HTTPException(500, "Failed to fetch community feed.")

@app.post("/api/community/vote/{post_id}")
async def vote_post(post_id: str, vote: VoteAction):
    if not db: raise HTTPException(500, "Firestore not initialized.")
    try:
        ref = db.collection('community_posts').document(post_id)
        if vote.action == 'upvote':
            ref.update({'upvotes': firestore.Increment(1)})
        elif vote.action == 'downvote':
            ref.update({'downvotes': firestore.Increment(1)})
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(500, "Failed to register vote.")


# --- SAVED STRATEGIES & USER DATA MODELS ---
class SavedStrategy(BaseModel):
    userId: str
    name: str
    symbol: str
    interval: str
    strategyText: str
    capital: float
    riskPercent: float
    slPercent: float
    targetPercent: float
    resultData: dict # Stores the entire result (pnl, trades, charts, ai analysis)

# --- USER DATA ENDPOINTS ---
@app.post("/api/user/strategies/save")
async def save_user_strategy(strategy: SavedStrategy):
    if not db: raise HTTPException(500, "Firestore not initialized.")
    try:
        doc_ref = db.collection('users').document(strategy.userId).collection('saved_strategies').add({
            'name': strategy.name,
            'symbol': strategy.symbol,
            'interval': strategy.interval,
            'strategyText': strategy.strategyText,
            'capital': strategy.capital,
            'riskPercent': strategy.riskPercent,
            'slPercent': strategy.slPercent,
            'targetPercent': strategy.targetPercent,
            'resultData': strategy.resultData,
            'timestamp': firestore.SERVER_TIMESTAMP
        })
        return {"status": "success", "id": doc_ref[1].id}
    except Exception as e:
        logger.error(f"Failed to save strategy: {e}")
        raise HTTPException(500, "Failed to save strategy.")

@app.get("/api/user/strategies/{user_id}")
async def get_user_strategies(user_id: str):
    if not db: raise HTTPException(500, "Firestore not initialized.")
    try:
        docs = db.collection('users').document(user_id).collection('saved_strategies').order_by('timestamp', direction=firestore.Query.DESCENDING).stream()
        strategies = []
        for doc in docs:
            data = doc.to_dict()
            if 'timestamp' in data and data['timestamp']:
                data['createdAt'] = data['timestamp'].strftime('%b %d, %Y %H:%M')
            else:
                data['createdAt'] = 'Just now'
            strategies.append({'id': doc.id, **data})
        return strategies
    except Exception as e:
        raise HTTPException(500, "Failed to fetch saved strategies.")

@app.get("/api/community/user-posts/{user_id}")
async def get_user_community_posts(user_id: str):
    if not db: raise HTTPException(500, "Firestore not initialized.")
    try:
        docs = db.collection('community_posts').where('userId', '==', user_id).stream()
        posts = []
        for doc in docs:
            data = doc.to_dict()
            if 'timestamp' in data and data['timestamp']:
                data['createdAt'] = data['timestamp'].strftime('%b %d, %Y %H:%M')
            else:
                data['createdAt'] = 'Just now'
            posts.append({'id': doc.id, **data})
            
        # Sort in python because we used a where clause
        posts = sorted(posts, key=lambda x: x.get('timestamp', 0), reverse=True)
        return posts
    except Exception as e:
        raise HTTPException(500, "Failed to fetch user posts.")
    

# --- CALENDAR ENDPOINTS ---

@app.get("/api/calendar/ai-events")
async def get_ai_events():
    if not db: raise HTTPException(500, "Firestore not initialized.")
    today_str = str(date.today())
    doc_ref = db.collection('calendar').document('ai_generated_events')
    try:
        doc = doc_ref.get()
        if doc.exists and doc.to_dict().get('last_updated') == today_str:
            return doc.to_dict().get('events')
    except Exception as e:
        logger.warning(f"Could not read cache, will regenerate. Error: {e}")

    logger.info("Cache miss. Generating new AI events.")
    try:
        prompt = f"""
        **Instruction:** You are a JSON data generation engine. Your sole function is to generate a JSON array of objects based on the provided schema and context. Your entire response must be ONLY the raw JSON array.
        **Context:** The user is a retail trader in the Indian stock market. Today's date is: {today_str}
        **JSON Schema:** Each object must have keys: "date" (YYYY-MM-DD), "event" (string), "type" (one of ["Domestic", "Global", "Corporate", "Geopolitical"]), and "impact" (one of ["High", "Medium", "Low"]).
        **Task:** Generate an array of 7 distinct, relevant events for the Indian market for today and the near future.
        """
        response_text = call_openrouter(prompt)
        
        if not response_text:
            raise ValueError("AI returned an empty response.")
        
        cleaned_text = response_text.strip().replace('```json', '').replace('```', '')
        events_json = json.loads(cleaned_text)
        
        # Validate that the AI returned a list
        if not isinstance(events_json, list):
            raise ValueError("AI did not return a list as expected.")
            
        doc_ref.set({'last_updated': today_str, 'events': events_json})
        return events_json
    except Exception as e:
        logger.error(f"FATAL: AI calendar generation failed. Error: {e}", exc_info=True)
        return []


@app.get("/api/calendar/user-events/{user_id}")
async def get_user_events(user_id: str):
    """ The 'Personal Diary' Reader - Fetches all events for a specific user. """
    if not db: raise HTTPException(500, "Firestore not initialized.")
    try:
        events = []
        docs = db.collection('users').document(user_id).collection('calendar_events').stream()
        for doc in docs:
            event_data = doc.to_dict(); event_data['id'] = doc.id
            events.append(event_data)
        return events
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/calendar/user-event")
async def add_user_event(event: UserCalendarEvent):
    """ Adds a new personal event to a user's diary. """
    if not db: raise HTTPException(500, "Firestore not initialized.")
    try:
        doc_ref = db.collection('users').document(event.userId).collection('calendar_events').add({
            'date': event.date, 'title': event.title, 'type': event.type,
            'timestamp': firestore.SERVER_TIMESTAMP
        })
        return {"status": "success", "eventId": doc_ref[1].id}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.put("/api/calendar/user-event/{user_id}/{event_id}")
async def update_user_event(user_id: str, event_id: str, event: UserCalendarEvent):
    """ Edits an existing personal event in a user's diary. """
    if not db: raise HTTPException(500, "Firestore not initialized.")
    try:
        db.collection('users').document(user_id).collection('calendar_events').document(event_id).update({
            'date': event.date, 'title': event.title, 'type': event.type
        })
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.delete("/api/calendar/user-event/{user_id}/{event_id}")
async def delete_user_event(user_id: str, event_id: str):
    """ Deletes a personal event from a user's diary. """
    if not db: raise HTTPException(500, "Firestore not initialized.")
    try:
        db.collection('users').document(user_id).collection('calendar_events').document(event_id).delete()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(500, str(e))
    

# --- Pydantic Models ---
class UserProfile(BaseModel):
    userId: str; displayName: str; picture: str
class QuizSubmission(BaseModel):
    userId: str
    level: int
    answers: dict


# --- USER & PROFILE ENDPOINTS ---
@app.post("/api/users/profile")
async def create_or_update_profile(profile: UserProfile):
    if not db: raise HTTPException(500, "Firestore not initialized.")
    doc_ref = db.collection('users').document(profile.userId)
    doc = doc_ref.get()
    
    if not doc.exists:
        logger.info(f"New user detected. Creating profile for: {profile.displayName} ({profile.userId})")
        doc_ref.set({'displayName': profile.displayName, 'picture': profile.picture, 'arenaScore': 0, 'dailyQuizCompleted': None})
        return {"status": "Profile created."}
    else:
        logger.info(f"Existing user signed in: {profile.displayName} ({profile.userId})")
        return {"status": "Profile already exists.", "data": doc.to_dict()}

# --- ARENA ENDPOINTS ---
def get_difficulty_tier(level: int) -> str:
    if level <= 5: return "Beginner"
    if level <= 10: return "Intermediate"
    if level <= 15: return "Advanced"
    return "Expert"

@app.get("/api/arena/daily-quiz/{level}")
async def get_daily_quiz(level: int):
    if not db: raise HTTPException(500, "Firestore not initialized.")
    today_str = str(date.today())
    level_key = f"level_{level}"
    doc_ref = db.collection('arena').document('daily_quizzes').collection(today_str).document('levels')
    doc = doc_ref.get()

    if doc.exists and level_key in doc.to_dict():
        quiz_data = doc.to_dict()[level_key]; return quiz_data
    
    logger.info(f"Generating new quiz for Level {level}...")
    try:
        difficulty = get_difficulty_tier(level)
        prompt = f"""
        **Instruction:** You are a JSON data generation engine for an Indian financial market quiz. Your sole function is to generate a JSON object. Do not provide any conversational text, explanations, or introductory sentences. Your entire response must be ONLY the raw JSON object.
        **JSON Schema:** The root object must have a "questions" key (an array of 10 question objects). Each question object must have: "question" (string), "options" (an array of 4 strings), and "correct" (the 0-based index of the correct option).
        **Difficulty:** The questions must be of **{difficulty}** difficulty.
        **Topics:** Cover a mix of recent Indian market news, global market events, and cryptocurrency concepts.
        """
        response_text = call_openrouter(prompt)
        
        if not response_text:
            raise ValueError("AI returned an empty response.")
        
        cleaned_text = response_text.strip().replace('```json', '').replace('```', '')

        try:
            quiz_json = json.loads(cleaned_text)
        except json.JSONDecodeError:
            logger.error(f"FATAL: AI returned invalid JSON even after cleaning! Raw text was: '{response_text}'")
            raise ValueError("AI response was not valid JSON.")

        answers = [q['correct'] for q in quiz_json['questions']]
        for q in quiz_json['questions']: del q['correct']
            
        doc_ref.set({level_key: {"questions": quiz_json['questions'], "answers": answers}}, merge=True)
        return {"questions": quiz_json['questions']}

    except Exception as e:
        logger.error(f"FATAL: AI quiz generation for Level {level} failed. Error: {e}", exc_info=True)
        raise HTTPException(500, "Could not generate the daily quiz. The AI service may be temporarily unavailable or returned an invalid format.")

@app.post("/api/arena/submit-quiz")
async def submit_quiz(submission: QuizSubmission):
    if not db: raise HTTPException(500, "Firestore not initialized.")
    today_str = str(date.today())
    level_key = f"level_{submission.level}"
    
    try:
        quiz_doc_ref = db.collection('arena').document('daily_quizzes').collection(today_str).document('levels')
        quiz_doc = quiz_doc_ref.get()
        if not quiz_doc.exists:
            raise HTTPException(404, "The daily quiz could not be found or has expired.")
        
        level_data = quiz_doc.to_dict().get(level_key)
        if not level_data:
            raise HTTPException(404, f"Quiz data for Level {submission.level} is not available.")
        
        correct_answers = level_data.get('answers', [])
        if not correct_answers:
             raise HTTPException(500, "Server error: Correct answers are missing for this quiz.")

        score = 0; results = {}
        for i, correct_index in enumerate(correct_answers):
            user_answer_str = submission.answers.get(str(i))
            
            is_correct = user_answer_str is not None and int(user_answer_str) == correct_index

            if is_correct:
                score += 10
            results[i] = {'correct_index': correct_index, 'was_correct': is_correct}
        
        # ... (Inside submit_quiz, replace the user_ref section with this) ...
        
        user_ref = db.collection('users').document(submission.userId)
        # Only update the score if it's greater than zero
        if score > 0:
            user_ref.update({'arenaScore': firestore.Increment(score)})
        # Always mark the quiz as completed
        user_ref.update({'dailyQuizCompleted': today_str})
        
        # --- NEW: Save the historical record ---
        history_ref = user_ref.collection('quiz_history').document(today_str)
        history_ref.set({
            'date': today_str,
            'level': submission.level,
            'score': score,
            'timestamp': firestore.SERVER_TIMESTAMP
        })
            
        return {"score": score, "results": results}
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"FATAL: An unexpected error occurred during quiz submission. Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected server error occurred while submitting your answers.")
    

# --- NEW ENDPOINT: Fetch User's Arena History ---
@app.get("/api/arena/history/{user_id}")
async def get_arena_history(user_id: str):
    if not db: raise HTTPException(500, "Firestore not initialized.")
    try:
        # Fetch history ordered by date (newest first)
        docs = db.collection('users').document(user_id).collection('quiz_history').order_by('date', direction=firestore.Query.DESCENDING).stream()
        history = [{'id': doc.id, **doc.to_dict()} for doc in docs]
        return history
    except Exception as e:
        logger.error(f"Failed to fetch arena history for {user_id}: {e}", exc_info=True)
        raise HTTPException(500, "Could not fetch history")

@app.get("/api/arena/leaderboard")
async def get_leaderboard():
    if not db: raise HTTPException(500, "Firestore not initialized.")
    docs = db.collection('users').order_by('arenaScore', direction=firestore.Query.DESCENDING).limit(10).stream()
    leaderboard = [{'id': doc.id, **doc.to_dict()} for doc in docs]
    return leaderboard

@app.get("/api/arena/profile/{user_id}")
async def get_profile(user_id: str):
    if not db: raise HTTPException(500, "Firestore not initialized.")
    doc = db.collection('users').document(user_id).get()
    if doc.exists: return {'id': doc.id, **doc.to_dict()}
    raise HTTPException(404, "User not found.")

@app.get("/")
def read_root():
    return {"status": "PatternIQ API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)