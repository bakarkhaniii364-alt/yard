import { useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage'; // Assuming useLocalStorage exists

export function useNotificationHistory(userId) {
  const storageKey = userId ? `yard_notifications_${userId}` : 'yard_notifications_local';
  
  // Try to use a custom local storage hook, or fallback to standard useState + useEffect
  // Wait, the project has useLocalStorage. Let's use it properly.
  const [history, setHistory] = useLocalStorage(storageKey, []);
  
  // Unread tracking (reset when user opens modal)
  const unreadKey = userId ? `yard_notifications_unread_${userId}` : 'yard_notifications_unread_local';
  const [unreadCount, setUnreadCount] = useLocalStorage(unreadKey, 0);

  const lastReadKey = userId ? `yard_notifications_last_read_${userId}` : 'yard_notifications_last_read_local';
  const [lastReadAt, setLastReadAt] = useLocalStorage(lastReadKey, 0);

  const addNotification = useCallback((message, type = 'info', metadata = {}) => {
    setHistory(prev => {
      const newNotif = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        message,
        type,
        timestamp: Date.now(),
        ...metadata
      };
      
      // Keep only the last 50 notifications
      const updated = [newNotif, ...(prev || [])].slice(0, 50);
      return updated;
    });
    setUnreadCount(prev => (prev || 0) + 1);
  }, [setHistory, setUnreadCount]);

  const markAllRead = useCallback(() => {
    setUnreadCount(0);
    setLastReadAt(Date.now());
  }, [setUnreadCount, setLastReadAt]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setUnreadCount(0);
  }, [setHistory, setUnreadCount]);

  return {
    history: history || [],
    unreadCount: unreadCount || 0,
    lastReadAt: lastReadAt || 0,
    addNotification,
    markAllRead,
    clearHistory
  };
}
