import React, { useState } from 'react';
import './EmergencyCallButton.css';

interface EmergencyCallButtonProps {
  phone: string;
  email: string;
}

const EmergencyCallButton: React.FC<EmergencyCallButtonProps> = ({ phone, email }) => {
  const [isCalling, setIsCalling] = useState(false);
  const [callStatus, setCallStatus] = useState<string>('');

  const initiateCall = async () => {
    setIsCalling(true);
    setCallStatus('Initiating call...');

    // Try Google Meet first
    const meetUrl = `https://meet.google.com/new?authuser=${email}`;
    window.open(meetUrl, '_blank');

    // Then try phone call
    const phoneUrl = `tel:${phone}`;
    window.open(phoneUrl, '_blank');

    // Set up retry mechanism
    const retryInterval = setInterval(() => {
      setCallStatus(prev => {
        if (prev.includes('Retrying')) {
          const count = parseInt(prev.split(' ')[1]) + 1;
          return `Retrying ${count}...`;
        }
        return 'Retrying 1...';
      });
    }, 10000); // Retry every 10 seconds

    // Clean up interval after 5 minutes
    setTimeout(() => {
      clearInterval(retryInterval);
      setIsCalling(false);
      setCallStatus('Call attempts completed');
    }, 300000); // 5 minutes
  };

  return (
    <div className="emergency-call-container">
      <button 
        className={`emergency-call-button ${isCalling ? 'calling' : ''}`}
        onClick={initiateCall}
        disabled={isCalling}
      >
        <span className="material-icons">call</span>
        {isCalling ? 'Calling...' : 'Call Emergency'}
      </button>
      {callStatus && <p className="call-status">{callStatus}</p>}
    </div>
  );
};

export default EmergencyCallButton; 