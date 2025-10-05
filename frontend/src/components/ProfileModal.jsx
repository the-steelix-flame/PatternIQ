import React from 'react';
import { Modal, Paper, Box, Typography, Avatar, Chip, Stack } from '@mui/material';

const style = { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 400, bgcolor: 'background.paper', borderRadius: 3, boxShadow: 24, p: 4, textAlign: 'center' };

const getFlair = (score) => {
    if (score > 5000) return { label: 'Platinum Analyst 💎', color: 'default' };
    if (score > 2000) return { label: 'Gold Trader 🥇', color: 'warning' };
    if (score > 500) return { label: 'Silver Trader 🥈', color: 'info' };
    if (score > 100) return { label: 'Bronze Trader 🥉', color: 'secondary' };
    return { label: 'New Trader', color: 'default' };
}

const ProfileModal = ({ open, handleClose, user }) => {
    if (!user) return null;

    const flair = getFlair(user.arenaScore);

    return (
        <Modal open={open} onClose={handleClose}>
            <Paper sx={style}>
                <Avatar src={user.picture} sx={{ width: 80, height: 80, margin: '0 auto', mb: 2 }} />
                <Typography variant="h5">{user.displayName}</Typography>
                <Typography color="text.secondary">Total Reputation: {user.arenaScore} RP</Typography>
                <Chip label={flair.label} color={flair.color} sx={{ mt: 2 }} />
            </Paper>
        </Modal>
    );
};

export default ProfileModal;