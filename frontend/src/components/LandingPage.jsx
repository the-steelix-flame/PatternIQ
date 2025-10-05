import React from 'react';
import { Box, Typography, Button, Container, Paper, Grid } from '@mui/material';
import { BarChart, Gavel, SportsEsports } from '@mui/icons-material';

const FeatureCard = ({ icon, title, description }) => (
    <Paper sx={{ p: 3, textAlign: 'center', height: '100%' }}>
        {icon}
        <Typography variant="h6" gutterBottom>{title}</Typography>
        <Typography variant="body2" color="text.secondary">{description}</Typography>
    </Paper>
);

const LandingPage = ({ onNavigateToLogin }) => {
    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
            <Container maxWidth="lg">
                <Grid container spacing={4} alignItems="center">
                    <Grid item xs={12} md={6}>
                        <Typography variant="h2" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
                            Test Your Trading Ideas, Not Your Code.
                        </Typography>
                        <Typography variant="h5" color="text.secondary" sx={{ mb: 4 }}>
                            PatternIQ is the first AI-native platform that lets you backtest complex strategies in plain English, compete with a community, and get real market insights.
                        </Typography>
                        <Button variant="contained" size="large" onClick={onNavigateToLogin}>
                            Get Started for Free
                        </Button>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Grid container spacing={2}>
                            <Grid item xs={12}><FeatureCard icon={<BarChart sx={{ fontSize: 40, mb: 1 }} color="primary"/>} title="AI Backtester" description="Describe any strategy in plain English and get instant results. No coding required."/></Grid>
                            <Grid item xs={12} sm={6}><FeatureCard icon={<SportsEsports sx={{ fontSize: 40, mb: 1 }} color="secondary"/>} title="The Arena" description="Test your knowledge with daily AI-generated quizzes and compete on the leaderboard."/></Grid>
                            <Grid item xs={12} sm={6}><FeatureCard icon={<Gavel sx={{ fontSize: 40, mb: 1 }} color="warning"/>} title="Anomaly Detection" description="Get real-time alerts on unusual market activity to protect your investments."/></Grid>
                        </Grid>
                    </Grid>
                </Grid>
            </Container>
        </Box>
    );
};

export default LandingPage;