import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Box, 
    Typography, 
    Button, 
    CircularProgress, 
    Paper, 
    Tabs, 
    Tab, 
    RadioGroup, 
    FormControlLabel, 
    Radio, 
    List, 
    ListItem, 
    ListItemAvatar, 
    Avatar, 
    ListItemText, 
    Alert, 
    Chip,
    ListItemButton
} from '@mui/material';
import { CheckCircle, Cancel } from '@mui/icons-material';
import ProfileModal from './ProfileModal';

const API_URL = "http://127.0.0.1:8000";

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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedProfile, setSelectedProfile] = useState(null);
    
    const { level, tier } = getLevelAndTier(userData?.arenaScore);
    
    // --- THE DEFINITIVE FIX: The "Smart Sentry" Logic ---
    // 1. Get today's date in the same format as the backend (YYYY-MM-DD)
    const todayStr = new Date().toISOString().split('T')[0];
    
    // 2. The core anti-cheating check. This will be true if the user has already submitted today.
    const hasCompletedQuizToday = userData?.dailyQuizCompleted === todayStr;

    useEffect(() => {
        const fetchData = async () => {
            if (!userData) { setLoading(true); return; }
            setLoading(true); setError('');
            try {
                // 3. The API call now respects the completion status.
                // If the quiz is done, it doesn't even bother fetching the questions.
                const quizPromise = hasCompletedQuizToday 
                    ? Promise.resolve({ data: null }) 
                    : axios.get(`${API_URL}/api/arena/daily-quiz/${level}`);
                
                const boardPromise = axios.get(`${API_URL}/api/arena/leaderboard`);
                
                const [quizRes, boardRes] = await Promise.all([quizPromise, boardPromise]);
                
                if (quizRes.data) setQuiz(quizRes.data);
                setLeaderboard(boardRes.data);
            } catch (err) { setError("Could not load Arena data."); }
            finally { setLoading(false); }
        };
        fetchData();
    }, [level, userData]); // Re-run when user data changes

    const handleAnswerChange = (qIndex, aIndex) => {
        setAnswers(prev => ({ ...prev, [qIndex]: parseInt(aIndex) }));
    };

    const submitQuiz = async () => {
        setLoading(true); setError('');
        try {
            const res = await axios.post(`${API_URL}/api/arena/submit-quiz`, { userId: user.sub, level, answers });
            setQuizResult(res.data);
            // After successful submission, we no longer need to refetch. The component will
            // re-render, see the quizResult, and then on next page load `hasCompletedQuizToday` will be true.
        } catch (err) { setError(err.response?.data?.detail || "Failed to submit quiz answers."); }
        finally { setLoading(false); }
    };
    
    const viewProfile = async (userId) => {
        const res = await axios.get(`${API_URL}/api/arena/profile/${userId}`);
        setSelectedProfile(res.data);
    };

    if (loading) {
        return <Box sx={{textAlign: 'center', p: 4}}><CircularProgress /><Typography sx={{mt: 2}}>Loading Arena...</Typography></Box>;
    }

    return (
        <Box>
            <ProfileModal open={!!selectedProfile} handleClose={() => setSelectedProfile(null)} user={selectedProfile} />
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h4" gutterBottom>The Arena</Typography>
                <Chip label={`Your Level: ${level} (${tier})`} color="primary" />
            </Box>
            <Paper>
                <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val)} centered>
                    <Tab label="Daily Quiz" />
                    <Tab label="Leaderboard" />
                </Tabs>

                {activeTab === 0 && (
                    <Box p={3}>
                        {error && <Alert severity="error" sx={{mb: 2}}>{error}</Alert>}

                        {/* --- THE FIX: This is the new rendering logic --- */}
                        {hasCompletedQuizToday ? (
                            // 1. If the user has completed the quiz, BLOCK access.
                            <Alert severity="success">You have already completed today's quiz! Your score has been updated. Come back tomorrow for a new challenge.</Alert>
                        ) : quizResult ? (
                            // 2. If they just submitted, show the results.
                            <Box>
                                <Typography variant="h4">Quiz Results</Typography>
                                <Typography variant="h6" color="primary.main" gutterBottom>You Scored: {quizResult.score} RP</Typography>
                                {quiz.questions.map((q, qIndex) => {
                                    const correctIdx = quizResult.correct_answers[qIndex];
                                    const userAnsIdx = answers[qIndex];
                                    return (
                                        <Box key={qIndex} my={2} p={2} borderRadius={2} sx={{border: '1px solid', borderColor: 'divider'}}>
                                            <Typography sx={{fontWeight: 'bold'}}>{qIndex + 1}. {q.question}</Typography>
                                            {q.options.map((opt, oIndex) => {
                                                const isCorrect = correctIdx === oIndex;
                                                const isUserChoice = userAnsIdx === oIndex;
                                                let color = 'inherit';
                                                if (isCorrect) color = 'success.main';
                                                else if (isUserChoice && !isCorrect) color = 'error.main';
                                                return <Box key={oIndex} display="flex" alignItems="center" sx={{color, my: 0.5}}>{isCorrect ? <CheckCircle fontSize="small" sx={{mr: 1}}/> : isUserChoice ? <Cancel fontSize="small" sx={{mr: 1}}/> : <Box sx={{width: '28px'}} />}<Typography>{opt}</Typography></Box>;
                                            })}
                                        </Box>
                                    );
                                })}
                            </Box>
                        ) : quiz ? (
                            // 3. If not completed and no result yet, show the quiz.
                            <>
                                <Typography variant="h6">Your {tier} Quiz ({quiz.questions.length} Questions)</Typography>
                                {quiz.questions.map((q, qIndex) => (
                                    <Box key={qIndex} my={2}>
                                        <Typography sx={{fontWeight: 'bold'}}>{qIndex + 1}. {q.question}</Typography>
                                        <RadioGroup onChange={(e) => handleAnswerChange(qIndex, e.target.value)}>
                                            {q.options.map((opt, oIndex) => <FormControlLabel key={oIndex} value={oIndex} control={<Radio />} label={opt} />)}
                                        </RadioGroup>
                                    </Box>
                                ))}
                                <Button variant="contained" onClick={submitQuiz}>Submit Answers</Button>
                            </>
                        ) : <Alert severity="info">Today's quiz for your level is not available yet. Please check back in a moment.</Alert>}
                    </Box>
                )}

                {activeTab === 1 && (
                    <List>
                        {leaderboard.map((player, index) => (
                            <ListItemButton key={player.id} onClick={() => viewProfile(player.id)}>
                                <ListItemAvatar><Avatar src={player.picture} /></ListItemAvatar>
                                <ListItemText primary={`${index + 1}. ${player.displayName}`} />
                                <Typography sx={{fontWeight: 'bold'}}>{player.arenaScore} RP</Typography>
                            </ListItemButton>
                        ))}
                    </List>
                )}
            </Paper>
        </Box>
    );
};

export default Arena;