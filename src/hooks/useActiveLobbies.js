import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

export function useActiveLobbies(roomId) {
  const [lobbies, setLobbies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) return;

    const fetchLobbies = async () => {
      const { data, error } = await supabase
        .from('arcade_sessions')
        .select('*')
        .eq('room_id', roomId)
        .eq('status', 'waiting');

      if (data) setLobbies(data);
      setLoading(false);
    };

    fetchLobbies();

    const channel = supabase
      .channel(`active_lobbies_${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'arcade_sessions',
        filter: `room_id=eq.${roomId}`
      }, () => {
        fetchLobbies();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  return { lobbies, loading };
}
