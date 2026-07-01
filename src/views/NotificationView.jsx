import React, { useState, useEffect } from 'react';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { CheckCheck, Clock, Bell } from 'lucide-react';
import { useNotificationHistory } from '../hooks/useNotificationHistory.js';
import { useAuth } from '../context/instances.js';

function formatDistanceToNow(dateInput) {
  const diffInSeconds = Math.round((new Date(dateInput).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const absDiff = Math.abs(diffInSeconds);
  if (absDiff < 60) return rtf.format(Math.round(diffInSeconds), 'second');
  if (absDiff < 3600) return rtf.format(Math.round(diffInSeconds / 60), 'minute');
  if (absDiff < 86400) return rtf.format(Math.round(diffInSeconds / 3600), 'hour');
  return rtf.format(Math.round(diffInSeconds / 86400), 'day');
}

import { useMobile } from '../hooks/useMobile.js';

export function NotificationView({ onClose, sfxEnabled }) {
  const { userId } = useAuth();
  const isMobile = useMobile();
  const { history, markAllRead, clearHistory, lastReadAt, unreadCount } = useNotificationHistory(userId);
  const [filter, setFilter] = useState('all');

  const filteredHistory = history.filter(notif => {
    if (filter === 'unread') return notif.timestamp > lastReadAt;
    return true;
  });

  return (
    <>
      <RetroWindow
        title="notifications_feed.exe"
        onClose={onClose}
        sfx={sfxEnabled}
        className={`w-full ${isMobile ? 'h-[100dvh] pb-[env(safe-area-inset-bottom)] max-h-none border-none shadow-none' : 'max-w-4xl h-[calc(100dvh-4rem)] max-h-[800px]'} flex flex-col transition-all duration-300 relative`}
        noPadding
      >
        <div className="flex flex-col h-full bg-[var(--bg-main)]">
          {/* Header */}
          <div className="p-4 sm:p-6 border-b-2 border-dashed border-border bg-window flex flex-col sm:flex-row justify-between items-start sm:items-center shrink-0 gap-4">
            <div className="flex items-center gap-2 bg-black/5 p-1 retro-border">
              <button 
                onClick={() => setFilter('all')}
                className={`px-4 py-1.5 font-bold uppercase tracking-widest text-xs transition-colors ${filter === 'all' ? 'bg-primary text-white retro-shadow-dark' : 'hover:bg-black/10'}`}
              >
                All
              </button>
              <button 
                onClick={() => setFilter('unread')}
                className={`px-4 py-1.5 font-bold uppercase tracking-widest text-xs transition-colors flex items-center gap-2 ${filter === 'unread' ? 'bg-primary text-white retro-shadow-dark' : 'hover:bg-black/10'}`}
              >
                Unread
                {unreadCount > 0 && filter !== 'unread' && (
                  <span className="bg-[var(--color-destructive)] text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black">{unreadCount}</span>
                )}
              </button>
            </div>
            <RetroButton 
              variant="white" 
              onClick={markAllRead} 
              disabled={unreadCount === 0}
              className="text-xs flex items-center gap-2 self-end sm:self-auto"
            >
              <CheckCheck size={14} /> <span className="hidden sm:inline">Mark all as read</span>
            </RetroButton>
          </div>
          
          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-4">
            {filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full opacity-50 text-center gap-3">
                <Bell size={48} className="opacity-20" />
                <p className="font-bold text-sm uppercase tracking-widest">No recent notifications</p>
              </div>
            ) : (
              filteredHistory.map(notif => {
                const isNew = notif.timestamp > lastReadAt;
                return (
                  <div key={notif.id} className={`p-4 sm:p-5 retro-border bg-window hover:bg-accent/5 transition-colors flex flex-col gap-2 ${isNew ? 'retro-shadow-dark translate-y-[-2px]' : 'opacity-70 grayscale-[0.5] shadow-none'}`}>
                    <div className="flex justify-between items-start gap-4">
                      <span className={`text-base sm:text-lg leading-tight text-main-text break-words pr-2 ${isNew ? 'font-black' : 'font-bold'}`}>
                        {isNew && <span className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--color-destructive)] mr-2.5 animate-pulse border border-white" />}
                        {notif.message}
                      </span>
                      <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest opacity-60 shrink-0 flex items-center gap-1.5 mt-1 bg-black/5 px-2 py-1 retro-border">
                        <Clock size={12} /> 
                        {formatDistanceToNow(notif.timestamp)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </RetroWindow>
    </>
  );
}
