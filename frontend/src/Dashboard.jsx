import React, { useState } from 'react';
import axios from 'axios';
import {
  Container, Box, Typography, TextField, Button, CircularProgress, Paper, Grid,
  Alert, AppBar, Toolbar, Avatar, Card, CardContent, Stack
} from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
// Import icons
import ShowChartIcon from '@mui/icons-material/ShowChart';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import InsightsIcon from '@mui/icons-material/Insights';

const API_URL = "http://127.0.0.1:8000";

// A small component for displaying stats in cards
const StatCard = ({ title, value, icon, color }) => (
  <Card elevation={3} sx={{ borderRadius: 3 }}>
    <CardContent>
      <Stack direction="row" spacing={2} alignItems="center">
        <Avatar sx={{ bgcolor: color, width: 56, height: 56 }}>
          {icon}
        </Avatar>
        <Box>
          <Typography variant="h6" component="div">{value}</Typography>
          <Typography color="text.secondary">{title}</Typography>
        </Box>
      </Stack>
    </CardContent>
  </Card>
);

function Dashboard({ user }) {
  const [symbol, setSymbol] = useState('RELIANCE');
  const [strategy, setStrategy] = useState('Buy if RSI is below 30. Sell if RSI is above 70.');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleBacktest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await axios.post(`${API_URL}/api/backtest`, {
        symbol: symbol,
        strategy_text: strategy,
      });
      setResult(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || "An unexpected error occurred. Check backend console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            📈 PatternIQ
          </Typography>
          <Typography sx={{mr: 2}}>{user.name}</Typography>
          <Avatar alt={user.name} src={user.picture} />
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 3, mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            No-Code Backtesting Engine
          </Typography>
          <Typography variant="subtitle1" color="text.secondary" gutterBottom>
            Write your trading strategy in plain English and instantly see how it performs on real data.
          </Typography>

          <Box component="form" onSubmit={handleBacktest} sx={{ mt: 4 }}>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Stock Symbol (e.g., RELIANCE, INFY)"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Your Strategy in Plain English"
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  multiline
                  rows={2}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  fullWidth
                  sx={{ height: '56px', fontWeight: 'bold' }}
                  disabled={loading}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : 'Run Backtest'}
                </Button>
              </Grid>
            </Grid>
          </Box>
        </Paper>

        {error && <Alert severity="error" sx={{ mt: 3 }}>{error}</Alert>}

        {result && (
          <Box>
            {/* Stat Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard title="Net Profit/Loss" value={`₹${result.pnl}`} icon={<RequestQuoteIcon />} color={result.pnl > 0 ? 'success.main' : 'error.main'} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard title="Return PnL %" value={`${result.pnl_percent}%`} icon={<ShowChartIcon />} color={result.pnl > 0 ? 'success.main' : 'error.main'} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard title="Win Rate" value={`${result.win_rate}%`} icon={<CheckCircleOutlineIcon />} color="info.main" />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard title="Total Trades" value={result.num_trades} icon={<InsightsIcon />} color="warning.main" />
              </Grid>
            </Grid>

            {/* Chart and AI Analysis */}
            {/* Chart and AI Analysis */}
            <Grid container spacing={3}>
              {/* CHANGE "lg" to "md" HERE */}
              <Grid item xs={12} md={7}>
                <Paper sx={{ p: 3, height: '500px', borderRadius: 3 }}>
                  <Typography variant="h6" gutterBottom>Equity Curve</Typography>
                  <ResponsiveContainer width="100%" height="90%">
                    <LineChart data={result.equity_curve} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2}/>
                      <XAxis dataKey="date" />
                      <YAxis tickFormatter={(value) => `₹${value.toLocaleString()}`} domain={['auto', 'auto']} />
                      <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                      <Legend />
                      <Line type="monotone" dataKey="equity" stroke="#8884d8" strokeWidth={2} dot={false}/>
                    </LineChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>
              {/* AND CHANGE "lg" to "md" HERE */}
              <Grid item xs={12} md={5}>
                <Paper sx={{ p: 3, height: '500px', overflowY: 'auto', borderRadius: 3 }}>
                  <Typography variant="h6" gutterBottom>🤖 AI Analysis</Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                    {result.ai_explanation}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        )}
      </Container>
    </>
  );
}

export default Dashboard;