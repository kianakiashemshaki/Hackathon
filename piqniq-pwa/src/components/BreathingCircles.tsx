import React, { useState, useEffect, useRef } from 'react';
import './BreathingCircles.css';

interface BreathingCirclesProps {
  phone: string;
}

const BreathingCircles: React.FC<BreathingCirclesProps> = ({ phone }) => {
  const [breathingPhase, setBreathingPhase] = useState<'inhale' | 'exhale'>('inhale');
  const [currentTrack, setCurrentTrack] = useState(1);
  const [isFirstCycle, setIsFirstCycle] = useState(true);
  const voiceAudioRef = useRef<HTMLAudioElement>(null);
  const backgroundAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const updatePhase = () => {
      const animationProgress = (Date.now() % 4000) / 4000;
      setBreathingPhase(animationProgress <= 0.4 ? 'inhale' : 'exhale');
    };

    updatePhase();
    const interval = setInterval(updatePhase, 100);
    return () => clearInterval(interval);
  }, []);

  // Background music effect
  useEffect(() => {
    if (backgroundAudioRef.current) {
      backgroundAudioRef.current.volume = 0.3;
      backgroundAudioRef.current.play().catch(error => console.error('Background audio playback error:', error));
    }
  }, []);

  // Voice guidance audio effect
  useEffect(() => {
    const playNextTrack = () => {
      if (voiceAudioRef.current) {
        // Determine next track number
        let nextTrack;
        if (isFirstCycle && currentTrack < 15) {
          nextTrack = currentTrack + 1;
        } else if (isFirstCycle && currentTrack === 15) {
          setIsFirstCycle(false);
          nextTrack = 12;
        } else if (!isFirstCycle && currentTrack < 15) {
          nextTrack = currentTrack + 1;
        } else {
          nextTrack = 12;
        }

        // Update current track
        setCurrentTrack(nextTrack);
        
        // Set new audio source and play
        voiceAudioRef.current.src = `/rsc/${nextTrack}.mp3`;
        voiceAudioRef.current.volume = 1.0;
        voiceAudioRef.current.play().catch(error => console.error('Audio playback error:', error));
      }
    };

    // Set up audio event listeners
    if (voiceAudioRef.current) {
      voiceAudioRef.current.addEventListener('ended', playNextTrack);
      
      // Start playing the first track
      voiceAudioRef.current.src = `/rsc/${currentTrack}.mp3`;
      voiceAudioRef.current.volume = 1.0;
      voiceAudioRef.current.play().catch(error => console.error('Audio playback error:', error));
    }

    // Cleanup
    return () => {
      if (voiceAudioRef.current) {
        voiceAudioRef.current.removeEventListener('ended', playNextTrack);
        voiceAudioRef.current.pause();
      }
    };
  }, [currentTrack, isFirstCycle]);

  const handleCall = () => {
    const phoneUrl = `tel:${phone}`;
    window.open(phoneUrl, '_blank');
  };

  return (
    <div className="breathing-container">
      <div className="page-title">Breathe with me</div>
      <div className="circle outer"></div>
      <div className="circle middle"></div>
      <div className="circle inner"></div>
      <button className="call-button" onClick={handleCall}>
        <span className="material-icons">call</span>
      </button>
      <div className="breathing-text">
        {breathingPhase === 'inhale' ? 'Inhale' : 'Exhale'}
      </div>
      
      {/* Audio elements */}
      <audio 
        ref={backgroundAudioRef}
        src="/rsc/background.mp3"
        loop
      />
      <audio 
        ref={voiceAudioRef}
      />
    </div>
  );
};

export default BreathingCircles; 