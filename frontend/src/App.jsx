import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { GoogleLogin, GoogleOAuthProvider, googleLogout } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';

// Firebase Imports
import { db } from './firebase'; 
import { doc, onSnapshot } from 'firebase/firestore';

// MUI Imports
import { 
    ThemeProvider, 
    createTheme, 
    CssBaseline, 
    Box, 
    Typography, 
    AppBar, 
    Toolbar, 
    Avatar, 
    Drawer, 
    List, 
    ListItem, 
    ListItemButton, 
    ListItemIcon, 
    ListItemText, 
    Badge,
    IconButton,
    Menu,
    MenuItem,
    Tooltip
} from '@mui/material';
import { 
    BarChart, 
    TravelExplore, 
    Event, 
    AccountBalanceWallet, 
    Notifications, 
    SportsEsports,
    Article,
    Logout
} from '@mui/icons-material';

// --- Import ALL of your feature components ---
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import BacktestDashboard from './components/BacktestDashboard';
import TradersCalendar from './components/TradersCalendar';
import AnomalyScanner from './components/AnomalyScanner';
import Portfolio from './components/Portfolio';
import Arena from './components/Arena';
import ComingSoon from './components/ComingSoon';

// --- CONFIGURATION ---
const GOOGLE_CLIENT_ID = "1083915166146-b689q33bmjd7l3gesfh7a0kneuht2rqp.apps.googleusercontent.com";
const API_URL = "http://127.0.0.1:8000";

// --- THEME ---
const theme = createTheme({
  palette: { 
    mode: 'dark', 
    primary: { main: '#00BFFF' },
    secondary: { main: '#f48fb1' },
    background: { default: '#121212', paper: '#1e1e1e' },
  },
  components: { MuiPaper: { styleOverrides: { root: { borderRadius: 12 } } } }
});

// --- MAIN APP COMPONENT ---
function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [authPage, setAuthPage] = useState('landing');
  const [notifications, setNotifications] = useState([]);
  const [anchorElUser, setAnchorElUser] = useState(null);

  // This effect listens for real-time updates to the user's Firestore data.
  useEffect(() => {
    if (user?.sub) {
        const userDocRef = doc(db, "users", user.sub);
        const unsubscribe = onSnapshot(userDocRef, 
            (doc) => { if (doc.exists()) setUserData(doc.data()); }, 
            (error) => { console.error("Firestore snapshot listener failed:", error); }
        );
        return () => unsubscribe();
    }
  }, [user]);

  // --- THE DEFINITIVE FIX: Using YOUR correct login logic ---
  const handleLoginSuccess = async (credentialResponse) => {
    const decodedUser = jwtDecode(credentialResponse.credential);
    try {
        const res = await axios.post(`${API_URL}/api/users/profile`, {
            userId: decodedUser.sub,
            displayName: decodedUser.name,
            picture: decodedUser.picture
        });
        // This is the CRUCIAL step that fixes the infinite loading screen for existing users.
        if (res.data.data) {
            setUserData(res.data.data);
        }
    } catch (error) {
        console.error("Failed to create/fetch user profile:", error);
    }
    setUser(decodedUser);
  };
  
  const handleLogout = () => {
      googleLogout();
      setUser(null);
      setUserData(null);
      setAuthPage('landing');
      handleCloseUserMenu();
  };

  const handleOpenUserMenu = (event) => setAnchorElUser(event.currentTarget);
  const handleCloseUserMenu = () => setAnchorElUser(null);

  if (!user) {
      return (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            {authPage === 'landing' && <LandingPage onNavigateToLogin={() => setAuthPage('login')} />}
            {authPage === 'login' && <LoginPage onLogin={handleLoginSuccess} />}
          </ThemeProvider>
        </GoogleOAuthProvider>
      );
  }

  const drawerWidth = 240;
  const menuItems = [
      { text: 'Backtest Dashboard', icon: <BarChart />, page: 'dashboard' },
      { text: 'The Arena', icon: <SportsEsports />, page: 'arena' },
      { text: 'Anomaly Scanner', icon: <TravelExplore />, page: 'scanner' },
      { text: 'Trader\'s Calendar', icon: <Event />, page: 'calendar' },
      { text: 'The Weekly Debrief', icon: <Article />, page: 'debrief' },
      { text: 'My Portfolio', icon: <AccountBalanceWallet />, page: 'portfolio' },
  ];

  const renderActivePage = () => {
    switch (activePage) {
      case 'dashboard': return <BacktestDashboard />;
      case 'arena': return <Arena user={user} userData={userData} />;
      case 'scanner': return <AnomalyScanner user={user} />;
      case 'calendar': return <TradersCalendar user={user} />;
      case 'debrief': return <ComingSoon featureName="The Weekly Debrief" />;
      case 'portfolio': return <Portfolio />;
      default: return <BacktestDashboard />;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex' }}>
        <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
          <Toolbar>
            <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>📈 PatternIQ</Typography>
            <Badge badgeContent={notifications.length} color="secondary" sx={{mr: 3}}><Notifications /></Badge>
            <Tooltip title="Open settings">
              <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                <Avatar alt={user.name} src={user.picture} />
              </IconButton>
            </Tooltip>
            <Menu 
                sx={{ mt: '45px' }} 
                anchorEl={anchorElUser} 
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }} 
                keepMounted 
                transformOrigin={{ vertical: 'top', horizontal: 'right' }} 
                open={Boolean(anchorElUser)} 
                onClose={handleCloseUserMenu}
            >
                <MenuItem disabled><Typography textAlign="center">Profile</Typography></MenuItem>
                <MenuItem disabled><Typography textAlign="center">Settings</Typography></MenuItem>
                <MenuItem onClick={handleLogout}>
                    <ListItemIcon><Logout fontSize="small" /></ListItemIcon>
                    <Typography textAlign="center">Logout</Typography>
                </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>
        <Drawer variant="permanent" sx={{ width: drawerWidth, flexShrink: 0, [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' } }}>
          <Toolbar />
          <Box sx={{ overflow: 'auto' }}>
            <List>
              {menuItems.map((item) => (
                <ListItem key={item.text} disablePadding>
                  <ListItemButton selected={activePage === item.page} onClick={() => setActivePage(item.page)}>
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.text} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Box>
        </Drawer>
        <Box component="main" sx={{ flexGrow: 1, p: 3, position: 'relative', 
            '&::before': {
                content: '""', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                backgroundImage: 'url(https://images.pexels.com/photos/730547/pexels-photo-730547.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2)',
                backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.05, zIndex: -1
            }}}>
          <Toolbar />
          {renderActivePage()}
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;