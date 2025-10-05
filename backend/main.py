import os
import yfinance as yf
import pandas as pd
import pandas_ta as ta
import google.generativeai as genai
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

# --- Setup Logging ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Firebase Initialization ---
try:
    cred = credentials.Certificate("serviceAccountKey.json")
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    db = firestore.client()
except Exception as e:
    logger.error(f"Failed to initialize Firebase: {e}")
    db = None

# --- App Configuration ---
load_dotenv(); genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
app = FastAPI(title="PatternIQ API")
origins = ["http://localhost:5173", "http://localhost:3000"]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# --- NEW: Updated Pydantic Model for Backtest Request ---
class BacktestRequest(BaseModel):
    symbol: str
    interval: str
    capital: float
    risk_percent: float
    sl_percent: float
    target_percent: float
    # We now take the raw strategy text
    strategy_text: str

# class UserCalendarEvent(BaseModel):
#     userId: str
#     date: str # YYYY-MM-DD
#     title: str
#     type: str # e.g., 'Note', 'Reminder', 'Trade Idea'

model = genai.GenerativeModel('gemini-1.5-flash-latest')
INDEX_MAP = { "NIFTY": "^NSEI", "NIFTY 50": "^NSEI", "BANKNIFTY": "^NSEBANK", "NIFTY BANK": "^NSEBANK", "SENSEX": "^BSESN" }


def find_resistance_levels(data, lookback=5):
    """Identifies pivot highs as resistance levels for pattern detection."""
    resistance_levels = []
    # Ensure we don't go out of bounds of the data
    for i in range(lookback, len(data) - lookback):
        is_pivot_high = True
        # Check 'lookback' candles to the left
        for j in range(1, lookback + 1):
            if data['High'][i] < data['High'][i - j]:
                is_pivot_high = False
                break
        if not is_pivot_high:
            continue
        # Check 'lookback' candles to the right
        for j in range(1, lookback + 1):
            if data['High'][i] < data['High'][i + j]:
                is_pivot_high = False
                break
        if is_pivot_high:
            resistance_levels.append({'index': i, 'price': data['High'][i]})
    return resistance_levels

# This helper function is no longer needed, as the AI will generate its own logic.
# You can delete the old find_resistance_levels function.

