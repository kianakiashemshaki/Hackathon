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
    return new Promise((resolve) => {
      // Hardcoded fallback location
      const fallbackLocation = {
        address: 'Department of Geography, Ridge Street, Bowling Green, Wood County, Ohio, 43403, United States',
        coordinates: { lat: 41.3779119, lon: -83.6395318 }
      };

      // Check if we're in a secure context
      if (!window.isSecureContext) {
        console.warn('Not in secure context - using fallback location');
        resolve(fallbackLocation);
        return;
      }

      if (!navigator.geolocation) {
        resolve(fallbackLocation);
        return;
      }

      const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      };

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            let retries = 3;
            let address = `${latitude}, ${longitude}`;
            
            while (retries > 0) {
              try {
                const response = await fetch(
                  `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
                  {
                    headers: {
                      'User-Agent': 'PiqniqApp/1.0'
                    }
                  }
                );
                
                if (!response.ok) {
                  throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                if (data.display_name) {
                  address = data.display_name;
                  break;
                }
              } catch (error) {
                console.warn(`Reverse geocoding attempt ${4 - retries} failed:`, error);
                retries--;
                if (retries > 0) {
                  await new Promise(r => setTimeout(r, 1000));
                }
              }
            }

            resolve({
              address,
              coordinates: { lat: latitude, lon: longitude }
            });
          } catch (error) {
            console.error('Error in location processing:', error);
            resolve({
              address: 'Location known but address lookup failed',
              coordinates: { lat: latitude, lon: longitude }
            });
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          // Use hardcoded fallback location instead of IP-based geolocation
          resolve(fallbackLocation);
        },
        options
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
