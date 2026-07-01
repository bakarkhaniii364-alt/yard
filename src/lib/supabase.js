import { createClient } from '@supabase/supabase-js';
import { isTestMode, onTestStateUpdate, sendTestStateUpdate } from './testMode.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  if (import.meta.env.PROD) {
    console.error(
      '[Yard] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and set your Supabase credentials.'
    );
  } else {
    console.warn(
      '[Yard] Supabase env vars missing — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (see .env.example).'
    );
  }
}

const realClient = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabaseKey || 'placeholder-anon-key',
  {
    auth: { 
      persistSession: true, 
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    realtime: { params: { eventsPerSecond: 10 } },
  }
);

// Simulated database memory for active lobbies in test mode
let mockSessions = [];
const realtimeCallbacks = [];

if (typeof window !== 'undefined' && isTestMode()) {
  onTestStateUpdate('arcade_sessions', (val) => {
    mockSessions = val || [];
    // Trigger all registered mock realtime channels to notify React hooks
    realtimeCallbacks.forEach(cb => cb(mockSessions));
  });
}

const createMockProxy = (target) => {
  return new Proxy(target, {
    get(obj, prop) {
      if (isTestMode()) {
        if (prop === 'auth') {
          return {
            getSession: async () => ({ data: { session: null }, error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
            signInWithPassword: async () => ({ data: { user: { id: 'mock' }, session: { access_token: 'mock' } }, error: null }),
            signUp: async () => ({ data: { user: { id: 'mock' }, session: { access_token: 'mock' } }, error: null }),
            signOut: async () => ({ error: null }),
            updateUser: async () => ({ data: { user: {} }, error: null }),
          };
        }
        if (prop === 'storage') {
          return {
            from: () => ({
              upload: async () => ({ data: { path: 'mock' }, error: null }),
              getPublicUrl: () => ({ data: { publicUrl: 'mock-url' } }),
              download: async () => ({ data: new Blob(), error: null }),
            }),
          };
        }
        if (prop === 'rpc') {
          return async (name, params) => {
            if (name === 'join_arcade_session') {
              const { p_room_id, p_game_id, p_user_id } = params;
              let session = mockSessions.find(s => s.room_id === p_room_id && s.game_id === p_game_id);
              if (!session) {
                session = {
                  id: `session-${p_game_id}-${p_room_id}`,
                  room_id: p_room_id,
                  game_id: p_game_id,
                  player_a_id: p_user_id,
                  player_b_id: null,
                  player_a_ready: false,
                  player_b_ready: false,
                  status: 'waiting',
                  game_state: {}
                };
                mockSessions.push(session);
              } else {
                if (!session.player_a_id) {
                  session.player_a_id = p_user_id;
                } else if (session.player_a_id !== p_user_id && !session.player_b_id) {
                  session.player_b_id = p_user_id;
                }
              }
              sendTestStateUpdate('arcade_sessions', mockSessions);
              return { data: session, error: null };
            }
            
            if (name === 'set_arcade_ready') {
              const { p_room_id, p_game_id, p_user_id, p_ready } = params;
              const session = mockSessions.find(s => s.room_id === p_room_id && s.game_id === p_game_id);
              if (session) {
                if (session.player_a_id === p_user_id) session.player_a_ready = p_ready;
                if (session.player_b_id === p_user_id) session.player_b_ready = p_ready;
                if (session.player_a_ready && (session.player_b_ready || !session.player_b_id)) {
                  session.status = 'starting';
                }
                sendTestStateUpdate('arcade_sessions', mockSessions);
              }
              return { data: session, error: null };
            }

            if (name === 'leave_arcade_session') {
              const { p_room_id, p_game_id, p_user_id } = params;
              const session = mockSessions.find(s => s.room_id === p_room_id && s.game_id === p_game_id);
              if (session) {
                if (session.player_a_id === p_user_id) {
                  session.player_a_id = null;
                  session.player_a_ready = false;
                }
                if (session.player_b_id === p_user_id) {
                  session.player_b_id = null;
                  session.player_b_ready = false;
                }
                if (!session.player_a_id && !session.player_b_id) {
                  mockSessions = mockSessions.filter(s => !(s.room_id === p_room_id && s.game_id === p_game_id));
                } else {
                  session.status = 'waiting';
                }
                sendTestStateUpdate('arcade_sessions', mockSessions);
              }
              return { data: null, error: null };
            }

            return { data: null, error: null };
          };
        }
        if (prop === 'channel') {
          return (channelName) => {
            let activeWrapper = null;
            const chain = () => ({
              on: (eventConfig, filterConfig, callback) => {
                if (eventConfig === 'postgres_changes' && filterConfig?.table === 'arcade_sessions') {
                  activeWrapper = (sessions) => {
                    const prefix = 'arcade_session_';
                    const activeLobbiesPrefix = 'active_lobbies_';
                    if (channelName.startsWith(prefix)) {
                      const content = channelName.substring(prefix.length);
                      const lastUnderscore = content.lastIndexOf('_');
                      if (lastUnderscore !== -1) {
                        const rId = content.substring(0, lastUnderscore);
                        const gId = content.substring(lastUnderscore + 1);
                        const session = sessions.find(s => s.room_id === rId && s.game_id === gId);
                        if (session) {
                          callback({
                            eventType: 'UPDATE',
                            new: session
                          });
                        }
                      }
                    } else if (channelName.startsWith(activeLobbiesPrefix)) {
                      const rId = channelName.substring(activeLobbiesPrefix.length);
                      callback({
                        eventType: 'UPDATE'
                      });
                    }
                  };
                  realtimeCallbacks.push(activeWrapper);
                }
                return chain();
              },
              subscribe: () => chain(),
              unsubscribe: () => {
                if (activeWrapper) {
                  const idx = realtimeCallbacks.indexOf(activeWrapper);
                  if (idx !== -1) realtimeCallbacks.splice(idx, 1);
                }
              }
            });
            return chain();
          };
        }
        if (prop === 'from') {
          return (tableName) => {
            if (tableName === 'arcade_sessions') {
              let filterRoomId = null;
              let filterGameId = null;
              const chain = () => ({
                select: () => chain(),
                update: (fields) => {
                  mockSessions.forEach(s => {
                    if ((!filterRoomId || s.room_id === filterRoomId) && (!filterGameId || s.game_id === filterGameId)) {
                      Object.assign(s, fields);
                    }
                  });
                  sendTestStateUpdate('arcade_sessions', mockSessions);
                  return chain();
                },
                eq: (col, val) => {
                  if (col === 'room_id') filterRoomId = val;
                  if (col === 'game_id') filterGameId = val;
                  return chain();
                },
                maybeSingle: () => {
                  return {
                    then(resolve) {
                      const session = mockSessions.find(s => 
                        (!filterRoomId || s.room_id === filterRoomId) && 
                        (!filterGameId || s.game_id === filterGameId)
                      ) || null;
                      resolve({ data: session, error: null });
                    }
                  };
                },
                then(resolve) {
                  const filtered = mockSessions.filter(s => 
                    (!filterRoomId || s.room_id === filterRoomId) && 
                    (!filterGameId || s.game_id === filterGameId)
                  );
                  resolve({ data: filtered, error: null });
                }
              });
              return chain();
            }

            let isSingle = false;
            let lastInsert = null;
            const chain = (inserted) => ({
              select: () => chain(inserted),
              insert: (data) => chain(data),
              update: (data) => chain(data),
              delete: () => chain(inserted),
              eq: () => chain(inserted),
              order: () => chain(inserted),
              limit: () => chain(inserted),
              lt: () => chain(inserted),
              match: () => chain(inserted),
              on: () => chain(inserted),
              in: () => chain(inserted),
              subscribe: () => chain(inserted),
              track: () => chain(inserted),
              unsubscribe: () => {},
              send: () => Promise.resolve({ error: null }),
              single: () => { isSingle = true; return chain(inserted); },
              maybeSingle: () => { isSingle = true; return chain(inserted); },
              then(resolve, reject) {
                const result = isSingle && inserted
                  ? { id: `mock-${Date.now()}`, created_at: new Date().toISOString(), ...inserted }
                  : (isSingle ? null : []);
                return Promise.resolve({ data: result, error: null }).then(resolve, reject);
              },
            });
            return chain(null);
          };
        }
      }
      const value = obj[prop];
      return typeof value === 'function' ? value.bind(obj) : value;
    },
  });
};

export const supabase = createMockProxy(realClient);
