import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
    Box, Typography, Button, CircularProgress, Paper, List, ListItem,
    ListItemText, Alert, Grid, FormControl, InputLabel, Select, MenuItem, Stack, Chip, Divider
} from '@mui/material';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import {
    ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    BarChart, Bar, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
    ReferenceLine, Legend, ComposedChart, Line
} from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const SCAN_INDICES = [
    { value: 'NIFTY_50', label: 'NIFTY 50' },
    { value: 'NIFTY_BANK', label: 'NIFTY Bank' },
    { value: 'NIFTY_IT', label: 'NIFTY IT' },
    { value: 'NIFTY_FIN_SERVICE', label: 'NIFTY Financial Services' },
    { value: 'NIFTY_AUTO', label: 'NIFTY Auto' },
    { value: 'NIFTY_FMCG', label: 'NIFTY FMCG' },
    { value: 'NIFTY_PHARMA', label: 'NIFTY Pharma' },
    { value: 'NIFTY_METAL', label: 'NIFTY Metal' },
    { value: 'NIFTY_MIDCAP_100', label: 'NIFTY Midcap 100' },
    { value: 'NIFTY_SMALLCAP_100', label: 'NIFTY Smallcap 100' },
];

const FALLBACK_SCATTER = [
    { name: 'ADANIENT',   priceChange: 4.5,  volumeSpike: 250 },
    { name: 'TATAMOTORS', priceChange: -2.1, volumeSpike: 180 },
    { name: 'RELIANCE',   priceChange: 1.2,  volumeSpike: 120 },
    { name: 'ITC',        priceChange: -0.5, volumeSpike: 300 },
    { name: 'HDFCBANK',   priceChange: 2.8,  volumeSpike: 210 },
    { name: 'WIPRO',      priceChange: -1.5, volumeSpike: 90  },
    { name: 'INFY',       priceChange: 3.2,  volumeSpike: 175 },
];
const FALLBACK_RSI = [
    { name: 'HDFCBANK',   rsi: 22 }, { name: 'INFY',      rsi: 78 },
    { name: 'SBIN',       rsi: 28 }, { name: 'TCS',       rsi: 55 },
    { name: 'RELIANCE',   rsi: 73 }, { name: 'WIPRO',     rsi: 35 },
    { name: 'BAJFINANCE', rsi: 82 }, { name: 'AXISBANK',  rsi: 18 },
];
const FALLBACK_DISTRIBUTION = [
    { name: 'Volume Spikes',    value: 45 },
    { name: 'Price Breakouts',  value: 25 },
    { name: 'RSI Extremes',     value: 20 },
    { name: 'MACD Signals',     value: 10 },
];
const FALLBACK_SECTORS = [
    { name: 'Banking', anomalies: 7 }, { name: 'IT',     anomalies: 4 },
    { name: 'Auto',    anomalies: 5 }, { name: 'FMCG',   anomalies: 3 },
    { name: 'Pharma',  anomalies: 6 }, { name: 'Metal',  anomalies: 8 },
];
const FALLBACK_RADAR = [
    { subject: 'Volatility', value: 85, fullMark: 100 },
    { subject: 'Momentum',   value: 65, fullMark: 100 },
    { subject: 'Volume',     value: 90, fullMark: 100 },
    { subject: 'Trend',      value: 45, fullMark: 100 },
    { subject: 'Breadth',    value: 58, fullMark: 100 },
];

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
    blue:       '#0EA5FF',
    teal:       '#00E5CC',
    violet:     '#7C6FFF',
    red:        '#FF5F5F',
    green:      '#00E676',
    cardBg:     'rgba(4, 12, 26, 0.96)',
    border:     'rgba(14, 165, 255, 0.15)',
    borderHot:  'rgba(14, 165, 255, 0.35)',
    grid:       '#0C1E33',
    text:       '#7B9EB8',
    textBright: '#B8D0E8',
};
const PIE_COLORS  = [C.blue, C.teal, C.violet, C.red];
const SECTOR_COLS = ['#0EA5FF', '#00C4AA', '#5A90FF', '#00B4D8', '#4CC9F0', '#7B6FFF'];