@app.post("/api/backtest")
async def perform_backtest(request: BacktestRequest):
    try:
        # --- STAGE 1: AI as a PROJECT MANAGER (Strategy Parser) ---
        parsing_prompt = f"""
        You are a trading strategy analysis bot. Your only job is to parse the user's plain-English strategy and convert it into a structured JSON object.
        The user's strategy is: "{request.strategy_text}"

        Your task is to extract the following and return ONLY the JSON object, nothing else:
        1. "entry_condition": A short description of the main entry signal (e.g., "RSI is below 30", "Price bounces off support").
        2. "pattern_to_find": If the strategy involves a chart pattern, name it here (e.g., "support_bounce", "resistance_breakout"). Otherwise, "none".
        3. "required_indicators": A list of technical indicators needed (e.g., ["RSI", "MACD", "SMA_50"]).

        Example:
        - User: "Buy when the price bounces off a support level, but only if it's also above the 50-day moving average."
        - AI Output: {{"entry_condition": "Price bounces off support level", "pattern_to_find": "support_bounce", "required_indicators": ["SMA_50"]}}
        """
        response = model.generate_content(parsing_prompt)
        cleaned_response = response.text.strip().replace('```json', '').replace('```', '')
        params = json.loads(cleaned_response)

        # --- Data Fetching and Indicator Calculation ---
        ticker = INDEX_MAP.get(request.symbol.upper(), f"{request.symbol.upper()}.NS")
        is_intraday = request.interval in ["1m", "5m", "15m", "30m", "1h"]
        start_date = datetime.now() - timedelta(days=59 if is_intraday else 180)
        end_date = datetime.now()
        data = yf.download(ticker, start=start_date, end=end_date, interval=request.interval, auto_adjust=True, progress=False)
        if data.empty: raise HTTPException(404, "No data found for this symbol/timeframe combination.")
        
        data.columns = [col[0] if isinstance(col, tuple) else col for col in data.columns]
        data.reset_index(inplace=True); date_col = 'Datetime' if 'Datetime' in data.columns else 'Date'
        data.dropna(inplace=True); data.reset_index(drop=True, inplace=True)

        required_indicators = params.get('required_indicators', [])
        if "RSI" in required_indicators: data.ta.rsi(length=14, append=True)
        if "MACD" in required_indicators: data.ta.macd(append=True)
        if "SMA_50" in required_indicators: data.ta.sma(length=50, append=True)
        
        # --- STAGE 2: AI as a SPECIALIST CODER (TA Code Generator) ---
        entry_signals = pd.Series(False, index=data.index)
        if params.get('pattern_to_find') != "none":
            # --- THE FIX: This new prompt is context-aware and tells the AI the exact data schema. ---
            available_columns = ", ".join(f"'{col}'" for col in data.columns)
            coding_prompt = f"""
            You are an expert Python developer specializing in financial analysis with the pandas library.
            Write a single Python function named `find_signals` that takes a pandas DataFrame `data` as input.
            The function must analyze the data to find signals for the pattern: "{params['entry_condition']}".
            
            CRITICAL INSTRUCTION: The input DataFrame `data` has the following columns: {available_columns}.
            Your code MUST ONLY use these available columns. Do NOT invent columns like 'resistance' or 'time'. Use '{date_col}' for time-based operations.

            The function must return a pandas Series of booleans with the same index as the input data, where `True` indicates an entry signal.
            Provide ONLY the Python code for the function, nothing else. Be robust and handle potential edge cases.
            """
            code_response = model.generate_content(coding_prompt)
            code_to_execute = code_response.text.strip().replace('```python', '').replace('```', '')
            
            local_scope = {}
            exec(code_to_execute, globals(), local_scope)
            find_signals_func = local_scope['find_signals']
            entry_signals = find_signals_func(data)
        else:
            if params.get('entry_condition') == "RSI is below 30":
                entry_signals = data['RSI_14'] < 30

        # --- Execute Backtest using Dynamically Generated Signals ---
        capital = request.capital; equity = [capital]; trades = []; in_trade = False
        peak_equity = capital; drawdown_data = [{'date': data[date_col].iloc[0].strftime('%Y-%m-%d %H:%M'), 'drawdown': 0}]
        
        for i in range(1, len(data)):
            if not in_trade and entry_signals.iloc[i]:
                in_trade = True; entry_price = data['Close'][i]
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
                    capital += position_size * (pnl_percent / 100); equity.append(capital)
                    peak_equity = max(peak_equity, capital)
                    drawdown = (peak_equity - capital) / peak_equity * 100 if peak_equity > 0 else 0
                    drawdown_data.append({'date': data[date_col][i].strftime('%Y-%m-%d %H:%M'), 'drawdown': drawdown})
                    in_trade = False

        # --- STAGE 3: AI as a BUSINESS ANALYST (Performance Reviewer) ---
        final_equity = equity[-1]; pnl = final_equity - request.capital; pnl_percent = (pnl / request.capital) * 100 if request.capital > 0 else 0
        wins = [t for t in trades if t['pnl_percent'] > 0]; losses = [t for t in trades if t['pnl_percent'] <= 0]
        win_rate = (len(wins) / len(trades)) * 100 if trades else 0
        max_drawdown = max(d['drawdown'] for d in drawdown_data) if drawdown_data else 0
        total_profit = sum(t['pnl_percent'] for t in wins); total_loss = abs(sum(t['pnl_percent'] for t in losses))
        profit_factor = total_profit / total_loss if total_loss > 0 else 999.0

        analysis_prompt = f"""
        **Instruction:** You are a trading analysis engine. Your sole function is to analyze the provided backtest report and generate a structured analysis in Markdown format. Do not ask for more information. Do not act like a conversational chatbot. Analyze only the data provided.

        **Backtest Report Data:**
        - **Symbol:** {request.symbol}
        - **Strategy:** '{request.strategy_text}'
        - **Risk Config:** {request.sl_percent}% SL, {request.target_percent}% TGT
        - **Final Equity:** ₹{final_equity:,.0f}
        - **Net Profit/Loss:** ₹{pnl:,.0f} ({pnl_percent:.2f}%)
        - **Win Rate:** {win_rate:.2f}%
        - **Profit Factor:** {profit_factor:.2f}
        - **Max Drawdown:** {max_drawdown:.2f}%
        - **Total Trades:** {len(trades)}

        **Required Output Format (Use this exact Markdown structure):**

        ### Executive Summary
        [Your summary here. State if the strategy was profitable and how well it managed risk based on Profit Factor and Max Drawdown.]

        ### Performance Breakdown
        **Profitability:** [Your analysis here. Explain the relationship between Win Rate and Profit Factor.]
        **Risk Management:** [Your analysis here. Comment on the Max Drawdown relative to the return.]

        ### Actionable Insight & Suggestion
        [Your specific, data-driven suggestion here. If no trades, explain why. If poor performance, suggest a specific parameter change.]
        """
        ai_response = model.generate_content(analysis_prompt)
        ai_explanation = ai_response.text.strip()
        
        equity_curve_data = [{'date': data[date_col].iloc[0].strftime('%Y-%m-%d %H:%M'), 'equity': request.capital}]
        for i, trade in enumerate(trades):
            equity_curve_data.append({'date': trade['exit_date'].strftime('%Y-%m-%d %H:%M'), 'equity': equity[i+1]})

        return {
            "pnl": round(pnl, 2), "pnl_percent": round(pnl_percent, 2),
            "win_rate": round(win_rate, 2), "num_trades": len(trades),
            "max_drawdown": round(max_drawdown, 2), "profit_factor": round(profit_factor, 2),
            "equity_curve": equity_curve_data, "drawdown_curve": drawdown_data,
            "ai_explanation": ai_explanation
        }

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"An unexpected error occurred during backtest: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An unexpected server error occurred: {str(e)}")
    

