import { useState, useEffect, useRef } from 'react';
import { playAudio } from '../utils/audio.js';
import { sendNativeNotification } from '../utils/notifications.js';
import { useNotificationHistory } from './useNotificationHistory.js';

export function useAppLogic({
  user,
  userId,
  roomId,
  partnerId,
  partnerName,
  isInitialized,
  sfxEnabled,
  toast,
  broadcast,
  updateSyncStateAtomic,
  navigate,
  location,
  chatHistory,
  onlineUsers,
  notificationsEnabled,
  lobbyState,
  syncSendMessage
}) {
  const [floatingDoodles, setFloatingDoodles] = useState([]);
  const [doodleQueue, setDoodleQueue] = useState([]);
  const [gameInvite, setGameInvite] = useState(null);
  const [watchpartyInvite, setWatchpartyInvite] = useState(null);
  const [showKiss, setShowKiss] = useState(false);
  const [partnerOnlineModal, setPartnerOnlineModal] = useState(false);
  
  const { addNotification } = useNotificationHistory(userId);
  
  const processedInvites = useRef(new Set());
  const prevPartnerOnline = useRef(false);
  const prevChatLength = useRef(0);
  const isPartnerOnline = partnerId && onlineUsers[partnerId]?.status === 'active';

  // Activity Tracking
  useEffect(() => {
    if (!userId || !roomId || !isInitialized) return;
    
    const routeToActivity = {
      '/dashboard': 'At Home',
      '/chat': 'In Chat',
      '/doodle': 'Doodling',
      '/watch': 'Watching SyncWatcher',
      '/arcade/pictionary': 'Drawing...',
      '/arcade/tictactoe': 'Playing Tic-Tac-Toe',
      '/arcade/memory': 'Playing Memory Match',
      '/arcade/wordle': 'Playing Retro Word',
      '/arcade/sudoku': 'Playing Sudoku',
      '/arcade/chess': 'Thinking (Chess)',
      '/arcade/quiz': 'Playing Couples Quiz',
      '/arcade/2048': 'Playing 2048',
      '/arcade/typing': 'Playing Typing Race',
      '/arcade/wyr': 'Playing Would You Rather',
      '/arcade/uno': 'Playing Uno',
      '/arcade/othello': 'Playing Othello',
      '/arcade/pool': 'Playing Pool',
      '/arcade/bluff': 'Playing Cheat (Bluff)',
      '/arcade/twentyq': 'Playing 20 Questions',
      '/arcade/ludo': 'Playing Ludo',
      '/arcade': 'Browsing Games',
    };

    let activity = 'Exploring';
    for (const [route, act] of Object.entries(routeToActivity)) {
      if (location.pathname.startsWith(route)) {
        activity = act;
        break;
      }
    }

    updateSyncStateAtomic('room_profiles', userId, { activity });
  }, [location.pathname, userId, roomId, isInitialized, updateSyncStateAtomic]);

  // Partner Online Notification
  useEffect(() => {
    if (isPartnerOnline && prevPartnerOnline.current === false) {
      if (notificationsEnabled) {
        setPartnerOnlineModal(true);
        playAudio('notif', sfxEnabled);
        sendNativeNotification(`${partnerName || 'Partner'} is online!`, { body: 'They just opened Yard.' });
        addNotification(`${partnerName || 'Partner'} is online!`, 'info');
        setTimeout(() => setPartnerOnlineModal(false), 4000);
      }
      

    }
    prevPartnerOnline.current = isPartnerOnline;
  }, [isPartnerOnline, notificationsEnabled, sfxEnabled, partnerName, syncSendMessage]);

  // Game Invite Handling
  useEffect(() => {
    if (!Array.isArray(chatHistory) || !partnerId) return;
    const pendingInvites = chatHistory.filter(m => 
      (m.type === 'game_invite' || m.type === 'game_invite_modal') && 
      m.sender === partnerId
    );
    const latestInvite = pendingInvites[pendingInvites.length - 1];
    if (latestInvite) {
      const gId = latestInvite.metadata?.gameId || latestInvite.gameId;
      if (gId && location.pathname.includes(gId)) {
        processedInvites.current.add(latestInvite.id);
        return;
      }
      if (!processedInvites.current.has(latestInvite.id) && gameInvite?.id !== latestInvite.id) {
        processedInvites.current.add(latestInvite.id);
        setGameInvite({ ...latestInvite, gameId: gId, metadata: { ...(latestInvite.metadata || {}), gameId: gId } });
        if (notificationsEnabled) {
          playAudio('notif', sfxEnabled);
          sendNativeNotification(`${partnerName || 'Partner'} sent a game invite!`, { body: `Join them for ${gId}` });
        }
      }
    }
    
    // Auto-dismiss invite if we navigated to the game
    if (gameInvite && location.pathname.includes(gameInvite.gameId)) {
      setGameInvite(null);
    }
  }, [chatHistory, partnerId, sfxEnabled, gameInvite, notificationsEnabled, location.pathname]);

  useEffect(() => {
    if (lobbyState?.gameId) {
      const partnerInLobby = (lobbyState?.players || []).includes(partnerId);
      const isWaiting = lobbyState?.status === 'waiting';
      const userInLobby = (lobbyState?.players || []).includes(userId);

      if (partnerInLobby && isWaiting && !userInLobby && gameInvite?.id !== lobbyState.gameId) {
        if (!location.pathname.includes(lobbyState.gameId)) {
          setGameInvite({
            id: lobbyState.gameId,
            gameId: lobbyState.gameId,
            mode: lobbyState.config?.mode || '1v1_remote',
            metadata: { gameId: lobbyState.gameId }
          });
        }
      } else if (gameInvite?.gameId === lobbyState.gameId) {
        // If the lobby for the current invite is no longer waiting or partner left, nullify
        if (!partnerInLobby || !isWaiting || userInLobby) {
          setGameInvite(null);
        }
      }
    } else if (gameInvite && lobbyState && Object.keys(lobbyState).length === 0) {
       // if lobbyState is empty, clear invite
       setGameInvite(null);
    }
  }, [lobbyState, partnerId, userId, gameInvite, location.pathname]);

  // Chat Notifications
  useEffect(() => {
    if (!Array.isArray(chatHistory)) return;
    const newMsgs = chatHistory.slice(prevChatLength.current);
    newMsgs.forEach(msg => {
      if (prevChatLength.current > 0 && msg.sender === partnerId && location.pathname !== '/chat' && notificationsEnabled) {
        playAudio('notif', sfxEnabled);
        const msgText = msg.type === 'text' ? msg.text : `Sent a ${msg.type}`;
        toast(`💬 ${partnerName}: ${msgText}`, 'info');
        sendNativeNotification(`New message from ${partnerName || 'Partner'}`, { body: msgText });
        addNotification(`New message from ${partnerName}: ${msgText}`, 'info');
      }
    });
    prevChatLength.current = chatHistory.length;
  }, [chatHistory, location.pathname, partnerId, notificationsEnabled, sfxEnabled]);

  // Broadcast Listeners
  useEffect(() => {
    const handler = ({ detail: { event, payload } }) => {
      if (event === 'interaction' && payload.type === 'kiss' && payload.from === partnerId) {
        setShowKiss(true);
        toast(`💋 ${partnerName} sent you a kiss!`, 'success');
        playAudio('notif', sfxEnabled);
        addNotification(`${partnerName} sent you a kiss! 💋`, 'success');
        if (notificationsEnabled) sendNativeNotification(`${partnerName} sent you a kiss! 💋`);
        setTimeout(() => setShowKiss(false), 4500);
      }
      if (event === 'doodle_alert' && payload.sender !== userId) {
        setFloatingDoodles(prev => [...prev, { 
          id: payload.id || Date.now(), 
          data: payload.image, 
          sender: payload.sender,
          assetId: payload.id
        }]);
        toast(`🎨 ${partnerName} sent you a new doodle!`, 'info');
        playAudio('notif', sfxEnabled);
        addNotification(`${partnerName} sent you a doodle! 🎨`, 'info');
        if (notificationsEnabled) sendNativeNotification(`${partnerName} sent you a doodle! 🎨`);
      }
      if (payload.action === 'invite' && payload.sender !== userId) {
        const isRecent = !payload.timestamp || (Date.now() - payload.timestamp < 30000);
        if (isRecent && !location.pathname.includes(payload.gameId)) {
           setGameInvite(payload);
           toast(`🎮 ${partnerName} invited you to play!`, 'actionable');
           playAudio('notif', sfxEnabled);
           addNotification(`${partnerName} invited you to play a game! 🎮`, 'actionable');
           if (notificationsEnabled) sendNativeNotification(`${partnerName} invited you to play! 🎮`);
        }
      }
      if (event === 'lobby_closed' && payload.sender !== userId) {
        if (gameInvite) setGameInvite(null);
        toast(`⚠️ ${partnerName} closed the game lobby.`, 'warning');
      }
      if (event === 'watchparty_invite' && payload.sender !== userId) {
        setWatchpartyInvite(payload);
        const titleStr = payload.title ? ` to watch "${payload.title}"` : '';
        toast(`🍿 ${partnerName} invited you to watch${titleStr}!`, 'actionable');
        addNotification(`${partnerName} invited you to a watch party${titleStr}! 🍿`, 'actionable');
        if (notificationsEnabled) sendNativeNotification(`${partnerName} invited you to watch${titleStr}! 🍿`);
      }
      if (event === 'force_reset' && payload.sender !== userId) {
        toast(`🔄 ${partnerName} reset the room state. Synchronizing...`, 'warning');
        setTimeout(() => window.location.reload(), 1500);
      }
      if (event === 'chat_message' && payload.sender === partnerId) {
        if (location.pathname !== '/chat') {
          toast(`💬 New message from ${partnerName}`, 'info');
        }
      }
    };
    window.addEventListener('sync_broadcast', handler);
    return () => window.removeEventListener('sync_broadcast', handler);
  }, [partnerId, partnerName, sfxEnabled, location.pathname, toast, gameInvite, userId, notificationsEnabled]);

  // Handle specialized call signals
  useEffect(() => {
    const onDropped = (e) => {
      if (e.detail.reason === 'refreshed') {
        toast(`⚠️ ${partnerName} refreshed their tab. Call dropped.`, 'warning');
      }
    };
    window.addEventListener('call_dropped', onDropped);
    return () => window.removeEventListener('call_dropped', onDropped);
  }, [partnerName, toast]);

  const closeDoodle = () => setDoodleQueue(prev => prev.slice(1));

  const handleMarkSeen = (assetId) => {
    if (!assetId) return;
    const seen = JSON.parse(localStorage.getItem('seen_assets') || '[]');
    if (!seen.includes(assetId)) {
      localStorage.setItem('seen_assets', JSON.stringify([...seen, assetId]));
    }
  };

  const handleReadLater = (doodle) => {
    setFloatingDoodles(prev => prev.filter(item => item.id !== doodle.id));
    handleMarkSeen(doodle.assetId);
    toast('Doodle moved to album! 📁', 'success');
    playAudio('success', sfxEnabled);
  };

  return {
    floatingDoodles,
    setFloatingDoodles,
    doodleQueue,
    setDoodleQueue,
    closeDoodle,
    gameInvite,
    setGameInvite,
    watchpartyInvite,
    setWatchpartyInvite,
    showKiss,
    setShowKiss,
    partnerOnlineModal,
    handleReadLater,
    handleMarkSeen
  };
}
