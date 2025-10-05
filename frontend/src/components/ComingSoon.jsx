import React from 'react';
import { Box, Typography } from '@mui/material';
import { keyframes } from '@mui/system';

// Define a simple pulse animation for the text
const pulse = keyframes`
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
`;

const ComingSoon = ({ featureName }) => {
    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '70vh',
                textAlign: 'center'
            }}
        >
            <Typography variant="h2" gutterBottom sx={{ animation: `${pulse} 2.5s infinite ease-in-out` }}>
                Coming Soon
            </Typography>
            <Typography variant="h6" color="text.secondary">
                The "{featureName}" feature is under construction. Get ready for something amazing!
            </Typography>
        </Box>
    );
};

export default ComingSoon;