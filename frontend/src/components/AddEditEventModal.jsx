import React, { useState, useEffect } from 'react';
import { Modal, Paper, Typography, TextField, Select, MenuItem, FormControl, InputLabel, Button, Stack, IconButton } from '@mui/material';
import { Delete } from '@mui/icons-material';

const style = { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 400, bgcolor: 'background.paper', borderRadius: 3, boxShadow: 24, p: 4 };

const AddEditEventModal = ({ open, handleClose, handleSave, handleDelete, eventToEdit, selectedDate }) => {
    const [title, setTitle] = useState('');
    const [type, setType] = useState('Note');
    
    const isEditing = eventToEdit !== null;

    useEffect(() => {
        if (isEditing) {
            setTitle(eventToEdit.title);
            setType(eventToEdit.type);
        } else {
            setTitle('');
            setType('Note');
        }
    }, [eventToEdit, open]);

    const onSave = () => {
        if (title.trim()) {
            handleSave({
                ...eventToEdit, // Includes the id if editing
                date: isEditing ? eventToEdit.date : selectedDate,
                title: title.trim(),
                type: type,
            });
            handleClose();
        }
    };
    
    const onDelete = () => {
        handleDelete(eventToEdit);
        handleClose();
    };

    return (
        <Modal open={open} onClose={handleClose}>
            <Paper sx={style}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6" component="h2" gutterBottom>
                        {isEditing ? 'Edit Event' : `Add Event for ${selectedDate}`}
                    </Typography>
                    {isEditing && (
                        <IconButton onClick={onDelete} color="error"><Delete /></IconButton>
                    )}
                </Stack>
                <Stack spacing={2} mt={2}>
                    <TextField fullWidth label="Event Title" value={title} onChange={(e) => setTitle(e.target.value)} />
                    <FormControl fullWidth>
                        <InputLabel>Event Type</InputLabel>
                        <Select value={type} label="Event Type" onChange={(e) => setType(e.target.value)}>
                            <MenuItem value="Note">Note</MenuItem>
                            <MenuItem value="Reminder">Reminder</MenuItem>
                            <MenuItem value="Trade Idea">Trade Idea</MenuItem>
                        </Select>
                    </FormControl>
                    <Stack direction="row" spacing={2} justifyContent="flex-end">
                         <Button onClick={handleClose}>Cancel</Button>
                         <Button variant="contained" onClick={onSave}>{isEditing ? 'Save Changes' : 'Save Event'}</Button>
                    </Stack>
                </Stack>
            </Paper>
        </Modal>
    );
};

export default AddEditEventModal;