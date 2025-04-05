import React, { useEffect } from 'react';
import './NotificationPopup.css';
import EmergencyCallButton from './EmergencyCallButton';

interface NotificationPopupProps {
  message: string;
  onClose: () => void;
  coordinates?: { lat: number; lon: number } | null;
  emergencyContact?: {
    email: string;
    phone: string;
  };
}

const NotificationPopup: React.FC<NotificationPopupProps> = ({ 
  message, 
  onClose, 
  coordinates,
  emergencyContact 
}) => {
  useEffect(() => {
    // Auto-close after 10 seconds
    const timer = setTimeout(() => {
      onClose();
    }, 10000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const getLocationLink = () => {
    if (!coordinates) return null;
    const { lat, lon } = coordinates;
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=15`;
  };

  const locationLink = getLocationLink();
  const [emergencyMessage, locationMessage] = message.split('\n');

  return (
    <div className="notification-popup">
      <div className="notification-content">
        <h3>Emergency Alert!</h3>
        <p className="emergency-message">{emergencyMessage}</p>
        <p className="location-message">{locationMessage}</p>
        {locationLink && (
          <div className="location-icon-container">
            <a 
              href={locationLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="location-link"
              title="View location on map"
            >
              <span className="material-icons">location_on</span>
            </a>
          </div>
        )}
        {emergencyContact && (
          <div className="emergency-call-container">
            <EmergencyCallButton 
              phone={emergencyContact.phone}
              email={emergencyContact.email}
            />
          </div>
        )}
        <button className="close-button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default NotificationPopup; 