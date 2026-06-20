import React, { useState } from 'react';
import { Box, Typography, Container, Paper, TextField, Button, Divider, Alert, CircularProgress } from '@mui/material';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { auth } from '../firebase';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    sendPasswordResetEmail
} from 'firebase/auth';

const LoginPage = ({ onLogin }) => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);

    const handleGoogleSuccess = (credentialResponse) => {
        const decoded = jwtDecode(credentialResponse.credential);
        onLogin({ sub: decoded.sub, name: decoded.name, picture: decoded.picture });
    };

    const handleForgotPassword = async () => {
        setError('');
        setSuccessMsg('');
        if (!email) {
            setError("Enter your email address above, then click 'Forgot password?' to receive a reset link.");
            return;
        }
        setLoading(true);
        try {
            await sendPasswordResetEmail(auth, email);
            // Worded so we never reveal whether an account actually exists for this email.
            setSuccessMsg(`If an account exists for ${email}, a password reset link has been sent. Check your inbox (and spam folder).`);
        } catch (err) {
            console.error("Password reset error:", err);
            const code = err.code || '';
            if (code === 'auth/invalid-email') {
                setError("Please enter a valid email address.");
            } else if (code === 'auth/user-not-found') {
                // Don't disclose account existence — show the same neutral success message.
                setSuccessMsg(`If an account exists for ${email}, a password reset link has been sent. Check your inbox (and spam folder).`);
            } else if (code === 'auth/too-many-requests') {
                setError("Too many attempts. Please wait a few minutes and try again.");
            } else {
                setError(err.message.replace("Firebase: ", ""));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleManualAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccessMsg('');

        try {
            if (isSignUp) {
                // 1. Create the user
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                
                // 2. Send the verification email
                await sendEmailVerification(userCredential.user);
                
                setSuccessMsg("Account created! We've sent a verification link to your email. Please check your inbox (and spam folder) to verify before logging in.");
                setIsSignUp(false); // Switch back to login mode
            } else {
                // 1. Log the user in
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                
                // 2. CHECK IF VERIFIED
                if (!userCredential.user.emailVerified) {
                    throw new Error("Please verify your email address before logging in. Check your inbox for the verification link.");
                }

                // 3. Let them into the app
                onLogin({
                    sub: userCredential.user.uid,
                    name: userCredential.user.displayName || email.split('@')[0],
                    picture: "https://api.dicebear.com/7.x/avataaars/svg?seed=" + userCredential.user.uid
                });
            }
        } catch (err) {
            console.error("Auth error:", err);
            // Clean up standard Firebase error messages to be user-friendly
            let errorText = err.message.replace("Firebase: ", "");
            if (errorText.includes("auth/invalid-credential")) errorText = "Invalid email or password.";
            if (errorText.includes("auth/email-already-in-use")) errorText = "An account with this email already exists.";
            setError(errorText);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container component="main" maxWidth="xs" sx={{ display: 'flex', alignItems: 'center', minHeight: '100vh' }}>
            <Paper sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', borderRadius: 3 }}>
                <Typography variant="h2" component="h1" gutterBottom>📈</Typography>
                <Typography component="h1" variant="h5" fontWeight="bold">
                    {isSignUp ? 'Create an Account' : 'Welcome Back'}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 1, mb: 3, textAlign: 'center' }}>
                    {isSignUp ? 'Join PatternIQ. Verification required.' : 'Sign in to your verified account.'}
                </Typography>

                {error && <Alert severity="error" sx={{ width: '100%', mb: 2 }}>{error}</Alert>}
                {successMsg && <Alert severity="success" sx={{ width: '100%', mb: 2 }}>{successMsg}</Alert>}

                <Box component="form" onSubmit={handleManualAuth} sx={{ width: '100%' }}>
                    {isSignUp && (
                        <TextField margin="normal" required fullWidth label="Display Name" autoFocus value={name} onChange={e => setName(e.target.value)} />
                    )}
                    <TextField margin="normal" required fullWidth label="Email Address" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                    <TextField margin="normal" required fullWidth label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
                    
                    <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 1, height: 45 }} disabled={loading}>
                        {loading ? <CircularProgress size={24} /> : (isSignUp ? 'Sign Up & Send Code' : 'Sign In')}
                    </Button>

                    {!isSignUp && (
                        <Box sx={{ textAlign: 'right', mb: 1 }}>
                            <Button type="button" onClick={handleForgotPassword} disabled={loading} sx={{ textTransform: 'none', fontSize: '0.85rem', p: 0.5 }}>
                                Forgot password?
                            </Button>
                        </Box>
                    )}
                </Box>

                <Button fullWidth onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccessMsg(''); }} sx={{ mb: 2, textTransform: 'none' }}>
                    {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                </Button>

                <Divider sx={{ width: '100%', my: 2 }}>OR</Divider>

                <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError('Google Login Failed')} />
            </Paper>
        </Container>
    );
};

export default LoginPage;