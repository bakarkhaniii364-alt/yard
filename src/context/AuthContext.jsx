import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { isTestMode, getTestUser, getTestRoomId } from '../lib/testMode.js';
import { AuthContext } from './instances.js';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [partnerId, setPartnerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roomLoading, setRoomLoading] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);

  const mountedRef = useRef(true);
  const userIdRef = useRef(null);
  const roomIdRef = useRef(null);
  const partnerIdRef = useRef(null);

  // Keep refs synced with React state to avoid stale closures in listeners
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    partnerIdRef.current = partnerId;
  }, [partnerId]);

  const fetchRoomData = useCallback(async (uid, showLoading = true) => {
    if (!uid) {
      if (mountedRef.current) {
        setRoomId(null);
        roomIdRef.current = null;
        setPartnerId(null);
        partnerIdRef.current = null;
        setRoomLoading(false);
        setHasInitialized(true);
      }
      return;
    }
    // Only set roomLoading to true if showLoading is explicitly requested
    if (mountedRef.current && showLoading) {
      setRoomLoading(true);
    }
    try {
      // Race condition fix: ensure session exists before RPC
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return; 

      const { data: room, error } = await supabase.rpc('get_my_room');
      if (error) throw error;

      if (mountedRef.current) {
        if (room) {
          setRoomId(room.id);
          roomIdRef.current = room.id;
          const pId = room.creator_id === uid ? room.partner_id : room.creator_id;
          setPartnerId(pId);
          partnerIdRef.current = pId;
        } else {
          setRoomId(null);
          roomIdRef.current = null;
          setPartnerId(null);
          partnerIdRef.current = null;
        }
      }
    } catch (err) {
      console.warn('[AUTH] Room fetch failed:', err.message);
    } finally {
      if (mountedRef.current) {
        setRoomLoading(false);
        setHasInitialized(true);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    
    const init = async () => {
      if (isTestMode()) {
        const testUser = getTestUser();
        const [base, suffix] = testUser.split('_');
        let hex = '';
        if (suffix) {
            for (let i = 0; i < suffix.length; i++) {
                hex += suffix.charCodeAt(i).toString(16);
            }
        }
        hex = hex.padEnd(12, '0').substring(0, 12);
        const isA = testUser.startsWith('userA');
        const myUid = isA ? `00000000-0000-0000-000a-${hex}` : `00000000-0000-0000-000b-${hex}`;
        const partnerUid = isA ? `00000000-0000-0000-000b-${hex}` : `00000000-0000-0000-000a-${hex}`;

        setUser({ id: myUid, email: `${testUser}@test.com`, user_metadata: { name: testUser } });
        setUserId(myUid);
        userIdRef.current = myUid;
        setRoomId(getTestRoomId());
        roomIdRef.current = getTestRoomId();
        setPartnerId(partnerUid);
        partnerIdRef.current = partnerUid;
        setLoading(false);
        setRoomLoading(false);
        setHasInitialized(true);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (mountedRef.current) {
        if (session) {
          setUser(session.user);
          setUserId(session.user.id);
          userIdRef.current = session.user.id;
          fetchRoomData(session.user.id, true);
        } else {
          setRoomLoading(false);
          setHasInitialized(true);
        }
        setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mountedRef.current) return;
      
      if (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED') {
        if (session) {
          const currentUserId = userIdRef.current;
          const currentRoomId = roomIdRef.current;
          const currentPartnerId = partnerIdRef.current;

          setUser(session.user);
          setUserId(session.user.id);
          userIdRef.current = session.user.id;
          
          const isSameUser = currentUserId === session.user.id;
          if (!isSameUser) {
            fetchRoomData(session.user.id, true);
          } else {
            const hasRoomDetails = !!(currentRoomId && currentPartnerId);
            fetchRoomData(session.user.id, !hasRoomDetails);
          }
        }
      }
      
      if (_event === 'SIGNED_OUT') {
        setUser(null);
        setUserId(null);
        userIdRef.current = null;
        setRoomId(null);
        roomIdRef.current = null;
        setPartnerId(null);
        partnerIdRef.current = null;
        setRoomLoading(false);
        setHasInitialized(true);
        setLoading(false);
        window.location.href = '/signin';
        return;
      }
      
      setLoading(false);
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [fetchRoomData]);

  const handleAuthSuccess = async (session) => {
    if (session) {
      setUser(session.user);
      setUserId(session.user.id);
      await fetchRoomData(session.user.id);
    }
  };

  const handlePaired = async (newRoomId, newPartnerId) => {
    if (newRoomId && newPartnerId) {
      setRoomId(newRoomId);
      setPartnerId(newPartnerId);
    } else {
      await fetchRoomData(userId);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserId(null);
    setRoomId(null);
    setPartnerId(null);
    setHasInitialized(false);
    
    // Save E2EE pins before clearing
    const e2eePins = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('e2ee_pin_')) {
        e2eePins[key] = localStorage.getItem(key);
      }
    }
    
    localStorage.clear();
    
    // Restore E2EE pins
    for (const [key, value] of Object.entries(e2eePins)) {
      localStorage.setItem(key, value);
    }
    
    window.location.href = '/';
  };

  const value = useMemo(() => ({
    user,
    userId,
    roomId,
    partnerId,
    loading,
    roomLoading,
    hasInitialized,
    logout,
    handleAuthSuccess,
    handlePaired,
    fetchRoomData
  }), [user, userId, roomId, partnerId, loading, roomLoading, hasInitialized, fetchRoomData]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
