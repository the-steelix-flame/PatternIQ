import React from 'react';
import { Box, Typography, Button, Container, Grid, Paper, Stack, Divider } from '@mui/material';
import { ShowChart, Psychology, Groups, Gavel, Speed, Security } from '@mui/icons-material';

const FeatureItem = ({ icon, title, desc }) => (
    <Grid item xs={12} md={4}>
        <Box sx={{ p: 3, textAlign: 'center' }}>
            <Box sx={{ mb: 2, color: 'primary.main' }}>{icon}</Box>
            <Typography variant="h6" fontWeight="bold" gutterBottom>{title}</Typography>
            <Typography variant="body2" color="text.secondary">{desc}</Typography>
        </Box>
    </Grid>
);

const LandingPage = ({ onNavigateToLogin, onNavigateToManual }) => {
    return (
        <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', pb: 10 }}>
            {/* Hero Section */}
            <Box sx={{ 
                height: '80vh', 
                display: 'flex', 
                alignItems: 'center', 
                background: 'linear-gradient(45deg, #121212 30%, #001f3f 90%)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <Container maxWidth="lg">
                    <Grid container spacing={4} alignItems="center">
                        <Grid item xs={12} md={6}>
                            <Typography variant="h1" sx={{ fontWeight: 900, fontSize: { xs: '3rem', md: '4.5rem' }, mb: 2 }}>
                                Pattern<span style={{ color: '#00BFFF' }}>IQ</span>
                            </Typography>
                            <Typography variant="h5" color="text.secondary" sx={{ mb: 4, lineHeight: 1.6 }}>
                                The world's first AI-Native Trading OS. Build, backtest, and battle with strategies using plain English.
                            </Typography>
                            <Stack direction="row" spacing={2}>
                                <Button variant="contained" size="large" onClick={onNavigateToLogin} sx={{ px: 4, py: 1.5, fontWeight: 'bold' }}>
                                    Launch Terminal
                                </Button>
                                <Button variant="outlined" size="large" onClick={() => window.scrollTo({ top: 1000, behavior: 'smooth' })}>
                                    Explore Features
                                </Button>
                            </Stack>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Box component="img" src="/assets/dashboard.png" sx={{ 
                                width: '130%', 
                                borderRadius: 4, 
                                boxShadow: '0 20px 50px rgba(0,191,255,0.3)',
                                transform: 'perspective(1000px) rotateY(-15deg)',
                                display: { xs: 'none', md: 'block' }
                            }} />
                        </Grid>
                    </Grid>
                </Container>
            </Box>

            {/* Feature Deep Dive */}
            <Container maxWidth="lg" sx={{ mt: 10 }}>
                <Typography variant="h3" textAlign="center" fontWeight="bold" gutterBottom>What can you do on PatternIQ?</Typography>
                <Typography variant="h6" textAlign="center" color="text.secondary" mb={8}>A complete ecosystem for the modern retail trader.</Typography>
                
                <Grid container spacing={6}>
                    <FeatureItem 
                        icon={<ShowChart sx={{ fontSize: 40 }} />} 
                        title="AI Backtesting" 
                        desc="No more coding. Type 'Buy if RSI < 30 and price is near support' and our AI generates the Python logic, fetches Nifty data, and gives you a professional PnL report." 
                    />
                    <FeatureItem 
                        icon={<Psychology sx={{ fontSize: 40 }} />} 
                        title="The Arena" 
                        desc="Gamify your learning. Take daily quizzes based on real-time market news. Earn Reputation Points (RP) and climb the global leaderboard." 
                    />
                    <FeatureItem 
                        icon={<Groups sx={{ fontSize: 40 }} />} 
                        title="Community Hub" 
                        desc="Found a 70% win-rate strategy? Share it with a single click. Upvote the best insights and participate in the Weekly Debrief rounds." 
                    />
                    <FeatureItem 
                        icon={<Speed sx={{ fontSize: 40 }} />} 
                        title="Anomaly Scanner" 
                        desc="Our background engine scans the Nifty 50 every minute for unusual volume spikes or price movements, alerting you before the trend goes mainstream." 
                    />
                    <FeatureItem 
                        icon={<Security sx={{ fontSize: 40 }} />} 
                        title="Risk Officer" 
                        desc="Connect your portfolio and let our AI Risk Officer audit your exposure. It detects sector over-concentration and correlation risks automatically." 
                    />
                    <FeatureItem 
                        icon={<Gavel sx={{ fontSize: 40 }} />} 
                        title="Strategy Vault" 
                        desc="Save your best performing tests to your profile. Build a library of proven mathematical edges over time." 
                    />
                </Grid>

                {/* Showcase Image 2 */}
                <Box sx={{ mt: 15, textAlign: 'center' }}>
                    <Grid container spacing={4} alignItems="center">
                        <Grid item xs={12} md={5}>
                            <Typography variant="h4" fontWeight="bold" gutterBottom align="left">Real-Time Intelligence</Typography>
                            <Typography variant="body1" color="text.secondary" align="left" paragraph>
                                The Anomaly Scanner doesn't just look at price; it analyzes relative volume and standard deviations to find "Smart Money" footprints.
                            </Typography>
                            <Box textAlign="left">
                                <Button variant="text" color="primary" onClick={onNavigateToManual}>Read the technical guide →</Button>
                            </Box>
                        </Grid>
                        <Grid item xs={12} md={7}>
                            <Box component="img" src="/assets/anomaly.png" sx={{ width: '100%', borderRadius: 3, border: '1px solid #333' }} />
                        </Grid>
                    </Grid>
                </Box>
            </Container>

            {/* Call to Action */}
            <Box sx={{ mt: 15, py: 10, bgcolor: 'primary.main', textAlign: 'center', color: 'black' }}>
                <Typography variant="h3" fontWeight="bold" mb={2}>Ready to Master the Market?</Typography>
                <Typography variant="h6" mb={4}>Join 5,000+ traders using PatternIQ to find their edge.</Typography>
                <Button variant="contained" color="inherit" size="large" onClick={onNavigateToLogin} sx={{ fontWeight: 'bold', px: 6 }}>Get Started for Free</Button>
            </Box>
        </Box>
    );
};

export default LandingPage;