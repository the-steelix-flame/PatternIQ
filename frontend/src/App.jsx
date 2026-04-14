import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { GoogleOAuthProvider, googleLogout } from '@react-oauth/google';

// --- Firebase Imports ---
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

// --- MUI Imports ---
import {
  ThemeProvider, createTheme, CssBaseline, Box, Typography, AppBar, Toolbar, Avatar,
  Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Badge, IconButton, Menu, MenuItem, Tooltip,
  Stack, Button, CircularProgress
} from '@mui/material';
import {
  BarChart, TravelExplore, Event, AccountBalanceWallet, Notifications,
  SportsEsports, Forum, Logout, Settings, Menu as MenuIcon
} from '@mui/icons-material';

// --- LOVABLE LANDING COMPONENTS ---
import Navbar from './components/landing/Navbar';
import HeroSection from './components/landing/HeroSection';
import LogoTicker from './components/landing/LogoTicker';
import FeaturesGrid from './components/landing/FeaturesGrid';
import ShowcaseSection from './components/landing/ShowcaseSection';
import StatsSection from './components/landing/StatsSection';
import HowItWorks from './components/landing/HowItWorks';
import TestimonialsSection from './components/landing/TestimonialsSection';
import PricingSection from './components/landing/PricingSection';
import FAQSection from './components/landing/FAQSection';
import CTASection from './components/landing/CTASection';
import Footer from './components/landing/Footer';

// --- DASHBOARD COMPONENTS ---
import LoginPage from './components/LoginPage';
import BacktestDashboard from './components/BacktestDashboard';
import TradersCalendar from './components/TradersCalendar';
import AnomalyScanner from './components/AnomalyScanner';
import Portfolio from './components/Portfolio';
import Arena from './components/Arena';
import CommunityHub from './components/CommunityHub';
import AccountSettings from './components/AccountSettings';
import UserManual from './components/UserManual';

const GOOGLE_CLIENT_ID = "1083915166146-b689q33bmjd7l3gesfh7a0kneuht2rqp.apps.googleusercontent.com";

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#00BFFF' },
    secondary: { main: '#f48fb1' },
    background: { default: '#121212', paper: '#1e1e1e' },
  },
  components: { MuiPaper: { styleOverrides: { root: { borderRadius: 12 } } } }
});

const drawerWidth = 240;

