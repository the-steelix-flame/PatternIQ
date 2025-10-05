import React, { useState } from 'react';
import axios from 'axios';
import { Box, Typography, Paper, Grid, TextField, Button, CircularProgress, Alert, Select, MenuItem, FormControl, InputLabel, InputAdornment } from '@mui/material';
import { LineChart } from '@mui/x-charts';
import { useTheme } from '@mui/material/styles';
import TypingEffect from './TypingEffect'; // This can stay, it doesn't cause harm
import ReactMarkdown from 'react-markdown';

const API_URL = "http://127.0.0.1:8000";

const StatCard = ({ title, value, color = '#fff' }) => (
  <Paper sx={{ p: 2, textAlign: 'center', height: '100%' }}>
    <Typography variant="h5" sx={{ color, fontWeight: 'bold' }}>{value}</Typography>
    <Typography variant="body2" color="text.secondary">{title}</Typography>
  </Paper>
);

const ChartPlaceholder = ({ message }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', p: 3 }}>
        <Typography variant="h6" color="text.secondary" textAlign="center">{message}</Typography>
    </Box>
);

const BacktestDashboard = () => {
    const theme = useTheme();
    const [strategyText, setStrategyText] = useState('Buy if a green candle closes 10 points above previous resistance');
    const [symbol, setSymbol] = useState('NIFTY');
    const [interval, setInterval] = useState('15m');
    const [capital, setCapital] = useState(100000);
    const [riskPercent, setRiskPercent] = useState(1);
    const [slPercent, setSlPercent] = useState(1);
    const [targetPercent, setTargetPercent] = useState(2);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleBacktest = async (e) => {
        e.preventDefault(); setLoading(true); setError(''); setResult(null);
        try {
            const response = await axios.post(`${API_URL}/api/backtest`, { 
                symbol, interval,
                capital: parseFloat(capital), risk_percent: parseFloat(riskPercent),
                sl_percent: parseFloat(slPercent), target_percent: parseFloat(targetPercent),
                strategy_text: strategyText
            });
            setResult(response.data);
        } catch (err) { setError(err.response?.data?.detail || "An error occurred."); } 
        finally { setLoading(false); }
    };

    return (
        <Box>
            <Typography variant="h4" gutterBottom>Ultimate AI Backtesting Engine</Typography>
            <Paper sx={{ p: 3, mb: 3 }} component="form" onSubmit={handleBacktest}>
                <Grid container spacing={2}>
                    <Grid item xs={12}><Typography variant="h6">Your Creative Strategy</Typography></Grid>
                    <Grid item xs={12} sm={3}><TextField fullWidth label="Symbol" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} /></Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField fullWidth label="Describe Your Entry Strategy" value={strategyText} onChange={e => setStrategyText(e.target.value)} multiline rows={3} />
                    </Grid>
                    <Grid item xs={12} sm={3}><FormControl fullWidth><InputLabel>Timeframe</InputLabel><Select value={interval} label="Timeframe" onChange={e => setInterval(e.target.value)}><MenuItem value="15m">15m</MenuItem><MenuItem value="1h">1h</MenuItem><MenuItem value="1d">1 Day</MenuItem><MenuItem value="1wk">1 Week</MenuItem></Select></FormControl></Grid>
                    <Grid item xs={12} mt={2}><Typography variant="h6">Risk Management</Typography></Grid>
                    <Grid item xs={6} sm={3}><TextField fullWidth label="Initial Capital" type="number" value={capital} onChange={e => setCapital(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} /></Grid>
                    <Grid item xs={6} sm={3}><TextField fullWidth label="Risk per Trade" type="number" value={riskPercent} onChange={e => setRiskPercent(e.target.value)} InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} /></Grid>
                    <Grid item xs={6} sm={3}><TextField fullWidth label="Stop-Loss" type="number" value={slPercent} onChange={e => setSlPercent(e.target.value)} InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} /></Grid>
                    <Grid item xs={6} sm={3}><TextField fullWidth label="Target" type="number" value={targetPercent} onChange={e => setTargetPercent(e.target.value)} InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} /></Grid>
                    <Grid item xs={12} mt={2}><Button type="submit" variant="contained" size="large" disabled={loading}>{loading ? <CircularProgress size={24} /> : 'Run Ultimate AI Backtest'}</Button></Grid>
                </Grid>
            </Paper>

            {error && <Alert severity="error" sx={{mt:2}}>{error}</Alert>}

            {result && (
                <Grid container spacing={3}>
                    <Grid item xs={12}><Grid container spacing={2}>
                        <Grid item xs={6} md={3}><StatCard title="Net P/L" value={`₹${result.pnl}`} color={result.pnl > 0 ? '#4caf50' : '#f44336'} /></Grid>
                        <Grid item xs={6} md={3}><StatCard title="Return %" value={`${result.pnl_percent}%`} color={result.pnl > 0 ? '#4caf50' : '#f44336'} /></Grid>
                        <Grid item xs={6} md={3}><StatCard title="Max Drawdown" value={`${result.max_drawdown}%`} color="#ff9800" /></Grid>
                        <Grid item xs={6} md={3}><StatCard title="Profit Factor" value={result.profit_factor} color="#00BFFF" /></Grid>
                    </Grid></Grid>
                    <Grid item xs={12}><Paper sx={{ p: 3, height: { xs: 400, md: 600 } }}><Typography variant="h6">Equity Curve</Typography>{result.num_trades > 0 ? (<LineChart xAxis={[{ data: result.equity_curve.map(p => p.date), scaleType: 'point', tickLabelStyle: { angle: -45, textAnchor: 'end', fontSize: 10 } }]} series={[{ data: result.equity_curve.map(p => p.equity), color: theme.palette.primary.main, label: 'Equity (₹)', area: true, showMark: false }]} margin={{ bottom: 70 }} />) : (<ChartPlaceholder message="No trades were executed." />)}</Paper></Grid>
                    <Grid item xs={12} lg={7}><Paper sx={{ p: 3, height: 450 }}><Typography variant="h6">Drawdown Curve (%)</Typography>{result.num_trades > 0 ? (<LineChart xAxis={[{ data: result.drawdown_curve.map(p => p.date), scaleType: 'point', tickLabelStyle: { angle: -45, textAnchor: 'end', fontSize: 10 } }]} series={[{ data: result.drawdown_curve.map(p => p.drawdown), color: theme.palette.secondary.main, label: 'Drawdown (%)', area: true, showMark: false }]} margin={{ bottom: 70 }} />) : (<ChartPlaceholder message="No trades to plot." />)}</Paper></Grid>
                    <Grid item xs={12} lg={5}><Paper sx={{ p: 3, height: 450, overflowY: 'auto' }}><Typography variant="h6">🤖 AI Analysis</Typography><Box sx={{ mt: 2, '& h3': { fontSize: '1.2rem', my: 1 }, '& p': { fontSize: '1rem', lineHeight: 1.7 } }}><ReactMarkdown>{result.ai_explanation}</ReactMarkdown></Box></Paper></Grid>
                </Grid>
            )}
        </Box>
    );
};

export default BacktestDashboard;