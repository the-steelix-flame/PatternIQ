import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Box, Typography, Button, CircularProgress, Paper, Tabs, Tab, 
    RadioGroup, FormControlLabel, Radio, List, ListItem, ListItemAvatar, 
    Avatar, ListItemText, Alert, Chip, ListItemButton, Divider,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from '@mui/material';
import { CheckCircle, Cancel, EmojiEvents, History } from '@mui/icons-material';
import ProfileModal from './ProfileModal';

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const getLevelAndTier = (score = 0) => {
    const level = Math.floor(score / 100) + 1;
    let tier = "Beginner";
    if (level > 15) tier = "Expert";
    else if (level > 10) tier = "Advanced";
    else if (level > 5) tier = "Intermediate";
    return { level: Math.min(level, 20), tier };
};

const Arena = ({ user, userData }) => {
    const [activeTab, setActiveTab] = useState(0);
    const [quiz, setQuiz] = useState(null);
    const [answers, setAnswers] = useState({});
    const [quizResult, setQuizResult] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [history, setHistory] = useState([]); // --- NEW: History State ---
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedProfile, setSelectedProfile] = useState(null);
    
    const { level, tier } = getLevelAndTier(userData?.arenaScore);
    
    const todayStr = new Date().toISOString().split('T')[0];
    const hasCompletedQuizToday = userData?.dailyQuizCompleted === todayStr;

    useEffect(() => {
        const fetchData = async () => {
            // FIX: Only block if the core auth ID is missing. 
            // We removed !userData so new users without a DB document don't get stuck!
            if (!user?.sub) { 
                setLoading(false); 
                return; 
            }
            
            setLoading(true); setError('');
            try {
                // Fetch Quiz, Leaderboard, AND History simultaneously
                const quizPromise = hasCompletedQuizToday 
                    ? Promise.resolve({ data: null }) 
                    : axios.get(`${API_URL}/api/arena/daily-quiz/${level}`);
                
                const boardPromise = axios.get(`${API_URL}/api/arena/leaderboard`);
                const historyPromise = axios.get(`${API_URL}/api/arena/history/${user.sub}`); 
                
                const [quizRes, boardRes, historyRes] = await Promise.all([quizPromise, boardPromise, historyPromise]);
                
                if (quizRes.data) setQuiz(quizRes.data);
                setLeaderboard(boardRes.data);
                setHistory(historyRes.data);
            } catch (err) { 
                setError("Could not load Arena data. Is the backend running?"); 
            } finally { 
                setLoading(false); 
            }
        };
        fetchData();
    }, [level, userData, user?.sub]);

    const handleAnswerChange = (qIndex, aIndex) => {
        setAnswers(prev => ({ ...prev, [qIndex]: parseInt(aIndex) }));
    };

    const submitQuiz = async () => {
        setLoading(true); setError('');
        try {
            const res = await axios.post(`${API_URL}/api/arena/submit-quiz`, { userId: user.sub, level, answers });
            setQuizResult(res.data);
            
            // Refresh history immediately after playing so it shows up in the tab
            const historyRes = await axios.get(`${API_URL}/api/arena/history/${user.sub}`);
            setHistory(historyRes.data);
        } catch (err) { setError(err.response?.data?.detail || "Failed to submit quiz answers."); }
        finally { setLoading(false); }
    };
    
    const viewProfile = async (userId) => {
        const res = await axios.get(`${API_URL}/api/arena/profile/${userId}`);
        setSelectedProfile(res.data);
    };

    if (loading) return <Box sx={{textAlign: 'center', p: 4}}><CircularProgress /><Typography sx={{mt: 2}}>Loading Arena...</Typography></Box>;

    return (
        <Box maxWidth="900px" margin="0 auto">
            <ProfileModal open={!!selectedProfile} handleClose={() => setSelectedProfile(null)} user={selectedProfile} />
            
            <Box display="flex" justifyContent="space-between" alignItems="flex-end" mb={3}>
                <Box>
                    <Typography variant="h3" fontWeight="bold">The Arena</Typography>
                    <Typography variant="subtitle1" color="text.secondary">Compete, learn, and earn Reputation Points (RP).</Typography>
                </Box>
                <Chip icon={<EmojiEvents />} label={`Lvl ${level} ${tier} | ${userData?.arenaScore || 0} RP`} color="primary" size="large" sx={{ fontWeight: 'bold' }} />
            </Box>

            <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
                <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val)} centered sx={{ bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider' }}>
                    <Tab label="Daily Quiz" sx={{ fontWeight: 'bold' }} />
                    <Tab label="Leaderboard" sx={{ fontWeight: 'bold' }} />
                    <Tab label="My History" iconPosition="start" icon={<History fontSize="small" />} sx={{ fontWeight: 'bold' }} />
                </Tabs>

                {activeTab === 0 && (
                    <Box p={4}>
                        {error && <Alert severity="error" sx={{mb: 2}}>{error}</Alert>}

                        {hasCompletedQuizToday ? (
                            <Alert severity="success" sx={{ borderRadius: 2 }}>You have already completed today's quiz! Your score has been updated. Come back tomorrow for a new challenge.</Alert>
                        ) : quizResult ? (
                            <Box>
                                <Typography variant="h5" fontWeight="bold" gutterBottom>Quiz Results</Typography>
                                <Typography variant="h6" color="primary.main" gutterBottom>You Earned: +{quizResult.score} RP</Typography>
                                <Divider sx={{ my: 2 }} />
                                {quiz.questions.map((q, qIndex) => {
                                    const correctIdx = quizResult.correct_answers ? quizResult.correct_answers[qIndex] : quizResult.results[qIndex].correct_index;
                                    const userAnsIdx = answers[qIndex];
                                    return (
                                        <Box key={qIndex} my={3} p={3} borderRadius={2} sx={{ bgcolor: 'background.default' }}>
                                            <Typography sx={{fontWeight: 'bold', mb: 2}}>{qIndex + 1}. {q.question}</Typography>
                                            {q.options.map((opt, oIndex) => {
                                                const isCorrect = correctIdx === oIndex;
                                                const isUserChoice = userAnsIdx === oIndex;
                                                let color = 'text.secondary';
                                                if (isCorrect) color = 'success.main';
                                                else if (isUserChoice && !isCorrect) color = 'error.main';
                                                
                                                return (
                                                    <Box key={oIndex} display="flex" alignItems="center" sx={{ color, my: 1, fontWeight: isCorrect || isUserChoice ? 'bold' : 'normal' }}>
                                                        {isCorrect ? <CheckCircle fontSize="small" sx={{mr: 1.5}}/> : isUserChoice ? <Cancel fontSize="small" sx={{mr: 1.5}}/> : <Box sx={{width: '32px'}} />}
                                                        <Typography>{opt}</Typography>
                                                    </Box>
                                                );
                                            })}
                                        </Box>
                                    );
                                })}
                            </Box>
                        ) : quiz ? (
                            <>
                                <Typography variant="h6" gutterBottom>Your {tier} Challenge</Typography>
                                <Typography variant="body2" color="text.secondary" mb={3}>Answer these {quiz.questions.length} questions based on recent market events. You earn 10 RP per correct answer.</Typography>
                                {quiz.questions.map((q, qIndex) => (
                                    <Box key={qIndex} my={3} p={3} borderRadius={2} sx={{ bgcolor: 'background.default' }}>
                                        <Typography sx={{fontWeight: 'bold', mb: 2}}>{qIndex + 1}. {q.question}</Typography>
                                        <RadioGroup onChange={(e) => handleAnswerChange(qIndex, e.target.value)}>
                                            {q.options.map((opt, oIndex) => <FormControlLabel key={oIndex} value={oIndex} control={<Radio />} label={opt} />)}
                                        </RadioGroup>
                                    </Box>
                                ))}
                                <Button variant="contained" size="large" fullWidth onClick={submitQuiz} sx={{ mt: 2, height: 48, fontWeight: 'bold' }}>Submit Answers</Button>
                            </>
                        ) : <Alert severity="info">Today's quiz is generating. Please check back in a moment.</Alert>}
                    </Box>
                )}

                {activeTab === 1 && (
                    <List sx={{ p: 0 }}>
                        {leaderboard.map((player, index) => (
                            <ListItemButton key={player.id} onClick={() => viewProfile(player.id)} divider>
                                <Typography variant="h6" sx={{ width: 40, color: index < 3 ? 'primary.main' : 'text.secondary', fontWeight: 'bold' }}>
                                    #{index + 1}
                                </Typography>
                                <ListItemAvatar><Avatar src={player.picture} /></ListItemAvatar>
                                <ListItemText primary={<Typography fontWeight="bold">{player.displayName}</Typography>} />
                                <Typography sx={{fontWeight: 'bold', color: 'primary.main'}}>{player.arenaScore} RP</Typography>
                            </ListItemButton>
                        ))}
                    </List>
                )}

                {/* --- NEW: HISTORY TAB --- */}
                {activeTab === 2 && (
                    <Box p={3}>
                        {history.length > 0 ? (
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 'bold' }}>Date Played</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold' }}>Difficulty Level</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Score Earned</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {history.map((record) => (
                                            <TableRow key={record.id} hover>
                                                <TableCell>{record.date}</TableCell>
                                                <TableCell align="center">
                                                    <Chip size="small" label={`Level ${record.level}`} variant="outlined" />
                                                </TableCell>
                                                <TableCell align="right" sx={{ color: record.score > 50 ? 'success.main' : 'warning.main', fontWeight: 'bold' }}>
                                                    +{record.score} RP
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        ) : (
                            <Alert severity="info" sx={{ mt: 2 }}>You haven't completed any quizzes yet. Play your first daily quiz to start building your history!</Alert>
                        )}
                    </Box>
                )}
            </Paper>
        </Box>
    );
};

export default Arena;