import { useState, useEffect, useCallback, useRef } from 'react';
import { useSync, useAuth } from '../context/instances.js';
import { isTestMode, onTestStateUpdate, sendTestStateRequest } from '../lib/testMode.js';

/**
 * useGlobalSync
 * Optimized wrapper around SyncContext for individual key synchronization.
 * Migration Note: Previously this had its own Supabase channel; now it uses the centralized SyncContext.
 */
export function useGlobalSync(key, initialValue) {
  const { globalState, updateSyncState, isInitialized } = useSync();
  const { userId } = useAuth();
  
  // localState allows for immediate UI updates before the context cycle completes
  const [localState, setLocalState] = useState(() => {
    if (isTestMode()) {
      const cached = localStorage.getItem(`yard_test_${key}`);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch(e) {}
      }
    }
    if (globalState && globalState[key] !== undefined) return globalState[key];
    return initialValue;
  });

  const [loading, setLoading] = useState(!isInitialized);
  const localStateRef = useRef(localState);

  // Sync localState with globalState
  useEffect(() => {
    if (globalState && globalState[key] !== undefined) {
      if (JSON.stringify(globalState[key]) !== JSON.stringify(localStateRef.current)) {
        localStateRef.current = globalState[key];
        setLocalState(globalState[key]);
      }
      setLoading(false);
    } else if (isInitialized) {
      setLoading(false);
    }
  }, [globalState, key, isInitialized]);

  const updateState = useCallback(async (value) => {
    const valueToStore = value instanceof Function ? value(localStateRef.current) : value;
    
    // Optimistic local update
    if (JSON.stringify(localStateRef.current) !== JSON.stringify(valueToStore)) {
      localStateRef.current = valueToStore;
      setLocalState(valueToStore);
      if (isTestMode()) {
        localStorage.setItem(`yard_test_${key}`, JSON.stringify(valueToStore));
      }
      updateSyncState(key, valueToStore);
    }
  }, [key, updateSyncState]);

  // Test Mode Support
  useEffect(() => {
    if (isTestMode()) {
        sendTestStateRequest(key);
        const un1 = onTestStateUpdate(key, (val) => {
            localStateRef.current = val;
            setLocalState(val);
        });
        return () => {
          un1();
        };
    }
  }, [key]);

  return [localState, updateState, loading];
}

/**
 * useBroadcast
 * Wrapper around SyncContext broadcast mechanism.
 */
export function useBroadcast(eventName, callback) {
  const { broadcast } = useSync();
  
  const callbackRef = useRef(callback);
  useEffect(() => { callbackRef.current = callback; }, [callback]);

  useEffect(() => {
    const handler = (e) => {
      const { event, payload } = e.detail;
      if (event === eventName && callbackRef.current) {
        callbackRef.current(payload);
      }
    };
    window.addEventListener('sync_broadcast', handler);
    return () => window.removeEventListener('sync_broadcast', handler);
  }, [eventName]);

  const sendBroadcast = useCallback((payload) => {
    broadcast(eventName, payload);
  }, [eventName, broadcast]);

  return sendBroadcast;
}

// Deprecated, but kept for compatibility with any legacy imports
export const initializeRoomSync = async (roomId) => {
  console.warn('initializeRoomSync is deprecated. SyncProvider handles initialization.');
};