// ── Sub-components ──────────────────────────────────────────────────────────────

// Glowing card wrapper
const GlowCard = ({ children, sx = {}, height }) => (
    <Box
        sx={{
            height: height || '100%',
            p: 3,
            bgcolor: C.cardBg,
            border: `1px solid ${C.border}`,
            borderRadius: '16px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(14,165,255,0.07)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
            transition: 'border-color 0.3s',
            '&:hover': { borderColor: C.borderHot },
            '&::before': {
                content: '""',
                position: 'absolute',
                top: 0, left: '15%', right: '15%',
                height: '1px',
                background: `linear-gradient(90deg, transparent, ${C.blue}55, transparent)`,
            },
            ...sx,
        }}
    >
        {children}
    </Box>
);

// Insight badge below each chart
const InsightBadge = ({ text, accent = C.blue }) => (
    <Box
        sx={{
            mt: 1.5,
            px: 1.8, py: 1,
            borderRadius: '8px',
            bgcolor: `${accent}10`,
            borderLeft: `3px solid ${accent}`,
            flexShrink: 0,
        }}
    >
        <Typography
            variant="caption"
            sx={{ color: accent, fontWeight: 600, fontSize: '0.72rem', letterSpacing: 0.2, lineHeight: 1.5 }}
        >
            {text}
        </Typography>
    </Box>
);

// Chart section header
const ChartHeader = ({ title, subtitle, badge }) => (
    <Box mb={2} display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
        <Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: C.textBright, fontSize: '0.95rem', letterSpacing: 0.3 }}>
                {title}
            </Typography>
            <Typography variant="caption" sx={{ color: C.text, lineHeight: 1.5, display: 'block', mt: 0.3 }}>
                {subtitle}
            </Typography>
        </Box>
        {badge && (
            <Chip
                label={badge}
                size="small"
                sx={{ bgcolor: `${C.blue}18`, color: C.blue, border: `1px solid ${C.blue}30`, fontSize: '0.68rem', fontWeight: 700 }}
            />
        )}
    </Box>
);

// Custom RSI bar: coloured by zone
const RsiBarShape = (props) => {
    const { x, y, width, height, value } = props;
    const id = `rsiGrad_${Math.round(value)}`;
    const color = value > 70 ? C.red : value < 30 ? C.green : C.violet;
    return (
        <g>
            <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={color} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.35} />
                </linearGradient>
            </defs>
            <rect x={x} y={y} rx={4} ry={4} width={width} height={Math.max(height, 0)} fill={`url(#${id})`} />
        </g>
    );
};

// Custom scatter dot with pulse-like glow
const ScatterDot = (props) => {
    const { cx, cy, payload } = props;
    const isHot = payload.volumeSpike > 150 && payload.priceChange > 1;
    const isBear = payload.priceChange < -1;
    const color = isHot ? C.blue : isBear ? C.red : C.teal;
    return (
        <g>
            <circle cx={cx} cy={cy} r={isHot ? 9 : 7} fill={color} fillOpacity={0.2} />
            <circle cx={cx} cy={cy} r={isHot ? 5 : 4} fill={color} fillOpacity={0.9} />
        </g>
    );
};

