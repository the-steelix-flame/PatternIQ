import React from 'react';
import { Box, Typography, Container, Paper } from '@mui/material';
import { GoogleLogin } from '@react-oauth/google';

const LoginPage = ({ onLogin }) => {
    return (
        <Container component="main" maxWidth="xs" sx={{ display: 'flex', alignItems: 'center', minHeight: '100vh' }}>
            <Paper sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                <Typography variant="h2" component="h1" gutterBottom>📈</Typography>
                <Typography component="h1" variant="h5">Welcome Back</Typography>
                <Typography color="text.secondary" sx={{ mt: 1, mb: 3, textAlign: 'center' }}>
                    Sign in with your Google account to access your dashboard.
                </Typography>
                <GoogleLogin onSuccess={onLogin} onError={() => console.log('Login Failed')} />
            </Paper>
        </Container>
    );
};

export default LoginPage;