NIFTY_50_SAMPLE = ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "HINDUNILVR.NS", "ICICIBANK.NS", "BHARTIARTL.NS", "SBIN.NS", "ITC.NS", "LT.NS"]

def scan_stocks_for_anomalies_task():
    if not db: return logger.error("Cannot scan: Firestore not initialized.")
    logger.info("Starting background anomaly scan...")
    for symbol in NIFTY_50_SAMPLE:
        try:
            data = yf.download(symbol, period="22d", interval="1d", auto_adjust=True, progress=False)
            if data.empty or len(data) < 22: continue
            
            data['avg_volume_20d'] = data['Volume'].rolling(window=20).mean()
            
            # --- THE DEFINITIVE FIX ---
            # .item() is the most robust and recommended way to extract a single value.
            # This permanently solves the "ambiguous truth value" error.
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


@app.get("/api/scan-anomalies")
async def scan_anomalies(background_tasks: BackgroundTasks):
    background_tasks.add_task(scan_stocks_for_anomalies_task)
    return {"status": "Scan initiated. Alerts will appear in the feed if found."}

# (The rest of the file remains the same)
# @app.get("/api/traders-calendar")
# async def get_traders_calendar():
#     if not db:
#         raise HTTPException(status_code=500, detail="Firestore database is not initialized.")
    
#     today_str = str(date.today())
#     doc_ref = db.collection('calendar').document('daily_events')
#     doc = doc_ref.get()

#     if doc.exists and doc.to_dict().get('date') == today_str:
#         logger.info("Serving calendar events from Firestore cache.")
#         return doc.to_dict().get('events')
#     else:
#         logger.info("Cache miss or stale. Generating new calendar events from AI.")
#         try:
#             prompt = """
#             You are a financial market data provider. Generate a concise array of 7 key events relevant to the Indian stock market for today and the near future.
#             For each event, provide: "date" (YYYY-MM-DD), "event" (description), "type" ('Domestic', 'Global', 'Corporate', 'Geopolitical'), and "impact" ('High', 'Medium', 'Low').
#             """
#             response = model.generate_content(prompt)
            
#             # --- THE CRITICAL DEBUG LOG ---
#             # This prints the raw AI output to your terminal so we can see exactly what it is.
#             logger.info(f"RAW AI Response Text: {response.text}")
            
#             # The API in JSON mode should return perfect JSON, but we parse it safely.
#             events_json = json.loads(response.text)

