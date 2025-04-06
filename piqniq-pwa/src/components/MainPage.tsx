import React from 'react';
import { useNavigate } from 'react-router-dom';
import SettingsModal from './SettingsModal';
import NotificationPopup from './NotificationPopup';

interface MainPageProps {
  userName: string;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (isOpen: boolean) => void;
  handleButtonClick: () => void;
  showEmergencyCall: boolean;
  handleEmergencyCall: () => void;
  activePopup: {
    message: string;
    coordinates?: { lat: number; lon: number } | null;
    emergencyContact?: {
      email: string;
      phone: string;
    };
  } | null;
  handleClosePopup: () => void;
}

const MainPage: React.FC<MainPageProps> = ({
  userName,
  isSettingsOpen,
  setIsSettingsOpen,
  handleButtonClick,
  showEmergencyCall,
  handleEmergencyCall,
  activePopup,
  handleClosePopup
}) => {
  const navigate = useNavigate();

  return (
    <div className="App">
      <div className="background-container">
        <img 
          src="/rsc/baby_bot2.png" 
          alt="Baby Bot" 
          className="baby-bot-image"
        />
      </div>
      <div className="navbar">
        <div className="user-greeting">
          <div className="greeting-text">We are here for you</div>
          <div className="user-name">{userName}</div>
        </div>
      </div>
      <button 
        className="settings-button"
        onClick={() => setIsSettingsOpen(true)}
      >
        ⚙️
      </button>
      <div className="button-container">
        <button 
          className="action-button"
          onClick={handleButtonClick}
        >
          Panic Attack
        </button>
        <button 
          className="report-button"
          onClick={() => navigate('/report')}
        >
          <span className="material-icons">assessment</span>
        </button>
        {showEmergencyCall && (
          <button 
            className="main-menu-call-button"
            onClick={handleEmergencyCall}
          >
            <span className="material-icons">call</span>
          </button>
        )}
      </div>
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
      {activePopup && (
        <NotificationPopup
          message={activePopup.message}
          onClose={handleClosePopup}
          coordinates={activePopup.coordinates}
          emergencyContact={activePopup.emergencyContact}
        />
      )}
    </div>
  );
};

export default MainPage; 