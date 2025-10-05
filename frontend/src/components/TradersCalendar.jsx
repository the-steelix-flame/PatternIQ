import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, Typography, Button, CircularProgress, Paper, Chip, IconButton, useTheme, Alert } from '@mui/material';
import { Public, Business, Gavel, Warning, EventNote, AddCircle, ChevronLeft, ChevronRight, Edit } from '@mui/icons-material';
import AddEditEventModal from './AddEditEventModal'; // We will use the intelligent modal

const API_URL = "http://127.0.0.1:8000";

// --- (Styles are the same) ---
const calendarGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', backgroundColor: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.1)' };
const calendarCellStyle = { minHeight: { xs: 100, md: 140 }, p: 0.5, position: 'relative', backgroundColor: 'background.paper', overflow: 'hidden' };
const eventTypeStyles = { 'Domestic': { color: 'primary', icon: <Gavel fontSize="inherit"/> }, 'Global': { color: 'info', icon: <Public fontSize="inherit"/> }, 'Corporate': { color: 'success', icon: <Business fontSize="inherit"/> }, 'Geopolitical': { color: 'error', icon: <Warning fontSize="inherit"/> }, 'Note': { color: 'secondary', icon: <EventNote fontSize="inherit"/> }, 'Reminder': { color: 'warning', icon: <EventNote fontSize="inherit"/> }, 'Trade Idea': { color: 'default', icon: <EventNote fontSize="inherit"/> } };

const CalendarEvent = ({ event, onClick }) => {
    if (!event || !event.type) return null;
    const style = eventTypeStyles[event.type] || eventTypeStyles['Note'];
    const isUserEvent = ['Note', 'Reminder', 'Trade Idea'].includes(event.type);
    
    return <Chip
        icon={style.icon}
        label={event.title || event.event}
        color={style.color}
        size="small"
        onClick={isUserEvent ? onClick : null} // Only user events are clickable
        onDelete={isUserEvent ? onClick : null} // Makes the whole chip a button to open edit
        deleteIcon={isUserEvent ? <Edit fontSize="inherit"/> : null}
        sx={{ mb: 0.5, width: 'calc(100% - 4px)', justifyContent: 'flex-start', ml: '2px', cursor: isUserEvent ? 'pointer' : 'default' }}
    />;
};

const TradersCalendar = ({ user }) => {
    const theme = useTheme();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [allEvents, setAllEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState(null);
    const [eventToEdit, setEventToEdit] = useState(null);

    // --- This function is now the single source of truth for fetching data ---
    const fetchAllEvents = async () => {
        if (!user?.sub) { setLoading(false); return; }
        setLoading(true); setError(null);
        try {
            const [aiRes, userRes] = await Promise.all([
                axios.get(`${API_URL}/api/calendar/ai-events`),
                axios.get(`${API_URL}/api/calendar/user-events/${user.sub}`)
            ]);
            const combined = [...(aiRes.data || []), ...(userRes.data || [])];
            setAllEvents(combined);
        } catch (err) { setError("Could not load calendar events."); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        fetchAllEvents();
    }, [user, user?.sub, currentDate]);

    const handleOpenAddModal = (dateStr) => {
        setEventToEdit(null);
        setSelectedDate(dateStr);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (event) => {
        setEventToEdit(event);
        setIsModalOpen(true);
    };

    // --- THE FIX: This function now contains the complete API logic ---
    const handleSaveEvent = async (eventData) => {
        const isEditing = !!eventData.id;
        const endpoint = isEditing ? `${API_URL}/api/calendar/user-event/${user.sub}/${eventData.id}` : `${API_URL}/api/calendar/user-event`;
        const method = isEditing ? 'put' : 'post';
        try {
            await axios[method](endpoint, {
                ...eventData,
                userId: user.sub, // Ensure userId is always sent
            });
            await fetchAllEvents(); // Refresh all events from the database after saving
        } catch (error) {
            console.error("Failed to save event:", error);
            setError("Could not save your event. Please try again.");
        }
    };
    
    // --- THE FIX: This function now contains the complete API logic ---
    const handleDeleteEvent = async (eventData) => {
        if (!eventData.id) return;
        try {
            await axios.delete(`${API_URL}/api/calendar/user-event/${user.sub}/${eventData.id}`);
            await fetchAllEvents(); // Refresh all events from the database after deleting
        } catch (error) {
            console.error("Failed to delete event:", error);
            setError("Could not delete your event. Please try again.");
        }
    };
    
    // (The rest of the component is the same, but now it's fully connected)
    const changeMonth = (offset) => { setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1)); };
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const calendarDays = Array(firstDayOfMonth).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)));

    if (!user) return <CircularProgress />;

    return (
        <Box>
            <AddEditEventModal open={isModalOpen} handleClose={() => setIsModalOpen(false)} handleSave={handleSaveEvent} handleDelete={handleDeleteEvent} eventToEdit={eventToEdit} selectedDate={selectedDate} />
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                 <Typography variant="h4" sx={{ fontWeight: 'bold' }}>{currentDate.toLocaleString('default', { month: 'long' })} {year}</Typography>
                 <Box>
                    <IconButton onClick={() => changeMonth(-1)}><ChevronLeft /></IconButton>
                    <Button onClick={() => setCurrentDate(new Date())} sx={{ mx: 1 }}>Today</Button>
                    <IconButton onClick={() => changeMonth(1)}><ChevronRight /></IconButton>
                </Box>
            </Box>
            {loading && <CircularProgress />}
            {error && <Alert severity="error">{error}</Alert>}
            {!loading && !error && (
                <Paper sx={{ overflow: 'hidden' }}>
                    <Box sx={calendarGridStyle}>
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <Box key={day} sx={{ textAlign: 'center', fontWeight: 'bold', py: 1, backgroundColor: 'rgba(0,0,0,0.2)'}}>{day}</Box>
                        ))}
                    </Box>
                    <Box sx={calendarGridStyle}>
                        {calendarDays.map((day, index) => {
                            if (!day) return <Box key={`empty-${index}`} sx={{...calendarCellStyle, backgroundColor: 'action.disabledBackground' }} />;
                            const dateStr = day.toISOString().split('T')[0];
                            const dayEvents = allEvents.filter(e => e.date === dateStr);
                            const isToday = new Date().toDateString() === day.toDateString();
                            return (
                                <Box key={dateStr} sx={calendarCellStyle}>
                                    <Typography variant="caption" sx={{ display: 'inline-block', fontWeight: isToday ? 'bold' : 'normal', color: isToday ? 'primary.main' : 'text.secondary', backgroundColor: isToday ? theme.palette.primary.main + '33' : 'transparent', borderRadius: '50%', width: '24px', height: '24px', textAlign: 'center', lineHeight: '24px' }}>
                                        {day.getDate()}
                                    </Typography>
                                    <IconButton size="small" sx={{ position: 'absolute', top: 2, right: 2 }} onClick={() => handleOpenAddModal(dateStr)}><AddCircle fontSize="inherit" /></IconButton>
                                    <Box sx={{ maxHeight: {xs: 70, md: 110}, overflowY: 'auto', mt: 0.5}}>
                                        {dayEvents.map((event, i) => <CalendarEvent key={event.id || i} event={event} onClick={() => handleOpenEditModal(event)} />)}
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                </Paper>
            )}
        </Box>
    );
};

export default TradersCalendar;