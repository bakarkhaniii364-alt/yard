import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';

/** Normalize RPC/realtime payloads into an arcade_sessions row. */
function normalizeArcadeSession(data) {
  if (!data) return null;
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (data.room_id && data.game_id) return data;
  return null;
}

export function useArcadeSession(roomId, gameId, userId) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch initial session
  useEffect(() => {
    if (!roomId || !gameId) return;

    const fetchSession = async () => {
      const { data, error } = await supabase
        .from('arcade_sessions')
        .select('*')
        .eq('room_id', roomId)
        .eq('game_id', gameId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.warn('[LOBBY] Session fetch:', error.message);
      }
      if (data) {
        setSession(data);
      }
      setLoading(false);
    };

    fetchSession();

    // Subscribe to changes
    const channel = supabase
      .channel(`arcade_session_${roomId}_${gameId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'arcade_sessions',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setSession(null);
          return;
        }
        const row = payload.new;
        if (row && row.game_id === gameId) {
          setSession(row);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, gameId]);

  const joinSession = useCallback(async () => {
    const { data, error } = await supabase.rpc('join_arcade_session', {
      p_room_id: roomId,
      p_game_id: gameId,
      p_user_id: userId
    });
    if (error) throw error;
    const row = normalizeArcadeSession(data);
    if (row) setSession(row);
    return row ?? data;
  }, [roomId, gameId, userId]);

  const setReady = useCallback(async (ready, partnerOnline = true) => {
    const { data, error } = await supabase.rpc('set_arcade_ready', {
      p_room_id: roomId,
      p_game_id: gameId,
      p_user_id: userId,
      p_ready: ready,
      p_partner_online: partnerOnline
    });
    if (error) throw error;
    const row = normalizeArcadeSession(data);
    if (row) setSession(row);
    return row ?? data;
  }, [roomId, gameId, userId]);

  const updateGameState = useCallback(async (newState) => {
    // Update local state immediately for zero-latency UI
    setSession(prev => prev ? { ...prev, game_state: newState, updated_at: new Date().toISOString() } : null);
    
    const { error } = await supabase
      .from('arcade_sessions')
      .update({ game_state: newState, updated_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('game_id', gameId);
    if (error) throw error;
  }, [roomId, gameId]);

  const leaveSession = useCallback(async () => {
    const { error } = await supabase.rpc('leave_arcade_session', {
      p_room_id: roomId,
      p_game_id: gameId,
      p_user_id: userId
    });
    if (error) console.error("[LOBBY] Leave failed:", error);
  }, [roomId, gameId, userId]);

  const resetSession = useCallback(async () => {
    const { error } = await supabase
      .from('arcade_sessions')
      .update({ 
        status: 'idle', 
        player_a_ready: false, 
        player_b_ready: false, 
        game_state: null,
        updated_at: new Date().toISOString() 
      })
      .eq('room_id', roomId)
      .eq('game_id', gameId);
    if (error) console.error("[LOBBY] Reset failed:", error);
  }, [roomId, gameId]);

  return { session, loading, joinSession, setReady, updateGameState, leaveSession, resetSession };
}
