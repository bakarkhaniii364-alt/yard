import React from 'react';
import { Bell, X, Monitor } from 'lucide-react';
import { RetroWindow, RetroButton } from './UI.jsx';
import { GameInviteModal } from './Modals/GameInviteModal.jsx';
import { DoodleReceiverModal } from './Modals/DoodleReceiverModal.jsx';
import { FloatingEnvelope } from './Modals/FloatingEnvelope.jsx';

export function OverlayManager({ 
  showKiss, floatingDoodles, doodleQueue, setDoodleQueue, setFloatingDoodles, 
  activeDoodleView, closeDoodle, gameInvite, setGameInvite, watchpartyInvite, 
  setWatchpartyInvite, partnerName, 
  partnerId, roomProfiles, sfxEnabled, navigate, toast, lobbyState, userId, roomId, updateSyncState,
  onReadLater, onMarkSeen
}) {
  return (
    <>
      {showKiss && (
        <div className="kiss-container">
          {[...Array(60)].map((_, i) => {
            return (
              <div key={i} className="floating-heart" style={{ 
                left: `${Math.random() * 100}vw`,
                bottom: `-${10 + Math.random() * 20}vh`,
                '--tx': `${(Math.random() - 0.5) * 400}px`, 
                '--ty': `-${100 + Math.random() * 50}vh`, 
                '--tr': `${(Math.random() - 0.5) * 500}deg`,
                animationDelay: `${Math.random() * 2}s`, 
                fontSize: `${1.5 + Math.random() * 3}rem` 
              }}>{['💖', '💗', '💓', '💕', '❤️', '💌'][Math.floor(Math.random() * 6)]}</div>
            );
          })}
        </div>
      )}





      {watchpartyInvite && (
        <div className="fixed inset-0 z-[var(--z-modal)] bg-black/40 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <RetroWindow title="watchparty_invite.exe" onClose={() => setWatchpartyInvite(null)} className="max-w-sm w-full">
            <div className="p-6 text-center">
               <div className="w-16 h-16 bg-primary text-white rounded-lg retro-border flex items-center justify-center mx-auto mb-4">
                  <Monitor size={32} />
               </div>
               <h2 className="text-xl font-black mb-2 uppercase tracking-tighter">{watchpartyInvite.senderName} invited you!</h2>
               <p className="text-sm font-bold opacity-70 mb-6 lowercase">
                  {watchpartyInvite.title ? `join them to watch "${watchpartyInvite.title}" on syncwatcher?` : 'join them for a watch party on syncwatcher?'}
               </p>
               <div className="flex gap-3">
                  <RetroButton variant="white" className="flex-1 py-2 text-xs font-black uppercase" onClick={() => setWatchpartyInvite(null)}>Decline</RetroButton>
                  <RetroButton variant="primary" className="flex-1 py-2 text-xs font-black uppercase" onClick={() => {
                      setWatchpartyInvite(null);
                      navigate('/watch');
                  }}>Join Now</RetroButton>
               </div>
            </div>
          </RetroWindow>
        </div>
      )}

      {floatingDoodles.map((doodle) => (
         <FloatingEnvelope 
           key={doodle.id} 
           doodle={doodle} 
           onClick={(d) => { 
             setDoodleQueue(prev => [...prev, { image: d.data, sender: partnerId, assetId: d.assetId }]); 
             setFloatingDoodles(prev => prev.filter((item) => item.id !== d.id)); 
             onMarkSeen(d.assetId);
           }} 
           onReadLater={onReadLater}
         />
      ))}

      {activeDoodleView && (
        <DoodleReceiverModal 
          doodleData={activeDoodleView.image}
          partnerName={roomProfiles[activeDoodleView.sender]?.name || 'Partner'}
          onClose={closeDoodle}
          onScrapbook={async () => { toast('Saved to Scrapbook!', 'success'); }}
          onRedoodle={() => { closeDoodle(); navigate('/doodle'); }}
          onReply={() => { closeDoodle(); navigate('/chat'); }}
        />
      )}
    </>
  );
}
