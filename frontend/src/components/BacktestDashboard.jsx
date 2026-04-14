import React, { useState, useMemo } from 'react';
import axios from 'axios';
import {
    Box, Typography, Paper, Grid, TextField, Button, CircularProgress,
    Alert, Select, MenuItem, FormControl, InputLabel, InputAdornment,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip,
    Stack, Tooltip, ToggleButtonGroup, ToggleButton, Divider,
    Card, CardHeader, CardContent, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { LineChart, BarChart, PieChart, ScatterChart } from '@mui/x-charts';
import { createTheme, ThemeProvider, alpha } from '@mui/material/styles';
import ReactMarkdown from 'react-markdown';
import DownloadIcon from '@mui/icons-material/Download';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CodeIcon from '@mui/icons-material/Code';
import UploadFileIcon from '@mui/icons-material/UploadFile';

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// ─── Deep Blue Theme ───────────────────────────────────────────────────────────
const terminalTheme = createTheme({
    palette: {
        mode: 'dark',
        primary:   { main: '#4A9EFF', light: '#74B9FF', dark: '#1C6FD4' },
        secondary: { main: '#00D4AA', light: '#33DDBB', dark: '#009977' },
        background: {
            default: '#080E1A',
            paper:   '#0D1628',
        },
        divider: 'rgba(74,158,255,0.12)',
        text: {
            primary:   '#E8F4FF',
            secondary: '#7BA8D4',
        },
        success: { main: '#00D4AA' },
        error:   { main: '#FF5C6C' },
        warning: { main: '#FFB547' },
    },
    shape: { borderRadius: 10 },
    typography: {
        fontFamily: '"IBM Plex Sans", "Roboto", sans-serif',
        h3: { fontWeight: 700, letterSpacing: '-0.5px' },
        h5: { fontWeight: 600 },
        h6: { fontWeight: 600 },
        button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
        MuiCard: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    backgroundColor: '#0D1628',
                    border: '1px solid rgba(74,158,255,0.12)',
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: { backgroundImage: 'none' },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                root: {
                    borderColor: 'rgba(74,158,255,0.08)',
                    fontSize: '0.8rem',
                },
                head: {
                    backgroundColor: '#080E1A',
                    color: '#7BA8D4',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    fontSize: '0.7rem',
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: { borderRadius: 6 },
            },
        },
        MuiToggleButton: {
            styleOverrides: {
                root: {
                    border: '1px solid rgba(74,158,255,0.18)',
                    color: '#7BA8D4',
                    '&.Mui-selected': {
                        backgroundColor: 'rgba(74,158,255,0.18)',
                        color: '#4A9EFF',
                        borderColor: '#4A9EFF',
                    },
                },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        '& fieldset': { borderColor: 'rgba(74,158,255,0.2)' },
                        '&:hover fieldset': { borderColor: 'rgba(74,158,255,0.45)' },
                        '&.Mui-focused fieldset': { borderColor: '#4A9EFF' },
                    },
                },
            },
        },
        MuiSelect: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(74,158,255,0.2)' },
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                containedPrimary: {
                    background: 'linear-gradient(135deg, #1C6FD4 0%, #4A9EFF 100%)',
                    boxShadow: '0 4px 20px rgba(74,158,255,0.3)',
                    '&:hover': {
                        background: 'linear-gradient(135deg, #2278DE 0%, #60AAFF 100%)',
                        boxShadow: '0 6px 24px rgba(74,158,255,0.45)',
                    },
                },
                containedSecondary: {
                    background: 'linear-gradient(135deg, #009977 0%, #00D4AA 100%)',
                    boxShadow: '0 4px 16px rgba(0,212,170,0.25)',
                    '&:hover': {
                        background: 'linear-gradient(135deg, #00AA88 0%, #00E5BB 100%)',
                    },
                },
            },
        },
    },
});

// ─── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ title, value, color, subtext, icon }) => (
    <Paper
        sx={{
            p: 2,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: `linear-gradient(135deg, #0D1628 60%, ${alpha(color || '#4A9EFF', 0.12)} 100%)`,
            border: `1px solid ${alpha(color || '#4A9EFF', 0.22)}`,
            borderRadius: 2,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
                content: '""',
                position: 'absolute',
                top: 0, left: 0, right: 0,
                height: '3px',
                background: color || '#4A9EFF',
                borderRadius: '2px 2px 0 0',
            },
        }}
    >
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
            <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.65rem', fontWeight: 600 }}>
                {title}
            </Typography>
            {icon && <Box sx={{ color: alpha(color || '#4A9EFF', 0.5), lineHeight: 0 }}>{icon}</Box>}
        </Box>
        <Typography variant="h5" sx={{ color, fontWeight: 700, mt: 1, letterSpacing: '-0.5px' }}>
            {value}
        </Typography>
        {subtext && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem', mt: 0.5 }}>
                {subtext}
            </Typography>
        )}
    </Paper>
);

// ─── Chart Empty State ─────────────────────────────────────────────────────────
const ChartPlaceholder = ({ message, hint }) => (
    <Box
        sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', p: 3, gap: 1,
            background: 'rgba(74,158,255,0.03)',
            border: '1px dashed rgba(74,158,255,0.15)',
            borderRadius: 2,
        }}
    >
        <InfoOutlinedIcon sx={{ color: 'rgba(74,158,255,0.3)', fontSize: 28 }} />
        <Typography variant="body2" color="text.secondary" textAlign="center">{message}</Typography>
        {hint && <Typography variant="caption" color="text.disabled" textAlign="center">{hint}</Typography>}
    </Box>
);

