import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Gamepad2, ArrowLeft, Users, Loader, Settings, Play, Swords, User, Monitor, Zap, Heart, Brush, X, Activity } from 'lucide-react';
import { RetroButton, RetroWindow, ScoreboardCountdown, ConfirmDialog } from '../components/UI.jsx';
import { useGlobalSync } from '../hooks/useSupabaseSync.js';
import { useArcadeSession } from '../hooks/useArcadeSession.js';
import { playAudio } from '../utils/audio.js';
import { supabase } from '../lib/supabase.js';
import { useActiveLobbies } from '../hooks/useActiveLobbies.js';
import { useSync } from '../context/instances.js';
import { useMobile } from '../hooks/useMobile.js';

// Games
import { TicTacToe } from './TicTacToeGame.jsx';
import { PictionaryGame } from './PictionaryGame.jsx';
import { MemoryGame } from './MemoryGame.jsx';
import { WordleClone } from './WordleClone.jsx';
import { Sudoku } from './SudokuGame.jsx';
import { ChessEngine } from './ChessEngine.jsx';
import { YardQuiz } from './YardQuiz.jsx';
import { Game2048 } from './Game2048.jsx';
import { TypingRace } from './TypingRace.jsx';
import { WouldYouRather } from './WouldYouRather.jsx';
import { UnoGame } from './UnoGame.jsx';
import { OthelloGame } from './OthelloGame.jsx';
import { PoolGame } from './PoolGame.jsx';
import { BluffGame } from './BluffGame.jsx';
import { TwentyQuestions } from './TwentyQuestions.jsx';
import { LudoGame } from './LudoGame.jsx';
const GAME_CATALOG = {
  pictionary: { title: 'Pictionary', desc: 'Draw and guess the hidden word.', color: 'var(--game-peach)', modes: [
    { id: 'coop_remote', label: 'Play with Partner', type: 'remote', desc: 'One draws, the other guesses in real-time.', diffs: ['easy', 'hard'], options: [{key: 'genre', label: 'Word Genre', choices: ['General', 'Animals', 'Movies', 'Food']}, {key: 'rounds', label: 'Rounds', choices: [1, 2, 3, 5]}] }
  ]},
  tictactoe: { title: 'Tic-Tac-Toe', desc: 'Classic grid match.', color: 'var(--game-red)', modes: [
    { id: 'vs_ai', label: 'Play vs AI', type: 'local', diffs: ['easy', 'medium', 'hard'], options: [{key: 'size', label: 'Grid Size', choices: [3, 4, 5]}, {key: 'matchType', label: 'Best Of', choices: [1, 3, 5]}], desc: 'Play locally against the computer.' },
    { id: '1v1_remote', label: 'Vs Partner (Online)', type: 'remote', options: [{key: 'size', label: 'Grid Size', choices: [3, 4, 5]}, {key: 'matchType', label: 'Best Of', choices: [1, 3, 5]}], desc: 'Challenge your partner remotely.' }
  ]},
  memory: { title: 'Memory Match', desc: 'Flip cards and find pairs.', color: 'var(--game-blue)', modes: [
    { id: 'solo', label: 'Solo Practice', type: 'local', diffs: ['easy', 'medium', 'hard'], desc: 'Find all pairs as fast as you can.' },
    { id: 'coop_remote', label: 'Co-op (Online)', type: 'remote', diffs: ['easy', 'medium', 'hard'], desc: 'Work together to clear the board.' },
    { id: 'competitive', label: 'Versus (Online)', type: 'remote', diffs: ['easy', 'medium', 'hard'], desc: 'Compete to find the most pairs.' }
  ]},
  wordle: { title: 'Retro Word', desc: 'Guess the hidden word.', color: 'var(--game-yellow)', modes: [
    { id: 'solo', label: 'Solo', type: 'local', diffs: ['easy', 'medium', 'hard'], desc: 'Guess the daily word alone.' },
    { id: 'coop_remote', label: 'Co-op (Online)', type: 'remote', diffs: ['easy', 'medium', 'hard'], desc: 'Solve the same word together.' },
    { id: 'competitive', label: 'Mastermind (Online)', type: 'remote', diffs: ['easy', 'medium', 'hard'], desc: 'Set a secret word for your opponent to guess.' }
  ]},
  sudoku: { title: 'Sudoku', desc: 'Logic puzzles.', color: 'var(--game-peach)', modes: [
    { id: 'solo', label: 'Solo', type: 'local', diffs: ['easy', 'medium', 'hard'], desc: 'Classic Sudoku experience.' },
    { id: 'parallel_remote', label: 'Parallel Play (Online)', type: 'remote', diffs: ['easy', 'medium', 'hard'], desc: 'Race your friend on the same puzzle.' }
  ]},
  chess: { title: 'Chess', desc: 'Standard or Sandbox.', color: 'var(--game-sky)', modes: [
    { id: 'vs_ai', label: 'Play vs AI', type: 'local', desc: 'Play against the chess engine.' },
    { id: '1v1_remote', label: 'Vs Friend (Online)', type: 'remote', desc: 'Online 1v1 match.' }
  ]},
  quiz: { title: 'Yard Quiz', desc: 'How well do you know your friends?', color: 'var(--game-yellow)', modes: [
    { id: 'coop_remote', label: 'Play with Friend', type: 'remote', desc: 'Answer questions about each other.' }
  ]},
  '2048': { title: '2048', desc: 'Merge tiles. Reach 2048!', color: 'var(--game-purple)', modes: [
    { id: 'solo', label: 'Solo', type: 'local', desc: 'Standard 2048 game.' },
    { id: 'parallel_remote', label: 'Parallel Play (Online)', type: 'remote', desc: 'Hang out in a lobby while you play.' }
  ]},
  typing: { title: 'Typing Race', desc: 'Type fast. Beat your WPM.', color: 'var(--game-teal)', modes: [
    { id: 'solo', label: 'Practice', type: 'local', desc: 'Test your typing speed alone.' },
    { id: '1v1_remote', label: 'Race Friend (Online)', type: 'remote', desc: 'First to finish the passage wins.' }
  ]},
  wyr: { title: 'Would You Rather', desc: 'See if you match!', color: 'var(--game-pink)', modes: [
    { id: 'coop_remote', label: 'Play with Friend', type: 'remote', desc: 'Answer dilemmas and compare choices.' }
  ]},
  uno: { title: 'Retro Uno', desc: 'Classic card game for 2.', color: 'var(--game-red)', modes: [
    { id: 'vs_ai', label: 'Play vs AI', type: 'local', desc: 'Practice against the computer.' },
    { id: '1v1_remote', label: 'Vs Friend (Online)', type: 'remote', desc: 'Challenge your friend to Uno.' }
  ]},
  othello: { title: 'Othello', desc: 'Classic Reversi.', color: 'var(--game-green)', modes: [
    { id: 'vs_ai', label: 'Play vs AI', type: 'local', diffs: ['easy', 'medium', 'hard'], desc: 'Outflank the computer.' },
    { id: '1v1_remote', label: 'Vs Friend (Online)', type: 'remote', desc: 'Online 1v1 match.' }
  ]},
  pool: { title: '8-Ball Pool', desc: 'Billiards physics.', color: 'var(--game-purple)', modes: [
    { id: 'vs_ai', label: 'Play vs AI', type: 'local', diffs: ['easy', 'medium', 'hard'], desc: 'Play against the computer.' },
    { id: '1v1_remote', label: 'Vs Friend (Online)', type: 'remote', desc: 'Real-time online pool.' }
  ]},
  bluff: { title: 'Cheat (Bluff)', desc: 'Lie to win.', color: 'var(--game-indigo)', modes: [
    { id: 'vs_ai', label: 'Play vs AI', type: 'local', diffs: ['easy', 'hard'], desc: 'Can you outsmart the computer?' },
    { id: '1v1_remote', label: 'Vs Friend (Online)', type: 'remote', desc: 'Call your friend\'s bluffs!' }
  ]},
  twentyq: { title: '20 Questions', desc: 'Guess the secret word.', color: 'var(--game-teal)', modes: [
    { id: '1v1_remote', label: 'Vs Friend (Online)', type: 'remote', desc: 'One sets the word, the other guesses.' }
  ]},
  ludo: { title: 'Ludo', desc: 'Classic board game.', color: 'var(--game-red)', modes: [
    { id: 'vs_ai', label: 'Play vs AI', type: 'local', desc: 'Play against AI.', options: [{key: 'colorsMode', label: 'Tokens', choices: ['2_colors', '1_color']}] },
    { id: '1v1_remote', label: 'Vs Friend (Online)', type: 'remote', desc: 'Online 1v1 match.', options: [{key: 'colorsMode', label: 'Tokens', choices: ['2_colors', '1_color']}] }
  ]}
};