// ── Main component ──────────────────────────────────────────────────────────────
const AnomalyScanner = () => {
    const [realAlerts, setRealAlerts]   = useState([]);
    const [scanStatus, setScanStatus]   = useState('idle');
    const [selectedIndex, setSelectedIndex] = useState('NIFTY_50');
    const [chartData, setChartData]     = useState({
        scatter: null, rsi: null, distribution: null, sectors: null, radar: null,
    });

    useEffect(() => {
        const q = query(collection(db, "alerts"), orderBy("timestamp", "desc"), limit(10));
        const unsub = onSnapshot(q, (snap) => {
            setRealAlerts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, []);

    const handleScan = async () => {
        setScanStatus('scanning');
        setChartData({ scatter: null, rsi: null, distribution: null, sectors: null, radar: null });
        try {
            const res = await axios.get(`${API_URL}/api/scan-anomalies`, { params: { index: selectedIndex } });
            if (res.data?.scatterData) {
                setChartData({
                    scatter:      res.data.scatterData,
                    rsi:          res.data.rsiData,
                    distribution: res.data.distributionData,
                    sectors:      res.data.sectorData,
                    radar:        res.data.radarData,
                });
            }
            setScanStatus('finished');
        } catch (err) {
            console.error("Scan failed", err);
            setTimeout(() => setScanStatus('finished'), 3000);
        }
    };

    const openTradingView = (symbol) =>
        window.open(`https://in.tradingview.com/chart/?symbol=NSE:${symbol}`, '_blank');

    const isDataVisible = scanStatus === 'finished';

    const activeScatter      = chartData.scatter      || FALLBACK_SCATTER;
    const activeRSI          = chartData.rsi          || FALLBACK_RSI;
    const activeDistribution = chartData.distribution || FALLBACK_DISTRIBUTION;
    const activeSectors      = chartData.sectors      || FALLBACK_SECTORS;
    const activeRadar        = chartData.radar        || FALLBACK_RADAR;

    // ── Computed insights ──────────────────────────────────────────────────────
    const insights = useMemo(() => {
        const highConviction = activeScatter.filter(d => d.volumeSpike > 150 && d.priceChange > 1.5).length;
        const bearishCount   = activeScatter.filter(d => d.priceChange < -1.5).length;
        const overbought     = activeRSI.filter(d => d.rsi > 70).length;
        const oversold       = activeRSI.filter(d => d.rsi < 30).length;
        const total          = activeDistribution.reduce((s, d) => s + d.value, 0) || 1;
        const dominant       = [...activeDistribution].sort((a, b) => b.value - a.value)[0];
        const totalAnomalies = activeSectors.reduce((s, d) => s + d.anomalies, 0) || 1;
        const hotSector      = [...activeSectors].sort((a, b) => b.anomalies - a.anomalies)[0];
        const avgMetric      = activeRadar.reduce((s, d) => s + d.value, 0) / (activeRadar.length || 1);
        const highestMetric  = [...activeRadar].sort((a, b) => b.value - a.value)[0];
        return { highConviction, bearishCount, overbought, oversold, dominant, total, hotSector, totalAnomalies, avgMetric, highestMetric };
    }, [activeScatter, activeRSI, activeDistribution, activeSectors, activeRadar]);

    const getScatterInsight = () => {
        if (insights.highConviction >= 3) return `🔥 ${insights.highConviction} stocks in the high-conviction breakout quadrant — institutional accumulation in play`;
        if (insights.highConviction >= 1) return `⚡ ${insights.highConviction} stock${insights.highConviction > 1 ? 's' : ''} showing breakout signal on elevated volume`;
        if (insights.bearishCount >= 3)   return `⚠️ ${insights.bearishCount} stocks showing bearish volume distribution — consider risk management`;
        return `Balanced distribution — no dominant directional bias detected across the index`;
    };

    const getRSIInsight = () => {
        const { overbought, oversold } = insights;
        if (overbought > 0 && oversold > 0) return `Divergence detected — ${overbought} overbought & ${oversold} oversold stocks active simultaneously`;
        if (overbought >= 3) return `⚠️ ${overbought} stocks in overbought territory — momentum may be overextended`;
        if (overbought >= 1) return `${overbought} stock crossing overbought threshold (RSI > 70) — monitor closely for reversal`;
        if (oversold >= 2)   return `📉 ${oversold} stocks at oversold levels (RSI < 30) — potential mean-reversion bounce setups`;
        if (oversold >= 1)   return `1 stock at oversold extreme — a potential contrarian opportunity forming`;
        return `RSI balanced across the index — no extreme momentum readings detected`;
    };

    const getDistributionInsight = () => {
        const { dominant, total } = insights;
        if (!dominant) return '';
        const pct = Math.round((dominant.value / total) * 100);
        return `${dominant.name} leads at ${pct}% of active anomalies — the primary signal driving current market irregularities`;
    };

    const getSectorInsight = () => {
        const { hotSector, totalAnomalies } = insights;
        if (!hotSector) return '';
        const pct = Math.round((hotSector.anomalies / totalAnomalies) * 100);
        return `${hotSector.name} is today's hotspot — ${hotSector.anomalies} anomalies detected (${pct}% of total market irregularities)`;
    };

    const getRadarInsight = () => {
        const { avgMetric, highestMetric } = insights;
        if (!highestMetric) return '';
        if (avgMetric >= 70) return `Elevated market stress across most metrics — ${highestMetric.subject} leading at ${highestMetric.value}/100`;
        if (avgMetric >= 50) return `Moderate activity — ${highestMetric.subject} is the dominant force at ${highestMetric.value}/100`;
        return `Low-activity state — only ${highestMetric.subject} elevated at ${highestMetric.value}/100; await confirmation`;
    };

    // ── Custom tooltip ─────────────────────────────────────────────────────────
    const CustomTooltip = ({ active, payload, label }) => {
        if (!active || !payload?.length) return null;
        return (
            <Box sx={{
                bgcolor: 'rgba(3, 10, 22, 0.97)',
                border: `1px solid ${C.borderHot}`,
                borderRadius: '10px',
                p: 1.5,
                boxShadow: `0 0 20px ${C.blue}22`,
                minWidth: 130,
            }}>
                <Typography variant="caption" fontWeight={700} sx={{ color: C.textBright, display: 'block', mb: 0.75 }}>
                    {label || payload[0]?.payload?.name}
                </Typography>
                {payload.map((entry, i) => (
                    <Box key={i} display="flex" alignItems="center" gap={0.8}>
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: entry.color || C.blue, flexShrink: 0 }} />
                        <Typography variant="caption" sx={{ color: C.text }}>
                            {entry.name}:&nbsp;
                            <span style={{ color: entry.color || C.blue, fontWeight: 700 }}>{entry.value}</span>
                        </Typography>
                    </Box>
                ))}
            </Box>
        );
    };

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <Box sx={{
            minHeight: '100vh',
            background: `
                radial-gradient(ellipse 80% 50% at 50% -10%, rgba(14,165,255,0.07) 0%, transparent 60%),
                radial-gradient(ellipse 50% 40% at 90% 80%, rgba(0,229,204,0.04) 0%, transparent 55%)
            `,
        }}>
            {/* ── Header ─────────────────────────────────────────────────────── */}
            <Box
                display="flex"
                flexDirection={{ xs: 'column', md: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', md: 'center' }}
                mb={4} gap={2}
            >
                <Box>
                    <Box display="flex" alignItems="center" gap={1.5} mb={0.5}>
                        <Box sx={{
                            width: 8, height: 8, borderRadius: '50%',
                            bgcolor: C.blue,
                            boxShadow: `0 0 10px ${C.blue}`,
                            animation: scanStatus === 'scanning' ? 'pulse 1s infinite' : 'none',
                            '@keyframes pulse': {
                                '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                                '50%':      { opacity: 0.4, transform: 'scale(1.6)' },
                            },
                        }} />
                        <Typography variant="h4" fontWeight={800} sx={{
                            background: `linear-gradient(90deg, ${C.textBright} 0%, ${C.blue} 100%)`,
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            letterSpacing: '-0.5px',
                        }}>
                            Market Anomaly Scanner
                        </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: C.text, pl: '21px' }}>
                        AI-driven detection for institutional volume & price aberrations
                    </Typography>
                </Box>

                <Stack direction="row" spacing={2} alignItems="center" flexShrink={0}>
                    <FormControl
                        variant="outlined"
                        size="small"
                        sx={{
                            minWidth: 200,
                            '& .MuiOutlinedInput-root': {
                                bgcolor: 'rgba(14,165,255,0.05)',
                                borderRadius: '10px',
                                '& fieldset': { borderColor: C.border },
                                '&:hover fieldset': { borderColor: `${C.blue}55` },
                                '&.Mui-focused fieldset': { borderColor: C.blue },
                            },
                            '& .MuiInputLabel-root': { color: C.text },
                            '& .MuiSelect-select': { color: C.textBright },
                        }}
                    >
                        <InputLabel>Market Index</InputLabel>
                        <Select
                            value={selectedIndex}
                            onChange={(e) => setSelectedIndex(e.target.value)}
                            label="Market Index"
                            disabled={scanStatus === 'scanning'}
                        >
                            {SCAN_INDICES.map((idx) => (
                                <MenuItem key={idx.value} value={idx.value}>{idx.label}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <Button
                        variant="contained"
                        size="large"
                        onClick={handleScan}
                        disabled={scanStatus === 'scanning'}
                        sx={{
                            fontWeight: 700,
                            px: 3.5,
                            height: 42,
                            borderRadius: '10px',
                            fontSize: '0.85rem',
                            letterSpacing: 0.8,
                            textTransform: 'uppercase',
                            background: `linear-gradient(135deg, #0EA5FF 0%, #0060CC 100%)`,
                            boxShadow: `0 0 24px rgba(14,165,255,0.35)`,
                            transition: 'all 0.25s ease',
                            '&:hover': {
                                boxShadow: `0 0 36px rgba(14,165,255,0.55)`,
                                transform: 'translateY(-1px)',
                            },
                            '&.Mui-disabled': { opacity: 0.5 },
                        }}
                    >
                        {scanStatus === 'scanning'
                            ? <><CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />Scanning...</>
                            : 'Initiate Scan'
                        }
                    </Button>
                </Stack>
            </Box>

            {/* ── Demo-data notice (shown when the scan returned nothing / the feed was down) ── */}
            {scanStatus === 'finished' && !chartData.scatter && (
                <Box sx={{
                    mb: 4, p: 2,
                    bgcolor: 'rgba(255,180,84,0.08)',
                    border: '1px solid rgba(255,180,84,0.35)',
                    borderRadius: '12px',
                    display: 'flex', alignItems: 'center', gap: 1.5,
                }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#FFB454', flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ color: '#FFB454' }}>
                        <strong>Sample data</strong> — the live {selectedIndex.replace(/_/g, ' ')} scan returned no anomalies or the data feed was unavailable. The charts below are illustrative placeholders, <strong>not live market data</strong>.
                    </Typography>
                </Box>
            )}

            {/* ── Charts ─────────────────────────────────────────────────────── */}
            {isDataVisible && (
                <Grid container spacing={3} sx={{ mb: 4 }}>

                    {/* 1 — Volume Spikes vs Price Action (Scatter) */}
                    <Grid item xs={12} lg={6}>
                        <GlowCard height={460}>
                            <ChartHeader
                                title="Volume Spikes vs Price Action"
                                subtitle="Top-right quadrant = high conviction breakouts driven by institutional volume"
                                badge="CLUSTER"
                            />
                            <Box sx={{ flexGrow: 1, width: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <ScatterChart margin={{ top: 10, right: 24, bottom: 20, left: 0 }}>
                                        <defs>
                                            <radialGradient id="scatterBg" cx="50%" cy="50%" r="50%">
                                                <stop offset="0%"   stopColor={C.blue} stopOpacity={0.04} />
                                                <stop offset="100%" stopColor={C.blue} stopOpacity={0}    />
                                            </radialGradient>
                                        </defs>
                                        <rect width="100%" height="100%" fill="url(#scatterBg)" />
                                        <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                                        <XAxis
                                            type="number" dataKey="volumeSpike" name="Volume Spike"
                                            stroke={C.text} tick={{ fill: C.text, fontSize: 11 }}
                                            tickFormatter={(v) => `${v}%`}
                                            label={{ value: 'Volume Spike %', position: 'insideBottom', offset: -10, fill: C.text, fontSize: 11 }}
                                        />
                                        <YAxis
                                            type="number" dataKey="priceChange" name="Price Change"
                                            stroke={C.text} tick={{ fill: C.text, fontSize: 11 }}
                                            tickFormatter={(v) => `${v}%`}
                                            label={{ value: 'Price Δ%', angle: -90, position: 'insideLeft', fill: C.text, fontSize: 11 }}
                                        />
                                        <ReferenceLine y={0}   stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4"
                                            label={{ value: '← Bearish | Bullish →', fill: C.text, fontSize: 10, position: 'insideTopRight' }}
                                        />
                                        <ReferenceLine x={150} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4"
                                            label={{ value: 'Institutional Threshold', fill: C.text, fontSize: 10, position: 'insideTopRight' }}
                                        />
                                        <RechartsTooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: C.border }} />
                                        <Scatter name="Stocks" data={activeScatter} shape={<ScatterDot />} />
                                    </ScatterChart>
                                </ResponsiveContainer>
                            </Box>
                            <InsightBadge text={getScatterInsight()} accent={insights.highConviction >= 2 ? C.blue : insights.bearishCount >= 3 ? C.red : C.teal} />
                        </GlowCard>
                    </Grid>

                    {/* 2 — RSI Divergence Radar */}
                    <Grid item xs={12} lg={6}>
                        <GlowCard height={460}>
                            <ChartHeader
                                title="RSI Divergence Radar"
                                subtitle="Red zone (>70) = overbought risk · Green zone (<30) = oversold opportunity"
                                badge="MOMENTUM"
                            />
                            <Box sx={{ flexGrow: 1, width: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={activeRSI} margin={{ top: 10, right: 20, bottom: 30, left: -20 }}>
                                        <defs>
                                            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                                                <stop offset="0%"   stopColor={C.blue}   stopOpacity={0.9} />
                                                <stop offset="100%" stopColor={C.violet} stopOpacity={0.9} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                                        <XAxis dataKey="name" stroke={C.text} tick={{ fill: C.text, fontSize: 10 }} angle={-30} textAnchor="end" height={55} interval={0} />
                                        <YAxis domain={[0, 100]} stroke={C.text} tick={{ fill: C.text, fontSize: 11 }} />
                                        <RechartsTooltip content={<CustomTooltip />} />
                                        <ReferenceLine y={70} stroke={`${C.red}90`}   strokeWidth={1.5} strokeDasharray="4 4"
                                            label={{ position: 'right', value: 'Overbought (70)', fill: C.red,   fontSize: 11 }} />
                                        <ReferenceLine y={30} stroke={`${C.green}90`} strokeWidth={1.5} strokeDasharray="4 4"
                                            label={{ position: 'right', value: 'Oversold (30)',   fill: C.green, fontSize: 11 }} />
                                        <Bar dataKey="rsi" shape={<RsiBarShape />} barSize={18} radius={[4, 4, 0, 0]} />
                                        <Line
                                            type="monotone" dataKey="rsi" stroke="url(#lineGrad)" strokeWidth={2.5}
                                            dot={{ r: 4, fill: '#050D1A', stroke: C.blue, strokeWidth: 2 }}
                                            activeDot={{ r: 6, fill: C.blue, strokeWidth: 0 }}
                                        />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </Box>
                            <InsightBadge
                                text={getRSIInsight()}
                                accent={insights.overbought > 0 && insights.oversold > 0 ? C.violet : insights.overbought > 0 ? C.red : insights.oversold > 0 ? C.green : C.teal}
                            />
                        </GlowCard>
                    </Grid>

                    {/* 3 — Alert Distribution (Donut) */}
                    <Grid item xs={12} md={6} lg={4}>
                        <GlowCard height={420}>
                            <ChartHeader
                                title="Alert Distribution"
                                subtitle="Breakdown of anomaly types triggering across the selected index"
                                badge="SIGNALS"
                            />
                            <Box sx={{ flexGrow: 1, width: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <defs>
                                            {PIE_COLORS.map((col, i) => (
                                                <radialGradient key={i} id={`pieGrad${i}`} cx="50%" cy="50%" r="50%">
                                                    <stop offset="0%"   stopColor={col} stopOpacity={0.95} />
                                                    <stop offset="100%" stopColor={col} stopOpacity={0.6}  />
                                                </radialGradient>
                                            ))}
                                        </defs>
                                        <Pie
                                            data={activeDistribution}
                                            cx="50%" cy="44%"
                                            innerRadius="48%" outerRadius="68%"
                                            paddingAngle={4} dataKey="value"
                                            strokeWidth={0}
                                        >
                                            {activeDistribution.map((_, i) => (
                                                <Cell key={i} fill={`url(#pieGrad${i})`} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip content={<CustomTooltip />} />
                                        <Legend
                                            iconType="circle" iconSize={8}
                                            wrapperStyle={{ color: C.text, fontSize: '12px', paddingTop: '8px' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </Box>
                            <InsightBadge text={getDistributionInsight()} accent={C.teal} />
                        </GlowCard>
                    </Grid>

                    {/* 4 — Sector Hotspots */}
                    <Grid item xs={12} md={6} lg={4}>
                        <GlowCard height={420}>
                            <ChartHeader
                                title="Sector Hotspots"
                                subtitle="Concentration of abnormal trading activity by sector"
                                badge="HEATMAP"
                            />
                            <Box sx={{ flexGrow: 1, width: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={activeSectors} margin={{ top: 10, right: 10, bottom: 30, left: -20 }}>
                                        <defs>
                                            {SECTOR_COLS.map((col, i) => (
                                                <linearGradient key={i} id={`sg${i}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%"   stopColor={col} stopOpacity={0.95} />
                                                    <stop offset="100%" stopColor={col} stopOpacity={0.4}  />
                                                </linearGradient>
                                            ))}
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                                        <XAxis dataKey="name" stroke={C.text} tick={{ fill: C.text, fontSize: 11 }} angle={-25} textAnchor="end" height={50} interval={0} />
                                        <YAxis stroke={C.text} tick={{ fill: C.text, fontSize: 11 }} allowDecimals={false} />
                                        <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(14,165,255,0.04)' }} />
                                        <Bar dataKey="anomalies" name="Anomalies" radius={[6, 6, 0, 0]} maxBarSize={48}>
                                            {activeSectors.map((_, i) => (
                                                <Cell key={i} fill={`url(#sg${i % SECTOR_COLS.length})`} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </Box>
                            <InsightBadge text={getSectorInsight()} accent={C.violet} />
                        </GlowCard>
                    </Grid>

                    {/* 5 — Market Sentiment Radar */}
                    <Grid item xs={12} lg={4}>
                        <GlowCard height={420}>
                            <ChartHeader
                                title="Market Sentiment Matrix"
                                subtitle="Holistic index health across five key performance dimensions"
                                badge="COMPOSITE"
                            />
                            <Box sx={{ flexGrow: 1, width: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="62%" data={activeRadar}>
                                        <defs>
                                            <linearGradient id="radarFill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%"   stopColor={C.blue} stopOpacity={0.5} />
                                                <stop offset="100%" stopColor={C.teal} stopOpacity={0.2} />
                                            </linearGradient>
                                        </defs>
                                        <PolarGrid stroke={C.grid} />
                                        <PolarAngleAxis dataKey="subject" tick={{ fill: C.textBright, fontSize: 11, fontWeight: 600 }} />
                                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                        <Radar
                                            name="Market State" dataKey="value"
                                            stroke={C.blue} strokeWidth={2}
                                            fill="url(#radarFill)"
                                        />
                                        <RechartsTooltip content={<CustomTooltip />} />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </Box>
                            <InsightBadge
                                text={getRadarInsight()}
                                accent={insights.avgMetric >= 70 ? C.red : insights.avgMetric >= 50 ? C.blue : C.teal}
                            />
                        </GlowCard>
                    </Grid>
                </Grid>
            )}

            {/* ── Live Alerts Feed ────────────────────────────────────────────── */}
            <GlowCard>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                    <Box display="flex" alignItems="center" gap={1.5}>
                        <Box sx={{
                            width: 8, height: 8, borderRadius: '50%', bgcolor: C.green,
                            boxShadow: `0 0 8px ${C.green}`,
                            animation: 'liveGlow 2s ease-in-out infinite',
                            '@keyframes liveGlow': {
                                '0%, 100%': { opacity: 1  },
                                '50%':      { opacity: 0.4 },
                            },
                        }} />
                        <Typography variant="h6" fontWeight={700} sx={{ color: C.textBright }}>
                            Live Alerts Feed
                        </Typography>
                        {realAlerts.length > 0 && (
                            <Chip
                                label={`${realAlerts.length} active`}
                                size="small"
                                sx={{ bgcolor: `${C.green}18`, color: C.green, border: `1px solid ${C.green}30`, fontSize: '0.68rem', fontWeight: 700 }}
                            />
                        )}
                    </Box>
                    <Chip
                        label={selectedIndex.replace(/_/g, ' ')}
                        size="small"
                        sx={{ bgcolor: `${C.blue}18`, color: C.blue, border: `1px solid ${C.border}`, fontSize: '0.7rem' }}
                    />
                </Box>

                <Divider sx={{ borderColor: C.border, mb: 0 }} />

                <List disablePadding>
                    {realAlerts.length > 0 ? realAlerts.map((alert, idx) => (
                        <ListItem
                            key={alert.id}
                            sx={{
                                py: 2, px: 0,
                                borderBottom: idx < realAlerts.length - 1 ? `1px solid ${C.grid}` : 'none',
                                '&:hover': { bgcolor: `${C.blue}05` },
                                transition: 'background 0.2s',
                            }}
                        >
                            <Box sx={{
                                width: 3, height: 38, borderRadius: 4,
                                bgcolor: C.blue,
                                boxShadow: `0 0 8px ${C.blue}55`,
                                mr: 2, flexShrink: 0,
                            }} />
                            <ListItemText
                                primary={
                                    <Box display="flex" alignItems="center" gap={1} mb={0.4}>
                                        <Typography variant="subtitle2" fontWeight={800} sx={{ color: C.blue, fontFamily: 'monospace', fontSize: '0.95rem' }}>
                                            {alert.symbol}
                                        </Typography>
                                        <Chip
                                            label="ANOMALY"
                                            size="small"
                                            sx={{ bgcolor: `${C.red}15`, color: C.red, border: `1px solid ${C.red}30`, fontSize: '0.6rem', fontWeight: 700, height: 18 }}
                                        />
                                    </Box>
                                }
                                secondary={
                                    <Typography variant="body2" sx={{ color: C.text }}>
                                        {alert.message}
                                    </Typography>
                                }
                            />
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={() => openTradingView(alert.symbol)}
                                sx={{
                                    ml: 2, flexShrink: 0,
                                    borderColor: C.border,
                                    color: C.text,
                                    borderRadius: '8px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    letterSpacing: 0.5,
                                    '&:hover': {
                                        borderColor: C.blue,
                                        color: C.blue,
                                        bgcolor: `${C.blue}0D`,
                                    },
                                }}
                            >
                                View Chart
                            </Button>
                        </ListItem>
                    )) : (
                        <ListItem sx={{ py: 4, justifyContent: 'center', flexDirection: 'column', gap: 1 }}>
                            <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: `${C.blue}10`, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Typography sx={{ fontSize: 18 }}>📡</Typography>
                            </Box>
                            <Typography variant="body2" sx={{ color: C.text }}>
                                {scanStatus === 'scanning'
                                    ? 'Scanning network infrastructure for anomalies...'
                                    : 'System idle — initiate a scan to populate the live feed'
                                }
                            </Typography>
                        </ListItem>
                    )}
                </List>
            </GlowCard>
        </Box>
    );
};

export default AnomalyScanner;