import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
    Box, Typography, Paper, Grid, CircularProgress, Alert,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Chip, Card, CardHeader, CardContent, Divider, Button, Stack,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton,
    Snackbar, Tooltip
} from '@mui/material';
import { PieChart, BarChart } from '@mui/x-charts';
import {
    AccountBalance, Security, AutoAwesome, Sync, Add, Delete,
    Link as LinkIcon, LinkOff, Inventory2
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import { useTheme } from '@mui/material/styles';

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const StatCard = ({ title, value, subtext, color = '#fff' }) => (
    <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderLeft: `4px solid ${color}` }}>
        <Typography variant="body2" color="text.secondary" textTransform="uppercase" letterSpacing={1}>{title}</Typography>
        <Typography variant="h4" fontWeight="bold" sx={{ my: 1 }}>{value}</Typography>
        {subtext && <Typography variant="body2" sx={{ color }}>{subtext}</Typography>}
    </Paper>
);

const RISK_COLORS = { Low: 'success', Moderate: 'warning', High: 'error' };

const Portfolio = ({ user }) => {
    const theme = useTheme();
    const [portfolio, setPortfolio] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [aiAnalysis, setAiAnalysis] = useState('');
    const [analyzing, setAnalyzing] = useState(false);

    const [addOpen, setAddOpen] = useState(false);
    const [form, setForm] = useState({ symbol: '', quantity: '', avg_price: '' });
    const [saving, setSaving] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const tokenHandled = useRef(false);

    const [snack, setSnack] = useState({ open: false, message: '', severity: 'info' });
    const showSnack = (message, severity = 'info') => setSnack({ open: true, message, severity });

    const fetchPortfolio = useCallback(async () => {
        if (!user?.sub) return;
        setLoading(true);
        setError('');
        try {
            const res = await axios.get(`${API_URL}/api/get-portfolio/${user.sub}`);
            setPortfolio(res.data);
        } catch (err) {
            setError("Failed to load your portfolio. Please try again.");
        } finally {
            setLoading(false);
        }
    }, [user?.sub]);

    // On mount: if Zerodha just redirected back with a request_token, complete the connection.
    useEffect(() => {
        if (!user?.sub) return;
        const params = new URLSearchParams(window.location.search);
        const requestToken = params.get('request_token');
        if (requestToken) {
            if (tokenHandled.current) return;   // guard against StrictMode double-mount / re-runs
            tokenHandled.current = true;
            // Strip the one-time token from the URL synchronously, BEFORE the await, so a
            // second effect run can never re-read and re-POST the single-use request_token.
            window.history.replaceState({}, document.title, window.location.pathname);
            setLoading(true);
            axios.post(`${API_URL}/api/broker/kite/connect`, { userId: user.sub, request_token: requestToken })
                .then(res => showSnack(`Zerodha connected — ${res.data.holdings_imported} holdings imported.`, 'success'))
                .catch(err => showSnack(err.response?.data?.detail || 'Failed to connect Zerodha.', 'error'))
                .finally(() => fetchPortfolio());
        } else {
            fetchPortfolio();
        }
    }, [user?.sub, fetchPortfolio]);

    const handleAddHolding = async () => {
        const symbol = form.symbol.trim().toUpperCase();
        const quantity = parseFloat(form.quantity);
        const avg_price = parseFloat(form.avg_price);
        if (!symbol || !(quantity > 0) || !(avg_price > 0)) {
            showSnack('Enter a symbol, a positive quantity and an average price.', 'warning');
            return;
        }
        setSaving(true);
        try {
            await axios.post(`${API_URL}/api/portfolio/holdings`, { userId: user.sub, symbol, quantity, avg_price });
            setAddOpen(false);
            setForm({ symbol: '', quantity: '', avg_price: '' });
            showSnack(`${symbol} added to your portfolio.`, 'success');
            fetchPortfolio();
        } catch (err) {
            showSnack(err.response?.data?.detail || 'Failed to add holding.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteHolding = async (symbol) => {
        try {
            await axios.delete(`${API_URL}/api/portfolio/holdings/${encodeURIComponent(user.sub)}/${encodeURIComponent(symbol)}`);
            showSnack(`${symbol} removed.`, 'info');
            fetchPortfolio();
        } catch (err) {
            showSnack('Failed to remove holding.', 'error');
        }
    };

    const handleConnectBroker = async () => {
        setConnecting(true);
        try {
            const res = await axios.get(`${API_URL}/api/broker/kite/login-url`, { params: { user_id: user.sub } });
            if (!res.data.configured) {
                showSnack(res.data.message || 'Broker connection is not configured on the server yet.', 'warning');
                setConnecting(false);
                return;
            }
            // Make sure Zerodha's redirect brings the user back to this page.
            localStorage.setItem('viewMode', 'app');
            localStorage.setItem('activePage', 'portfolio');
            window.location.href = res.data.login_url;
        } catch (err) {
            showSnack('Could not start the broker connection.', 'error');
            setConnecting(false);
        }
    };

    const handleDisconnectBroker = async () => {
        try {
            await axios.post(`${API_URL}/api/broker/kite/disconnect/${user.sub}`);
            showSnack('Zerodha disconnected.', 'info');
            fetchPortfolio();
        } catch (err) {
            showSnack('Failed to disconnect.', 'error');
        }
    };

    const handleGenerateRiskReport = async () => {
        if (!portfolio) return;
        setAnalyzing(true);
        try {
            const allocations = portfolio.sector_data.map(s => `${s.label}: ₹${s.value}`).join(', ');
            const summary = `Total Value: ₹${portfolio.total_current}, Risk: ${portfolio.risk?.level} (${portfolio.risk?.detail}), Allocations: ${allocations}`;
            const res = await axios.post(`${API_URL}/api/portfolio/analyze`, { portfolio_summary: summary });
            setAiAnalysis(res.data.analysis);
        } catch (err) {
            showSnack('Failed to generate AI Risk Report.', 'error');
        } finally {
            setAnalyzing(false);
        }
    };

    if (loading) return <Box textAlign="center" p={5}><CircularProgress /><Typography mt={2}>Loading your portfolio…</Typography></Box>;
    if (error) return <Alert severity="error" sx={{ m: 3 }}>{error}</Alert>;
    if (!portfolio) return null;

    const holdings = portfolio.holdings || [];
    const hasHoldings = holdings.length > 0;
    const broker = portfolio.broker || { connected: false };
    const risk = portfolio.risk || { level: 'N/A' };
    const riskColor = theme.palette[RISK_COLORS[risk.level]]?.main || theme.palette.text.secondary;

    const barChartData = holdings.map(h => ({ symbol: h.symbol, invested: h.invested_value, current: h.current_value }));

    const BrokerButton = () => (
        broker.connected ? (
            <Stack direction="row" spacing={1} alignItems="center">
                <Chip icon={<AccountBalance />} label={`Connected: ${broker.broker}`} color="success" variant="outlined" />
                <Button size="small" color="inherit" startIcon={<LinkOff />} onClick={handleDisconnectBroker}>Disconnect</Button>
            </Stack>
        ) : (
            <Button variant="outlined" startIcon={<LinkIcon />} onClick={handleConnectBroker} disabled={connecting}>
                {connecting ? 'Connecting…' : 'Connect Zerodha'}
            </Button>
        )
    );

    return (
        <Box sx={{ maxWidth: '1400px', margin: '0 auto', pb: 5 }}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-end" mb={4} flexWrap="wrap" gap={2}>
                <Box>
                    <Typography variant="h3" fontWeight="bold">My Portfolio</Typography>
                    <Typography variant="subtitle1" color="text.secondary">Live exposure tracking and risk analytics.</Typography>
                </Box>
                <Stack direction="row" spacing={2} alignItems="center">
                    <Button variant="contained" startIcon={<Add />} onClick={() => setAddOpen(true)}>Add Holding</Button>
                    <BrokerButton />
                </Stack>
            </Box>

            {!hasHoldings ? (
                <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3, border: '1px dashed', borderColor: 'divider' }}>
                    <Inventory2 sx={{ fontSize: 64, opacity: 0.2, mb: 2 }} />
                    <Typography variant="h5" fontWeight="bold" gutterBottom>Your portfolio is empty</Typography>
                    <Typography color="text.secondary" mb={3}>
                        Add holdings manually, or connect your Zerodha account to import them automatically.
                        Prices, P&amp;L and risk are calculated live.
                    </Typography>
                    <Stack direction="row" spacing={2} justifyContent="center">
                        <Button variant="contained" size="large" startIcon={<Add />} onClick={() => setAddOpen(true)}>Add a Holding</Button>
                        <Button variant="outlined" size="large" startIcon={<LinkIcon />} onClick={handleConnectBroker} disabled={connecting}>
                            {connecting ? 'Connecting…' : 'Connect Zerodha'}
                        </Button>
                    </Stack>
                </Paper>
            ) : (
                <>
                    {/* KPI Row */}
                    <Grid container spacing={3} mb={4}>
                        <Grid item xs={12} md={3}>
                            <StatCard title="Current Value" value={`₹${portfolio.total_current.toLocaleString()}`} color={theme.palette.primary.main} />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <StatCard title="Invested Amount" value={`₹${portfolio.total_invested.toLocaleString()}`} color={theme.palette.text.secondary} />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <StatCard
                                title="Total Returns"
                                value={`₹${portfolio.total_pnl.toLocaleString()}`}
                                subtext={`${portfolio.total_pnl > 0 ? '+' : ''}${portfolio.total_pnl_percent}% All Time`}
                                color={portfolio.total_pnl >= 0 ? theme.palette.success.main : theme.palette.error.main}
                            />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <StatCard
                                title="Risk Status"
                                value={risk.level}
                                subtext={risk.detail}
                                color={riskColor}
                            />
                        </Grid>
                    </Grid>

                    {/* Charts Row */}
                    <Grid container spacing={3} mb={4}>
                        <Grid item xs={12} lg={6}>
                            <Card elevation={2} sx={{ borderRadius: 3, height: '100%' }}>
                                <CardHeader title="Sector Allocation" titleTypographyProps={{ fontWeight: 'bold' }} />
                                <Divider />
                                <CardContent sx={{ height: 350, display: 'flex', alignItems: 'center' }}>
                                    {portfolio.sector_data.length > 0 ? (
                                        <PieChart
                                            series={[{ data: portfolio.sector_data, innerRadius: 60, paddingAngle: 2, cornerRadius: 5 }]}
                                            height={250}
                                            slotProps={{ legend: { direction: 'column', position: { vertical: 'middle', horizontal: 'right' } } }}
                                        />
                                    ) : <Typography color="text.secondary" m="auto">No sector data.</Typography>}
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={12} lg={6}>
                            <Card elevation={2} sx={{ borderRadius: 3, height: '100%' }}>
                                <CardHeader
                                    title="AI Risk Officer"
                                    titleTypographyProps={{ fontWeight: 'bold' }}
                                    action={
                                        <Button variant="outlined" color="primary" size="small" startIcon={<AutoAwesome />} onClick={handleGenerateRiskReport} disabled={analyzing}>
                                            {analyzing ? 'Analyzing...' : 'Audit Portfolio'}
                                        </Button>
                                    }
                                />
                                <Divider />
                                <CardContent sx={{ height: 350, overflowY: 'auto', bgcolor: 'rgba(0,0,0,0.02)' }}>
                                    {aiAnalysis ? (
                                        <Box sx={{ '& h3': { fontSize: '1.1rem', mt: 0 }, '& p': { lineHeight: 1.6 } }}>
                                            <ReactMarkdown>{aiAnalysis}</ReactMarkdown>
                                        </Box>
                                    ) : (
                                        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="100%" color="text.secondary">
                                            <Security sx={{ fontSize: 60, opacity: 0.2, mb: 2 }} />
                                            <Typography>Click "Audit Portfolio" to generate an AI risk profile based on your current exposure.</Typography>
                                        </Box>
                                    )}
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>

                    {/* Holdings Table */}
                    <Card elevation={2} sx={{ borderRadius: 3 }}>
                        <CardHeader title="Current Holdings" titleTypographyProps={{ fontWeight: 'bold' }} action={<Button startIcon={<Sync />} onClick={fetchPortfolio}>Refresh Prices</Button>} />
                        <Divider />
                        <TableContainer>
                            <Table stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Asset</TableCell>
                                        <TableCell sx={{ fontWeight: 'bold' }}>Sector</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Qty</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Avg Price</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>LTP</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Current Value</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Net P&L</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {holdings.map((h) => (
                                        <TableRow key={h.symbol} hover>
                                            <TableCell>
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    <Typography fontWeight="bold">{h.symbol}</Typography>
                                                    {h.source === 'kite' && <Chip label="Zerodha" size="small" color="success" variant="outlined" />}
                                                    {!h.price_live && <Tooltip title="Live price unavailable — showing cost price"><Chip label="no live price" size="small" variant="outlined" /></Tooltip>}
                                                </Stack>
                                            </TableCell>
                                            <TableCell><Chip label={h.sector} size="small" variant="outlined" /></TableCell>
                                            <TableCell align="right">{h.quantity}</TableCell>
                                            <TableCell align="right">₹{h.avg_price.toLocaleString()}</TableCell>
                                            <TableCell align="right">₹{h.current_price.toLocaleString()}</TableCell>
                                            <TableCell align="right">₹{h.current_value.toLocaleString()}</TableCell>
                                            <TableCell align="right" sx={{ color: h.pnl >= 0 ? 'success.main' : 'error.main', fontWeight: 'bold' }}>
                                                {h.pnl > 0 ? '+' : ''}₹{h.pnl.toLocaleString()} ({h.pnl_percent.toFixed(2)}%)
                                            </TableCell>
                                            <TableCell align="right">
                                                {h.source === 'manual' ? (
                                                    <Tooltip title="Remove holding">
                                                        <IconButton size="small" onClick={() => handleDeleteHolding(h.symbol)}><Delete fontSize="small" /></IconButton>
                                                    </Tooltip>
                                                ) : null}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Card>
                </>
            )}

            {/* Add Holding Dialog */}
            <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle fontWeight="bold">Add a Holding</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" mb={2}>
                        Use the NSE symbol (e.g. RELIANCE, TCS, INFY). The live price is fetched automatically.
                    </Typography>
                    <Stack spacing={2} mt={1}>
                        <TextField label="NSE Symbol" value={form.symbol} onChange={e => setForm({ ...form, symbol: e.target.value })} autoFocus fullWidth />
                        <TextField label="Quantity" type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} fullWidth />
                        <TextField label="Average Buy Price (₹)" type="number" value={form.avg_price} onChange={e => setForm({ ...form, avg_price: e.target.value })} fullWidth />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setAddOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleAddHolding} disabled={saving}>{saving ? 'Saving…' : 'Add Holding'}</Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snack.open}
                autoHideDuration={5000}
                onClose={() => setSnack({ ...snack, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })} variant="filled">{snack.message}</Alert>
            </Snackbar>
        </Box>
    );
};

export default Portfolio;