export function ActivitiesHub({ onClose, sfx, setConfetti, onShareToChat, broadcast, userId, partnerId, scores, setScores, profile, myName, partnerName, roomProfiles, onlineUsers, syncedRoomId, onSaveToScrapbook, pictionaryState, setPictionaryState }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMobile();
  // Extract gameRoute and subRoute from location.pathname to support dedicated sub-routing
  const pathParts = location.pathname.split('/').filter(Boolean); // ['arcade', 'ludo', 'setup']
  const gameRoute = pathParts[1]; // 'ludo'
  const subRoute = pathParts[2]; // 'setup' | 'lobby' | 'play'
  
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showPartnerLeftModal, setShowPartnerLeftModal] = useState(false);
  const [lobbyPhase, setLobbyPhase] = useState('IDLE'); // IDLE, WAITING, STARTING
  const [isNavigatingLobby, setIsNavigatingLobby] = useState(false);
  const { lobbies: activeLobbies } = useActiveLobbies(syncedRoomId);
  const [localPlayConfig, setLocalPlayConfig] = useState(null);
  const [view, setView] = useState('arcade');
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  const { session: arcadeSession, joinSession, setReady, leaveSession, updateGameState, resetSession } = useArcadeSession(syncedRoomId, gameRoute, userId);
  const { setCurrentActivity, updateSyncStateAtomic, updateSyncState } = useSync();

  const game = GAME_CATALOG[gameRoute];

  // Determine current active phase (MUST be defined before useEffects)
  let currentPhase = 'menu';
  if (gameRoute && game) {
    if (subRoute === 'setup') {
      currentPhase = 'details';
    } else if (subRoute === 'lobby') {
      currentPhase = 'lobby';
    } else if (subRoute === 'play') {
      if (localPlayConfig) {
        currentPhase = 'playing_local';
      } else if (arcadeSession && arcadeSession.status === 'playing') {
        currentPhase = 'playing_remote';
      } else {
        // If they navigate directly to play but no game is active, fallback to details setup
        currentPhase = 'details';
      }
    } else {
      // Legacy route fallback (e.g. /activities/ludo)
      if (localPlayConfig) {
        currentPhase = 'playing_local';
      } else if (isNavigatingLobby || (arcadeSession && arcadeSession.status !== 'playing')) {
        currentPhase = 'lobby';
      } else if (arcadeSession && arcadeSession.status === 'playing') {
        currentPhase = 'playing_remote';
      } else {
        currentPhase = 'details';
      }
    }
  }

  // Redirect plain game URLs (e.g. /arcade/ludo) to their correct state-based sub-route
  useEffect(() => {
    if (gameRoute && game && !subRoute) {
      if (localPlayConfig) {
        navigate(`/arcade/${gameRoute}/play`, { replace: true });
      } else if (isNavigatingLobby || (arcadeSession && arcadeSession.status !== 'playing')) {
        navigate(`/arcade/${gameRoute}/lobby`, { replace: true });
      } else if (arcadeSession && arcadeSession.status === 'playing') {
        navigate(`/arcade/${gameRoute}/play`, { replace: true });
      } else {
        navigate(`/arcade/${gameRoute}/setup`, { replace: true });
      }
    }
  }, [gameRoute, game, subRoute, localPlayConfig, isNavigatingLobby, arcadeSession, navigate]);

  // If subRoute is 'play' but no active game session or config exists, send back to setup
  useEffect(() => {
    if (gameRoute && game && subRoute === 'play' && !localPlayConfig && (!arcadeSession || arcadeSession.status !== 'playing')) {
      navigate(`/arcade/${gameRoute}/setup`, { replace: true });
    }
  }, [gameRoute, game, subRoute, localPlayConfig, arcadeSession, navigate]);

  // Clear game state on entering setup screen to ensure a clean slate
  useEffect(() => {
    if (currentPhase === 'details' && gameRoute && syncedRoomId) {
      console.log(`[SETUP] Entering setup for ${gameRoute}. Wiping any stale sync states.`);
      const gameStateKeys = {
        tictactoe: `tictactoe_${syncedRoomId}`,
        pictionary: 'pictionary_state',
        memory: `memory_${syncedRoomId}`,
        chess: `chess_${syncedRoomId}`,
        othello: `othello_${syncedRoomId}`,
        pool: [`pool_${syncedRoomId}`, `pool_players_${syncedRoomId}`],
        uno: `uno_${syncedRoomId}`,
        bluff: `bluff_${syncedRoomId}`,
        typing: `typing_${syncedRoomId}`,
        wyr: `wyr_${syncedRoomId}`,
        twentyq: `twentyq_${syncedRoomId}`,
        quiz: `quiz_${syncedRoomId}`,
        wordle: `wordle_${syncedRoomId}`,
        ludo: `ludo_${syncedRoomId}`,
      };
      const stateKey = gameStateKeys[gameRoute];
      if (stateKey) {
        if (Array.isArray(stateKey)) {
          stateKey.forEach(k => updateSyncState(k, null));
        } else {
          updateSyncState(stateKey, null);
        }
      }
      if (resetSession) {
        resetSession();
      }
    }
  }, [currentPhase, gameRoute, syncedRoomId, updateSyncState, resetSession]);

  useEffect(() => {
    if (currentPhase === 'playing_remote' && arcadeSession) {
      const isPlayerA = arcadeSession.player_a_id === userId;
      const partnerInSession = isPlayerA ? arcadeSession.player_b_id : arcadeSession.player_a_id;
      if (!partnerInSession) {
        setShowPartnerLeftModal(true);
      }
    }
  }, [arcadeSession, currentPhase, userId]);

  useEffect(() => {
     if (view === 'scores' && syncedRoomId) {
         setLoadingLeaderboard(true);
         supabase.from('highscores').select('*').eq('room_id', syncedRoomId).order('score', { ascending: false }).limit(100)
           .then(({ data }) => {
               const localScores = JSON.parse(localStorage.getItem('yard_local_highscores') || '[]')
                 .filter((s) => s.room_id === syncedRoomId);
               const combined = [...(data || []), ...localScores];
               const seen = new Set();
               const unique = [];
               for (const s of combined) {
                  const key = `${s.user_id}_${s.game_id}_${s.mode}_${s.score}`;
                  if (!seen.has(key)) {
                     seen.add(key);
                     unique.push(s);
                  }
               }
               unique.sort((a, b) => (b.score || 0) - (a.score || 0));
               setLeaderboardData(unique);
               setLoadingLeaderboard(false);
           }).catch(() => {
               const localScores = JSON.parse(localStorage.getItem('yard_local_highscores') || '[]')
                 .filter((s) => s.room_id === syncedRoomId);
               localScores.sort((a, b) => (b.score || 0) - (a.score || 0));
               setLeaderboardData(localScores);
               setLoadingLeaderboard(false);
           });
     }
  }, [view, syncedRoomId]);
  const [selectedModeId, setSelectedModeId] = useState(null);
  const [selectedDiff, setSelectedDiff] = useState('medium');
  const [selectedOptions, setSelectedOptions] = useState({ matchType: 1 });



  const partnerIsOnline = partnerId && (onlineUsers?.[partnerId]?.status === 'active' || onlineUsers?.[partnerId]?.status === 'idle');

  // Reset navigation when game changes
  useEffect(() => {
    setIsNavigatingLobby(false);
    setLobbyPhase('IDLE');
  }, [gameRoute]);

  // Auto-join lobby when navigating via invitation accept action
  useEffect(() => {
    if (location.state?.autoJoin && gameRoute && game) {
      console.log("🚦 [LOBBY] Auto-joining lobby for", gameRoute);
      setIsNavigatingLobby(true);
      joinSession().catch(err => {
        console.error("Auto-joining lobby failed:", err);
      });
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.autoJoin, gameRoute, game, joinSession, navigate, location.pathname]);



  // Cleanup logic



  useEffect(() => {
    if (gameRoute && game && !arcadeSession && currentPhase === 'lobby') {
      console.log("🚦 [LOBBY] Bootstrapping session for", gameRoute);
      joinSession().catch((e) => console.error('[LOBBY] Bootstrap failed:', e));
    }
  }, [gameRoute, game, arcadeSession, joinSession, currentPhase]);

  // Sync lobbyPhase with arcadeSession status
  useEffect(() => {
    if (arcadeSession?.status === 'starting') {
      console.log("🚦 [LOBBY] DB status is 'starting'. Bypassing countdown and starting immediately.");
      setLobbyPhase('STARTING');
      const isPlayerA = arcadeSession?.player_a_id === userId;
      if (isPlayerA) {
        supabase.from('arcade_sessions').update({ status: 'playing' }).eq('room_id', syncedRoomId).eq('game_id', gameRoute)
          .then(({ error }) => {
            if (error) console.error("Failed to automatically start game:", error);
          });
      }
    } else if (arcadeSession?.status === 'playing') {
      setLobbyPhase('PLAYING');
      if (subRoute === 'lobby') {
        navigate(`/arcade/${gameRoute}/play`, { replace: true });
      }
    }
  }, [arcadeSession?.status, userId, syncedRoomId, gameRoute, subRoute, navigate]);

  // Solo Bypass Handshake Listener
  useEffect(() => {
    const isPlayerA = arcadeSession?.player_a_id === userId;
    const partnerInLobby = isPlayerA ? !!arcadeSession?.player_b_id : !!arcadeSession?.player_a_id;
    const partnerIsOnline = partnerId && (onlineUsers?.[partnerId]?.status === 'active' || onlineUsers?.[partnerId]?.status === 'idle');
    
    if (!partnerIsOnline && !partnerInLobby && lobbyPhase === 'WAITING') {
        console.log("🚦 [LOBBY] Solo Bypass: Partner offline and not in lobby. Bypassing database handshake...");
        const timer = setTimeout(async () => {
          try {
            setLobbyPhase('STARTING');
            if (arcadeSession && arcadeSession.status !== 'playing') {
               await supabase.from('arcade_sessions').update({ status: 'playing' }).eq('room_id', syncedRoomId).eq('game_id', gameRoute);
            }
          } catch (e) {
            console.error("🛑 [LOBBY] Solo bypass DB update failed, but proceeding anyway:", e);
          }
        }, 800);
        return () => clearTimeout(timer);
    }
  }, [lobbyPhase, partnerId, onlineUsers, arcadeSession, syncedRoomId, gameRoute, userId]);

  // Auto start when both players are ready in remote lobby
  useEffect(() => {
    if (currentPhase === 'lobby' && arcadeSession && arcadeSession.status === 'idle') {
      const isPlayerA = arcadeSession.player_a_id === userId;
      const partnerInLobby = isPlayerA ? !!arcadeSession.player_b_id : !!arcadeSession.player_a_id;
      
      if (partnerInLobby && arcadeSession.player_a_ready && arcadeSession.player_b_ready) {
        console.log("🚦 [LOBBY] Both players ready! Auto starting...");
        if (isPlayerA) {
          supabase.from('arcade_sessions').update({ status: 'playing' }).eq('room_id', syncedRoomId).eq('game_id', gameRoute)
            .then(({ error }) => {
              if (error) console.error("Failed to automatically start game:", error);
            });
        }
      }
    }
  }, [arcadeSession, currentPhase, userId, syncedRoomId, gameRoute]);

  // Keep the global 'arcade_lobby' sync state in sync with the current active arcadeSession
  useEffect(() => {
    if (currentPhase === 'lobby' && arcadeSession) {
      const players = [];
      if (arcadeSession.player_a_id) players.push(arcadeSession.player_a_id);
      if (arcadeSession.player_b_id) players.push(arcadeSession.player_b_id);
      
      const nextLobbyState = {
        gameId: gameRoute,
        players,
        status: arcadeSession.status === 'starting' || arcadeSession.status === 'playing' ? 'playing' : 'waiting',
        config: arcadeSession.game_state
      };
      
      updateSyncState('arcade_lobby', nextLobbyState);
    } else if (currentPhase === 'menu' || !gameRoute) {
      // Clear lobby state when not in lobby
      updateSyncState('arcade_lobby', { players: [], gameId: null, status: 'idle', config: null });
    }
  }, [arcadeSession, currentPhase, gameRoute, updateSyncState]);
  
  // Track Activity Status
  useEffect(() => {
    if (!gameRoute) {
      setCurrentActivity('Browsing Arcade');
      return;
    }

    const gameTitle = game?.title || gameRoute;
    let activity = '';

    if (currentPhase === 'playing_local' || currentPhase === 'playing_remote') {
      activity = `Playing ${gameTitle}`;
      // Persist last played game
      updateSyncStateAtomic('room_profiles', userId, {
        lastActivity: { game: gameTitle, timestamp: new Date().toISOString() }
      });
    } else if (currentPhase === 'lobby') {
      activity = `In Lobby for ${gameTitle}`;
    } else if (currentPhase === 'details') {
      activity = `Setting up ${gameTitle}`;
    } else {
      activity = 'Browsing Arcade';
    }

    setCurrentActivity(activity);

    return () => {
      // Clear activity when leaving ActivitiesHub or switching games
      if (!gameRoute) setCurrentActivity(null);
    };
  }, [gameRoute, currentPhase, game?.title, setCurrentActivity, updateSyncStateAtomic, userId]);

  const handleWin = () => { 
    try { if (sfx) { const winAudio = new Audio('/assets/win.mp3'); winAudio.volume = 0.5; winAudio.play().catch(()=>{}); } } catch(e){}
    setConfetti(true); setTimeout(() => setConfetti(false), 4000); 
  };

  const handleStartLocal = (mode) => {
      playAudio('click', sfx);
      setLocalPlayConfig({ mode: mode.id, diff: selectedDiff, ...selectedOptions });
      navigate(`/arcade/${gameRoute}/play`);
  };

  const buildRemoteGameConfig = (mode) => ({
    mode: mode.id,
    type: 'remote',
    diff: selectedDiff,
    ...selectedOptions,
    modeLabel: mode.label,
  });

  const handleCreateLobby = async (mode) => {
      playAudio('click', sfx);
      setIsNavigatingLobby(true);
      setLobbyPhase('IDLE');
      try {
        // Clear any stale game state so the board always starts fresh
        const gameStateKeys = {
          tictactoe: `tictactoe_${syncedRoomId}`,
          pictionary: 'pictionary_state',
          memory: `memory_${syncedRoomId}`,
          chess: `chess_${syncedRoomId}`,
          othello: `othello_${syncedRoomId}`,
          pool: [`pool_${syncedRoomId}`, `pool_players_${syncedRoomId}`],
          uno: `uno_${syncedRoomId}`,
          bluff: `bluff_${syncedRoomId}`,
          typing: `typing_${syncedRoomId}`,
          wyr: `wyr_${syncedRoomId}`,
          twentyq: `twentyq_${syncedRoomId}`,
          quiz: `quiz_${syncedRoomId}`,
          wordle: `wordle_${syncedRoomId}`,
          ludo: `ludo_${syncedRoomId}`,
        };
        const stateKey = gameStateKeys[gameRoute];
        if (stateKey) {
          if (Array.isArray(stateKey)) {
            stateKey.forEach(k => updateSyncState(k, null));
          } else {
            updateSyncState(stateKey, null);
          }
        }

        const gameConfig = buildRemoteGameConfig(mode);
        await joinSession();
        await updateGameState(gameConfig);
        console.log("🚦 [LOBBY] Session created with config:", gameConfig);
        onShareToChat(`Join me for ${game.title} (${mode.label})!`, null, { gameId: gameRoute, type: 'game_invite_modal' });
        navigate(`/arcade/${gameRoute}/lobby`);
      } catch (e) {
        console.error("Failed to create lobby:", e);
        setIsNavigatingLobby(false);
        setLobbyPhase('IDLE');
      }
  };

  const handleJoinLobby = async () => {
      playAudio('click', sfx);
      try {
        setIsNavigatingLobby(true);
        await joinSession();
        navigate(`/arcade/${gameRoute}/lobby`);
      } catch (e) {
        console.error("Failed to join lobby:", e);
      }
  };

  // Cleanup logic
  useEffect(() => {
      setLocalPlayConfig(null);
      setSelectedModeId(null);
      return () => {
          if (gameRoute) leaveSession();
      };
  }, [gameRoute, leaveSession]);

  const renderActiveGame = () => {
    const firstRemoteMode = game?.modes?.find(m => m.type === 'remote')?.id || '1v1_remote';
    const remoteDefaults = { diff: selectedDiff, mode: firstRemoteMode, matchType: 1, ...selectedOptions };
    // Use game_state from DB only if it has a valid 'mode' property (guarantees full config)
    const activeConfig = currentPhase === 'playing_local'
      ? localPlayConfig
      : (arcadeSession?.game_state?.mode
          ? arcadeSession.game_state
          : remoteDefaults);
    const isMultiplayer = currentPhase === 'playing_remote';
    const isHost = isMultiplayer ? (arcadeSession?.player_a_id === userId) : true;
    const myPlayerId = isMultiplayer ? (isHost ? 'p1' : 'p2') : 'p1';
    const oppPlayerId = isMultiplayer ? (isHost ? 'p2' : 'p1') : 'ai';

    const commonProps = { 
        config: activeConfig || { diff: 'easy', mode: 'solo', matchType: 1 }, 
        sfx, userId, partnerId, setScores, onWin: handleWin,
        isHost, isMultiplayer, myPlayerId, oppPlayerId,
        onBack: () => {
             setLocalPlayConfig(null);
             navigate('/arcade');
        }, 
        onShareToChat, onSaveToScrapbook, profile,
        myName, partnerName, roomProfiles,
        roomId: syncedRoomId || 'global'
    };

    const gameComponent = (() => {
      switch (gameRoute) {
        case 'tictactoe': return <TicTacToe {...commonProps} />;
        case 'pictionary': return <PictionaryGame {...commonProps} pictionaryState={pictionaryState} setPictionaryState={setPictionaryState} />;
        case 'memory': return <MemoryGame {...commonProps} roomId={commonProps.roomId} />;
        case 'wordle': return <WordleClone {...commonProps} />;
        case 'sudoku': return <Sudoku {...commonProps} />;
        case 'chess': return <ChessEngine {...commonProps} />;
        case 'quiz': return <YardQuiz {...commonProps} />;
        case '2048': return <Game2048 {...commonProps} />;
        case 'typing': return <TypingRace {...commonProps} />;
        case 'wyr': return <WouldYouRather {...commonProps} />;
        case 'uno': return <UnoGame {...commonProps} />;
        case 'othello': return <OthelloGame {...commonProps} />;
        case 'pool': return <PoolGame {...commonProps} />;
        case 'bluff': return <BluffGame {...commonProps} />;
        case 'twentyq': return <TwentyQuestions {...commonProps} />;
        case 'ludo': return <LudoGame {...commonProps} />;
        default: return <div className="p-8 text-center font-bold">Game Engine Offline</div>;
      }
    })();

    return gameComponent;
  };

  // 1. Arcade Menu Phase
  if (currentPhase === 'menu') {
    return (
      <RetroWindow title="activities_hub.exe" onClose={onClose} className="w-full max-w-4xl h-[calc(100dvh-56px)] md:h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col border-none md:border-solid rounded-none relative overflow-hidden" noPadding>
        <div className="flex border-b-2 retro-border shrink-0 bg-[var(--bg-main)]">
           <button onClick={() => setView('arcade')} className={`flex-1 py-3 font-black uppercase tracking-widest text-xs transition-all ${view === 'arcade' ? 'bg-[var(--primary)] text-white' : 'opacity-60 grayscale'}`}>Games</button>
           <button onClick={() => setView('scores')} className={`flex-1 py-3 font-black uppercase tracking-widest text-xs border-l-2 retro-border transition-all ${view === 'scores' ? 'bg-[var(--secondary)] text-white' : 'opacity-60 grayscale'}`}>Leaderboard</button>
        </div>

        {view === 'scores' ? (
                    <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[var(--bg-window)] text-[var(--text-main)]">
             <div className="max-w-4xl mx-auto border-4 border-double border-[var(--border)] p-4 sm:p-8 relative">
                <h2 className="text-2xl sm:text-3xl font-black text-center mb-8 uppercase tracking-[0.3em]">Global Leaderboard</h2>
                
                {loadingLeaderboard ? (
                    <div className="flex justify-center py-12"><Loader className="animate-spin text-[var(--primary)]" size={32}/></div>
                ) : leaderboardData.length > 0 ? (
                    <div className="space-y-8">
                       {/* Group by Game and Mode */}
                       {Object.entries(
                           leaderboardData.reduce((acc, curr) => {
                               const key = curr.game_id + ' | ' + curr.mode;
                               if (!acc[key]) acc[key] = [];
                               acc[key].push(curr);
                               return acc;
                           }, {})
                       ).map(([groupKey, scores]) => (
                           <div key={groupKey} className="bg-[var(--bg-main)] retro-border p-4">
                               <h3 className="font-black text-xl uppercase text-[var(--primary)] mb-4 bg-black text-white inline-block px-3 py-1">{groupKey}</h3>
                               <div className="space-y-2">
                                  {scores.slice(0, 10).map((s, i) => (
                                      <div key={s.id || i} className="flex justify-between items-center bg-[var(--bg-window)] p-2 border-b-2 border-dashed border-[var(--border)]">
                                          <div className="flex items-center gap-4">
                                              <span className="font-black text-xl opacity-40 w-6">#{i+1}</span>
                                              <span className="font-bold">{s.player_name || 'Unknown'}</span>
                                          </div>
                                          <span className="font-black text-[var(--secondary)] text-xl">{s.score}</span>
                                      </div>
                                  ))}
                               </div>
                           </div>
                       ))}
                    </div>
                ) : (
                    <div className="text-center opacity-60 font-bold py-12">No highscores recorded yet. Be the first!</div>
                )}
             </div>
          </div>
        ) : (
           <div className="flex-1 overflow-hidden flex flex-col bg-[var(--bg-main)]">
            {activeLobbies?.length > 0 && activeLobbies.some(l => l.player_a_id === partnerId || l.player_b_id === partnerId) && (
              (() => {
                const partnerLobby = activeLobbies.find(l => l.player_a_id === partnerId || l.player_b_id === partnerId);
                if (partnerLobby?.game_id === gameRoute) return null; // Don't show if already in that game's setup/lobby
                
                return (
                  <div className="bg-[var(--secondary)] text-[var(--text-on-secondary)] p-4 border-b-2 retro-border flex items-center justify-between gap-4 animate-pulse shrink-0">
                      <div className="flex items-center gap-3">
                          <Users className="shrink-0" />
                          <div>
                              <h2 className="text-sm font-black uppercase mb-0.5">{partnerName} is Waiting!</h2>
                              <p className="font-bold text-[10px] opacity-90">They are in a lobby for {GAME_CATALOG[partnerLobby?.game_id]?.title || partnerLobby?.game_id}.</p>
                          </div>
                      </div>
                      <RetroButton variant="white" className="text-black px-4 py-1.5 text-xs whitespace-nowrap" onClick={() => {
                        navigate(`/arcade/${partnerLobby?.game_id}/lobby`);
                      }}>View Lobby</RetroButton>
                  </div>
                );
              })()
            )}
            
            {isMobile && (
              <div className="p-6 pb-0 shrink-0">
                 <button 
                   onClick={() => { try{playAudio('click', sfx);}catch(e){} navigate('/watch'); }}
                   className="w-full flex items-center justify-between p-6 bg-[var(--bg-window)] border-2 border-[var(--secondary)] shadow-[4px_4px_0px_0px_var(--secondary)] hover:translate-y-1 hover:translate-x-1 hover:shadow-none transition-all text-left"
                 >
                   <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-[var(--secondary)] text-white flex items-center justify-center retro-border shadow-sm shrink-0">
                       <Monitor size={24} />
                     </div>
                     <div>
                       <h3 className="font-black text-xl mb-1 text-[var(--secondary)] tracking-tight">Watch Party</h3>
                       <p className="text-sm text-[var(--text-main)] opacity-70 leading-tight font-medium">Sync YouTube & Movies together.</p>
                     </div>
                   </div>
                 </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6 overflow-y-auto h-full">
            {Object.entries(GAME_CATALOG)
              .filter(([id]) => !window.matchMedia('(max-width: 768px)').matches || id !== 'chess')
              .map(([id, g]) => (
              <button 
                key={id} 
                onClick={() => { try{playAudio('click', sfx);}catch(e){} navigate(`/arcade/${id}/setup`); }}
                data-testid={`game-card-${id}`}
                className="game-card flex flex-col items-start p-6 bg-[var(--bg-window)] border-2 border-[var(--border)] shadow-[4px_4px_0px_0px_var(--border)] hover:translate-y-1 hover:translate-x-1 hover:shadow-none transition-all text-left"
              >
                <div className="w-5 h-5 mb-4 border-2 border-[var(--border)] shadow-[2px_2px_0_0_var(--border)]" style={{ backgroundColor: g.color }}></div>
                <h3 className="font-black text-lg mb-2 text-[var(--text-main)] tracking-tight">{g.title}</h3>
                <p className="text-xs text-[var(--text-main)] opacity-70 leading-tight font-medium">{g.desc}</p>
              </button>
            ))}
            </div>
          </div>
        )}
        </RetroWindow>
    );
  }


  
  const leaveLobby = async () => {
      playAudio('click', sfx);
      await leaveSession();
      if (broadcast) {
        broadcast('lobby_closed', { sender: userId, gameId: gameRoute });
      }
      setShowLeaveConfirm(false);
      setIsNavigatingLobby(false);
      setLobbyPhase('IDLE');
      navigate('/arcade');
  };
  const handleLeaveClick = () => {
      const partnerInLobby = !!arcadeSession?.player_a_id && !!arcadeSession?.player_b_id;
      if (!partnerInLobby) {
          setShowLeaveConfirm(true);
      } else {
          leaveLobby();
      }
  };

  // 2. Game Details / Mode Selector Phase

  if (currentPhase === 'details') {
      const partnerWaitingHere = activeLobbies?.some(l => l.game_id === gameRoute && (l.player_a_id === partnerId || l.player_b_id === partnerId));

      const hasSolo = game.modes.find(m => m.id === 'solo' || m.id === '1v1_local' || m.id === 'practice');
      const hasAI = game.modes.find(m => m.id === 'vs_ai');
      const partnerModes = game.modes.filter(m => m.type === 'remote');
      const hasPartner = partnerModes.length > 0;

      const topCategory = selectedModeId === 'solo' || selectedModeId === '1v1_local' || selectedModeId === 'practice' ? 'solo' : selectedModeId === 'vs_ai' ? 'ai' : partnerModes.some(m => m.id === selectedModeId) ? 'partner' : null;

      const handleCategoryClick = (cat) => {
          playAudio('click', sfx);
          if (cat === 'solo') setSelectedModeId(hasSolo?.id || 'solo');
          if (cat === 'ai') setSelectedModeId(hasAI?.id || 'vs_ai');
          if (cat === 'partner') {
              setSelectedModeId(partnerModes[0]?.id || 'partner');
          }
      };

      const activeModeObj = game.modes.find(m => m.id === selectedModeId) || game.modes[0];

      return (
        <div className="w-full min-h-full flex items-center justify-center p-4 sm:p-6 md:p-8 animate-in fade-in duration-200">
          <RetroWindow title={`${gameRoute}_setup.exe`} onClose={() => navigate('/arcade')} className="w-full max-w-md flex flex-col bg-[var(--bg-window)]" noPadding>
          <div className="flex flex-col bg-[var(--bg-window)] text-[var(--text-main)]">
             <div className="p-6 border-b-2 border-dashed border-[var(--border)] flex flex-col items-center justify-center text-center shrink-0">
                 <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-widest" style={{ color: game.color || 'var(--primary)' }}>{game.title}</h1>
                 <p className="text-sm font-bold opacity-70 mt-2">{game.desc}</p>
             </div>

             <div className="p-4 sm:p-6 flex flex-col">
                 {partnerWaitingHere && (
                     <div className="bg-[var(--secondary)] text-[var(--text-on-secondary)] p-4 mb-6 retro-border flex items-center justify-between gap-4 animate-pulse">
                         <div>
                             <h2 className="text-lg font-black uppercase mb-1">Partner is Waiting!</h2>
                             <p className="font-bold text-xs opacity-90">They set up a lobby for {game.title}.</p>
                         </div>
                         <RetroButton variant="white" className="text-black px-4 py-2 text-sm" onClick={handleJoinLobby}>Join</RetroButton>
                     </div>
                 )}

                 <h3 className="text-sm font-black uppercase tracking-widest mb-4 opacity-50">Game Mode</h3>
                 
                 <div className="flex gap-3 mb-6 shrink-0">
                     {hasSolo && <RetroButton variant={topCategory === 'solo' ? 'primary' : 'white'} onClick={() => handleCategoryClick('solo')} className={`flex-1 py-3 text-sm ${topCategory !== 'solo' ? 'opacity-70' : ''}`}><User size={16} /> Solo</RetroButton>}
                     {hasAI && <RetroButton variant={topCategory === 'ai' ? 'primary' : 'white'} onClick={() => handleCategoryClick('ai')} className={`flex-1 py-3 text-sm ${topCategory !== 'ai' ? 'opacity-70' : ''}`}><Monitor size={16} /> With AI</RetroButton>}
                     {hasPartner && <RetroButton variant={topCategory === 'partner' ? 'primary' : 'white'} onClick={() => handleCategoryClick('partner')} className={`flex-1 py-3 text-sm ${topCategory !== 'partner' ? 'opacity-70' : ''}`}><Users size={16} /> With Partner</RetroButton>}
                 </div>
                 
                 {topCategory && (
                     <div className="bg-[var(--bg-window)] retro-border p-4 sm:p-6 flex-1 flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                        {topCategory === 'partner' && partnerModes.length > 1 && (
                            <div className="mb-6">
                               <label className="text-xs font-black uppercase tracking-widest opacity-50 mb-3 block">Partner Mode</label>
                               <div className="flex gap-2">
                                  {partnerModes.map(m => (
                                     <RetroButton key={m.id} variant={selectedModeId === m.id ? 'secondary' : 'white'} onClick={() => { playAudio('click', sfx); setSelectedModeId(m.id); }} className="flex-1 py-2 text-xs">
                                        {m.label.replace(' (Online)', '')}
                                     </RetroButton>
                                  ))}
                               </div>
                            </div>
                        )}

                        {activeModeObj?.diffs && (topCategory !== 'partner' || gameRoute === 'pictionary') && (
                            <div className="mb-6">
                                <label className="text-xs font-black uppercase tracking-widest opacity-50 mb-3 block">Difficulty</label>
                                <div className="flex gap-2">
                                    {activeModeObj.diffs.map(d => (
                                        <button key={d} onClick={() => { playAudio('click', sfx); setSelectedDiff(d); }} className={`flex-1 py-2 text-xs font-bold uppercase retro-border transition-colors ${selectedDiff === d ? 'bg-[var(--primary)] text-white' : 'bg-[var(--bg-window)] opacity-70 hover:opacity-100'}`}>
                                            {d}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeModeObj?.options && activeModeObj.options.map(opt => (
                            <div key={opt.key} className="mb-6">
                                <label className="text-xs font-black uppercase tracking-widest opacity-50 mb-3 block">{opt.label}</label>
                                <div className="flex gap-2">
                                    {opt.choices.map(c => (
                                        <button key={c} onClick={() => { playAudio('click', sfx); setSelectedOptions(p => ({...p, [opt.key]: c})); }}
                                                className={`flex-1 py-2 text-xs font-bold uppercase retro-border transition-colors ${selectedOptions[opt.key] === c ? 'bg-[var(--primary)] text-white' : 'bg-[var(--bg-window)] opacity-70 hover:opacity-100'}`}>
                                            {c}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                        
                        <div className="mt-auto pt-6">
                            <RetroButton 
                                variant={topCategory === 'partner' ? 'accent' : 'primary'} 
                                className="w-full py-4 text-lg retro-shadow-dark flex items-center justify-center gap-2"
                                onClick={() => {
                                    if (topCategory === 'partner') {
                                        handleCreateLobby(activeModeObj);
                                    } else {
                                        handleStartLocal(activeModeObj);
                                    }
                                }}
                            >
                                {topCategory === 'partner' ? <><Zap size={20}/> Proceed to Lobby</> : <><Play size={20}/> Start Game</>}
                            </RetroButton>
                        </div>
                     </div>
                 )}
             </div>
          </div>
          </RetroWindow>
        </div>
      );
  }

  // 3. Lobby Waiting Phase
  if (currentPhase === 'lobby') {
    const isPlayerA = arcadeSession?.player_a_id === userId;
    const playerA = isPlayerA ? userId : arcadeSession?.player_a_id;
    const playerB = isPlayerA ? arcadeSession?.player_b_id : userId;
    
    const partnerIsOnline = partnerId && (onlineUsers?.[partnerId]?.status === 'active' || onlineUsers?.[partnerId]?.status === 'idle');
    const partnerInLobby = isPlayerA ? !!arcadeSession?.player_b_id : !!arcadeSession?.player_a_id;
    
    // Solo Bypass: If partner is offline, only my ready status matters for 'isReady'
    const isReady = partnerIsOnline 
      ? (arcadeSession?.player_a_ready && arcadeSession?.player_b_ready)
      : (isPlayerA ? arcadeSession?.player_a_ready : arcadeSession?.player_b_ready);

    const amIReady = isPlayerA ? arcadeSession?.player_a_ready : arcadeSession?.player_b_ready;

    return (
      <div className="w-full min-h-full flex items-center justify-center p-4 sm:p-6 md:p-8 animate-in fade-in duration-200">
        <RetroWindow title={`lobby_${gameRoute}.exe`} onClose={handleLeaveClick} className="w-full max-w-md flex flex-col bg-[var(--bg-window)]" noPadding>
           <div className="flex-1 overflow-y-auto w-full custom-scrollbar flex flex-col items-center justify-center p-8 text-center bg-[var(--bg-window)]">
              <h2 className="text-3xl font-black uppercase mb-2 text-[var(--primary)]">Arcade Lobby</h2>
              
              <div className="bg-[var(--bg-window)] border-2 border-black border-dashed px-6 py-2 mb-8 inline-flex flex-col items-center">
                  <span className="font-black text-[var(--primary)] uppercase tracking-widest text-xl">{game?.title || gameRoute}</span>
                  <span className="text-xs font-bold opacity-70 uppercase tracking-widest mt-1">Mode: {arcadeSession?.game_state?.mode || 'Online'}</span>
              </div>
              <div className="flex justify-center gap-8 mb-10 w-full max-w-md">
                  {/* Player 1 Slot (Always You) */}
                  <div className="flex-1 flex flex-col items-center p-4 bg-[var(--bg-window)] retro-border retro-shadow-dark min-w-[120px]">
                      <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mb-2 border-2 border-primary">
                          <User size={24} className="text-primary" />
                      </div>
                      <span className="text-[10px] font-black uppercase opacity-40">P1</span>
                      <span className="text-sm font-black truncate">{myName || 'You'}</span>
                      <div className={`mt-2 px-2 py-0.5 text-[8px] font-black uppercase retro-border ${!arcadeSession ? 'bg-gray-400 opacity-50' : (isPlayerA ? (arcadeSession.player_a_ready ? 'bg-[var(--color-game)] text-white' : 'bg-orange-400 text-white') : (arcadeSession.player_b_ready ? 'bg-[var(--color-game)] text-white' : 'bg-orange-400 text-white'))}`}>
                          {!arcadeSession ? 'SYNCING...' : (isPlayerA ? (arcadeSession.player_a_ready ? 'READY' : 'WAITING') : (arcadeSession.player_b_ready ? 'READY' : 'WAITING'))}
                      </div>
                  </div>
  
                  {/* VS Divider */}
                  <div className="flex items-center justify-center">
                      <span className="text-2xl font-black italic opacity-20">VS</span>
                  </div>
  
                  {/* Player 2 Slot (Partner) */}
                  <div className="flex-1 flex flex-col items-center p-4 bg-[var(--bg-window)] retro-border retro-shadow-dark min-w-[120px]">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 border-2 ${partnerInLobby ? 'bg-accent/20 border-accent' : 'bg-border/10 border-dashed border-border'}`}>
                          {partnerInLobby ? <User size={24} className="text-accent" /> : <Monitor size={24} className="opacity-20" />}
                      </div>
                      <span className="text-[10px] font-black uppercase opacity-40">P2</span>
                      <span className={`text-sm font-black truncate ${!partnerInLobby ? 'opacity-30' : ''}`}>
                          {partnerInLobby ? (partnerName || 'Partner') : (arcadeSession ? 'WAITING...' : 'SYNCING...')}
                      </span>
                      {partnerInLobby ? (
                          <div className={`mt-2 px-2 py-0.5 text-[8px] font-black uppercase retro-border ${isPlayerA ? (arcadeSession.player_b_ready ? 'bg-[var(--color-game)] text-white' : 'bg-orange-400 text-white') : (arcadeSession.player_a_ready ? 'bg-[var(--color-game)] text-white' : 'bg-orange-400 text-white')}`}>
                              {isPlayerA ? (arcadeSession.player_b_ready ? 'READY' : 'WAITING') : (arcadeSession.player_a_ready ? 'READY' : 'WAITING')}
                          </div>
                      ) : (
                          <div className="mt-2 px-2 py-0.5 text-[8px] font-black uppercase opacity-30 border-2 border-dashed border-black/10">
                              {!arcadeSession ? 'SYNCING...' : 'EMPTY'}
                          </div>
                      )}
                  </div>
              </div>
  
              <div className="flex flex-col gap-4 w-full max-w-xs">
                <RetroButton 
                  variant={amIReady ? 'primary' : 'accent'} 
                  disabled={!partnerInLobby}
                  onClick={async () => {
                    const nextReady = !amIReady;
                    console.log(`🚦 [LOBBY] Toggle ready to ${nextReady}`);
                    try {
                       await setReady(nextReady, partnerIsOnline);
                    } catch (e) {
                       console.error("Failed to toggle ready:", e);
                    }
                  }}
                  className="w-full py-3 font-black uppercase text-sm"
                >
                  {amIReady ? "✓ You are Ready" : "Click to Ready"}
                </RetroButton>
                
                <RetroButton 
                  variant="secondary"
                  onClick={() => onShareToChat(`Join my lobby for ${game?.title || gameRoute}!`, null, { gameId: gameRoute, type: 'game_invite_modal' })} 
                  className="w-full py-2 text-xs"
                >
                   {partnerInLobby ? "Ping Partner" : "Resend Invite"}
                </RetroButton>
              </div>
           </div>
        </RetroWindow>
        {showLeaveConfirm && (
          <ConfirmDialog 
            title="Leave Lobby?" 
            message="Are you sure you want to close the lobby? This will disconnect your partner." 
            onConfirm={leaveLobby} 
            onCancel={() => { playAudio('click', sfx); setShowLeaveConfirm(false); }} 
            showSave={false} 
            sfx={sfx}
          />
        )}
        {showPartnerLeftModal && (
          <div className={`${isMobile ? 'absolute' : 'fixed'} inset-0 z-[var(--z-modal)] bg-black/35 flex items-center justify-center p-4 animate-in fade-in duration-200`}>
            <RetroWindow title="partner_left.exe" onClose={() => setShowPartnerLeftModal(false)} className="w-full max-w-sm">
              <p className="font-bold text-sm mb-6">Your partner has left the game mid-game. Would you like to stay or leave?</p>
              <div className="flex gap-2">
                <RetroButton variant="white" className="flex-1 py-2" onClick={() => { playAudio('click', sfx); setShowPartnerLeftModal(false); }}>Stay</RetroButton>
                <RetroButton className="flex-1 py-2" onClick={() => { playAudio('click', sfx); setShowPartnerLeftModal(false); leaveLobby(); }}>Leave Game</RetroButton>
              </div>
            </RetroWindow>
          </div>
        )}
      </div>
    );
  }

  // 4. Active Game Phase
  if (currentPhase === 'playing_local' || currentPhase === 'playing_remote') {
      return (
        <div className="w-full min-h-full flex items-center justify-center p-4 sm:p-6 md:p-8 animate-in fade-in duration-200">
           {renderActiveGame()}
        </div>
      );
  }

  return null;
}
