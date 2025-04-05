import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import SignIn from './components/auth/SignIn';
import SignUp from './components/auth/SignUp';
import SettingsModal from './components/SettingsModal';
import NotificationPopup from './components/NotificationPopup';
import './App.css';

interface Notification {
  type: string;
  message: string;
  timestamp: string;
  userId: string;
}

const App: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userName, setUserName] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [activePopup, setActivePopup] = useState<Notification | null>(null);

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

      // Initialize WebSocket connection
      const socket = io('http://localhost:3001', {
        auth: {
          token: token
        }
      });

      // Authenticate the socket connection
      socket.emit('authenticate', token);

      socket.on('notification', (data) => {
        // Only show notifications meant for the current user
        if (data.userId !== currentUserId) {
          setNotifications(prev => [...prev, data]);
          setActivePopup(data);
        }
      });

      setSocket(socket);

      return () => {
        socket.disconnect();
      };
    }
  }, [currentUserId]);

  const handleButtonClick = () => {
    if (socket) {
      socket.emit('button_click', { timestamp: new Date().toISOString() });
    }
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
        <Route
          path="/"
          element={
            <PrivateRoute>
              <div className="App">
                <div className="user-greeting">
                  We are here for you {userName}
                </div>
                <button 
                  className="settings-button"
                  onClick={() => setIsSettingsOpen(true)}
                >
                  ⚙️
                </button>
                <button 
                  className="action-button"
                  onClick={handleButtonClick}
                >
                  Panic Attack
                </button>
                <SettingsModal 
                  isOpen={isSettingsOpen}
                  onClose={() => setIsSettingsOpen(false)}
                />
                {activePopup && (
                  <NotificationPopup
                    message={activePopup.message}
                    onClose={handleClosePopup}
                  />
                )}
              </div>
            </PrivateRoute>
          }
        />
      </Routes>
    </Router>
  );
};

export default App;
