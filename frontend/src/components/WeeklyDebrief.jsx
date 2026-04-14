import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Box, Typography, Paper, Button, TextField, CircularProgress, 
    Alert, Avatar, Card, CardContent, CardHeader, CardActions, 
    IconButton, Chip, Stack, ToggleButtonGroup, ToggleButton, Divider
} from '@mui/material';
import { ThumbUp, TrendingUp, TrendingDown, Remove } from '@mui/icons-material';

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const WeeklyDebrief = ({ user, userData }) => {
    const [scenario, setScenario] = useState(null);
    const [analyses, setAnalyses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [myAnalysis, setMyAnalysis] = useState('');
    const [myStance, setMyStance] = useState('Bullish');
    const [submitLoading, setSubmitLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [scenarioRes, analysesRes] = await Promise.all([
                axios.get(`${API_URL}/api/debrief/current`),
                axios.get(`${API_URL}/api/debrief/analyses`)
            ]);
            setScenario(scenarioRes.data);
            setAnalyses(analysesRes.data);
        } catch (err) {
            setError("Failed to load the Weekly Debrief. Please try again later.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleSubmit = async () => {
        if (!myAnalysis.trim()) return;
        setSubmitLoading(true);
        try {
            await axios.post(`${API_URL}/api/debrief/submit`, {
                userId: user.sub,
                displayName: userData?.displayName || user.name,
                picture: user.picture,
                analysis: myAnalysis,
                stance: myStance
            });
            setMyAnalysis('');
            fetchData(); // Refresh the feed
        } catch (err) {
            setError("Failed to submit your analysis.");
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleVote = async (analysisId) => {
        // Optimistic UI update for instant feedback
        setAnalyses(prev => prev.map(a => a.id === analysisId ? { ...a, votes: a.votes + 1 } : a));
        try {
            await axios.post(`${API_URL}/api/debrief/vote/${analysisId}`);
        } catch (err) {
            fetchData(); // Revert on failure
        }
    };

    const getStanceColor = (stance) => {
        if (stance === 'Bullish') return 'success';
        if (stance === 'Bearish') return 'error';
        return 'warning';
    };

    const getStanceIcon = (stance) => {
        if (stance === 'Bullish') return <TrendingUp />;
        if (stance === 'Bearish') return <TrendingDown />;
        return <Remove />;
    };

    // Check if the current user has already submitted a take
    const hasSubmitted = analyses.some(a => a.userId === user?.sub);

    if (loading) return <Box sx={{textAlign: 'center', p: 4}}><CircularProgress /><Typography sx={{mt: 2}}>Loading Community Insights...</Typography></Box>;

    return (
        <Box sx={{ maxWidth: '1000px', margin: '0 auto' }}>
            <Typography variant="h3" fontWeight="bold" gutterBottom>The Weekly Debrief</Typography>
            <Typography variant="subtitle1" color="text.secondary" mb={4}>
                Analyze the macro scenario, post your thesis, and learn from the community's top-rated insights.
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            {/* The Scenario Card */}
            {scenario && (
                <Paper sx={{ p: 4, mb: 4, borderRadius: 3, borderLeft: '6px solid', borderColor: 'primary.main', bgcolor: 'background.paper' }}>
                    <Typography variant="overline" color="primary" fontWeight="bold">Topic of the Week</Typography>
                    <Typography variant="h5" fontWeight="bold" gutterBottom>{scenario.title}</Typography>
                    <Typography variant="body1" sx={{ fontSize: '1.1rem', lineHeight: 1.7 }}>{scenario.description}</Typography>
                </Paper>
            )}

            {/* The Input Section */}
            {!hasSubmitted ? (
                <Card sx={{ mb: 5, borderRadius: 3, overflow: 'visible' }}>
                    <CardHeader 
                        avatar={<Avatar src={user?.picture} />} 
                        title="What's your take, Analyst?" 
                        titleTypographyProps={{ fontWeight: 'bold' }}
                    />
                    <CardContent>
                        <Stack direction="row" spacing={2} mb={2} alignItems="center">
                            <Typography variant="body2" color="text.secondary">Market Stance:</Typography>
                            <ToggleButtonGroup value={myStance} exclusive onChange={(e, val) => val && setMyStance(val)} size="small">
                                <ToggleButton value="Bullish" sx={{ color: 'success.main', '&.Mui-selected': { bgcolor: 'success.dark', color: 'white' } }}>Bullish</ToggleButton>
                                <ToggleButton value="Neutral" sx={{ color: 'warning.main', '&.Mui-selected': { bgcolor: 'warning.dark', color: 'white' } }}>Neutral</ToggleButton>
                                <ToggleButton value="Bearish" sx={{ color: 'error.main', '&.Mui-selected': { bgcolor: 'error.dark', color: 'white' } }}>Bearish</ToggleButton>
                            </ToggleButtonGroup>
                        </Stack>
                        <TextField 
                            fullWidth multiline rows={4} 
                            placeholder="Draft your analysis here. Reference technical levels or fundamental data..." 
                            value={myAnalysis} onChange={(e) => setMyAnalysis(e.target.value)} 
                        />
                    </CardContent>
                    <CardActions sx={{ justifyContent: 'flex-end', p: 2 }}>
                        <Button variant="contained" onClick={handleSubmit} disabled={submitLoading || !myAnalysis.trim()}>
                            {submitLoading ? <CircularProgress size={24} /> : "Publish Analysis"}
                        </Button>
                    </CardActions>
                </Card>
            ) : (
                <Alert severity="success" sx={{ mb: 4, borderRadius: 2 }}>
                    You have published your analysis for this week! Check out what the rest of the community is thinking below.
                </Alert>
            )}

            <Divider sx={{ my: 4 }}>
                <Typography variant="overline" color="text.secondary">Community Insights</Typography>
            </Divider>

            {/* The Community Feed */}
            <Stack spacing={3}>
                {analyses.length > 0 ? analyses.map((item) => (
                    <Card key={item.id} elevation={1} sx={{ borderRadius: 3 }}>
                        <CardHeader
                            avatar={<Avatar src={item.picture} />}
                            title={item.displayName}
                            subheader={new Date(item.timestamp?.seconds * 1000).toLocaleDateString() || "Just now"}
                            action={
                                <Chip 
                                    icon={getStanceIcon(item.stance)} 
                                    label={item.stance} 
                                    color={getStanceColor(item.stance)} 
                                    variant="outlined" 
                                    size="small" 
                                    sx={{ mt: 1, mr: 1, fontWeight: 'bold' }} 
                                />
                            }
                        />
                        <CardContent sx={{ pt: 0 }}>
                            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                                {item.analysis}
                            </Typography>
                        </CardContent>
                        <CardActions sx={{ bgcolor: 'rgba(0,0,0,0.02)', px: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                            <Button 
                                size="small" 
                                startIcon={<ThumbUp />} 
                                onClick={() => handleVote(item.id)}
                                color="text.secondary"
                            >
                                Helpful ({item.votes})
                            </Button>
                        </CardActions>
                    </Card>
                )) : (
                    <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3, bgcolor: 'transparent', border: '1px dashed grey' }}>
                        <Typography color="text.secondary">No analyses posted yet. Be the first to share your insights!</Typography>
                    </Paper>
                )}
            </Stack>
        </Box>
    );
};

export default WeeklyDebrief;