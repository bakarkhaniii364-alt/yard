import { useState, useEffect, useCallback } from 'react';
import { useSync, useAuth } from '../context/instances.js';

/**
 * Returns a human-readable "last seen" string for any userId.
 * Updates every 30 seconds automatically.
 */
export function useLastSeen() {
  const { onlineUsers, globalState } = useSync();
  const { partnerId } = useAuth();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  const getLastSeen = useCallback((userId) => {
    const presence = onlineUsers[userId];
    const profile = globalState?.room_profiles?.[userId] || {};
    const lastActivity = profile.lastActivity;
    
    if (!presence) {
      // Offline logic
      const lastOnlineAt = profile.last_online_at || profile.updated_at;
      let label = 'Offline';
      if (lastOnlineAt) {
        const diffMs = Date.now() - new Date(lastOnlineAt).getTime();
        const diffMins = Math.floor(diffMs / 60_000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1)    label = 'Just now';
        else if (diffMins < 60)   label = `${diffMins}m ago`;
        else if (diffHours < 24)  label = `${diffHours}h ago`;
        else if (diffDays === 1)  label = 'Yesterday';
        else label = `${diffDays}d ago`;
      }

      return {
        status: 'offline',
        label: label === 'Offline' ? 'Offline' : `Last seen ${label}`,
        activity: null,
        lastActivity: lastActivity
      };
    }

    // Determine Activity Label (Discord Style)
    let activityLabel = null;
    if (presence.activity) {
      activityLabel = presence.activity;
    }

    return {
      status: presence.status || 'active',
      label: presence.status === 'active' ? 'Active Now' : (presence.status === 'dnd' ? 'Do Not Disturb' : 'Idle'),
      activity: activityLabel,
      lastActivity: lastActivity
    };
  }, [onlineUsers, globalState, tick]);

  const formatStatus = useCallback((userId) => {
    const data = getLastSeen(userId);
    if (data.status === 'active' || data.status === 'idle' || data.status === 'dnd') {
      if (data.activity) return data.activity;
      if (data.status === 'active') return 'Active Now';
      if (data.status === 'dnd') return 'Do Not Disturb';
      return 'Idle';
    }
    
    let base = data.label;
    if (data.lastActivity) {
      // Show what they were doing before they went offline
      const timeDiff = Date.now() - new Date(data.lastActivity.timestamp).getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      // Only show "Played X" if it was recent (last 24h)
      if (hoursDiff < 24) {
        base += ` (Played ${data.lastActivity.game})`;
      }
    }
    return base;
  }, [getLastSeen]);

  const partnerStatusData = getLastSeen(partnerId);
  const partnerStatusLabel = formatStatus(partnerId);
  const isPartnerOnline = partnerStatusData.status === 'active' || partnerStatusData.status === 'idle';

  return { getLastSeen, formatStatus, partnerStatusData, partnerStatusLabel, isPartnerOnline };
}
