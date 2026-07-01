import React from 'react';
import { Heart, MessageSquare, Gamepad2, Grid3x3 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth, useSync, useChat } from '../../context/instances.js';
import { playAudio } from '../../utils/audio.js';

export function MobileBottomNav({ sfxEnabled }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userId } = useAuth();
  const { globalState } = useSync();
  const { messages: chatHistory } = useChat();
  
  // Need to safely check partner id and unread count, 
  // since this component will mount in App.jsx and has auth context.
  const profile = globalState?.room_profiles?.[userId] || {};
  const myPfp = profile.pfp;

  const tabs = [
    { id: 'home', path: '/dashboard', label: 'Dashboard', icon: Heart },
    { id: 'space', path: '/space', label: 'Spaces', icon: Grid3x3 },
    { id: 'arcade', path: '/arcade', label: 'Arcade', icon: Gamepad2 },
    { id: 'settings', path: '/settings', label: 'Control panel', isAvatar: true }
  ];

  const handleNav = (tab) => {
    playAudio('click', sfxEnabled);
    navigate(tab.path);
  };

  const shouldHide = location.pathname.startsWith('/chat');

  return (
    <div 
      className="md:hidden fixed bottom-0 left-0 right-0 z-[600] bg-window border-t-[0.5px] border-border pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
      style={{
        transform: shouldHide ? 'translate3d(0, 100%, 0)' : 'translate3d(0, 0, 0)',
        pointerEvents: shouldHide ? 'none' : 'auto'
      }}
    >
      <div className="flex items-center justify-between px-2 h-[56px]">
        {tabs.map(tab => {
          const isActive = location.pathname.startsWith(tab.path);
          const Icon = tab.icon;
          
          return (
            <button
              key={tab.id}
              onClick={() => handleNav(tab)}
              className="flex-1 flex flex-col items-center justify-center min-h-[44px] min-w-[44px] relative active:scale-95 transition-transform"
            >
              {tab.isAvatar ? (
                <div className={`w-[28px] h-[28px] overflow-hidden border-[1.5px] ${isActive ? 'border-primary' : 'border-transparent'}`}>
                  {myPfp ? (
                    <img src={myPfp} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-secondary flex items-center justify-center text-[10px]">
                      {profile.emoji || '👤'}
                    </div>
                  )}
                </div>
              ) : (
                <div className={`flex flex-col items-center gap-[2px] ${isActive ? 'text-primary' : 'text-main-text opacity-50'}`}>
                  <Icon size={24} strokeWidth={isActive ? 2 : 1.5} fill={isActive && tab.id === 'home' ? 'currentColor' : 'none'} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
