import React, { useState } from 'react';
import { RetroWindow, RetroButton } from '../UI.jsx';
import { CheckCheck, Clock, Bell } from 'lucide-react';
import { useNotificationHistory } from '../../hooks/useNotificationHistory.js';

function formatDistanceToNow(dateInput) {
  const diffInSeconds = Math.round((new Date(dateInput).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const absDiff = Math.abs(diffInSeconds);
  if (absDiff < 60) return rtf.format(Math.round(diffInSeconds), 'second');
  if (absDiff < 3600) return rtf.format(Math.round(diffInSeconds / 60), 'minute');
  if (absDiff < 86400) return rtf.format(Math.round(diffInSeconds / 3600), 'hour');
  return rtf.format(Math.round(diffInSeconds / 86400), 'day');
}

export function NotificationHistoryModal({ userId, onClose, sfxEnabled }) {
  const { history, markAllRead, lastReadAt, unreadCount } = useNotificationHistory(userId);
  const [filter, setFilter] = useState('all');

  const filteredHistory = history.filter(notif => {
    if (filter === 'unread') return notif.timestamp > lastReadAt;
    return true;
  });
  return (
    <div className="modal-backdrop fixed inset-0 z-[var(--z-modal)] flex items-center justify-center">
      <RetroWindow
        title="notifications.log"
        onClose={onClose}
        sfx={sfxEnabled}
        className="universal-modal"
        noPadding
      >
        <div className="flex flex-col h-full bg-main/5">
            <div className="p-4 border-b border-dashed border-border bg-window/50 flex justify-between items-center shrink-0 gap-4">
              <div className="flex items-center gap-2 bg-black/5 p-1 retro-border">
                <button 
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1 font-bold uppercase tracking-widest text-[10px] transition-colors ${filter === 'all' ? 'bg-primary text-white retro-shadow-dark' : 'hover:bg-black/10'}`}
                >
                  All
                </button>
                <button 
                  onClick={() => setFilter('unread')}
                  className={`px-3 py-1 font-bold uppercase tracking-widest text-[10px] transition-colors flex items-center gap-2 ${filter === 'unread' ? 'bg-primary text-white retro-shadow-dark' : 'hover:bg-black/10'}`}
                >
                  Unread
                  {unreadCount > 0 && filter !== 'unread' && (
                    <span className="bg-[var(--color-destructive)] text-white w-3 h-3 rounded-none flex items-center justify-center text-[7px] font-black">{unreadCount}</span>
                  )}
                </button>
              </div>
              <RetroButton 
                variant="white" 
                size="sm"
                onClick={markAllRead} 
                disabled={unreadCount === 0}
                className="text-[10px] flex items-center gap-1.5"
              >
                <CheckCheck size={12} /> Mark all as read
              </RetroButton>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-[200px]">
              {filteredHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full opacity-50 text-center gap-2">
                  <Bell size={32} className="opacity-20" />
                  <p className="font-bold text-xs">No recent notifications</p>
                </div>
              ) : (
                filteredHistory.map(notif => {
                  const isNew = notif.timestamp > lastReadAt;
                  return (
                    <div key={notif.id} className={`p-4 retro-border bg-window hover:bg-accent/5 transition-colors flex flex-col gap-1 ${isNew ? '' : 'opacity-60 grayscale-[0.3]'}`}>
                      <div className="flex justify-between items-start gap-3">
                        <span className={`text-base leading-tight text-main-text break-words pr-2 ${isNew ? 'font-black' : 'font-bold'}`}>
                          {isNew && <span className="inline-block w-2 h-2 rounded-none bg-[var(--color-destructive)] mr-2 animate-pulse" />}
                          {notif.message}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 shrink-0 flex items-center gap-1 mt-1">
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
    </div>
  );
}
