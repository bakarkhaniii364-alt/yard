import React, { useEffect, useRef } from 'react';
import { Phone, Video, PhoneOff } from 'lucide-react';
import { PremiumCallHub } from './Call/PremiumCallHub.jsx';

export function CallOverlay({
  incomingCall, isRinging, partnerProfile, partnerName, endCall, acceptCall, declineCall,
  calling, callDuration, callStatus, callQuality, isMuted, isDeafened, isCameraOff, isScreenSharing,
  toggleMic, toggleDeafen, toggleCamera, startScreenShare, stopScreenShare,
  restartIce, changeDevice, isPartnerTyping, isPartnerCameraOff,
  sfxEnabled, remoteStream, remoteScreenStream, localStream,
  onReaction, onRaiseHand,
  localScreenStream, isPartnerScreenSharing,
}) {
  // Hidden <audio> element to play remote audio stream (bypasses autoplay policy)
  const remoteAudioRef = useRef(null);

  useEffect(() => {
    const audio = remoteAudioRef.current;
    if (!audio) return;
    if (remoteStream) {
      console.log('[CallOverlay] Binding remote stream. Tracks:', remoteStream.getTracks().map(t => `${t.kind}:${t.enabled}`));
      audio.srcObject = remoteStream;
      audio.play()
        .then(() => console.log('[CallOverlay] Remote audio playing'))
        .catch(e => console.warn('[CallOverlay] Autoplay blocked or play failed:', e));
    } else {
      console.log('[CallOverlay] Clearing remote stream');
      audio.srcObject = null;
    }
  }, [remoteStream]);

  // Apply deafen and volume settings
  useEffect(() => {
    const audio = remoteAudioRef.current;
    if (!audio) return;
    audio.muted = isDeafened;
    
    const savedVol = Number(localStorage.getItem('call_output_volume') || 1);
    audio.volume = savedVol;

    const handleVolChange = (e) => {
      audio.volume = e.detail.volume;
    };
    window.addEventListener('call_volume_change', handleVolChange);
    return () => window.removeEventListener('call_volume_change', handleVolChange);
  }, [isDeafened]);

  if (!incomingCall && !calling) return null;

  const handleAccept = () => {
    // Trigger play on user gesture to bypass autoplay policy
    if (remoteAudioRef.current) {
      remoteAudioRef.current.play().catch(() => {});
    }
    acceptCall();
  };

  const handleDecline = () => {
    if (declineCall) declineCall();
    else if (endCall) endCall();
  };

  return (
    <>
      {/* Hidden audio element for remote stream */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        className="opacity-0 pointer-events-none fixed bottom-0 left-0 w-1 h-1"
      />

      {/* Incoming call modal */}
      {incomingCall && isRinging && (
        <div className="fixed inset-0 z-[var(--z-modal)] bg-black/40 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-window/95 text-main-text retro-border shadow-2xl max-w-md w-full p-12 text-center animate-in slide-in-from-bottom-10 border-t-8 border-t-primary">
            {/* Avatar */}
            <div className="w-24 h-24 bg-secondary text-secondary-text retro-border mx-auto flex items-center justify-center mb-6 animate-pulse shadow-[0_0_40px_var(--secondary)] relative overflow-hidden">
              {incomingCall.type === 'video'
                ? <Video size={48} className="text-white absolute z-0" />
                : <Phone size={48} className="text-white absolute z-0" />
              }
              {partnerProfile?.pfp && (
                <img
                  src={partnerProfile.pfp}
                  alt="partner"
                  className="w-full h-full object-cover relative z-10 bg-window"
                  onError={e => { e.target.style.display = 'none'; }}
                />
              )}
            </div>

            <h2 className="text-2xl font-black mb-1">{partnerName || 'Partner'}</h2>
            <p className="text-[10px] font-black text-primary mb-8 uppercase tracking-[0.2em] animate-pulse">
              Incoming {incomingCall.type === 'video' ? 'Video' : 'Voice'} Call
            </p>

            {/* Decline / Accept */}
            <div className="flex gap-6 justify-center">
              <button
                onClick={handleDecline}
                className="p-5 bg-[var(--color-destructive)] text-white retro-border rounded-full hover:bg-[var(--color-destructive)] transition-all hover:scale-110 shadow-lg"
                title="Decline"
              >
                <PhoneOff size={28} className="rotate-[135deg]" />
              </button>
              <button
                onClick={handleAccept}
                className="p-5 bg-[var(--color-game)] text-white retro-border rounded-full hover:bg-green-600 transition-all hover:scale-110 shadow-lg"
                title="Accept"
              >
                <Phone size={28} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active call UI */}
      {calling && (
      <PremiumCallHub
          calling={calling} callDuration={callDuration} callStatus={callStatus} callQuality={callQuality}
          isMuted={isMuted} isDeafened={isDeafened} isCameraOff={isCameraOff} isScreenSharing={isScreenSharing}
          onMicToggle={toggleMic} onDeafenToggle={toggleDeafen} onCameraToggle={toggleCamera} onEndCall={endCall}
          onScreenShare={startScreenShare} onStopScreenShare={stopScreenShare}
          onRestartIce={restartIce} onChangeDevice={changeDevice}
          isPartnerTyping={isPartnerTyping} isPartnerCameraOff={isPartnerCameraOff}
          partnerName={partnerName} partnerPfp={partnerProfile?.pfp} sfx={sfxEnabled}
          remoteStream={remoteStream} remoteScreenStream={remoteScreenStream} localStream={localStream} isRinging={isRinging} type={calling}
          onReaction={onReaction} onRaiseHand={onRaiseHand}
          localScreenStream={localScreenStream} isPartnerScreenSharing={isPartnerScreenSharing}
        />
      )}
    </>
  );
}
