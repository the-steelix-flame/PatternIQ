import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Box, Typography, Paper, Button, TextField, CircularProgress, 
    Alert, Avatar, Card, CardContent, CardHeader, CardActions, 
    Chip, Stack, Divider, InputAdornment, IconButton, Dialog, 
    DialogTitle, DialogContent, DialogActions, Tooltip,
    ToggleButtonGroup, ToggleButton, Grid // <--- FIXED: Added Grid Import!
} from '@mui/material';
import { 
    ThumbUp, ThumbDown, ChatBubbleOutline, Share, Search, 
    TrendingUp, TrendingDown, Remove, PostAdd, BarChart, Article 
} from '@mui/icons-material';

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const CommunityHub = ({ user, userData }) => {
    // --- COMMUNITY FEED STATE ---
    const [feed, setFeed] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTag, setSearchTag] = useState('');
    const [error, setError] = useState('');
    
    // --- CREATE POST STATE ---
    const [openPostModal, setOpenPostModal] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [newTags, setNewTags] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- WEEKLY DEBRIEF STATE ---
    const [openDebriefModal, setOpenDebriefModal] = useState(false);
    const [scenario, setScenario] = useState(null);
    const [debriefs, setDebriefs] = useState([]);
    const [debriefLoading, setDebriefLoading] = useState(false);
    const [myStance, setMyStance] = useState('Bullish');
    const [myAnalysis, setMyAnalysis] = useState('');
    const [submitDebriefLoading, setSubmitDebriefLoading] = useState(false);

    // --- FETCH COMMUNITY FEED ---
    const fetchFeed = async (tagQuery = '') => {
        setLoading(true); setError('');
        try {
            const url = tagQuery 
                ? `${API_URL}/api/community/feed?tag=${encodeURIComponent(tagQuery)}` 
                : `${API_URL}/api/community/feed`;
            const res = await axios.get(url);
            setFeed(res.data);
        } catch (err) { setError("Failed to load community feed."); } 
        finally { setLoading(false); }
    };

    useEffect(() => { fetchFeed(); }, []);

    // --- FETCH WEEKLY DEBRIEF ---
    const fetchDebriefData = async () => {
        setDebriefLoading(true);
        try {
            const [scenarioRes, analysesRes] = await Promise.all([
                axios.get(`${API_URL}/api/debrief/current`),
                axios.get(`${API_URL}/api/debrief/analyses`)
            ]);
            setScenario(scenarioRes.data);
            setDebriefs(analysesRes.data);
        } catch (err) { console.error("Failed to load debrief data"); } 
        finally { setDebriefLoading(false); }
    };

    // Load debrief data only when the modal is opened
    useEffect(() => {
        if (openDebriefModal && !scenario) fetchDebriefData();
    }, [openDebriefModal, scenario]);

    // --- HANDLERS ---
    const handleSearch = (e) => { if (e.key === 'Enter') fetchFeed(searchTag); };

    const handleVote = async (postId, action) => {
        // Optimistic UI update (Fixed string match for backend)
        setFeed(prev => prev.map(p => p.id === postId ? { ...p, [action + 's']: p[action + 's'] + 1 } : p));
        try { await axios.post(`${API_URL}/api/community/vote/${postId}`, { action }); } 
        catch (err) { fetchFeed(searchTag); } 
    };

    const handleCreatePost = async () => {
        if (!newTitle.trim() || !newContent.trim()) return;
        setIsSubmitting(true);
        try {
            const tagsArray = newTags.split(',').map(t => t.trim()).filter(t => t !== '');
            await axios.post(`${API_URL}/api/community/post`, {
                userId: user?.sub || "anon",
                displayName: userData?.displayName || user?.name || "Analyst",
                picture: user?.picture || "",
                type: 'discussion', title: newTitle, content: newContent, tags: tagsArray
            });
            setOpenPostModal(false); setNewTitle(''); setNewContent(''); setNewTags(''); fetchFeed();
        } catch (err) { setError("Failed to publish post."); } 
        finally { setIsSubmitting(false); }
    };

    const handleSubmitDebrief = async () => {
        if (!myAnalysis.trim()) return;
        setSubmitDebriefLoading(true);
        try {
            await axios.post(`${API_URL}/api/debrief/submit`, {
                userId: user?.sub || "anon",
                displayName: userData?.displayName || user?.name || "Analyst",
                picture: user?.picture || "",
                analysis: myAnalysis, stance: myStance
            });
            setMyAnalysis(''); fetchDebriefData(); // Refresh debrief feed
        } catch (err) { alert("Failed to submit debrief."); } 
        finally { setSubmitDebriefLoading(false); }
    };

    const handleCopyLink = (postId) => {
        navigator.clipboard.writeText(`${window.location.origin}/community/${postId}`);
        alert("Link copied to clipboard!");
    };

    const getStanceColor = (stance) => {
        if (stance === 'Bullish') return 'success';
        if (stance === 'Bearish') return 'error';
        return 'warning';
    };

    const getStanceIcon = (stance) => {
        if (stance === 'Bullish') return <TrendingUp fontSize="small" sx={{mr:0.5}} />;
        if (stance === 'Bearish') return <TrendingDown fontSize="small" sx={{mr:0.5}} />;
        return <Remove fontSize="small" sx={{mr:0.5}} />;
    };

    const hasSubmittedDebrief = debriefs.some(a => a.userId === user?.sub);

    return (
        <Box sx={{ maxWidth: '1000px', margin: '0 auto', pb: 5 }}>
            {/* Header Area with Top Right Buttons */}
            <Box display="flex" justifyContent="space-between" alignItems="flex-end" mb={4}>
                <Box>
                    <Typography variant="h3" fontWeight="bold">Community Hub</Typography>
                    <Typography variant="subtitle1" color="text.secondary">
                        Discuss market trends, ask questions, and share profitable strategies.
                    </Typography>
                </Box>
                <Stack direction="row" spacing={2}>
                    <Button 
                        variant="outlined" 
                        color="secondary" 
                        startIcon={<Article />} 
                        onClick={() => setOpenDebriefModal(true)}
                        sx={{ fontWeight: 'bold', borderWidth: 2, '&:hover': { borderWidth: 2 } }}
                    >
                        Weekly Debrief
                    </Button>
                    <Button variant="contained" startIcon={<PostAdd />} onClick={() => setOpenPostModal(true)}>
                        New Post
                    </Button>
                </Stack>
            </Box>

            {/* Top Bar: Search */}
            <Paper sx={{ p: 2, mb: 4, display: 'flex', alignItems: 'center', borderRadius: 3 }}>
                <TextField
                    fullWidth placeholder="Search by tag (e.g., 'nifty', 'options'). Press Enter to search."
                    value={searchTag} onChange={(e) => setSearchTag(e.target.value)} onKeyDown={handleSearch}
                    variant="outlined" size="small" InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
                />
                {searchTag && <Button sx={{ml: 2}} onClick={() => { setSearchTag(''); fetchFeed(''); }}>Clear</Button>}
            </Paper>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            {/* The Main Feed */}
            {loading ? (
                <Box sx={{textAlign: 'center', p: 4}}><CircularProgress /></Box>
            ) : feed.length > 0 ? (
                <Stack spacing={3}>
                    {feed.map((post) => (
                        <Card key={post.id} elevation={2} sx={{ borderRadius: 3 }}>
                            <CardHeader
                                avatar={<Avatar src={post.picture} />}
                                title={<Typography fontWeight="bold">{post.displayName}</Typography>}
                                subheader={post.createdAt}
                                action={
                                    post.type === 'strategy' ? <Chip icon={<BarChart />} label="Strategy Shared" color="primary" variant="outlined" size="small" sx={{mt: 1, mr: 1}} />
                                    : <Chip label="Discussion" size="small" sx={{mt: 1, mr: 1}} />
                                }
                            />
                            <CardContent sx={{ pt: 0 }}>
                                <Typography variant="h6" fontWeight="bold" gutterBottom>{post.title}</Typography>
                                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', mb: 2, color: 'text.secondary' }}>{post.content}</Typography>

                                {/* RENDER EMBEDDED STRATEGY DATA (This is where it crashed previously!) */}
                                {post.type === 'strategy' && post.strategyData && (
                                    <Paper sx={{ p: 2, mb: 2, bgcolor: 'rgba(0, 191, 255, 0.05)', border: '1px solid rgba(0, 191, 255, 0.2)' }}>
                                        <Grid container spacing={2}>
                                            <Grid item xs={6} sm={3}>
                                                <Typography variant="caption" color="text.secondary">Asset</Typography>
                                                <Typography fontWeight="bold">{post.strategyData.symbol} ({post.strategyData.interval})</Typography>
                                            </Grid>
                                            <Grid item xs={6} sm={3}>
                                                <Typography variant="caption" color="text.secondary">Net Return</Typography>
                                                <Typography fontWeight="bold" color={post.strategyData.pnl_percent > 0 ? 'success.main' : 'error.main'}>
                                                    {post.strategyData.pnl_percent > 0 ? '+' : ''}{post.strategyData.pnl_percent}%
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={6} sm={3}>
                                                <Typography variant="caption" color="text.secondary">Win Rate</Typography>
                                                <Typography fontWeight="bold" color="info.main">{post.strategyData.win_rate}%</Typography>
                                            </Grid>
                                            <Grid item xs={6} sm={3}>
                                                <Typography variant="caption" color="text.secondary">Profit Factor</Typography>
                                                <Typography fontWeight="bold">{post.strategyData.profit_factor}</Typography>
                                            </Grid>
                                        </Grid>
                                    </Paper>
                                )}
                                <Stack direction="row" spacing={1} mt={2}>
                                    {post.tags?.map((t, i) => <Chip key={i} label={`#${t}`} size="small" onClick={() => {setSearchTag(t); fetchFeed(t);}} sx={{cursor: 'pointer'}} />)}
                                </Stack>
                            </CardContent>
                            <Divider />
                            <CardActions sx={{ px: 2, py: 1, justifyContent: 'space-between' }}>
                                <Stack direction="row" spacing={1}>
                                    {/* FIXED: Passed 'upvote' instead of 'upvotes' to match backend */}
                                    <Tooltip title="Upvote"><IconButton size="small" onClick={() => handleVote(post.id, 'upvote')}><ThumbUp fontSize="small" sx={{mr: 0.5}} /> <Typography variant="body2">{post.upvotes}</Typography></IconButton></Tooltip>
                                    <Tooltip title="Downvote"><IconButton size="small" onClick={() => handleVote(post.id, 'downvote')}><ThumbDown fontSize="small" sx={{mr: 0.5}} /> <Typography variant="body2">{post.downvotes}</Typography></IconButton></Tooltip>
                                    <Tooltip title="Comments"><IconButton size="small"><ChatBubbleOutline fontSize="small" sx={{mr: 0.5}} /> <Typography variant="body2">{post.commentsCount || 0}</Typography></IconButton></Tooltip>
                                </Stack>
                                <Tooltip title="Share Link"><IconButton size="small" onClick={() => handleCopyLink(post.id)}><Share fontSize="small" /></IconButton></Tooltip>
                            </CardActions>
                        </Card>
                    ))}
                </Stack>
            ) : (
                <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 3, bgcolor: 'background.paper' }}>
                    <Typography color="text.secondary">No posts found. Start a new discussion!</Typography>
                </Paper>
            )}

            {/* --- CREATE POST MODAL --- */}
            <Dialog open={openPostModal} onClose={() => setOpenPostModal(false)} fullWidth maxWidth="sm">
                <DialogTitle>Create a New Post</DialogTitle>
                <DialogContent>
                    <TextField autoFocus margin="dense" label="Title" fullWidth variant="outlined" value={newTitle} onChange={e => setNewTitle(e.target.value)} sx={{mb: 2, mt: 1}} />
                    <TextField label="Content" multiline rows={4} fullWidth variant="outlined" value={newContent} onChange={e => setNewContent(e.target.value)} sx={{mb: 2}} placeholder="What's on your mind?" />
                    <TextField label="Tags (comma separated)" fullWidth variant="outlined" value={newTags} onChange={e => setNewTags(e.target.value)} placeholder="nifty, options, tutorial" />
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setOpenPostModal(false)} color="inherit">Cancel</Button>
                    <Button onClick={handleCreatePost} variant="contained" disabled={isSubmitting || !newTitle || !newContent}>
                        {isSubmitting ? <CircularProgress size={24} /> : "Post"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* --- WEEKLY DEBRIEF MODAL --- */}
            <Dialog open={openDebriefModal} onClose={() => setOpenDebriefModal(false)} fullWidth maxWidth="md" scroll="paper">
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h5" fontWeight="bold">The Weekly Debrief</Typography>
                    <Button onClick={() => setOpenDebriefModal(false)} color="inherit">Close</Button>
                </DialogTitle>
                <DialogContent dividers sx={{ bgcolor: 'background.default' }}>
                    {debriefLoading ? <Box sx={{textAlign: 'center', p: 4}}><CircularProgress /></Box> : (
                        <Box>
                            {/* The Scenario Card */}
                            {scenario && (
                                <Paper sx={{ p: 4, mb: 4, borderRadius: 3, borderLeft: '6px solid', borderColor: 'secondary.main', bgcolor: 'background.paper' }}>
                                    <Typography variant="overline" color="secondary" fontWeight="bold">Topic of the Week</Typography>
                                    <Typography variant="h5" fontWeight="bold" gutterBottom>{scenario.title}</Typography>
                                    <Typography variant="body1" sx={{ fontSize: '1.1rem', lineHeight: 1.7 }}>{scenario.description}</Typography>
                                </Paper>
                            )}

                            {/* The Input Section */}
                            {!hasSubmittedDebrief ? (
                                <Card sx={{ mb: 4, borderRadius: 3 }}>
                                    <CardHeader avatar={<Avatar src={user?.picture} />} title="What's your take, Analyst?" titleTypographyProps={{ fontWeight: 'bold' }} />
                                    <CardContent>
                                        <Stack direction="row" spacing={2} mb={2} alignItems="center">
                                            <Typography variant="body2" color="text.secondary">Market Stance:</Typography>
                                            <ToggleButtonGroup value={myStance} exclusive onChange={(e, val) => val && setMyStance(val)} size="small">
                                                <ToggleButton value="Bullish" sx={{ color: 'success.main', '&.Mui-selected': { bgcolor: 'success.dark', color: 'white' } }}>Bullish</ToggleButton>
                                                <ToggleButton value="Neutral" sx={{ color: 'warning.main', '&.Mui-selected': { bgcolor: 'warning.dark', color: 'white' } }}>Neutral</ToggleButton>
                                                <ToggleButton value="Bearish" sx={{ color: 'error.main', '&.Mui-selected': { bgcolor: 'error.dark', color: 'white' } }}>Bearish</ToggleButton>
                                            </ToggleButtonGroup>
                                        </Stack>
                                        <TextField fullWidth multiline rows={4} placeholder="Draft your analysis here. Reference technical levels or fundamental data..." value={myAnalysis} onChange={(e) => setMyAnalysis(e.target.value)} />
                                    </CardContent>
                                    <CardActions sx={{ justifyContent: 'flex-end', p: 2 }}>
                                        <Button variant="contained" color="secondary" onClick={handleSubmitDebrief} disabled={submitDebriefLoading || !myAnalysis.trim()}>
                                            {submitDebriefLoading ? <CircularProgress size={24} /> : "Publish Analysis"}
                                        </Button>
                                    </CardActions>
                                </Card>
                            ) : (
                                <Alert severity="success" sx={{ mb: 4, borderRadius: 2 }}>You have published your analysis for this week! See community takes below.</Alert>
                            )}

                            {/* Debrief Community Feed */}
                            <Typography variant="h6" fontWeight="bold" gutterBottom>Community Insights</Typography>
                            <Stack spacing={2}>
                                {debriefs.length > 0 ? debriefs.map((item) => (
                                    <Card key={item.id} elevation={1} sx={{ borderRadius: 3 }}>
                                        <CardHeader
                                            avatar={<Avatar src={item.picture} />}
                                            title={item.displayName}
                                            action={
                                                <Typography variant="body2" color={getStanceColor(item.stance) + '.main'} sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', mt: 1, mr: 1 }}>
                                                    {getStanceIcon(item.stance)} {item.stance}
                                                </Typography>
                                            }
                                        />
                                        <CardContent sx={{ pt: 0 }}>
                                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{item.analysis}</Typography>
                                        </CardContent>
                                    </Card>
                                )) : (
                                    <Typography color="text.secondary">No analyses posted yet. Be the first!</Typography>
                                )}
                            </Stack>
                        </Box>
                    )}
                </DialogContent>
            </Dialog>

        </Box>
    );
};

export default CommunityHub;