// ─── Contextual Chart Insight ──────────────────────────────────────────────────
const ChartInsight = ({ children }) => (
    <Box sx={{
        mt: 1, px: 1.5, py: 0.75,
        background: 'rgba(74,158,255,0.07)',
        borderLeft: '3px solid rgba(74,158,255,0.4)',
        borderRadius: '0 6px 6px 0',
    }}>
        <Typography variant="caption" sx={{ color: '#7BA8D4', lineHeight: 1.5 }}>
            {children}
        </Typography>
    </Box>
);

// ─── Strategy Templates ────────────────────────────────────────────────────────
const STRATEGY_TEMPLATES = [
    { label: "RSI Reversal",      text: "Buy when RSI drops below 30. Sell when RSI crosses above 70." },
    { label: "MACD Trend",        text: "Buy when MACD line crosses above the signal line. Sell when it crosses below." },
    { label: "Resistance Breakout", text: "Buy if a green candle closes 10 points above previous resistance." },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
function getEquityInsight(equityCurve, pnlPercent) {
    if (!equityCurve || equityCurve.length < 2) return null;
    const first = equityCurve[0].equity;
    const last  = equityCurve[equityCurve.length - 1].equity;
    const peak  = Math.max(...equityCurve.map(p => p.equity));
    const trough = Math.min(...equityCurve.map(p => p.equity));
    if (pnlPercent > 5) return `Strong upward trajectory — equity grew from ₹${first.toLocaleString()} to ₹${last.toLocaleString()}, peaking at ₹${peak.toLocaleString()}.`;
    if (pnlPercent < -3) return `Declining equity path — the curve dipped to ₹${trough.toLocaleString()}. Consider tightening your stop-loss.`;
    return `Mostly flat equity with minor swings between ₹${trough.toLocaleString()} and ₹${peak.toLocaleString()}. Strategy needs stronger signals.`;
}

function getMonthlyInsight(barData) {
    if (!barData || barData.length === 0) return null;
    const best  = barData.reduce((a, b) => (a.pnl > b.pnl ? a : b));
    const worst = barData.reduce((a, b) => (a.pnl < b.pnl ? a : b));
    return `Best month: ${best.month} (₹${best.pnl.toLocaleString()}) · Worst: ${worst.month} (₹${worst.pnl.toLocaleString()})`;
}

function getPieInsight(winRate, profitFactor) {
    if (winRate >= 60) return `High win rate of ${winRate}% with profit factor ${profitFactor}× — strategy has solid edge.`;
    if (winRate < 40) return `Win rate is ${winRate}% — below 40%. Ensure your reward-to-risk compensates for frequent losses.`;
    return `Balanced win rate of ${winRate}%. Profit factor of ${profitFactor}× — focus on avoiding large single losses.`;
}

function getScatterInsight(scatterData) {
    if (!scatterData || scatterData.length === 0) return null;
    const quickWins = scatterData.filter(d => d.x < 4 && d.y > 0).length;
    const longLosses = scatterData.filter(d => d.x > 8 && d.y < 0).length;
    if (quickWins > scatterData.length * 0.4) return `${quickWins} quick wins (under 4 hrs) — strategy performs best with short hold times.`;
    if (longLosses > 2) return `${longLosses} long-duration losses detected. Consider adding a time-based exit rule.`;
    return 'Hold duration has mixed impact on PnL — no clear time-based pattern detected.';
}

// ─── Main Component ────────────────────────────────────────────────────────────
const BacktestDashboard = ({ user, userData }) => {
    // Input Mode State
    const [inputMode, setInputMode] = useState('ai'); // 'ai' or 'python'
    const [customScript, setCustomScript] = useState('');
    const [scriptName, setScriptName] = useState('');

    const [strategyText, setStrategyText] = useState(STRATEGY_TEMPLATES[0].text);
    const [symbol,       setSymbol]       = useState('NIFTY');
    const [interval,     setInterval]     = useState('15m');
    const [capital,      setCapital]      = useState(100000);
    const [riskPercent,  setRiskPercent]  = useState(1);
    const [slPercent,    setSlPercent]    = useState(1);
    const [targetPercent,setTargetPercent]= useState(2);

    const [result,      setResult]      = useState(null);
    const [loading,     setLoading]     = useState(false);
    const [error,       setError]       = useState('');
    const [tradeFilter, setTradeFilter] = useState('all');

    const [shareModalOpen,    setShareModalOpen]    = useState(false);
    const [shareTitle,        setShareTitle]        = useState('');
    const [shareDesc,         setShareDesc]         = useState('');
    const [shareTags,         setShareTags]         = useState('strategy, backtest');
    const [saveModalOpen,     setSaveModalOpen]     = useState(false);
    const [savedStrategyName, setSavedStrategyName] = useState('');

    // Handle .py file upload
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setScriptName(file.name);
        const reader = new FileReader();
        reader.onload = (evt) => setCustomScript(evt.target.result);
        reader.readAsText(file);
    };

    // Download Python script
    const handleDownloadScript = () => {
        // Fallback to customScript if result.python_code isn't provided by backend yet
        const codeToDownload = result?.python_code || customScript;
        if (!codeToDownload) return alert("No Python script is available to download for this backtest.");

        const blob = new Blob([codeToDownload], { type: 'text/x-python;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${symbol}_strategy.py`;
        link.click();
    };

    const handleBacktest = async (e) => {
        e.preventDefault();
        setLoading(true); setError(''); setResult(null);
        try {
            const payload = {
                symbol, interval,
                capital: parseFloat(capital),
                risk_percent: parseFloat(riskPercent),
                sl_percent: parseFloat(slPercent),
                target_percent: parseFloat(targetPercent),
                mode: inputMode,
                strategy_text: inputMode === 'ai' ? strategyText : '',
                custom_script: inputMode === 'python' ? customScript : ''
            };

            const response = await axios.post(`${API_URL}/api/backtest`, payload);
            setResult(response.data);
            setTradeFilter('all');
        } catch (err) {
            setError(err.response?.data?.detail || 'An error occurred.');
        } finally {
            setLoading(false);
        }
    };

    const handleShareStrategy = async () => {
        try {
            const tagsArray = shareTags.split(',').map(t => t.trim()).filter(Boolean);
            await axios.post(`${API_URL}/api/community/post`, {
                userId: user?.sub || 'anonymous_id',
                displayName: userData?.displayName || user?.name || 'Analyst',
                picture: user?.picture || '',
                type: 'strategy',
                title: shareTitle,
                content: shareDesc,
                tags: tagsArray,
                strategyData: {
                    symbol, interval,
                    pnl_percent:    result.pnl_percent,
                    win_rate:       result.win_rate,
                    profit_factor:  result.profit_factor,
                },
            });
            setShareModalOpen(false);
            alert('Strategy shared to the Community Hub!');
        } catch {
            alert('Failed to share strategy.');
        }
    };

    const handleSaveToProfile = async () => {
        try {
            await axios.post(`${API_URL}/api/user/strategies/save`, {
                userId: user?.sub || 'anonymous_id',
                name: savedStrategyName || `${symbol} Strategy`,
                symbol, interval, 
                strategyText: inputMode === 'ai' ? strategyText : 'Custom Python Script',
                python_code: result?.python_code || customScript, // Ensure script is saved!
                capital: parseFloat(capital),
                riskPercent: parseFloat(riskPercent),
                slPercent: parseFloat(slPercent),
                targetPercent: parseFloat(targetPercent),
                resultData: result,
            });
            setSaveModalOpen(false);
            alert('Strategy saved to your profile!');
        } catch {
            alert('Failed to save strategy.');
        }
    };

    const filteredTrades = useMemo(() => {
        if (!result?.trades) return [];
        if (tradeFilter === 'wins')   return result.trades.filter(t => t.pnl_percent > 0);
        if (tradeFilter === 'losses') return result.trades.filter(t => t.pnl_percent <= 0);
        return result.trades;
    }, [result, tradeFilter]);

    const exportToCSV = () => {
        if (!result?.trades) return;
        const headers = ['Entry Date', 'Exit Date', 'Entry Price', 'Exit Price', 'P/L %', 'Reason'];
        const rows = result.trades.map(t =>
            `${t.entry_date},${t.exit_date},${t.entry_price},${t.exit_price},${t.pnl_percent},${t.reason}`
        );
        const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `PatternIQ_Trades_${symbol}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    // ─── Derived insight strings ─────────────────────────────────────────────
    const equityInsight  = result ? getEquityInsight(result.equity_curve, result.pnl_percent)  : null;
    const monthlyInsight = result ? getMonthlyInsight(result.bar_data)                          : null;
    const pieInsight     = result ? getPieInsight(result.win_rate, result.profit_factor)        : null;
    const scatterInsight = result ? getScatterInsight(result.scatter_data)                      : null;

    // ─── Stat card meta ──────────────────────────────────────────────────────
    const pnlColor    = result ? (result.pnl > 0 ? '#00D4AA' : '#FF5C6C') : '#4A9EFF';
    const returnColor = pnlColor;

    return (
        <ThemeProvider theme={terminalTheme}>
            <Box
                sx={{
                    maxWidth: '1400px',
                    margin: '0 auto',
                    px: { xs: 1, sm: 2, md: 3 },
                    py: 3,
                    minHeight: '100vh',
                    background: '#080E1A',
                }}
            >
                {/* ── Header ───────────────────────────────────────────────── */}
                <Box mb={4} display="flex" justifyContent="space-between" alignItems="flex-end">
                    <Box>
                        <Box display="flex" alignItems="center" gap={1.5} mb={0.5}>
                            <ShowChartIcon sx={{ color: '#4A9EFF', fontSize: 30 }} />
                            <Typography variant="h3" sx={{ color: 'text.primary', lineHeight: 1 }}>
                                Terminal
                            </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                            Design, test, and extract your algorithmic strategies.
                        </Typography>
                    </Box>
                    <Chip
                        label="LIVE ENGINE"
                        size="small"
                        sx={{
                            background: 'rgba(0,212,170,0.12)',
                            color: '#00D4AA',
                            border: '1px solid rgba(0,212,170,0.3)',
                            fontWeight: 700,
                            letterSpacing: '0.08em',
                            fontSize: '0.65rem',
                        }}
                    />
                </Box>

                {/* ── Command Center ───────────────────────────────────────── */}
                <Card elevation={0} sx={{ mb: 4, borderRadius: 3 }}>
                    <Box
                        component="form"
                        onSubmit={handleBacktest}
                        sx={{
                            p: 3,
                            background: 'linear-gradient(135deg, #0D1628 0%, #0A1420 100%)',
                        }}
                    >
                        <Grid container spacing={3}>
                            {/* Strategy Input Toggle & Logic */}
                            <Grid item xs={12} md={8}>
                                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                                    <ToggleButtonGroup
                                        value={inputMode}
                                        exclusive
                                        onChange={(e, val) => val && setInputMode(val)}
                                        size="small"
                                        sx={{ height: 32 }}
                                    >
                                        <ToggleButton value="ai" sx={{ px: 2, fontSize: '0.75rem', py: 0 }}>AI Builder</ToggleButton>
                                        <ToggleButton value="python" sx={{ px: 2, fontSize: '0.75rem', py: 0 }}>Custom Python</ToggleButton>
                                    </ToggleButtonGroup>

                                    {inputMode === 'ai' && (
                                        <Stack direction="row" spacing={0.75} flexWrap="wrap">
                                            {STRATEGY_TEMPLATES.map((tpl, i) => (
                                                <Tooltip title={`Use ${tpl.label} template`} key={i}>
                                                    <Chip
                                                        icon={<AutoFixHighIcon sx={{ fontSize: '14px !important' }} />}
                                                        label={tpl.label}
                                                        size="small"
                                                        onClick={() => setStrategyText(tpl.text)}
                                                        clickable
                                                        sx={{
                                                            fontSize: '0.7rem',
                                                            background: strategyText === tpl.text
                                                                ? 'rgba(74,158,255,0.2)'
                                                                : 'rgba(74,158,255,0.06)',
                                                            color: strategyText === tpl.text ? '#4A9EFF' : '#7BA8D4',
                                                            border: `1px solid ${strategyText === tpl.text ? 'rgba(74,158,255,0.5)' : 'rgba(74,158,255,0.15)'}`,
                                                            '& .MuiChip-icon': { color: 'inherit' },
                                                        }}
                                                    />
                                                </Tooltip>
                                            ))}
                                        </Stack>
                                    )}
                                </Box>

                                {/* Input Area based on Mode */}
                                {inputMode === 'ai' ? (
                                    <TextField
                                        fullWidth
                                        placeholder="Describe your strategy in plain English…"
                                        value={strategyText}
                                        onChange={e => setStrategyText(e.target.value)}
                                        multiline
                                        rows={3}
                                        sx={{ mb: 2 }}
                                        inputProps={{ style: { fontSize: '0.875rem', lineHeight: 1.6 } }}
                                    />
                                ) : (
                                    <Box sx={{ border: '1px dashed rgba(74,158,255,0.3)', borderRadius: 2, p: 2, mb: 2, minHeight: '107px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                        {!customScript ? (
                                            <Box textAlign="center">
                                                <UploadFileIcon sx={{ fontSize: 32, color: 'rgba(74,158,255,0.5)', mb: 1 }} />
                                                <Typography variant="body2" color="text.secondary" mb={1}>Upload your .py strategy file</Typography>
                                                <Button variant="outlined" component="label" size="small" sx={{ color: '#4A9EFF', borderColor: 'rgba(74,158,255,0.5)' }}>
                                                    Select File
                                                    <input type="file" accept=".py" hidden onChange={handleFileUpload} />
                                                </Button>
                                            </Box>
                                        ) : (
                                            <Box textAlign="left">
                                                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                                    <Typography variant="caption" sx={{ color: '#00D4AA', fontWeight: 600 }}>{scriptName || 'custom_strategy.py'} loaded</Typography>
                                                    <Button size="small" onClick={() => { setCustomScript(''); setScriptName(''); }} sx={{ color: '#FF5C6C', minWidth: 0, p: 0 }}>Remove</Button>
                                                </Box>
                                                <TextField
                                                    fullWidth multiline rows={2}
                                                    value={customScript}
                                                    onChange={e => setCustomScript(e.target.value)}
                                                    inputProps={{ style: { fontSize: '0.75rem', fontFamily: 'monospace', color: '#7BA8D4' } }}
                                                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(0,0,0,0.2)' } }}
                                                />
                                            </Box>
                                        )}
                                    </Box>
                                )}

                                <Grid container spacing={2}>
                                    <Grid item xs={6} sm={4}>
                                        <TextField
                                            fullWidth label="Symbol" size="small"
                                            value={symbol}
                                            onChange={e => setSymbol(e.target.value.toUpperCase())}
                                        />
                                    </Grid>
                                    <Grid item xs={6} sm={4}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel>Timeframe</InputLabel>
                                            <Select value={interval} label="Timeframe" onChange={e => setInterval(e.target.value)}>
                                                <MenuItem value="15m">15 min</MenuItem>
                                                <MenuItem value="1h">1 Hour</MenuItem>
                                                <MenuItem value="1d">1 Day</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                </Grid>
                            </Grid>

                            {/* Risk Parameters */}
                            <Grid item xs={12} md={4}>
                                <Typography variant="h6" sx={{ color: 'text.primary', mb: 1.5 }}>
                                    Risk Parameters
                                </Typography>
                                <Grid container spacing={2}>
                                    <Grid item xs={6}>
                                        <TextField
                                            fullWidth label="Capital" size="small" type="number"
                                            value={capital} onChange={e => setCapital(e.target.value)}
                                            InputProps={{ startAdornment: <InputAdornment position="start"><Typography variant="caption" color="text.secondary">₹</Typography></InputAdornment> }}
                                        />
                                    </Grid>
                                    <Grid item xs={6}>
                                        <TextField
                                            fullWidth label="Risk / Trade" size="small" type="number"
                                            value={riskPercent} onChange={e => setRiskPercent(e.target.value)}
                                            InputProps={{ endAdornment: <InputAdornment position="end"><Typography variant="caption" color="text.secondary">%</Typography></InputAdornment> }}
                                        />
                                    </Grid>
                                    <Grid item xs={6}>
                                        <TextField
                                            fullWidth label="Stop-Loss" size="small" type="number"
                                            value={slPercent} onChange={e => setSlPercent(e.target.value)}
                                            InputProps={{ endAdornment: <InputAdornment position="end"><Typography variant="caption" color="text.secondary">%</Typography></InputAdornment> }}
                                        />
                                    </Grid>
                                    <Grid item xs={6}>
                                        <TextField
                                            fullWidth label="Target" size="small" type="number"
                                            value={targetPercent} onChange={e => setTargetPercent(e.target.value)}
                                            InputProps={{ endAdornment: <InputAdornment position="end"><Typography variant="caption" color="text.secondary">%</Typography></InputAdornment> }}
                                        />
                                    </Grid>
                                </Grid>
                                <Button
                                    type="submit" variant="contained" color="primary"
                                    size="large" fullWidth
                                    sx={{ mt: 2.5, height: 48, fontSize: '0.95rem' }}
                                    disabled={loading || (inputMode === 'python' && !customScript)}
                                    startIcon={loading ? null : <ShowChartIcon />}
                                >
                                    {loading
                                        ? <><CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />Running Backtest…</>
                                        : 'Execute Backtest'
                                    }
                                </Button>
                            </Grid>
                        </Grid>
                    </Box>
                </Card>

                {error && (
                    <Alert severity="error" sx={{ mb: 4, borderRadius: 2, border: '1px solid rgba(255,92,108,0.3)' }}>
                        {error}
                    </Alert>
                )}

                {/* ── Results ──────────────────────────────────────────────── */}
                {result && (
                    <Box>
                        {/* KPI Row */}
                        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                            <Typography variant="h5" sx={{ color: 'text.primary' }}>
                                Performance Overview
                            </Typography>
                            <Chip
                                label={`${result.num_trades} trades · ${symbol} ${interval}`}
                                size="small"
                                sx={{
                                    background: 'rgba(74,158,255,0.1)',
                                    color: '#7BA8D4',
                                    border: '1px solid rgba(74,158,255,0.2)',
                                    fontSize: '0.7rem',
                                }}
                            />
                        </Box>

                        <Grid container spacing={2} mb={4}>
                            <Grid item xs={6} sm={4} md={2}>
                                <StatCard
                                    title="Net P/L"
                                    value={`₹${result.pnl.toLocaleString()}`}
                                    color={pnlColor}
                                    icon={result.pnl > 0 ? <TrendingUpIcon fontSize="small" /> : <TrendingDownIcon fontSize="small" />}
                                    subtext={result.pnl > 0 ? 'Strategy is profitable' : 'Strategy is in loss'}
                                />
                            </Grid>
                            <Grid item xs={6} sm={4} md={2}>
                                <StatCard
                                    title="Total Return"
                                    value={`${result.pnl_percent}%`}
                                    color={returnColor}
                                    subtext={`On ₹${Number(capital).toLocaleString()} capital`}
                                />
                            </Grid>
                            <Grid item xs={6} sm={4} md={2}>
                                <StatCard
                                    title="Win Rate"
                                    value={`${result.win_rate}%`}
                                    color="#4A9EFF"
                                    subtext={result.win_rate >= 50 ? 'Above average' : 'Below average'}
                                />
                            </Grid>
                            <Grid item xs={6} sm={4} md={2}>
                                <StatCard
                                    title="Max Drawdown"
                                    value={`${result.max_drawdown}%`}
                                    color="#FFB547"
                                    subtext={result.max_drawdown > 10 ? 'High risk — review SL' : 'Within safe range'}
                                />
                            </Grid>
                            <Grid item xs={6} sm={4} md={2}>
                                <StatCard
                                    title="Avg Win"
                                    value={`+${result.avg_win}%`}
                                    color="#00D4AA"
                                    subtext="Per winning trade"
                                />
                            </Grid>
                            <Grid item xs={6} sm={4} md={2}>
                                <StatCard
                                    title="Avg Loss"
                                    value={`-${result.avg_loss}%`}
                                    color="#FF5C6C"
                                    subtext={result.avg_win > result.avg_loss ? 'Favourable R:R' : 'Unfavourable R:R'}
                                />
                            </Grid>
                        </Grid>

                        {/* ── Charts Row 1: Equity + AI ─────────────────────── */}
                        <Grid container spacing={3} mb={3}>
                            {/* Equity Curve */}
                            <Grid item xs={12} lg={8}>
                                <Card elevation={0} sx={{ borderRadius: 3, height: '100%' }}>
                                    <CardHeader
                                        title="Cumulative Equity Curve"
                                        titleTypographyProps={{ variant: 'h6', sx: { color: 'text.primary' } }}
                                        subheader="Portfolio value over the backtest period"
                                        subheaderTypographyProps={{ variant: 'caption', sx: { color: 'text.secondary' } }}
                                    />
                                    <Divider sx={{ borderColor: 'divider' }} />
                                    <CardContent sx={{ pb: '12px !important' }}>
                                        <Box sx={{ height: 320 }}>
                                            {result.num_trades > 0 ? (
                                                <LineChart
                                                    xAxis={[{
                                                        data: result.equity_curve.map(p => p.date),
                                                        scaleType: 'point',
                                                        tickLabelStyle: { angle: -35, textAnchor: 'end', fontSize: 10, fill: '#7BA8D4' },
                                                    }]}
                                                    series={[{
                                                        data: result.equity_curve.map(p => p.equity),
                                                        color: '#4A9EFF',
                                                        label: 'Equity (₹)',
                                                        area: true,
                                                        showMark: false,
                                                    }]}
                                                    sx={{
                                                        '& .MuiAreaElement-root': { fill: 'url(#equityGradient)', opacity: 0.3 },
                                                        '& .MuiLineElement-root': { strokeWidth: 2 },
                                                        '& .MuiChartsAxis-tickLabel': { fill: '#7BA8D4' },
                                                    }}
                                                    margin={{ bottom: 55, top: 10, left: 70, right: 20 }}
                                                    height={320}
                                                />
                                            ) : (
                                                <ChartPlaceholder
                                                    message="No trades were executed."
                                                    hint="Try adjusting your strategy conditions or timeframe."
                                                />
                                            )}
                                        </Box>
                                        {equityInsight && <ChartInsight>{equityInsight}</ChartInsight>}
                                    </CardContent>
                                </Card>
                            </Grid>

                            {/* AI Insights */}
                            <Grid item xs={12} lg={4}>
                                <Card
                                    elevation={0}
                                    sx={{
                                        borderRadius: 3,
                                        height: '100%',
                                        background: 'linear-gradient(160deg, #0D1628 0%, #071020 100%)',
                                        border: '1px solid rgba(74,158,255,0.18)',
                                    }}
                                >
                                    <CardHeader
                                        title={
                                            <Box display="flex" alignItems="center" gap={1}>
                                                <Box sx={{
                                                    width: 8, height: 8, borderRadius: '50%',
                                                    background: '#4A9EFF',
                                                    boxShadow: '0 0 8px #4A9EFF',
                                                    animation: 'pulse 2s infinite',
                                                    '@keyframes pulse': {
                                                        '0%, 100%': { opacity: 1 },
                                                        '50%': { opacity: 0.4 },
                                                    },
                                                }} />
                                                <Typography variant="h6" sx={{ color: '#4A9EFF' }}>AI Insights</Typography>
                                            </Box>
                                        }
                                        subheader="Powered by strategy analysis"
                                        subheaderTypographyProps={{ variant: 'caption', sx: { color: 'text.secondary' } }}
                                    />
                                    <Divider sx={{ borderColor: 'divider' }} />
                                    <CardContent sx={{ height: 340, overflowY: 'auto', '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-thumb': { background: 'rgba(74,158,255,0.3)', borderRadius: '4px' } }}>
                                        <Box sx={{
                                            '& h3': { fontSize: '0.95rem', mt: 0, mb: 0.5, color: '#E8F4FF', fontWeight: 600 },
                                            '& p':  { fontSize: '0.85rem', lineHeight: 1.7, color: '#7BA8D4', mt: 0, mb: 1.5 },
                                            '& ul': { pl: 2, color: '#7BA8D4', fontSize: '0.85rem' },
                                            '& li': { mb: 0.5 },
                                            '& strong': { color: '#4A9EFF' },
                                        }}>
                                            <ReactMarkdown>{result.ai_explanation}</ReactMarkdown>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>

                        {/* ── Charts Row 2: Monthly + Pie + Scatter ─────────── */}
                        <Grid container spacing={3} mb={3}>
                            {/* Monthly Returns */}
                            <Grid item xs={12} md={4}>
                                <Card elevation={0} sx={{ borderRadius: 3 }}>
                                    <CardHeader
                                        title="Monthly Returns"
                                        titleTypographyProps={{ variant: 'h6', sx: { color: 'text.primary' } }}
                                        subheader="PnL grouped by calendar month"
                                        subheaderTypographyProps={{ variant: 'caption', sx: { color: 'text.secondary' } }}
                                    />
                                    <Divider sx={{ borderColor: 'divider' }} />
                                    <CardContent sx={{ pb: '12px !important' }}>
                                        <Box sx={{ height: 260 }}>
                                            {result.bar_data?.length > 0 ? (
                                                <BarChart
                                                    dataset={result.bar_data}
                                                    xAxis={[{
                                                        scaleType: 'band',
                                                        dataKey: 'month',
                                                        tickLabelStyle: { fontSize: 10, fill: '#7BA8D4' },
                                                    }]}
                                                    series={[{
                                                        dataKey: 'pnl',
                                                        color: '#00D4AA',
                                                        label: 'Monthly PnL (₹)',
                                                    }]}
                                                    sx={{ '& .MuiChartsAxis-tickLabel': { fill: '#7BA8D4' } }}
                                                    margin={{ top: 10, bottom: 30, left: 55, right: 10 }}
                                                    height={260}
                                                />
                                            ) : (
                                                <ChartPlaceholder
                                                    message="Not enough data for monthly view."
                                                    hint="Run a longer backtest period to see monthly PnL."
                                                />
                                            )}
                                        </Box>
                                        {monthlyInsight && <ChartInsight>{monthlyInsight}</ChartInsight>}
                                    </CardContent>
                                </Card>
                            </Grid>

                            {/* Win/Loss Pie */}
                            <Grid item xs={12} md={4}>
                                <Card elevation={0} sx={{ borderRadius: 3 }}>
                                    <CardHeader
                                        title="Win / Loss Distribution"
                                        titleTypographyProps={{ variant: 'h6', sx: { color: 'text.primary' } }}
                                        subheader={`${result.num_trades} total trades analysed`}
                                        subheaderTypographyProps={{ variant: 'caption', sx: { color: 'text.secondary' } }}
                                    />
                                    <Divider sx={{ borderColor: 'divider' }} />
                                    <CardContent sx={{ pb: '12px !important' }}>
                                        <Box sx={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {result.num_trades > 0 ? (
                                                <PieChart
                                                    series={[{
                                                        data: result.pie_data,
                                                        innerRadius: 50,
                                                        outerRadius: 90,
                                                        paddingAngle: 3,
                                                        cornerRadius: 5,
                                                        highlightScope: { faded: 'global', highlighted: 'item' },
                                                    }]}
                                                    height={240}
                                                    slotProps={{
                                                        legend: {
                                                            direction: 'row',
                                                            position: { vertical: 'bottom', horizontal: 'middle' },
                                                            padding: 0,
                                                            labelStyle: { fill: '#7BA8D4', fontSize: 12 },
                                                        },
                                                    }}
                                                />
                                            ) : (
                                                <ChartPlaceholder message="No trades to display." />
                                            )}
                                        </Box>
                                        {pieInsight && <ChartInsight>{pieInsight}</ChartInsight>}
                                    </CardContent>
                                </Card>
                            </Grid>

                            {/* Duration vs PnL Scatter */}
                            <Grid item xs={12} md={4}>
                                <Card elevation={0} sx={{ borderRadius: 3 }}>
                                    <CardHeader
                                        title="Duration vs PnL"
                                        titleTypographyProps={{ variant: 'h6', sx: { color: 'text.primary' } }}
                                        subheader="Each dot = one trade (hours held vs return)"
                                        subheaderTypographyProps={{ variant: 'caption', sx: { color: 'text.secondary' } }}
                                    />
                                    <Divider sx={{ borderColor: 'divider' }} />
                                    <CardContent sx={{ pb: '12px !important' }}>
                                        <Box sx={{ height: 260 }}>
                                            {result.scatter_data?.length > 0 ? (
                                                <ScatterChart
                                                    series={[{
                                                        data: result.scatter_data,
                                                        color: '#4A9EFF',
                                                        label: 'Trades',
                                                    }]}
                                                    xAxis={[{ label: 'Hold Duration (hrs)', labelStyle: { fill: '#7BA8D4', fontSize: 11 } }]}
                                                    yAxis={[{ label: 'PnL (%)',             labelStyle: { fill: '#7BA8D4', fontSize: 11 } }]}
                                                    sx={{ '& .MuiChartsAxis-tickLabel': { fill: '#7BA8D4' } }}
                                                    margin={{ top: 10, bottom: 50, left: 55, right: 20 }}
                                                    height={260}
                                                />
                                            ) : (
                                                <ChartPlaceholder
                                                    message="Not enough scatter data."
                                                    hint="Need at least 3 completed trades."
                                                />
                                            )}
                                        </Box>
                                        {scatterInsight && <ChartInsight>{scatterInsight}</ChartInsight>}
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>

                        {/* ── Trade Ledger ─────────────────────────────────── */}
                        <Grid container spacing={3}>
                            <Grid item xs={12}>
                                <Card elevation={0} sx={{ borderRadius: 3 }}>
                                    <CardHeader
                                        title="Trade Ledger"
                                        titleTypographyProps={{ variant: 'h6', sx: { color: 'text.primary' } }}
                                        subheader={`Showing ${filteredTrades.length} of ${result.trades?.length || 0} trades`}
                                        subheaderTypographyProps={{ variant: 'caption', sx: { color: 'text.secondary' } }}
                                        action={
                                            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                                                <ToggleButtonGroup
                                                    value={tradeFilter} exclusive size="small"
                                                    onChange={(e, val) => val && setTradeFilter(val)}
                                                >
                                                    <ToggleButton value="all" sx={{ px: 1.5, fontSize: '0.72rem' }}>All</ToggleButton>
                                                    <ToggleButton value="wins" sx={{ px: 1.5, fontSize: '0.72rem', '&.Mui-selected': { color: '#00D4AA', borderColor: '#00D4AA', background: 'rgba(0,212,170,0.12)' } }}>
                                                        Wins
                                                    </ToggleButton>
                                                    <ToggleButton value="losses" sx={{ px: 1.5, fontSize: '0.72rem', '&.Mui-selected': { color: '#FF5C6C', borderColor: '#FF5C6C', background: 'rgba(255,92,108,0.12)' } }}>
                                                        Losses
                                                    </ToggleButton>
                                                </ToggleButtonGroup>

                                                <Button
                                                    variant="contained" color="primary" size="small"
                                                    onClick={() => setSaveModalOpen(true)}
                                                    sx={{ fontSize: '0.75rem' }}
                                                >
                                                    Save Strategy
                                                </Button>
                                                
                                                {/* NEW: Download Python Script Button */}
                                                <Button
                                                    variant="outlined" size="small"
                                                    startIcon={<CodeIcon fontSize="small" />}
                                                    onClick={handleDownloadScript}
                                                    disabled={!result?.python_code && !customScript}
                                                    sx={{ fontSize: '0.75rem', borderColor: 'rgba(74,158,255,0.3)', color: '#4A9EFF', '&:hover': { background: 'rgba(74,158,255,0.1)' } }}
                                                >
                                                    .PY
                                                </Button>

                                                <Button
                                                    variant="contained" color="secondary" size="small"
                                                    onClick={() => {
                                                        setShareTitle(`My ${symbol} Strategy: ${result.pnl_percent}% Return!`);
                                                        setShareModalOpen(true);
                                                    }}
                                                    sx={{ fontSize: '0.75rem' }}
                                                >
                                                    Share to Community
                                                </Button>
                                                <Button
                                                    variant="outlined" size="small"
                                                    startIcon={<DownloadIcon fontSize="small" />}
                                                    onClick={exportToCSV}
                                                    disabled={!result.trades?.length}
                                                    sx={{ fontSize: '0.75rem', borderColor: 'rgba(74,158,255,0.3)', color: '#7BA8D4' }}
                                                >
                                                    CSV
                                                </Button>
                                            </Stack>
                                        }
                                    />
                                    <Divider sx={{ borderColor: 'divider' }} />
                                    <TableContainer sx={{ maxHeight: 440, '&::-webkit-scrollbar': { width: '5px' }, '&::-webkit-scrollbar-thumb': { background: 'rgba(74,158,255,0.2)', borderRadius: '4px' } }}>
                                        <Table stickyHeader size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>#</TableCell>
                                                    <TableCell>Entry Date</TableCell>
                                                    <TableCell>Exit Date</TableCell>
                                                    <TableCell align="right">Entry Price</TableCell>
                                                    <TableCell align="right">Exit Price</TableCell>
                                                    <TableCell align="right">P/L %</TableCell>
                                                    <TableCell align="center">Exit Reason</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {filteredTrades.length > 0 ? filteredTrades.map((trade, index) => (
                                                    <TableRow
                                                        key={index}
                                                        hover
                                                        sx={{
                                                            '&:hover': { background: 'rgba(74,158,255,0.05)' },
                                                            background: trade.pnl_percent > 0
                                                                ? 'rgba(0,212,170,0.03)'
                                                                : 'rgba(255,92,108,0.03)',
                                                        }}
                                                    >
                                                        <TableCell sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>{index + 1}</TableCell>
                                                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{trade.entry_date}</TableCell>
                                                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{trade.exit_date}</TableCell>
                                                        <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>₹{trade.entry_price.toLocaleString()}</TableCell>
                                                        <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>₹{trade.exit_price.toLocaleString()}</TableCell>
                                                        <TableCell align="right" sx={{
                                                            fontWeight: 700,
                                                            fontFamily: 'monospace',
                                                            color: trade.pnl_percent > 0 ? '#00D4AA' : '#FF5C6C',
                                                            fontSize: '0.8rem',
                                                        }}>
                                                            {trade.pnl_percent > 0 ? '+' : ''}{trade.pnl_percent}%
                                                        </TableCell>
                                                        <TableCell align="center">
                                                            <Chip
                                                                size="small"
                                                                label={trade.reason}
                                                                sx={{
                                                                    fontSize: '0.68rem',
                                                                    minWidth: 70,
                                                                    background: trade.reason === 'Target'
                                                                        ? 'rgba(0,212,170,0.12)'
                                                                        : 'rgba(255,92,108,0.12)',
                                                                    color: trade.reason === 'Target' ? '#00D4AA' : '#FF5C6C',
                                                                    border: `1px solid ${trade.reason === 'Target' ? 'rgba(0,212,170,0.3)' : 'rgba(255,92,108,0.3)'}`,
                                                                }}
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                )) : (
                                                    <TableRow>
                                                        <TableCell colSpan={7} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                                                            No trades match the current filter.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </Card>
                            </Grid>
                        </Grid>
                    </Box>
                )}

                {/* ── Share Dialog ──────────────────────────────────────────── */}
                <Dialog
                    open={shareModalOpen}
                    onClose={() => setShareModalOpen(false)}
                    fullWidth maxWidth="sm"
                    PaperProps={{ sx: { background: '#0D1628', border: '1px solid rgba(74,158,255,0.2)', borderRadius: 3 } }}
                >
                    <DialogTitle sx={{ color: 'text.primary', borderBottom: '1px solid rgba(74,158,255,0.12)', pb: 1.5 }}>
                        Share Strategy to Community
                    </DialogTitle>
                    <DialogContent sx={{ pt: 2.5 }}>
                        <Alert
                            severity="info"
                            sx={{
                                mb: 2, mt: 0.5,
                                background: 'rgba(74,158,255,0.08)',
                                border: '1px solid rgba(74,158,255,0.2)',
                                color: '#7BA8D4',
                                '& .MuiAlert-icon': { color: '#4A9EFF' },
                            }}
                        >
                            This will post your strategy's PnL, Win Rate, and Symbol to the public Community Hub.
                        </Alert>
                        <TextField fullWidth label="Post Title" value={shareTitle} onChange={e => setShareTitle(e.target.value)} sx={{ mb: 2 }} />
                        <TextField fullWidth multiline rows={3} label="Describe your logic" placeholder="Why did this work so well?" value={shareDesc} onChange={e => setShareDesc(e.target.value)} sx={{ mb: 2 }} />
                        <TextField fullWidth label="Tags (comma separated)" value={shareTags} onChange={e => setShareTags(e.target.value)} placeholder="strategy, nifty, breakout" />
                    </DialogContent>
                    <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(74,158,255,0.12)' }}>
                        <Button onClick={() => setShareModalOpen(false)} sx={{ color: 'text.secondary' }}>Cancel</Button>
                        <Button variant="contained" color="secondary" onClick={handleShareStrategy} disabled={!shareTitle || !shareDesc}>
                            Publish Strategy
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* ── Save Dialog ───────────────────────────────────────────── */}
                <Dialog
                    open={saveModalOpen}
                    onClose={() => setSaveModalOpen(false)}
                    fullWidth maxWidth="xs"
                    PaperProps={{ sx: { background: '#0D1628', border: '1px solid rgba(74,158,255,0.2)', borderRadius: 3 } }}
                >
                    <DialogTitle sx={{ color: 'text.primary', borderBottom: '1px solid rgba(74,158,255,0.12)', pb: 1.5 }}>
                        Save to My Strategies
                    </DialogTitle>
                    <DialogContent sx={{ pt: 2.5 }}>
                        <TextField
                            autoFocus fullWidth margin="dense"
                            label="Strategy Name"
                            placeholder="e.g., Nifty Trend Catcher"
                            value={savedStrategyName}
                            onChange={e => setSavedStrategyName(e.target.value)}
                        />
                    </DialogContent>
                    <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(74,158,255,0.12)' }}>
                        <Button onClick={() => setSaveModalOpen(false)} sx={{ color: 'text.secondary' }}>Cancel</Button>
                        <Button variant="contained" color="primary" onClick={handleSaveToProfile} disabled={!savedStrategyName.trim()}>
                            Save
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </ThemeProvider>
    );
};

export default BacktestDashboard;