import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageSquare, Trophy, Gamepad2, Settings as SettingsIcon, Bell, Mic, MicOff, Headphones, User, LogOut, Search } from 'lucide-react';
import { playAudio } from '../../utils/audio.js';
import { useAuth, useSync, useCall } from '../../context/instances.js';
import { useNotificationHistory } from '../../hooks/useNotificationHistory.js';
import { useLastSeen } from '../../hooks/useLastSeen.js';
import { NotificationHistoryModal } from '../Modals/NotificationHistoryModal.jsx';
import { useToast } from '../UI.jsx';

export function LeftNavBar({ sfxEnabled, onOpenLeaderboard, isLeaderboardOpen, onOpenSettings }) {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { userId, partnerId, logout } = useAuth();
  const { globalState, updateSyncStateAtomic, onlineUsers } = useSync();
  const { isMuted, isDeafened, toggleMic, toggleDeafen } = useCall();
  const { unreadCount } = useNotificationHistory(userId);
  const { partnerStatusData, partnerStatusLabel } = useLastSeen();

  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);

  const navItems = [
    { id: 'search', label: 'Search', icon: Search, isRoute: false, onClick: () => {
      if (location.pathname !== '/dashboard') {
        navigate('/dashboard', { state: { autoOpenSearch: true } });
      } else {
        window.dispatchEvent(new CustomEvent('open_search'));
      }
    }},
    { id: 'chat', path: '/chat', label: 'Chat Log', icon: MessageSquare, isRoute: true },
    { id: 'leaderboard', label: 'Scoreboard', icon: Trophy, isRoute: false, onClick: onOpenLeaderboard },
    { id: 'arcade', path: '/arcade', label: 'Arcade cabinet', icon: Gamepad2, isRoute: true },
    { id: 'notifications', label: 'Notifications', icon: Bell, isRoute: false, onClick: () => setShowNotifModal(true) },
  ];

  const handleNav = (item) => {
    playAudio('click', sfxEnabled);
    if (item.isRoute) {
      navigate(item.path);
    } else if (item.onClick) {
      item.onClick();
    }
  };

  const handleSetStatus = (statusValue) => {
    playAudio('click', sfxEnabled);
    updateSyncStateAtomic('room_profiles', userId, { userStatus: statusValue });
    setShowStatusMenu(false);
    toast({
      message: `Status updated to ${statusValue === 'active' ? 'Online' : statusValue === 'idle' ? 'Idle' : 'Do Not Disturb'}`,
      type: 'success'
    });
  };

  const isHome = location.pathname === '/dashboard';
  const profile = globalState?.room_profiles?.[userId] || {};
  const presence = onlineUsers[userId];
  const userStatus = profile.userStatus || (presence?.status || 'active');

  let statusColor = 'bg-success';
  if (userStatus === 'idle') statusColor = 'bg-warning';
  else if (userStatus === 'dnd') statusColor = 'bg-[var(--color-destructive)]';
  else if (userStatus === 'offline') statusColor = 'bg-disabled';

  return (
    <div 
      className="hidden md:flex flex-col justify-between items-center py-6 px-1 fixed left-0 top-0 bottom-0 w-12 z-40 bg-[var(--bg-main)] border-r-2 border-[var(--border)]"
      style={{ boxSizing: 'border-box' }}
    >
      {/* Top Section (Navigation) */}
      <div className="flex flex-col items-center w-full">
        {/* Start Button as lowercase 'y' in Space Mono font, without any surrounding box */}
        <button
          onClick={() => {
            playAudio('click', sfxEnabled);
            navigate('/dashboard');
          }}
          className={`w-9 h-9 flex items-center justify-center text-2xl font-bold select-none transition-all shrink-0 ${
            isHome 
              ? 'text-[var(--primary)] scale-110' 
              : 'text-[var(--text-main)] opacity-60 hover:opacity-100 hover:scale-105'
          }`}
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          y
        </button>

        {/* Separator line */}
        <div className="w-8 h-[2px] bg-[var(--border)] opacity-30 my-3 shrink-0" />

        {/* Stack of App Buttons */}
        <div className="flex flex-col gap-4 w-full items-center">
          {navItems.map((item) => {
            const isActive = item.isRoute ? location.pathname.startsWith(item.path) : (item.id === 'leaderboard' ? isLeaderboardOpen : false);
            const Icon = item.icon;

            const buttonClass = isActive
              ? "relative w-9 h-9 flex items-center justify-center text-[var(--primary)] font-black rounded-md hover:bg-[var(--text-main)]/5"
              : "relative w-9 h-9 flex items-center justify-center text-[var(--text-main)] opacity-60 hover:opacity-100 hover:scale-105 active:scale-95 rounded-md hover:bg-[var(--text-main)]/5";

            return (
              <div key={item.id} className="relative group flex items-center justify-center">
                <button
                  onClick={() => handleNav(item)}
                  className={`${buttonClass} font-mono transition-all select-none`}
                >
                  <Icon size={17} strokeWidth={isActive ? 2.5 : 1.75} />
                  
                  {isActive && item.id !== 'notifications' && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-[3px] bg-[var(--primary)] rounded-full" />
                  )}

                  {item.id === 'notifications' && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[var(--color-destructive)] text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-[var(--bg-window)] shadow-sm animate-pulse">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                {/* Yellow monospaced tooltip */}
                <div className="absolute left-10 top-1/2 -translate-y-1/2 ml-2 hidden group-hover:block bg-[#ffffe1] border border-black text-black text-[9px] font-mono font-bold px-2 py-0.5 shadow-[2px_2px_0_rgba(0,0,0,0.25)] whitespace-nowrap z-50">
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Section (The Control Pod + Avatar) */}
      <div className="flex flex-col items-center w-full gap-4 mt-auto relative">
        {/* Separator line */}
        <div className="w-8 h-[2px] bg-[var(--border)] opacity-30 my-1 shrink-0" />

        {/* Audio & Settings Buttons */}
        <div className="flex flex-col gap-2.5 w-full items-center">
          {/* Microphone Mute */}
          <div className="relative group flex items-center justify-center">
            <button
              onClick={() => {
                toggleMic();
                playAudio('click', sfxEnabled);
                toast({
                  message: !isMuted ? 'Microphone muted' : 'Microphone unmuted',
                  type: 'info'
                });
              }}
              className={`w-9 h-9 flex items-center justify-center rounded-md transition-all hover:scale-105 active:scale-95 ${
                isMuted 
                  ? 'text-[var(--color-destructive)] bg-[var(--color-destructive)]/10 border border-[var(--color-destructive)]/30' 
                  : 'text-[var(--text-main)] opacity-60 hover:opacity-100 hover:bg-[var(--text-main)]/5'
              }`}
            >
              {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <div className="absolute left-10 top-1/2 -translate-y-1/2 ml-2 hidden group-hover:block bg-[#ffffe1] border border-black text-black text-[9px] font-mono font-bold px-2 py-0.5 shadow-[2px_2px_0_rgba(0,0,0,0.25)] whitespace-nowrap z-50">
              {isMuted ? 'Unmute Mic' : 'Mute Mic'}
            </div>
          </div>

          {/* Headphones Deafen */}
          <div className="relative group flex items-center justify-center">
            <button
              onClick={() => {
                toggleDeafen();
                playAudio('click', sfxEnabled);
                toast({
                  message: !isDeafened ? 'Audio deafened' : 'Audio enabled',
                  type: 'info'
                });
              }}
              className={`w-9 h-9 flex items-center justify-center rounded-md transition-all hover:scale-105 active:scale-95 ${
                isDeafened 
                  ? 'text-[var(--color-destructive)] bg-[var(--color-destructive)]/10 border border-[var(--color-destructive)]/30' 
                  : 'text-[var(--text-main)] opacity-60 hover:opacity-100 hover:bg-[var(--text-main)]/5'
              }`}
            >
              <Headphones size={16} className={isDeafened ? 'stroke-[2.5]' : ''} />
            </button>
            <div className="absolute left-10 top-1/2 -translate-y-1/2 ml-2 hidden group-hover:block bg-[#ffffe1] border border-black text-black text-[9px] font-mono font-bold px-2 py-0.5 shadow-[2px_2px_0_rgba(0,0,0,0.25)] whitespace-nowrap z-50">
              {isDeafened ? 'Undeafen Audio' : 'Deafen Audio'}
            </div>
          </div>

          {/* Settings gear */}
          <div className="relative group flex items-center justify-center">
            <button
              onClick={() => {
                playAudio('click', sfxEnabled);
                if (onOpenSettings) onOpenSettings();
              }}
              className="w-9 h-9 flex items-center justify-center text-[var(--text-main)] opacity-60 hover:opacity-100 hover:scale-105 active:scale-95 rounded-md hover:bg-[var(--text-main)]/5 transition-all"
            >
              <SettingsIcon size={16} />
            </button>
            <div className="absolute left-10 top-1/2 -translate-y-1/2 ml-2 hidden group-hover:block bg-[#ffffe1] border border-black text-black text-[9px] font-mono font-bold px-2 py-0.5 shadow-[2px_2px_0_rgba(0,0,0,0.25)] whitespace-nowrap z-50">
              Settings
            </div>
          </div>
        </div>

        {/* Separator line */}
        <div className="w-8 h-[2px] bg-[var(--border)] opacity-30 my-1 shrink-0" />

        {/* User Avatar Anchor */}
        <div className="relative group flex items-center justify-center shrink-0">
          <button
            onClick={() => {
              playAudio('click', sfxEnabled);
              setShowStatusMenu(!showStatusMenu);
            }}
            className="relative w-9 h-9 flex items-center justify-center select-none transition-all hover:scale-105 active:scale-95"
          >
            {profile.pfp ? (
              <img 
                src={profile.pfp} 
                alt={profile.name || 'User Avatar'} 
                className="w-9 h-9 retro-border object-cover bg-white" 
              />
            ) : (
              <div className="w-9 h-9 retro-border retro-bg-accent flex items-center justify-center text-lg">
                {profile.emoji || '👤'}
              </div>
            )}
            <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 border-2 border-[var(--bg-window)] rounded-full ${statusColor}`} />
          </button>
          <div className="absolute left-10 top-1/2 -translate-y-1/2 ml-2 hidden group-hover:block bg-[#ffffe1] border border-black text-black text-[9px] font-mono font-bold px-2 py-0.5 shadow-[2px_2px_0_rgba(0,0,0,0.25)] whitespace-nowrap z-50">
            Status & Profile
          </div>
        </div>

        {/* Status Switcher Popover Menu */}
        {showStatusMenu && (
          <>
            <div 
              className="fixed inset-0 z-40 bg-transparent cursor-default" 
              onClick={() => setShowStatusMenu(false)} 
            />
            
            <div 
              className="absolute bottom-12 left-14 z-50 w-44 bg-[var(--bg-window)] retro-border-thick retro-shadow-dark p-2 select-none animate-in slide-in-from-bottom-2 duration-150"
            >
              <div className="text-[10px] font-black uppercase opacity-45 px-2 py-1 border-b border-dashed border-[var(--border)] mb-1.5 tracking-wider">
                select status
              </div>
              
              {/* Online */}
              <button
                onClick={() => handleSetStatus('active')}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-black/5 text-left rounded-none transition-colors"
              >
                <span className="w-2.5 h-2.5 bg-success shrink-0" />
                <span>Online</span>
                {userStatus === 'active' && <span className="ml-auto text-xs text-[var(--primary)] font-black">✓</span>}
              </button>
              
              {/* Idle */}
              <button
                onClick={() => handleSetStatus('idle')}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-black/5 text-left rounded-none transition-colors"
              >
                <span className="w-2.5 h-2.5 bg-warning shrink-0" />
                <span>Idle</span>
                {userStatus === 'idle' && <span className="ml-auto text-xs text-[var(--primary)] font-black">✓</span>}
              </button>
              
              {/* Do Not Disturb */}
              <button
                onClick={() => handleSetStatus('dnd')}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-black/5 text-left rounded-none transition-colors"
              >
                <span className="w-2.5 h-2.5 bg-[var(--color-destructive)] shrink-0" />
                <span>DND</span>
                {userStatus === 'dnd' && <span className="ml-auto text-xs text-[var(--primary)] font-black">✓</span>}
              </button>
              
              <div className="border-t border-dashed border-[var(--border)]/30 my-1.5" />

              {/* View Profile */}
              <button
                onClick={() => {
                  setShowStatusMenu(false);
                  window.dispatchEvent(new CustomEvent('open_user_profile', { detail: { userId } }));
                }}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-black/5 text-left rounded-none transition-colors text-[var(--primary)]"
              >
                <User size={12} className="shrink-0" />
                <span>View Profile...</span>
              </button>

              {/* Log Out */}
              <button
                onClick={() => {
                  setShowStatusMenu(false);
                  logout();
                }}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-black/5 text-left rounded-none transition-colors text-[var(--color-destructive)]"
              >
                <LogOut size={12} className="shrink-0" />
                <span>Log Out</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Notifications History Modal overlay */}
      {showNotifModal && (
        <NotificationHistoryModal 
          userId={userId} 
          onClose={() => setShowNotifModal(false)} 
          sfxEnabled={sfxEnabled} 
        />
      )}


    </div>
  );
}
