import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import SignIn from './components/auth/SignIn';
import SignUp from './components/auth/SignUp';
import SettingsModal from './components/SettingsModal';
import NotificationPopup from './components/NotificationPopup';
import BreathingCircles from './components/BreathingCircles';
import ReportPage from './components/ReportPage';
import MainPage from './components/MainPage';
import './App.css';

interface Notification {
  type: string;
  message: string;
  timestamp: string;
  userId: string;
  location?: string;
  coordinates?: { lat: number; lon: number } | null;
  emergencyContact?: {
    email: string;
    phone: string;
  };
}

// Get the current hostname and port
const API_URL = `http://${window.location.hostname}:3001`;

const EMERGENCY_CONTACT = {
  email: '911',
  phone: '911'
};

const App: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userName, setUserName] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [activePopup, setActivePopup] = useState<Notification | null>(null);
  const [showEmergencyCall, setShowEmergencyCall] = useState(false);

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);

    if (token) {
      try {
        // Decode the token to get user info
        const tokenPayload = JSON.parse(atob(token.split('.')[1]));
        if (tokenPayload && tokenPayload.name) {
          setUserName(tokenPayload.name);
          setCurrentUserId(tokenPayload.userId);
        }
      } catch (error) {
        console.error('Error decoding token:', error);
      }

      // Initialize WebSocket connection with proper configuration
      const socket = io(API_URL, {
        auth: {
          token: token
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        path: '/socket.io/'
      });

      // Handle connection events
      socket.on('connect', () => {
        console.log('WebSocket connected');
        socket.emit('authenticate', token);
      });

      socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
      });

      socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
      });

      socket.on('notification', (data) => {
        console.log('Received notification:', data);
        // Only show notifications meant for the current user
        if (data.userId !== currentUserId) {
          setNotifications(prev => [...prev, data]);
          setActivePopup(data);
          console.log('Setting active popup:', data);
        }
      });

      setSocket(socket);

      return () => {
        socket.disconnect();
      };
    }
  }, [currentUserId]);

  const getLocation = async (): Promise<{ address: string; coordinates: { lat: number; lon: number } | null }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
            );
            const data = await response.json();
            const address = data.display_name || `${latitude}, ${longitude}`;
            resolve({
              address,
              coordinates: { lat: latitude, lon: longitude }
            });
          } catch (error) {
            console.error('Error getting address:', error);
            resolve({
              address: 'Location unknown',
              coordinates: null
            });
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          resolve({
            address: 'Location unavailable',
            coordinates: null
          });
        }
      );
    });
  };

  const handleButtonClick = async () => {
    if (socket) {
      try {
        const { address, coordinates } = await getLocation();
        socket.emit('button_click', { 
          timestamp: new Date().toISOString(),
          location: address,
          coordinates
        });
        // Instead of setShowEmergencyCall, navigate to the breathing page
        window.open(`/breathing?phone=${encodeURIComponent(EMERGENCY_CONTACT.phone)}`, '_blank');
      } catch (error) {
        console.error('Error getting location:', error);
        socket.emit('button_click', { 
          timestamp: new Date().toISOString(),
          location: 'Location unavailable',
          coordinates: null
        });
        window.open(`/breathing?phone=${encodeURIComponent(EMERGENCY_CONTACT.phone)}`, '_blank');
      }
    }
  };

  const handleEmergencyCall = () => {
    const phoneUrl = 'tel:+1 (619) 609 3341';
    window.open(phoneUrl, '_blank');
  };

  const handleClosePopup = () => {
    setActivePopup(null);
  };

  const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return isAuthenticated ? <>{children}</> : <Navigate to="/signin" />;
  };

  return (
    <Router>
      <Routes>
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/breathing" element={<BreathingCircles phone={new URLSearchParams(window.location.search).get('phone') || EMERGENCY_CONTACT.phone} />} />
        <Route path="/report" element={<PrivateRoute><ReportPage /></PrivateRoute>} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <MainPage
                userName={userName}
                isSettingsOpen={isSettingsOpen}
                setIsSettingsOpen={setIsSettingsOpen}
                handleButtonClick={handleButtonClick}
                showEmergencyCall={showEmergencyCall}
                handleEmergencyCall={handleEmergencyCall}
                activePopup={activePopup}
                handleClosePopup={handleClosePopup}
              />
            </PrivateRoute>
          }
        />
      </Routes>
    </Router>
  );
};

export default App;
