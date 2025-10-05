import React, { useState } from 'react';
import axios from 'axios';
import { Box, Typography, Button, CircularProgress, Paper, Grid, List, ListItem, ListItemText } from '@mui/material';
import { PieChart } from '@mui/x-charts';

const API_URL = "http://127.0.0.1:8000";

const Portfolio = () => {
    const [portfolio, setPortfolio] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleConnect = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_URL}/api/get-portfolio`);
            setPortfolio(response.data);
        } catch (error) { console.error("Failed to fetch portfolio"); }
        finally { setLoading(false); }
    }

    const pieChartData = portfolio ? portfolio.holdings.map(h => ({
        id: h.symbol,
        value: h.quantity * h.avg_price,
        label: h.sector
    })) : [];

    return (
        <Box>
            <Typography variant="h4" gutterBottom>Your Portfolio</Typography>
            {!portfolio ? (
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                    <Typography gutterBottom>Connect your broker to see your live portfolio and risk analysis.</Typography>
                    <Button variant="contained" onClick={handleConnect} disabled={loading}>{loading ? <CircularProgress size={24} /> : "Connect Kotak (Demo)"}</Button>
                </Paper>
            ) : (
                <Grid container spacing={3}>
                    {/* CORRECTED: Removed 'item' prop, direct props on Grid */}
                    <Grid xs={12} md={6}>
                        <Paper sx={{ p: 2, height: 400 }}>
                            <Typography variant="h6">Holdings (Value: ₹{portfolio.total_value.toLocaleString()})</Typography>
                            <List>{portfolio.holdings.map(h => (<ListItem key={h.symbol} divider><ListItemText primary={`${h.symbol} (${h.quantity})`} secondary={`Avg. ₹${h.avg_price}`} /></ListItem>))}</List>
                        </Paper>
                    </Grid>
                    <Grid xs={12} md={6}>
                        <Paper sx={{ p: 2, height: 400 }}>
                            <Typography variant="h6">Sector Allocation</Typography>
                            <PieChart series={[{ data: pieChartData, highlightScope: { faded: 'global', highlighted: 'item' }, faded: { innerRadius: 30, additionalRadius: -30, color: 'gray' }, }]} height={350} />
                        </Paper>
                    </Grid>
                </Grid>
            )}
        </Box>
    );
};

export default Portfolio;