function App() {
  // 1. Initialize state from localStorage so refreshes don't wipe your screen
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('viewMode') || 'landing');
  const [activePage, setActivePage] = useState(() => localStorage.getItem('activePage') || 'dashboard');

  // 2. Initialize user from localStorage to prevent Google Auth from wiping on refresh
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('patternIqUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [userData, setUserData] = useState(null);
  const [anchorElUser, setAnchorElUser] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // 3. Sync state changes to localStorage automatically
  useEffect(() => {
    localStorage.setItem('viewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('activePage', activePage);
  }, [activePage]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('patternIqUser', JSON.stringify(user));
    } else {
      localStorage.removeItem('patternIqUser');
    }
  }, [user]);

  // 4. Firebase Session Persistence (Modified to respect Google OAuth)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          sub: firebaseUser.uid,
          name: firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'Trader'),
          picture: firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`
        });
        setViewMode(prev => prev === 'login' ? 'app' : prev);
      } else {
        // CRITICAL FIX: Only kick to landing if there is ALSO no Google user in localStorage
        if (!localStorage.getItem('patternIqUser')) {
          setUser(null);
          setViewMode('landing');
        }
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && user.sub) {
      const unsubscribe = onSnapshot(doc(db, "users", user.sub), (docSnap) => {
        if (docSnap.exists()) setUserData(docSnap.data());
      });
      return () => unsubscribe();
    }
  }, [user]);

  const handleLoginSuccess = (payload) => {
    setUser(payload);
    setViewMode('app');
    setActivePage('dashboard');
  };

  const handleLogout = () => {
    googleLogout();
    auth.signOut();
    setUser(null);
    setViewMode('landing');
    setAnchorElUser(null);

    // Clear all session memory
    localStorage.removeItem('viewMode');
    localStorage.removeItem('activePage');
    localStorage.removeItem('patternIqUser');
  };

  const menuItems = [
    { text: 'Dashboard', icon: <BarChart />, page: 'dashboard' },
    { text: 'Arena', icon: <SportsEsports />, page: 'arena' },
    { text: 'Community', icon: <Forum />, page: 'community' },
    { text: 'Scanner', icon: <TravelExplore />, page: 'scanner' },
    { text: 'Calendar', icon: <Event />, page: 'calendar' },
    { text: 'Portfolio', icon: <AccountBalanceWallet />, page: 'portfolio' },
  ];

  const isHomePage = activePage === 'home';

  const renderContent = () => {
    switch (activePage) {
      case 'dashboard': return <BacktestDashboard user={user} userData={userData} />;
      case 'arena': return <Arena user={user} userData={userData} />;
      case 'community': return <CommunityHub user={user} userData={userData} />;
      case 'scanner': return <AnomalyScanner user={user} />;
      case 'calendar': return <TradersCalendar user={user} />;
      case 'portfolio': return <Portfolio user={user} />;
      case 'settings': return <AccountSettings user={user} userData={userData} onLogout={handleLogout} />;
      default: return <BacktestDashboard user={user} userData={userData} />;
    }
  };

  // --- ROUTING LOGIC ---

  // 1. Wait for Firebase to finish checking cookies
  if (isAuthLoading) {
    return (
      <Box display="flex" height="100vh" alignItems="center" justifyContent="center" bgcolor="#000">
        <CircularProgress color="primary" />
      </Box>
    );
  }

  // 2. Manual & Login Pages
  if (viewMode === 'manual') return <ThemeProvider theme={theme}><CssBaseline /><UserManual onBack={() => setViewMode('landing')} /></ThemeProvider>;
  if (viewMode === 'login') return <ThemeProvider theme={theme}><CssBaseline /><LoginPage onLogin={handleLoginSuccess} onBack={() => setViewMode('landing')} /></ThemeProvider>;

  // 3. Lovable Landing Page (Viewable by both Logged In & Logged Out users)
  if (viewMode === 'landing') {
    return (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <Box className="bg-background min-h-screen text-foreground overflow-x-hidden">
          <Navbar
            user={user}
            onLoginClick={() => setViewMode('login')}
            onDashboardClick={() => { setViewMode('app'); setActivePage('dashboard'); }}
            onLogoutClick={handleLogout}
          />
          <HeroSection onCtaClick={() => {
            if (user) {
              setViewMode('app');
              setActivePage('dashboard');
            } else {
              setViewMode('login');
            }
          }} />
          <LogoTicker />
          <FeaturesGrid />
          <ShowcaseSection />
          <StatsSection />
          <HowItWorks />
          <TestimonialsSection />
          <PricingSection />
          <FAQSection />
          <CTASection onCtaClick={() => {
            if (user) {
              setViewMode('app');
              setActivePage('dashboard');
            } else {
              setViewMode('login');
            }
          }} />
          <Footer onManualClick={() => setViewMode('manual')} />
        </Box>
      </GoogleOAuthProvider>
    );
  }

  // 4. Authenticated Route (MUI Dashboard)
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex' }}>
        <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: 'background.paper', backgroundImage: 'none', borderBottom: '1px solid #333' }}>
          <Toolbar>
            {!isHomePage && (
              <IconButton color="inherit" onClick={() => setDrawerOpen(!drawerOpen)} edge="start" sx={{ mr: 2 }}>
                <MenuIcon />
              </IconButton>
            )}

            <Typography
              variant="h6"
              noWrap
              sx={{
                flexGrow: isHomePage ? 0 : 1,
                fontWeight: 'bold',
                cursor: 'pointer',
                mr: 4,
                '&:hover': { color: 'primary.main' }
              }}
              onClick={() => setViewMode('landing')}
            >
              📈 Pattern<span style={{ color: '#00BFFF' }}>IQ</span>
            </Typography>

            {isHomePage && (
              <Stack direction="row" spacing={1} sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' } }}>
                {menuItems.map((item) => (
                  <Button key={item.text} color="inherit" onClick={() => setActivePage(item.page)} startIcon={item.icon} sx={{ textTransform: 'none', fontSize: '0.9rem' }}>
                    {item.text}
                  </Button>
                ))}
              </Stack>
            )}

            <Stack direction="row" spacing={2} alignItems="center" sx={{ ml: 'auto' }}>
              <Badge badgeContent={notifications.length} color="secondary"><Notifications /></Badge>
              <Tooltip title="Account">
                <IconButton onClick={(e) => setAnchorElUser(e.currentTarget)} sx={{ p: 0 }}>
                  <Avatar alt={user?.name || "User"} src={user?.picture} />
                </IconButton>
              </Tooltip>
            </Stack>

            <Menu sx={{ mt: '45px' }} anchorEl={anchorElUser} anchorOrigin={{ vertical: 'top', horizontal: 'right' }} open={Boolean(anchorElUser)} onClose={() => setAnchorElUser(null)}>
              <MenuItem onClick={() => { setActivePage('settings'); setAnchorElUser(null); }}><ListItemIcon><Settings fontSize="small" /></ListItemIcon>Settings</MenuItem>
              <MenuItem onClick={handleLogout}><ListItemIcon><Logout fontSize="small" /></ListItemIcon>Logout</MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        {!isHomePage && (
          <Drawer
            variant="permanent"
            sx={{
              width: drawerOpen ? drawerWidth : 70,
              flexShrink: 0,
              [`& .MuiDrawer-paper`]: {
                width: drawerOpen ? drawerWidth : 70,
                boxSizing: 'border-box',
                overflowX: 'hidden',
                transition: 'width 0.2s'
              }
            }}
          >
            <Toolbar />
            <List>
              {menuItems.map((item) => (
                <ListItem key={item.text} disablePadding sx={{ display: 'block' }}>
                  <ListItemButton selected={activePage === item.page} onClick={() => setActivePage(item.page)} sx={{ minHeight: 48, justifyContent: drawerOpen ? 'initial' : 'center', px: 2.5 }}>
                    <ListItemIcon sx={{ minWidth: 0, mr: drawerOpen ? 3 : 'auto', justifyContent: 'center', color: activePage === item.page ? 'primary.main' : 'inherit' }}>
                      {item.icon}
                    </ListItemIcon>
                    {drawerOpen && <ListItemText primary={item.text} />}
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Drawer>
        )}

        <Box component="main" sx={{ flexGrow: 1, p: isHomePage ? 0 : 3 }}>
          <Toolbar />
          {renderContent()}
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;