#             doc_ref.set({'date': today_str, 'events': events_json})
#             return events_json
#         except json.JSONDecodeError as json_err:
#             logger.error(f"AI returned invalid JSON! Error: {json_err}")
#             raise HTTPException(500, "The AI returned data in an invalid format. Please try again.")
#         except Exception as e:
#             logger.error(f"AI generation failed: {e}", exc_info=True)
#             raise HTTPException(500, f"AI generation failed: {str(e)}")
        
        
# @app.post("/api/calendar/user-event")
# async def add_user_event(event: UserCalendarEvent):
#     if not db:
#         raise HTTPException(status_code=500, detail="Firestore database is not initialized.")
#     try:
#         # Save the event to a user-specific subcollection for security
#         doc_ref = db.collection('users').document(event.userId).collection('calendar_events').add({
#             'date': event.date,
#             'title': event.title,
#             'type': event.type,
#             'timestamp': firestore.SERVER_TIMESTAMP
#         })
#         return {"status": "success", "eventId": doc_ref[1].id}
#     except Exception as e:
#         logger.error(f"Failed to add user event for {event.userId}: {e}", exc_info=True)
#         raise HTTPException(status_code=500, detail=str(e))

# # --- NEW ENDPOINT: Fetch all custom events for a user ---
# @app.get("/api/calendar/user-events/{user_id}")
# async def get_user_events(user_id: str):
#     if not db:
#         raise HTTPException(status_code=500, detail="Firestore database is not initialized.")
#     try:
#         events = []
#         docs = db.collection('users').document(user_id).collection('calendar_events').stream()
#         for doc in docs:
#             event_data = doc.to_dict()
#             event_data['id'] = doc.id
#             events.append(event_data)
#         return events
#     except Exception as e:
#         logger.error(f"Failed to fetch user events for {user_id}: {e}", exc_info=True)
#         raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/get-portfolio")
async def get_portfolio():
    return {"broker":"Kotak","total_value":125500,"holdings":[{"symbol":"RELIANCE","quantity":10,"avg_price":2800,"sector":"Energy"},{"symbol":"TATAMOTORS","quantity":50,"avg_price":950,"sector":"Automobile"}]}


class UserCalendarEvent(BaseModel):
    userId: str; date: str; title: str; type: str

    
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
        response = model.generate_content(prompt)
        
        if not response.text:
            raise ValueError("AI returned an empty response.")
        
        cleaned_text = response.text.strip().replace('```json', '').replace('```', '')
        events_json = json.loads(cleaned_text)
        
        # Validate that the AI returned a list
        if not isinstance(events_json, list):
            raise ValueError("AI did not return a list as expected.")
            
        doc_ref.set({'last_updated': today_str, 'events': events_json})
        return events_json
    except Exception as e:
        logger.error(f"FATAL: AI calendar generation failed. Error: {e}", exc_info=True)
        # Return an empty list to prevent the frontend from crashing
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
    answers: dict# { questionIndex: answerIndex }


# --- USER & PROFILE ENDPOINTS ---
@app.post("/api/users/profile")
async def create_or_update_profile(profile: UserProfile):
    if not db: raise HTTPException(500, "Firestore not initialized.")
    doc_ref = db.collection('users').document(profile.userId)
    doc = doc_ref.get()
    
    # --- THE FIX: Added explicit logging for transparency ---
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
        response = model.generate_content(prompt)
        
        # --- THE DEFINITIVE FIX: The Bulletproof Safety Net ---
        if not response.text:
            raise ValueError("AI returned an empty response.")
        
        # 1. We manually clean the response to remove any Markdown wrappers.
        cleaned_text = response.text.strip().replace('```json', '').replace('```', '')

        # 2. We TRY to parse the cleaned text. This is the only way to be 100% safe.
        try:
            quiz_json = json.loads(cleaned_text)
        except json.JSONDecodeError:
            logger.error(f"FATAL: AI returned invalid JSON even after cleaning! Raw text was: '{response.text}'")
            raise ValueError("AI response was not valid JSON.")

        # 3. We continue with the working logic.
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
            
            # --- THE DEFINITIVE FIX: Convert the user's text answer to a number before comparing ---
            is_correct = user_answer_str is not None and int(user_answer_str) == correct_index

            if is_correct:
                score += 10
            results[i] = {'correct_index': correct_index, 'was_correct': is_correct}
        
        user_ref = db.collection('users').document(submission.userId)
        # Only update the score if it's greater than zero
        if score > 0:
            user_ref.update({'arenaScore': firestore.Increment(score)})
        # Always mark the quiz as completed
        user_ref.update({'dailyQuizCompleted': today_str})
            
        return {"score": score, "results": results}
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"FATAL: An unexpected error occurred during quiz submission. Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected server error occurred while submitting your answers.")

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