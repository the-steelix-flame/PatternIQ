import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, Typography, Button, CircularProgress, Paper, List, ListItem, ListItemText, Alert } from '@mui/material';
import { db } from '../firebase'; 
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import TypingEffect from './TypingEffect'; // Import our new component

const API_URL = "http://127.0.0.1:8000";

const DUMMY_ALERTS = [
    { id: 'dummy1', symbol: 'ADANIENT', message: "Unusual Volume: Today's volume is 250% of the 20-day average." },
    { id: 'dummy2', symbol: 'TATAMOTORS', message: "Unusual Volume: Today's volume is 180% of the 20-day average." }
];

const AnomalyScanner = () => {
    const [realAlerts, setRealAlerts] = useState([]);
    const [scanStatus, setScanStatus] = useState('idle'); // idle, scanning, finished
    const [showDummyData, setShowDummyData] = useState(false);

    // This listener for REAL alerts is always on
    useEffect(() => {
        const q = query(collection(db, "alerts"), orderBy("timestamp", "desc"), limit(10));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const alertsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRealAlerts(alertsData);
        });
        return () => unsubscribe();
    }, []);

    const handleScan = async () => {
        setScanStatus('scanning');
        setShowDummyData(false); // Reset dummy data on new scan
        try {
            await axios.get(`${API_URL}/api/scan-anomalies`);
            // The backend will take time. We set the status to finished after a delay
            // to allow time for Firestore to update if a real alert is found.
            setTimeout(() => {
                setScanStatus('finished');
            }, 5000); // Wait 5 seconds for real results
        } catch (error) {
            console.error("Scan request failed", error);
            setScanStatus('finished'); // End scan even if API fails
        }
    };

    // This effect checks if we should show dummy data
    useEffect(() => {
        if (scanStatus === 'finished' && realAlerts.length === 0) {
            setShowDummyData(true);
        }
    }, [scanStatus, realAlerts]);

    const alertsToDisplay = showDummyData ? DUMMY_ALERTS : realAlerts;

    return (
        <Box>
            <Typography variant="h4" gutterBottom>Market Anomaly Scanner</Typography>
            <Button variant="contained" onClick={handleScan} disabled={scanStatus === 'scanning'} sx={{ mb: 2 }}>
                {scanStatus === 'scanning' ? <CircularProgress size={24} /> : "Scan NIFTY 50 Stocks for Volume Spikes"}
            </Button>
            
            {showDummyData && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    <TypingEffect text="NNo major anomalies detected in the live scan. Displaying recent examples..." />
                </Alert>
            )}

            <Paper sx={{ p: 2 }}>
                <Typography variant="h6">Live Alerts Feed</Typography>
                <List>
                    {alertsToDisplay.length > 0 ? alertsToDisplay.map(alert => (
                        <ListItem key={alert.id} divider>
                            <ListItemText 
                                primary={<Typography variant="subtitle1" component="span" sx={{fontWeight: 'bold'}}>{alert.symbol}</Typography>} 
                                secondary={alert.message} />
                        </ListItem>
                    )) : (
                         <ListItem>
                            <ListItemText primary={scanStatus === 'scanning' ? "Scanning in progress..." : "No recent alerts. Click the scan button to check for anomalies."} />
                        </ListItem>
                    )}
                </List>
            </Paper>
        </Box>
    );
};

export default AnomalyScanner;