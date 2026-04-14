import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Box, Typography, Paper, Grid, CircularProgress, Alert, 
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
    Chip, Card, CardHeader, CardContent, Divider, Button, Stack
} from '@mui/material';
import { PieChart, BarChart } from '@mui/x-charts';
import { AccountBalance, Security, AutoAwesome, Sync } from '@mui/icons-material';
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

const Portfolio = ({ user }) => {
    const theme = useTheme();
    const [portfolio, setPortfolio] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    const [aiAnalysis, setAiAnalysis] = useState('');
    const [analyzing, setAnalyzing] = useState(false);

    useEffect(() => {
        const fetchPortfolio = async () => {
            if (!user?.sub) return;
            setLoading(true);
            try {
                const res = await axios.get(`${API_URL}/api/get-portfolio/${user.sub}`);
                setPortfolio(res.data);
            } catch (err) {
                setError("Failed to sync broker data.");
            } finally {
                setLoading(false);
            }
        };
        fetchPortfolio();
    }, [user?.sub]);

    const handleGenerateRiskReport = async () => {
        if (!portfolio) return;
        setAnalyzing(true);
        try {
            const summaryData = portfolio.sector_data.map(s => `${s.label}: ₹${s.value}`).join(', ');
            const res = await axios.post(`${API_URL}/api/portfolio/analyze`, {
                portfolio_summary: `Total Value: ₹${portfolio.total_current}, Allocations: ${summaryData}`
            });
            setAiAnalysis(res.data.analysis);
        } catch (err) {
            alert("Failed to generate AI Risk Report.");
        } finally {
            setAnalyzing(false);
        }
    };

    if (loading) return <Box textAlign="center" p={5}><CircularProgress /><Typography mt={2}>Syncing with Broker...</Typography></Box>;
    if (error) return <Alert severity="error" sx={{ m: 3 }}>{error}</Alert>;
    if (!portfolio) return null;

    // Formatting for the Bar Chart
    const barChartData = portfolio.holdings.map(h => ({
        symbol: h.symbol,
        invested: h.invested_value,
        current: h.current_value
    }));

    return (
        <Box sx={{ maxWidth: '1400px', margin: '0 auto', pb: 5 }}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-end" mb={4}>
                <Box>
                    <Typography variant="h3" fontWeight="bold">My Portfolio</Typography>
                    <Typography variant="subtitle1" color="text.secondary">Live exposure tracking and risk analytics.</Typography>
                </Box>
                <Chip icon={<AccountBalance />} label={`Connected: ${portfolio.broker}`} color="success" variant="outlined" />
            </Box>

            {/* KPI Row */}
            <Grid container spacing={3} mb={4}>
                <Grid item xs={12} md={3}>
                    <StatCard 
                        title="Current Value" 
                        value={`₹${portfolio.total_current.toLocaleString()}`} 
                        color={theme.palette.primary.main} 
                    />
                </Grid>
                <Grid item xs={12} md={3}>
                    <StatCard 
                        title="Invested Amount" 
                        value={`₹${portfolio.total_invested.toLocaleString()}`} 
                        color={theme.palette.text.secondary} 
                    />
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
                        value="Moderate" 
                        subtext="Based on Sector Volatility"
                        color={theme.palette.warning.main} 
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
                            <PieChart 
                                series={[{ 
                                    data: portfolio.sector_data,
                                    innerRadius: 60,
                                    paddingAngle: 2,
                                    cornerRadius: 5
                                }]} 
                                height={250}
                                slotProps={{ legend: { direction: 'column', position: { vertical: 'middle', horizontal: 'right' } } }}
                            />
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
                <CardHeader title="Current Holdings" titleTypographyProps={{ fontWeight: 'bold' }} action={<Button startIcon={<Sync />}>Refresh Prices</Button>} />
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
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {portfolio.holdings.map((h) => (
                                <TableRow key={h.symbol} hover>
                                    <TableCell><Typography fontWeight="bold">{h.symbol}</Typography></TableCell>
                                    <TableCell><Chip label={h.sector} size="small" variant="outlined" /></TableCell>
                                    <TableCell align="right">{h.quantity}</TableCell>
                                    <TableCell align="right">₹{h.avg_price.toLocaleString()}</TableCell>
                                    <TableCell align="right">₹{h.current_price.toLocaleString()}</TableCell>
                                    <TableCell align="right">₹{h.current_value.toLocaleString()}</TableCell>
                                    <TableCell align="right" sx={{ color: h.pnl > 0 ? 'success.main' : 'error.main', fontWeight: 'bold' }}>
                                        {h.pnl > 0 ? '+' : ''}₹{h.pnl.toLocaleString()} ({h.pnl_percent.toFixed(2)}%)
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Card>
        </Box>
    );
};

export default Portfolio;