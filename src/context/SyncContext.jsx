import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import localforage from 'localforage';
import { supabase } from '../lib/supabase.js';
import { useAuth } from './instances.js';
import { isTestMode, getTestUser, sendTestBroadcast, onTestBroadcast, sendTestStateUpdate, onTestStateUpdate } from '../lib/testMode.js';
import { SyncContext } from './instances.js';

export function SyncProvider({ children }) {
  const { roomId, userId } = useAuth();
  const [globalState, setGlobalState] = useState({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [currentActivity, setCurrentActivity] = useState(null);
  const channelsRef = useRef({});
  const pendingUpdateRef = useRef(null);
  const latestStateRef = useRef({});
  const isSubscribedRef = useRef(false); // true only after WebSocket SUBSCRIBED

  // Initialize Room Sync
  useEffect(() => {
    if (!roomId || !userId) {
      setIsInitialized(false);
      setGlobalState({});
      return;
    }

    let mounted = true;

    const initSync = async () => {
       if (isTestMode()) {
        const testUser = getTestUser();
        const isA = testUser.startsWith('userA');
        const [_, suffix] = testUser.split('_');
        let hex = '';
        if (suffix) {
            for (let i = 0; i < suffix.length; i++) {
                hex += suffix.charCodeAt(i).toString(16);
            }
        }
        hex = hex.padEnd(12, '0').substring(0, 12);
        
        const myUid = isA ? `00000000-0000-0000-000a-${hex}` : `00000000-0000-0000-000b-${hex}`;
        const partnerUid = isA ? `00000000-0000-0000-000b-${hex}` : `00000000-0000-0000-000a-${hex}`;

        setGlobalState(prev => ({
          ...prev,
          room_profiles: {
            [myUid]: { name: isA ? 'User A' : 'User B', emoji: isA ? '🍎' : '🍏', status: 'online' },
            [partnerUid]: { name: isA ? 'User B' : 'User A', emoji: isA ? '🍏' : '🍎', status: 'online' }
          },
          couple_data: { petName: 'Buddy', petHappy: 80, petSkin: '/assets/cat_1_9' },
          user_streaks: { [myUid]: { count: 5, best: 10 }, [partnerUid]: { count: 5, best: 10 } },
          game_scores: {},
          arcade_lobby: prev.arcade_lobby || { players: [], gameId: null, status: 'idle', config: null }
        }));
        setIsInitialized(true);
        return;
      }

      // Safety timeout: don't hang the app forever if Supabase is slow
      const timeout = setTimeout(() => {
        if (!isInitialized && mounted) {
           console.warn("[SYNC] Initialization timed out, proceeding with local state.");
           setIsInitialized(true);
        }
      }, 5000);

      // 1. Fetch initial state from DB
      try {
        const { data, error } = await supabase.from('app_state').select('state').eq('room_id', roomId).single();
        
        let initialState = {};
        if (data && data.state) {
          initialState = data.state;
        } else if (error && (error.code === 'PGRST116' || error.message?.includes('0 rows'))) {
          // Check localforage as a fallback if DB is empty
          try {
            const cached = await localforage.getItem('yard_global_state');
            if (cached) initialState = cached;
          } catch(e) {}
          await supabase.from('app_state').insert({ room_id: roomId, state: initialState });
        }

        if (mounted) {
          latestStateRef.current = initialState;
          setGlobalState(initialState);
          setIsInitialized(true);
        }
      } catch (e) {
        console.error("[SYNC] DB Init failed:", e);
        if (mounted) setIsInitialized(true);
      } finally {
        clearTimeout(timeout);
      }

      // 2. Setup Realtime Channel
      const channelId = `room_sync_${roomId}`;
      if (channelsRef.current[channelId]) supabase.removeChannel(channelsRef.current[channelId]);

      const channel = supabase.channel(channelId, {
        config: { presence: { key: userId } }
      })
        .on('broadcast', { event: 'state_update' }, ({ payload }) => {
          if (payload.key && payload.value !== undefined) {
            setGlobalState(prev => ({ ...prev, [payload.key]: payload.value }));
          }
        })
        .on('broadcast', { event: '*' }, ({ event, payload }) => {
          // Centralized event bus for non-state broadcasts (kisses, doodle alerts, etc.)
          if (event !== 'state_update') {
            console.log(`[SYNC] Broadcast Received: ${event}`, payload);
            window.dispatchEvent(new CustomEvent('sync_broadcast', { detail: { event, payload } }));
          }
        })
        .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'app_state', 
          filter: `room_id=eq.${roomId}` 
        }, (payload) => {
          if (payload.new && payload.new.state) {
            latestStateRef.current = payload.new.state;
            setGlobalState(payload.new.state);
          }
        })
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const onlineMap = {};
          Object.keys(state).forEach(id => {
            onlineMap[id] = state[id][0];
          });
          setOnlineUsers(onlineMap);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            isSubscribedRef.current = true;
            // Debounced Presence Update
            const trackPresence = async () => {
              const profile = latestStateRef.current?.room_profiles?.[userId] || {};
              const statusOverride = profile.userStatus || (document.hasFocus() ? 'active' : 'idle');
              await channel.track({
                online_at: new Date().toISOString(),
                status: statusOverride,
                activity: currentActivity
              });
            };
            trackPresence();
            const interval = setInterval(trackPresence, 15000);
            channelsRef.current[channelId + '_presence'] = interval;
          } else {
            isSubscribedRef.current = false;
          }
        });

      channelsRef.current[channelId] = channel;
    };

    initSync();
    
    let unsubs = [];
    if (isTestMode()) {
        unsubs.push(onTestBroadcast('*', (payload, event) => {
            window.dispatchEvent(new CustomEvent('sync_broadcast', { detail: { event, payload } }));
        }));
        unsubs.push(onTestStateUpdate('*', (value, key) => {
            console.log('[SyncContext] onTestStateUpdate received:', key, value);
            setGlobalState(prev => ({ ...prev, [key]: value }));
        }));
    }

    return () => {
      mounted = false;
      unsubs.forEach(u => u());
      Object.entries(channelsRef.current).forEach(([key, val]) => {
        if (key.endsWith('_presence')) clearInterval(val);
        else supabase.removeChannel(val);
      });
      channelsRef.current = {};
      isSubscribedRef.current = false;
    };
  }, [roomId, userId]);


  const updateSyncState = useCallback(async (key, value) => {
    if (!roomId || !isInitialized) return;

    setGlobalState(prev => {
      const resolved = typeof value === 'function' ? value(prev[key]) : value;
      const newState = { ...prev, [key]: resolved };
      latestStateRef.current = newState;
      
      // Instant Broadcast
      const channelId = `room_sync_${roomId}`;
      if (channelsRef.current[channelId]) {
        channelsRef.current[channelId].send({
          type: 'broadcast',
          event: 'state_update',
          payload: { key, value: resolved, senderId: userId }
        });
      }
      if (isTestMode()) sendTestStateUpdate(key, resolved);

      // Debounced DB Push
      if (pendingUpdateRef.current) clearTimeout(pendingUpdateRef.current);
      pendingUpdateRef.current = setTimeout(async () => {
        // ALWAYS use the latest ref state to avoid race conditions
        const finalState = latestStateRef.current;
        const { error } = await supabase.from('app_state').update({ state: finalState }).eq('room_id', roomId);
        if (error) console.error("[SYNC] DB Push Error:", error);
        
        // Cache full state locally once during the sync window
        localforage.setItem('yard_global_state', finalState).catch(() => {});
      }, 1000);

      // Cache small key locally immediately
      localforage.setItem(`sync_${key}`, resolved).catch(() => {});

      return newState;
    });
  }, [roomId, isInitialized, userId]);

  /**
   * Atomic update for nested subkeys (e.g., room_profiles -> user_id)
   * Prevents Last-Write-Wins race conditions.
   */
  const updateSyncStateAtomic = useCallback(async (key, subkey, value) => {
    if (!roomId || !isInitialized) return;

    // 1. Update local state immediately for responsiveness
    setGlobalState(prev => {
      const currentKeyData = prev[key] || {};
      const currentSubkeyData = currentKeyData[subkey] || {};
      const newSubkeyData = typeof value === 'object' ? { ...currentSubkeyData, ...value } : value;
      const newKeyData = { ...currentKeyData, [subkey]: newSubkeyData };
      const newState = { ...prev, [key]: newKeyData };
      latestStateRef.current = newState;

      if (isTestMode()) sendTestStateUpdate(key, newKeyData);

      // 2. Broadcast the sub-update immediately
      const channelId = `room_sync_${roomId}`;
      if (channelsRef.current[channelId]) {
        channelsRef.current[channelId].send({
          type: 'broadcast',
          event: 'state_update',
          payload: { key, value: newKeyData, senderId: userId }
        });
      }

      // 3. Push to DB atomically via RPC
      supabase.rpc('update_app_state_atomic', {
        p_room_id: roomId,
        p_key: key,
        p_subkey: subkey,
        p_value: typeof value === 'object' ? value : JSON.stringify(value)
      }).then(({ error }) => {
        if (error) {
          console.error(`[SYNC] Atomic update failed for ${key}.${subkey}:`, error);
          setSyncError(error);
        } else {
          setSyncError(null);
        }
      }).catch((err) => {
        console.error(`[SYNC] Atomic update exception for ${key}.${subkey}:`, err);
        setSyncError(err);
      });

      return newState;
    });
  }, [roomId, isInitialized, userId]);

  /**
   * Atomic merge for top-level keys (e.g., couple_data)
   */
  const mergeSyncState = useCallback(async (key, value) => {
    if (!roomId || !isInitialized) return;

    setGlobalState(prev => {
      const currentData = prev[key] || {};
      const newData = { ...currentData, ...value };
      const newState = { ...prev, [key]: newData };
      latestStateRef.current = newState;

      // Broadcast
      const channelId = `room_sync_${roomId}`;
      if (channelsRef.current[channelId]) {
        channelsRef.current[channelId].send({
          type: 'broadcast',
          event: 'state_update',
          payload: { key, value: newData, senderId: userId }
        });
      }

      // Push to DB via RPC
      supabase.rpc('merge_app_state', {
        p_room_id: roomId,
        p_key: key,
        p_value: value
      }).then(({ error }) => {
        if (error) {
          console.error(`[SYNC] Merge failed for ${key}:`, error);
          setSyncError(error);
        } else {
          setSyncError(null);
        }
      }).catch((err) => {
        console.error(`[SYNC] Merge exception for ${key}:`, err);
        setSyncError(err);
      });

      return newState;
    });
  }, [roomId, isInitialized, userId]);

  const broadcast = useCallback((eventName, payload) => {
    const channelId = `room_sync_${roomId}`;
    if (channelsRef.current[channelId]) {
      channelsRef.current[channelId].send({
        type: 'broadcast',
        event: eventName,
        payload
      });
    }
    if (isTestMode()) sendTestBroadcast(eventName, payload);
  }, [roomId]);

  const userStatusOverride = globalState?.room_profiles?.[userId]?.userStatus;

  // Trigger presence update when activity or status override changes
  useEffect(() => {
    if (!isSubscribedRef.current) return;
    
    const channelId = `room_sync_${roomId}`;
    const channel = channelsRef.current[channelId];
    if (channel) {
      const statusOverride = userStatusOverride || (document.hasFocus() ? 'active' : 'idle');
      channel.track({
        online_at: new Date().toISOString(),
        status: statusOverride,
        activity: currentActivity
      });
    }
  }, [currentActivity, roomId, userStatusOverride]);

  // Heartbeat to persist last_online_at in DB
  useEffect(() => {
    if (!roomId || !userId || !isInitialized) return;
    
    const interval = setInterval(() => {
      updateSyncStateAtomic('room_profiles', userId, {
        last_online_at: new Date().toISOString()
      });
    }, 60000); // Every minute
    
    return () => clearInterval(interval);
  }, [roomId, userId, isInitialized, updateSyncStateAtomic]);

  const value = useMemo(() => ({
    globalState,
    isInitialized,
    onlineUsers,
    currentActivity,
    setCurrentActivity,
    updateSyncState,
    updateSyncStateAtomic,
    mergeSyncState,
    broadcast,
    syncError,
    roomProfiles: globalState.room_profiles || {}
  }), [
    globalState,
    isInitialized,
    onlineUsers,
    currentActivity,
    setCurrentActivity,
    updateSyncState,
    updateSyncStateAtomic,
    mergeSyncState,
    broadcast,
    syncError
  ]);

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

