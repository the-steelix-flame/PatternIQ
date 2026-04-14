import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Box, Typography, Paper, Tabs, Tab, Button, TextField,
    Alert, Grid, Card, CardContent, Divider, Stack, Chip,
    Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
    AppBar // <--- FIXED: Added AppBar import here!
} from '@mui/material';
import { LineChart } from '@mui/x-charts';
import { auth } from '../firebase';
import { updatePassword, deleteUser } from 'firebase/auth';
import { Lock, DeleteForever, Code, Forum, AccessTime, Close } from '@mui/icons-material';

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const AccountSettings = ({ user, userData, onLogout }) => {
    const [activeTab, setActiveTab] = useState(0);
    const [newPassword, setNewPassword] = useState('');
    const [pwdMessage, setPwdMessage] = useState({ type: '', text: '' });

    const [myPosts, setMyPosts] = useState([]);
    const [myStrategies, setMyStrategies] = useState([]);
    const [loadingData, setLoadingData] = useState(true);

    // Modal state for viewing a saved strategy
    const [selectedStrategy, setSelectedStrategy] = useState(null);

    useEffect(() => {
        const fetchUserData = async () => {
            setLoadingData(true);
            try {
                const [postsRes, stratsRes] = await Promise.all([
                    axios.get(`${API_URL}/api/community/user-posts/${user.sub}`),
                    axios.get(`${API_URL}/api/user/strategies/${user.sub}`)
                ]);
                setMyPosts(postsRes.data);
                setMyStrategies(stratsRes.data);
            } catch (err) {
                console.error("Failed to load user data");
            } finally {
                setLoadingData(false);
            }
        };
        fetchUserData();
    }, [user.sub]);

    // --- FIREBASE AUTH ACTIONS ---
    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        setPwdMessage({ type: '', text: '' });
        try {
            if (auth.currentUser) {
                await updatePassword(auth.currentUser, newPassword);
                setPwdMessage({ type: 'success', text: 'Password updated successfully.' });
                setNewPassword('');
            } else {
                setPwdMessage({ type: 'error', text: 'Google-authenticated accounts cannot change passwords here.' });
            }
        } catch (error) {
            setPwdMessage({ type: 'error', text: error.message.replace("Firebase: ", "") });
        }
    };

    const handleDeleteAccount = async () => {
        if (window.confirm("WARNING: This will permanently delete your account and all data. Are you sure?")) {
            try {
                if (auth.currentUser) {
                    await deleteUser(auth.currentUser);
                    alert("Account deleted.");
                    onLogout(); // Log them out immediately
                }
            } catch (error) {
                alert("Please log out and log back in to verify your identity before deleting your account.");
            }
        }
    };

    return (
        <Box sx={{ maxWidth: '1200px', margin: '0 auto', pb: 5 }}>
            <Box mb={4}>
                <Typography variant="h3" fontWeight="bold">Account Hub</Typography>
                <Typography variant="subtitle1" color="text.secondary">Manage your profile, security, and saved data.</Typography>
            </Box>

            <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
                <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val)} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
                    <Tab label="Security & Settings" icon={<Lock fontSize="small" />} iconPosition="start" />
                    <Tab label={`My Strategies (${myStrategies.length})`} icon={<Code fontSize="small" />} iconPosition="start" />
                    <Tab label={`My Posts (${myPosts.length})`} icon={<Forum fontSize="small" />} iconPosition="start" />
                </Tabs>

                <Box p={4}>
                    {/* --- TAB 0: SECURITY --- */}
                    {activeTab === 0 && (
                        <Grid container spacing={4}>
                            <Grid item xs={12} md={6}>
                                <Typography variant="h6" fontWeight="bold" gutterBottom>Profile Information</Typography>
                                <Paper sx={{ p: 3, mb: 3, bgcolor: 'background.default' }}>
                                    <Typography variant="body2" color="text.secondary">Display Name</Typography>
                                    <Typography variant="h6" gutterBottom>{userData?.displayName || user.name}</Typography>
                                    <Typography variant="body2" color="text.secondary">Email / ID</Typography>
                                    <Typography variant="body1">{user.sub}</Typography>
                                </Paper>

                                <Typography variant="h6" fontWeight="bold" gutterBottom>Activity Stats</Typography>
                                <Paper sx={{ p: 3, bgcolor: 'background.default' }}>
                                    <Stack direction="row" spacing={2} alignItems="center">
                                        <AccessTime color="primary" />
                                        <Box>
                                            <Typography variant="body2" color="text.secondary">Total Arena Score</Typography>
                                            <Typography variant="h5" fontWeight="bold" color="primary">{userData?.arenaScore || 0} RP</Typography>
                                        </Box>
                                    </Stack>
                                </Paper>
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <Typography variant="h6" fontWeight="bold" gutterBottom>Security</Typography>
                                <Paper sx={{ p: 3, mb: 4, bgcolor: 'background.default' }} component="form" onSubmit={handleUpdatePassword}>
                                    <Typography variant="body2" mb={2}>Update your password (Email/Password users only).</Typography>
                                    {pwdMessage.text && <Alert severity={pwdMessage.type} sx={{ mb: 2 }}>{pwdMessage.text}</Alert>}
                                    <TextField fullWidth label="New Password" type="password" size="small" value={newPassword} onChange={e => setNewPassword(e.target.value)} sx={{ mb: 2 }} />
                                    <Button variant="contained" type="submit" disabled={!newPassword}>Update Password</Button>
                                </Paper>

                                <Typography variant="h6" fontWeight="bold" color="error" gutterBottom>Danger Zone</Typography>
                                <Paper sx={{ p: 3, bgcolor: 'rgba(244, 67, 54, 0.05)', border: '1px solid rgba(244, 67, 54, 0.3)' }}>
                                    <Typography variant="body2" mb={2}>Permanently delete your account and all associated data.</Typography>
                                    <Button variant="outlined" color="error" startIcon={<DeleteForever />} onClick={handleDeleteAccount}>
                                        Delete Account
                                    </Button>
                                </Paper>
                            </Grid>
                        </Grid>
                    )}

                    {/* --- TAB 1: MY STRATEGIES --- */}
                    {activeTab === 1 && (
                        <Grid container spacing={3}>
                            {myStrategies.length > 0 ? myStrategies.map((strat) => (
                                <Grid item xs={12} md={6} lg={4} key={strat.id}>
                                    <Card elevation={2} sx={{ borderRadius: 3, cursor: 'pointer', '&:hover': { outline: '2px solid #00BFFF' } }} onClick={() => setSelectedStrategy(strat)}>
                                        <CardContent>
                                            <Typography variant="h6" fontWeight="bold" noWrap>{strat.name}</Typography>
                                            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>{strat.createdAt}</Typography>
                                            <Divider sx={{ my: 1 }} />
                                            <Stack direction="row" justifyContent="space-between" mb={1}>
                                                <Typography variant="body2">Asset:</Typography>
                                                <Typography variant="body2" fontWeight="bold">{strat.symbol} ({strat.interval})</Typography>
                                            </Stack>
                                            <Stack direction="row" justifyContent="space-between">
                                                <Typography variant="body2">Net P/L:</Typography>
                                                <Typography variant="body2" fontWeight="bold" color={strat.resultData.pnl_percent > 0 ? 'success.main' : 'error.main'}>
                                                    {strat.resultData.pnl_percent > 0 ? '+' : ''}{strat.resultData.pnl_percent}%
                                                </Typography>
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            )) : <Typography color="text.secondary">No saved strategies found.</Typography>}
                        </Grid>
                    )}

                    {/* --- TAB 2: MY POSTS --- */}
                    {activeTab === 2 && (
                        <Stack spacing={2}>
                            {myPosts.length > 0 ? myPosts.map((post) => (
                                <Paper key={post.id} sx={{ p: 3, borderRadius: 2 }}>
                                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                        <Typography variant="h6" fontWeight="bold">{post.title}</Typography>
                                        <Chip label={post.type} size="small" />
                                    </Box>
                                    <Typography variant="body2" color="text.secondary" gutterBottom>{post.createdAt}</Typography>
                                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>{post.content}</Typography>
                                    <Stack direction="row" spacing={2} mt={2}>
                                        <Typography variant="caption" color="text.secondary">Upvotes: {post.upvotes || 0}</Typography>
                                        <Typography variant="caption" color="text.secondary">Comments: {post.commentsCount || 0}</Typography>
                                    </Stack>
                                </Paper>
                            )) : <Typography color="text.secondary">You haven't posted in the Community Hub yet.</Typography>}
                        </Stack>
                    )}
                </Box>
            </Paper>

            {/* --- STRATEGY VIEWER MODAL --- */}
            {selectedStrategy && (
                <Dialog open={!!selectedStrategy} onClose={() => setSelectedStrategy(null)} fullScreen>
                    <AppBar sx={{ position: 'relative' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 3, py: 2 }}>
                            <Box>
                                <Typography variant="h5" fontWeight="bold">{selectedStrategy.name}</Typography>
                                <Typography variant="subtitle2">Saved on {selectedStrategy.createdAt}</Typography>
                            </Box>
                            <IconButton color="inherit" onClick={() => setSelectedStrategy(null)}>
                                <Close />
                            </IconButton>
                        </Box>
                    </AppBar>
                    <Box p={4} bgcolor="background.default" minHeight="100vh">
                        <Grid container spacing={3} maxWidth="1200px" margin="0 auto">
                            <Grid item xs={12}>
                                <Typography variant="h6" color="primary">Strategy Logic:</Typography>
                                <Typography variant="body1" sx={{ fontStyle: 'italic', mb: 2 }}>"{selectedStrategy.strategyText}"</Typography>
                            </Grid>

                            {/* KPI Row */}
                            <Grid item xs={6} md={3}>
                                <Paper sx={{ p: 2, textAlign: 'center' }}>
                                    <Typography color="text.secondary" variant="caption">Net Return</Typography>
                                    <Typography variant="h5" color={selectedStrategy.resultData.pnl_percent > 0 ? 'success.main' : 'error.main'}>
                                        {selectedStrategy.resultData.pnl_percent > 0 ? '+' : ''}{selectedStrategy.resultData.pnl_percent}%
                                    </Typography>
                                </Paper>
                            </Grid>
                            <Grid item xs={6} md={3}>
                                <Paper sx={{ p: 2, textAlign: 'center' }}>
                                    <Typography color="text.secondary" variant="caption">Win Rate</Typography>
                                    <Typography variant="h5" color="info.main">{selectedStrategy.resultData.win_rate}%</Typography>
                                </Paper>
                            </Grid>
                            <Grid item xs={6} md={3}>
                                <Paper sx={{ p: 2, textAlign: 'center' }}>
                                    <Typography color="text.secondary" variant="caption">Max Drawdown</Typography>
                                    <Typography variant="h5" color="warning.main">{selectedStrategy.resultData.max_drawdown}%</Typography>
                                </Paper>
                            </Grid>
                            <Grid item xs={6} md={3}>
                                <Paper sx={{ p: 2, textAlign: 'center' }}>
                                    <Typography color="text.secondary" variant="caption">Total Trades</Typography>
                                    <Typography variant="h5">{selectedStrategy.resultData.num_trades}</Typography>
                                </Paper>
                            </Grid>

                            {/* Chart */}
                            <Grid item xs={12}>
                                <Paper sx={{ p: 3, height: 450 }}>
                                    <Typography variant="h6" gutterBottom>Equity Curve</Typography>
                                    {selectedStrategy.resultData.equity_curve && selectedStrategy.resultData.equity_curve.length > 0 ? (
                                        <LineChart
                                            xAxis={[{ data: selectedStrategy.resultData.equity_curve.map(p => p.date), scaleType: 'point', tickLabelStyle: { display: 'none' } }]}
                                            series={[{ data: selectedStrategy.resultData.equity_curve.map(p => p.equity), color: '#00BFFF', area: true, showMark: false }]}
                                            margin={{ bottom: 30 }}
                                        />
                                    ) : (
                                        <Typography color="text.secondary">No chart data available for this strategy.</Typography>
                                    )}
                                </Paper>
                            </Grid>
                        </Grid>
                    </Box>
                </Dialog>
            )}
        </Box>
    );
};

export default AccountSettings;