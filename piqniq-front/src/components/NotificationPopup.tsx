import React, { useEffect } from 'react';
import './NotificationPopup.css';

interface NotificationPopupProps {
  message: string;
  onClose: () => void;
}

const NotificationPopup: React.FC<NotificationPopupProps> = ({ message, onClose }) => {
  useEffect(() => {
    // Auto-close after 10 seconds
    const timer = setTimeout(() => {
      onClose();
    }, 10000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="notification-popup">
      <div className="notification-content">
        <h3>Emergency Alert!</h3>
        <p>{message}</p>
        <button className="close-button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default NotificationPopup; 