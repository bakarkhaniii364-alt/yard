import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RetroWindow, RetroButton, ShareOutcomeOverlay } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { calculateLevenshtein, floodFill } from '../utils/helpers.js';
import { incrementUserScore, getScoreForUser } from '../utils/userDataHelpers.js';
import { PICTIONARY_CATEGORIES } from '../constants/data.js';
import { useBroadcast } from '../hooks/useSupabaseSync.js';
import { useCall } from '../context/instances.js';
import { Brush, Undo2, Trash2, PenTool, Eraser, Grid, Lightbulb, SkipForward, PaintBucket, Smile } from 'lucide-react';

import { isTestMode } from '../lib/testMode.js';

export function PictionaryGame({ config, setScores, onBack, sfx, onWin, onShareToChat, onSaveToScrapbook, profile, myName, userId, partnerId, pictionaryState, setPictionaryState, isHost, partnerName }) {
  const p1Id = isHost ? userId : (partnerId || userId);
  const p2Id = isHost ? (partnerId || userId) : userId;

  const defaultState = {
    gameState: 'prep',
    hostId: p1Id,
    guestId: p2Id,
    currentRound: 1,
    totalRounds: parseInt(config?.rounds) || 3,
    turn: 1, // turn 1: p1Id draws, turn 2: p2Id draws
    drawerId: p1Id,
    wordOptions: [],
    word: '',
    displayWord: [],
    endTime: null,
    currentCanvas: null,
    scores: {},
    turnResult: null
  };

  // Pre-emptive host initialization to guarantee identical state from the beginning
  useEffect(() => {
    if (isHost && !pictionaryState) {
      setPictionaryState(defaultState);
    }
  }, [isHost, pictionaryState, setPictionaryState]);

  const stateToUse = pictionaryState || defaultState;
  const { gameState, drawerId, word, displayWord, currentCanvas } = stateToUse;
  const isDrawer = userId === drawerId;

  const [guess, setGuess] = useState('');
  
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const [tool, setTool] = useState('pen'); 
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(4);
  const [undoStack, setUndoStack] = useState([]);
  
  const [finalImage, setFinalImage] = useState(null);
  
  const [gridEnabled, setGridEnabled] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const [partnerCursor, setPartnerCursor] = useState({ x: 0, y: 0, show: false });
  const [fakeCursor, setFakeCursor] = useState({ x: 0, y: 0, show: false });

  const getWordOptions = () => {
    const genre = config?.genre || config?.category || 'General';
    const words = PICTIONARY_CATEGORIES[genre] || PICTIONARY_CATEGORIES['General'] || ['Apple', 'Tree', 'Cat'];
    // Pick 3 distinct words randomly
    const shuffled = [...words].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3);
  };

  const startRound = () => { 
    if (gameState === 'drawing' || gameState === 'word_selection') return;
    playAudio('click', sfx); 
    const wordOptions = getWordOptions();
    if (isTestMode()) {
      setPictionaryState({
        gameState: 'drawing',
        hostId: p1Id,
        guestId: p2Id,
        currentRound: 1,
        totalRounds: parseInt(config?.rounds) || 3,
        turn: 1,
        drawerId: p1Id,
        wordOptions,
        word: 'Apple',
        displayWord: ['_', '_', '_', '_', '_'],
        endTime: Date.now() + 90 * 1000,
        currentCanvas: null,
        scores: { [p1Id]: 0, [p2Id]: 0 },
        turnResult: null
      });
    } else {
      setPictionaryState({
        gameState: 'word_selection',
        hostId: p1Id,
        guestId: p2Id,
        currentRound: 1,
        totalRounds: parseInt(config?.rounds) || 3,
        turn: 1,
        drawerId: p1Id,
        wordOptions,
        word: '',
        displayWord: [],
        endTime: null,
        currentCanvas: null,
        scores: { [p1Id]: 0, [p2Id]: 0 },
        turnResult: null
      });
    }
    setUndoStack([]); 
  };

  const selectWord = (selectedWord) => {
    playAudio('click', sfx);
    setPictionaryState(prev => ({
       ...prev,
       gameState: 'drawing',
       word: selectedWord,
       displayWord: selectedWord.split('').map(() => '_'),
       endTime: Date.now() + 90 * 1000,
       currentCanvas: null
    }));
    setUndoStack([]);
  };

  const handleSkip = () => {
      playAudio('click', sfx);
      const wordOptions = getWordOptions();
      setPictionaryState(prev => ({
          ...prev,
          gameState: 'word_selection',
          wordOptions,
          word: '',
          displayWord: []
      }));
      setScores(prev => incrementUserScore(prev, userId, 'pictionary', -1, myName || profile?.name || 'You'));
  };

  const [localTimeLeft, setLocalTimeLeft] = useState(90);

  const [prepCountdown, setPrepCountdown] = useState(4);
  const [wordCountdown, setWordCountdown] = useState(10);
  const [turnEndCountdown, setTurnEndCountdown] = useState(5);

  useEffect(() => {
    if (gameState === 'prep') {
      setPrepCountdown(4);
      const interval = setInterval(() => {
        setPrepCountdown(c => Math.max(0, c - 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'word_selection') {
      setWordCountdown(10);
      const interval = setInterval(() => {
        setWordCountdown(c => Math.max(0, c - 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'turn_end') {
      setTurnEndCountdown(5);
      const interval = setInterval(() => {
        setTurnEndCountdown(c => Math.max(0, c - 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameState]);

  // Auto-advance prep stage after 4s (Host only)
  useEffect(() => {
    if (gameState === 'prep' && isHost) {
      const timer = setTimeout(() => {
        startRound();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [gameState, isHost]);

  // Auto-advance word selection stage after 10s (Host only)
  useEffect(() => {
    if (gameState === 'word_selection' && isHost) {
      const timer = setTimeout(() => {
        // Automatically select the first word option
        const options = stateToUse.wordOptions || [];
        const selected = options[0] || 'Apple';
        selectWord(selected);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [gameState, isHost, stateToUse.wordOptions]);

  // Auto-advance turn_end stage after 5s (Host only)
  useEffect(() => {
    if (gameState === 'turn_end' && isHost) {
      const timer = setTimeout(() => {
        proceedToNextTurn();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [gameState, isHost]);

  useEffect(() => { 
      if (gameState === 'drawing' && stateToUse.endTime) { 
        const timer = setInterval(() => { 
          const remaining = Math.max(0, Math.ceil((stateToUse.endTime - Date.now()) / 1000));
          setLocalTimeLeft(remaining);

          if (remaining === 0 && isDrawer) { 
             clearInterval(timer); 
             setPictionaryState(prev => ({ ...prev, gameState: 'turn_end', turnResult: 'time_up' })); 
          } 
        }, 100); 
        return () => clearInterval(timer); 
      } 
  }, [gameState, stateToUse.endTime, isDrawer, setPictionaryState]);

  const updateCanvasResolution = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect(); if (rect.width === 0) return;
    const ctx = canvas.getContext('2d');
    if (!canvas.dataset.initialized) { 
      canvas.width = rect.width; 
      canvas.height = rect.height; 
      canvas.dataset.initialized = 'true'; 
      saveStateToUndo(); 
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  };

  useEffect(() => { 
      if (gameState === 'drawing') updateCanvasResolution(); 
  }, [gameState]);
  
  // Sync Canvas fallback for re-joining or lag
  useEffect(() => {
    if (!isDrawer && currentCanvas && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = currentCanvas;
    }
  }, [currentCanvas, isDrawer]);

  // Realtime Drawing Sync
  const { sendData } = useCall();
  const sendDrawBroadcast = useBroadcast('pictionary_draw');
  const sendCursorBroadcast = useBroadcast('pictionary_cursor');
  const sendEmojiBroadcast = useBroadcast('pictionary_emoji');

  const isDrawerRef = useRef(isDrawer);
  const lastCursorSendRef = useRef(0);
  const batchedMovesRef = useRef([]);
  const batchTimerRef = useRef(null);
  useEffect(() => { isDrawerRef.current = isDrawer; }, [isDrawer]);

  // handleRemoteDraw MUST be defined before the useEffect that references it
  const handleRemoteDraw = useCallback((payload) => {
      if (isDrawerRef.current) return; 
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      
      const applyDraw = (p) => {
          const { x, y, type, color: pColor, tool: pTool, brushSize: pBrush } = p;
          
          if (type === 'clear') {
              ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
              return;
          }

          ctx.strokeStyle = pTool === 'eraser' ? '#ffffff' : (pColor || '#000000'); 
          ctx.lineWidth = pTool === 'eraser' ? (pBrush || 4) * 4 : (pBrush || 4); 
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';

          if (type === 'down') {
              ctx.beginPath();
              ctx.moveTo(x, y);
          } else if (type === 'move') {
              ctx.lineTo(x, y);
              ctx.stroke();
          } else if (type === 'fill') {
              floodFill(canvas, Math.floor(x), Math.floor(y), pColor || '#000000');
          }
      };

      if (payload.type === 'batch') {
          payload.moves.forEach(applyDraw);
      } else {
          applyDraw(payload);
      }
  }, []); // no deps — uses refs for isDrawer

  // Subscribe to Supabase broadcast for drawing
  useBroadcast('pictionary_draw', handleRemoteDraw);

  const sendDraw = useCallback((payload) => {
    const dataSent = typeof sendData === 'function'
      ? sendData({ type: 'pictionary_draw', ...payload })
      : false;
    if (!dataSent || payload.type === 'clear' || payload.type === 'fill') {
      if (payload.type === 'move') {
          batchedMovesRef.current.push(payload);
          if (!batchTimerRef.current) {
              batchTimerRef.current = setTimeout(() => {
                  sendDrawBroadcast({ type: 'batch', moves: batchedMovesRef.current });
                  batchedMovesRef.current = [];
                  batchTimerRef.current = null;
              }, 50); // Batch every 50ms (20fps fallback)
          }
      } else {
          sendDrawBroadcast(payload);
      }
    }
  }, [sendData, sendDrawBroadcast]);

  // Listen for P2P Data
  useEffect(() => {
    const handleData = (e) => {
      if (isDrawerRef.current) return;
      const { type, ...payload } = e.detail;
      if (type === 'pictionary_draw') {
        handleRemoteDraw(payload);
      }
    };
    window.addEventListener('webrtc_data', handleData);
    return () => window.removeEventListener('webrtc_data', handleData);
  }, [handleRemoteDraw]);

  const sendCursor = useCallback((x, y, show) => {
    const payload = { x, y, show: !!show };
    const dataSent = typeof sendData === 'function'
      ? sendData({ type: 'pictionary_cursor', ...payload })
      : false;
    if (!dataSent) sendCursorBroadcast(payload);
  }, [sendData, sendCursorBroadcast]);

  // Listen for partner cursor (P2P)
  useEffect(() => {
    const handleCursorData = (e) => {
      if (isDrawerRef.current) return;
      const { type, ...payload } = e.detail;
      if (type === 'pictionary_cursor') {
        setPartnerCursor({ ...payload, show: true });
      }
    };
    window.addEventListener('webrtc_data', handleCursorData);
    return () => window.removeEventListener('webrtc_data', handleCursorData);
  }, []);

  // Listen for partner cursor (Supabase broadcast)
  useBroadcast('pictionary_cursor', useCallback((payload) => {
      if (isDrawerRef.current) return;
      setPartnerCursor({ ...payload, show: true });
  }, []));

  useBroadcast('pictionary_emoji', (payload) => {
      setFloatingEmojis(p => [...p, { id: Date.now(), ...payload }]);
      setTimeout(() => { setFloatingEmojis(p => p.slice(1)); }, 2000);
  });

  const triggerGuesserEmoji = (emj) => {
      playAudio('click', sfx);
      const payload = { emj, left: Math.random() * 80 + 10, top: Math.random() * 80 + 10 };
      setFloatingEmojis(p => [...p, { id: Date.now(), ...payload }]);
      setTimeout(() => { setFloatingEmojis(p => p.slice(1)); }, 2000);
      sendEmojiBroadcast(payload);
  };

  const saveStateToUndo = () => { const canvas = canvasRef.current; if (!canvas) return; setUndoStack(prev => [...prev, canvas.toDataURL()]); };
  const handleUndo = () => {
    playAudio('click', sfx); if (undoStack.length <= 1) return; 
    const newStack = [...undoStack]; newStack.pop(); const previousState = newStack[newStack.length - 1];
    const canvas = canvasRef.current; const ctx = canvas.getContext('2d');
    const img = new Image(); img.onload = () => { ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(img, 0, 0); }; img.src = previousState;
    setUndoStack(newStack);
  };

  const getCoords = (e) => { const canvas = canvasRef.current; const rect = canvas.getBoundingClientRect(); const clientX = e.touches ? e.touches[0].clientX : e.clientX; const clientY = e.touches ? e.touches[0].clientY : e.clientY; return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) }; };

  const handlePointerDown = (e) => { 
      if (!isDrawer || gameState !== 'drawing') return; 
      const { x, y } = getCoords(e); 
      
      if (tool === 'fill') {
          floodFill(canvasRef.current, Math.floor(x), Math.floor(y), color);
          sendDraw({ type: 'fill', x, y, color });
          saveStateToUndo();
          return;
      }
      
      isDrawingRef.current = true; 
      const ctx = canvasRef.current.getContext('2d'); 
      ctx.beginPath(); ctx.moveTo(x, y); 
      sendDraw({ type: 'down', x, y, color, tool, brushSize });
      sendCursor(x, y, true);
  };

  const handlePointerMove = (e) => { 
      const rect = e.currentTarget.getBoundingClientRect();
      const fx = e.clientX - rect.left;
      const fy = e.clientY - rect.top;
      setFakeCursor({ x: fx, y: fy, show: true });

      const { x, y } = getCoords(e); 
      if (isDrawer) {
          const now = Date.now();
          if (now - lastCursorSendRef.current > 50) {
            lastCursorSendRef.current = now;
            sendCursor(x, y, true);
          }
          if (isDrawingRef.current && gameState === 'drawing') {
              const ctx = canvasRef.current.getContext('2d'); 
              ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color; 
              ctx.lineWidth = tool === 'eraser' ? brushSize * 4 : brushSize; 
              ctx.lineTo(x, y); ctx.stroke(); 
              sendDraw({ type: 'move', x, y, color, tool, brushSize });
          }
      }
  };

  const handlePointerUp = () => { 
      if(isDrawer && isDrawingRef.current) { 
          isDrawingRef.current = false; 
          saveStateToUndo(); 
          sendDraw({ type: 'up' });
          sendCursor(0, 0, false);

          const canvas = canvasRef.current;
          if (canvas) {
            setPictionaryState(prev => ({ ...prev, currentCanvas: canvas.toDataURL() }));
          }
      } 
  };
  const handleClear = () => { 
    if (isDrawer && window.confirm("Are you sure you want to clear the entire canvas?")) { 
        playAudio('click', sfx); 
        const canvas = canvasRef.current; 
        const ctx = canvas.getContext('2d'); 
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); 
        saveStateToUndo(); 
        sendDraw({ type: 'clear' });
    } 
  };

  const submitGuess = (e) => { 
      e.preventDefault(); 
      if (guess.toUpperCase() === word.toUpperCase()) { 
          onWin(); 
          if (canvasRef.current) setFinalImage(canvasRef.current.toDataURL()); 
          let pts = 1;
          if (localTimeLeft >= 80) pts = 2;

          const updatedScores = {
             ...(stateToUse.scores || {}),
             [userId]: ((stateToUse.scores || {})[userId] || 0) + pts
          };
          
          setScores(prev => incrementUserScore(prev, userId, 'pictionary', pts, myName || profile?.name || 'You'));
          proceedToNextTurn(updatedScores);
      } else { 
          playAudio('click', sfx); 
      } 
      setGuess(''); 
  };

  const handleGiveUp = () => {
    playAudio('click', sfx);
    setPictionaryState(prev => ({
       ...prev,
       gameState: 'turn_end',
       turnResult: 'gave_up'
    }));
  };

  const proceedToNextTurn = (updatedScores = null) => {
    playAudio('click', sfx);
    let nextRound = stateToUse.currentRound;
    let nextTurn = stateToUse.turn + 1;

    if (nextTurn > 2) {
      nextTurn = 1;
      nextRound += 1;
    }

    const scoresToUse = updatedScores || stateToUse.scores || {};

    if (nextRound > stateToUse.totalRounds) {
      setPictionaryState(prev => ({
        ...prev,
        scores: scoresToUse,
        gameState: 'game_over'
      }));
    } else {
      const nextDrawerId = nextTurn === 1 ? stateToUse.hostId : stateToUse.guestId;
      const wordOptions = getWordOptions();
      setPictionaryState(prev => ({
        ...prev,
        scores: scoresToUse,
        gameState: 'word_selection',
        currentRound: nextRound,
        turn: nextTurn,
        drawerId: nextDrawerId,
        wordOptions,
        word: '',
        displayWord: [],
        endTime: null,
        currentCanvas: null,
        turnResult: null
      }));
      setUndoStack([]);
    }
  };

  const useHint = () => {
    playAudio('click', sfx);
    const hidden = []; displayWord.forEach((char, i) => { if (char === '_') hidden.push(i); });
    if (hidden.length === 0) return;
    const rnd = hidden[hidden.length * Math.random() | 0];
    const newDisplay = [...displayWord];
    newDisplay[rnd] = word[rnd];
    
    setPictionaryState(prev => ({ ...prev, displayWord: newDisplay }));
    setScores(prev => incrementUserScore(prev, userId, 'pictionary', -1, myName || profile?.name || 'You'));
  };

  if (gameState === 'game_over') {
    const p1Id = stateToUse.hostId;
    const p2Id = stateToUse.guestId;
    const p1Score = stateToUse.scores?.[p1Id] || 0;
    const p2Score = stateToUse.scores?.[p2Id] || 0;

    let winnerId = null;
    if (p1Score > p2Score) winnerId = p1Id;
    else if (p2Score > p1Score) winnerId = p2Id;

    return (
      <RetroWindow title={`${myName || 'You'} vs ${partnerName || 'Partner'} - Game Over`} className="w-full max-w-md h-[calc(100dvh-4rem)] max-h-[600px]" onClose={onBack} confirmOnClose sfx={sfx}>
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
          <h2 className="text-3xl font-black mb-4 uppercase tracking-widest text-[var(--primary)]">
            {winnerId ? (winnerId === userId ? 'YOU WON! 🏆' : `${partnerName} WON! 🎉`) : 'IT\'S A TIE! 🤝'}
          </h2>
          <div className="bg-[var(--bg-main)] retro-border p-4 w-full mb-6 text-left">
            <p className="font-black text-xs uppercase opacity-60 mb-2 tracking-wider">Final Scores</p>
            <div className={`flex justify-between items-center mb-1 p-2 border-b-2 border-dashed border-[var(--border)] ${winnerId === p1Id ? 'bg-yellow-50 border-yellow-300' : 'bg-white'}`}>
               <span className="font-bold flex items-center gap-2">
                 {userId === p1Id ? 'You (P1)' : `${partnerName} (P1)`}
                 {winnerId === p1Id && '⭐'}
               </span>
               <span className="font-black text-[var(--secondary)] text-xl">{p1Score} pts</span>
            </div>
            <div className={`flex justify-between items-center p-2 border-b-2 border-dashed border-[var(--border)] ${winnerId === p2Id ? 'bg-yellow-50 border-yellow-300' : 'bg-white'}`}>
               <span className="font-bold flex items-center gap-2">
                 {userId === p2Id ? 'You (P2)' : `${partnerName} (P2)`}
                 {winnerId === p2Id && '⭐'}
               </span>
               <span className="font-black text-[var(--secondary)] text-xl">{p2Score} pts</span>
            </div>
          </div>

          <RetroButton className="w-full py-4 text-lg font-black uppercase tracking-widest" onClick={onBack}>
            Back to Arcade
          </RetroButton>
        </div>
      </RetroWindow>
    );
  }

  if (gameState === 'turn_end') {
    return (
      <RetroWindow title={`${myName || 'You'} vs ${partnerName || 'Partner'} - Turn Summary`} className="w-full max-w-md h-[calc(100dvh-4rem)] max-h-[600px]" onClose={onBack} confirmOnClose sfx={sfx}>
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
          <Brush size={48} className="text-[var(--primary)] mb-4 animate-bounce"/>
          <h2 className="text-2xl font-black mb-4 uppercase tracking-widest text-[var(--primary)]">
            {stateToUse.turnResult === 'guessed' ? 'Guessed Correctly! 🎉' : stateToUse.turnResult === 'gave_up' ? 'Gave Up! 🛑' : 'Time Up! ⏰'}
          </h2>
          <p className="text-lg font-bold mb-1">Secret Word: <span className="font-black text-[var(--secondary)] uppercase tracking-wider">{stateToUse.word}</span></p>
          <p className="font-bold opacity-70 text-sm mb-4">
            Round {stateToUse.currentRound} of {stateToUse.totalRounds} • Turn {stateToUse.turn}
          </p>

          <div className="bg-[var(--bg-main)] retro-border p-4 w-full mb-6 text-left">
            <p className="font-black text-xs uppercase opacity-60 mb-2 tracking-wider">Current Scores</p>
            <div className="flex justify-between items-center mb-1 bg-white p-2 border-b-2 border-dashed border-[var(--border)]">
               <span className="font-bold">{userId === stateToUse.hostId ? 'You (P1)' : `${partnerName} (P1)`}</span>
               <span className="font-black text-[var(--secondary)] text-xl">{stateToUse.scores?.[stateToUse.hostId] || 0} pts</span>
            </div>
            <div className="flex justify-between items-center bg-white p-2 border-b-2 border-dashed border-[var(--border)]">
               <span className="font-bold">{userId === stateToUse.guestId ? 'You (P2)' : `${partnerName} (P2)`}</span>
               <span className="font-black text-[var(--secondary)] text-xl">{stateToUse.scores?.[stateToUse.guestId] || 0} pts</span>
            </div>
          </div>

          <div className="text-xs font-bold opacity-60 mb-6 uppercase tracking-wider text-main-text/60 animate-pulse">
            Proceeding to next turn in {turnEndCountdown}s...
          </div>

          {isHost && (
            <RetroButton className="w-full py-4 text-lg font-black uppercase tracking-widest" onClick={proceedToNextTurn}>
              Proceed Now
            </RetroButton>
          )}
        </div>
      </RetroWindow>
    );
  }

  if (gameState === 'prep') {
    return (
      <RetroWindow title={`${myName || 'You'} vs ${partnerName || 'Partner'} - Pictionary`} className="w-full max-w-md h-[calc(100dvh-4rem)] max-h-[600px]" onClose={onBack} confirmOnClose sfx={sfx}>
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
          <Brush size={48} className="text-[var(--primary)] mb-4 animate-bounce"/>
          <h2 className="text-2xl font-black mb-1 uppercase tracking-widest text-[var(--primary)]">Pictionary</h2>
          <p className="font-bold opacity-80 mb-6 text-sm">
            {isDrawer ? "You are drawing this round" : `${partnerName} is drawing this round`}
          </p>
          <div className="w-full mb-6 bg-[var(--bg-main)] retro-border p-4 text-left">
             <p className="font-bold opacity-70 mb-1 text-xs">Category: {config.genre || config.category || 'General'}</p>
             <p className="font-bold opacity-70 text-xs">Timer: 90s per turn</p>
          </div>
          
          <div className="text-sm font-black text-[var(--primary)] animate-pulse mb-6">
            Starting in {prepCountdown}s...
          </div>
          
          {isHost && (
            <RetroButton className="w-full py-4 text-lg font-black uppercase tracking-widest" onClick={startRound}>
              Start Now
            </RetroButton>
          )}
        </div>
      </RetroWindow>
    );
  }

  if (gameState === 'word_selection') {
    return (
      <RetroWindow title={`${myName || 'You'} vs ${partnerName || 'Partner'} - Pictionary`} className="w-full max-w-md h-[calc(100dvh-4rem)] max-h-[600px]" onClose={onBack} confirmOnClose sfx={sfx}>
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
          <Brush size={48} className="text-[var(--primary)] mb-4 animate-bounce"/>
          <h2 className="text-2xl font-black mb-1 uppercase tracking-widest text-[var(--primary)]">Word Choice</h2>
          
          {isDrawer ? (
            <>
              <p className="font-bold opacity-80 mb-6 text-sm">Select a secret word to draw:</p>
              <div className="flex flex-col gap-4 w-full max-w-xs">
                {(stateToUse.wordOptions || []).map((w, i) => {
                   const colors = [
                     { bg: 'var(--primary)', text: 'var(--text-on-primary)' },
                     { bg: 'var(--secondary)', text: 'var(--text-on-secondary)' },
                     { bg: 'var(--accent)', text: 'var(--text-on-accent)' }
                   ];
                   const currentStyle = colors[i % colors.length];
                   return (
                     <button 
                       key={i} 
                       type="button"
                       onClick={() => selectWord(w)}
                       className="w-full py-3.5 px-6 text-lg font-black uppercase tracking-wider retro-border retro-shadow-dark transition-all hover:-translate-y-0.5 active:translate-y-[1px] active:shadow-none"
                       style={{ backgroundColor: currentStyle.bg, color: currentStyle.text }}
                     >
                       {w}
                     </button>
                   );
                })}
              </div>
              <div className="text-xs font-bold opacity-60 mt-6 uppercase tracking-wider text-main-text/60">
                Auto-selecting in {wordCountdown}s...
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <p className="font-bold opacity-80 text-sm">{partnerName || 'Partner'} is picking a word to draw...</p>
              <div className="loader mt-4 font-bold text-xs animate-pulse text-primary uppercase tracking-wider">Auto-selecting in {wordCountdown}s...</div>
            </div>
          )}
        </div>
      </RetroWindow>
    );
  }

  const hostScore = stateToUse.scores?.[stateToUse.hostId] || 0;
  const guestScore = stateToUse.scores?.[stateToUse.guestId] || 0;
  const myScore = isHost ? hostScore : guestScore;
  const partnerScore = isHost ? guestScore : hostScore;

  return (
    <RetroWindow title={`${myName || 'You'} vs ${partnerName || 'Partner'} - Pictionary`} className="w-full max-w-4xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col relative" onClose={onBack} confirmOnClose sfx={sfx} noPadding>
      <div className="bg-[var(--bg-header)] text-[var(--text-on-header)] border-b-2 border-[var(--border)] p-3 flex justify-between items-center font-bold text-xs sm:text-sm select-none">
         <div className={`flex items-center gap-2 px-3 py-1 bg-[var(--bg-window)] text-[var(--text-main)] retro-border shadow-inner font-mono ${localTimeLeft < 10 ? 'text-red-600 animate-pulse-fast border-red-500 bg-red-50' : ''}`}>
            <span className="text-sm sm:text-base">⏳</span>
            <span className="font-black text-xs sm:text-sm tracking-wider">{localTimeLeft}s</span>
         </div>
         
         <div className="flex items-center gap-2 sm:gap-4 bg-[var(--bg-window)] text-[var(--text-main)] px-3 sm:px-4 py-1.5 retro-border shadow-inner">
            <div className="flex items-center gap-1.5">
               <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[var(--primary)] shrink-0"></span>
               <span className="font-extrabold tracking-tight text-xs sm:text-sm">You: <span className="font-black text-[var(--primary)]">{myScore} pts</span></span>
            </div>
            <div className="w-px h-4 bg-[var(--border)]/20"></div>
            <div className="flex items-center gap-1.5">
               <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[var(--secondary)] shrink-0"></span>
               <span className="font-extrabold tracking-tight text-xs sm:text-sm">{partnerName || 'Partner'}: <span className="font-black text-[var(--secondary)]">{partnerScore} pts</span></span>
            </div>
         </div>

         {gameState === 'drawing' ? (
           <div className="flex items-center gap-2">
             <span className="px-2.5 py-1 bg-[var(--accent)] text-[var(--text-on-accent)] retro-border font-black text-[9px] sm:text-[10px] uppercase tracking-wider">
                {isDrawer ? 'Drawing' : 'Guessing'}
             </span>
             {isDrawer && <RetroButton variant="white" onClick={() => { setPictionaryState(prev => ({...prev, gameState: 'turn_end', turnResult: 'time_up'})); }} className={`px-2.5 py-0.5 text-[9px] sm:text-xs ${isTestMode() ? 'opacity-100 relative' : 'opacity-0 absolute pointer-events-none'}`}>Hand to Guesser</RetroButton>}
           </div>
         ) : (
           <span className="px-2.5 py-1 bg-[var(--accent)] text-[var(--text-on-accent)] retro-border font-black text-[9px] sm:text-[10px] uppercase tracking-wider">
              {isDrawer ? 'Waiting' : 'Guessing'}
           </span>
         )}
      </div>

      {gameState === 'drawing' && isDrawer && (
        <div className="p-3 bg-[var(--bg-main)] border-b-2 border-[var(--border)] flex flex-wrap gap-4 items-center select-none overflow-x-auto">
          {/* Main Visual Tool Toggles */}
          <div className="flex gap-2">
            <button onClick={() => setTool('pen')} className={`p-2 retro-border retro-shadow-dark transition-colors ${tool === 'pen' ? 'bg-[var(--accent)]' : 'bg-[var(--bg-window)]'}`} title="Pen Tool"><PenTool size={18}/></button>
            <button onClick={() => setTool('eraser')} className={`p-2 retro-border retro-shadow-dark transition-colors ${tool === 'eraser' ? 'bg-[var(--accent)]' : 'bg-[var(--bg-window)]'}`} title="Eraser Tool"><Eraser size={18}/></button>
            <button onClick={() => setTool('fill')} className={`p-2 retro-border retro-shadow-dark transition-colors ${tool === 'fill' ? 'bg-[var(--accent)]' : 'bg-[var(--bg-window)]'}`} title="Fill Tool"><PaintBucket size={18}/></button>
          </div>
          
          {/* Brush Size Slider */}
          <div className="flex items-center gap-1 mx-2 bg-[var(--bg-window)] px-2 py-1 rounded retro-border"><div className="w-1.5 h-1.5 bg-black rounded-full"></div><input type="range" min="1" max="20" value={brushSize} onChange={e=>setBrushSize(e.target.value)} className="w-16 accent-[var(--primary)]" /><div className="w-3.5 h-3.5 bg-black rounded-full"></div></div>
          
          {/* High-Contrast Palette Colors */}
          <div className="flex flex-wrap gap-1.5 bg-[var(--bg-window)] p-1.5 retro-border">
            {['#000000', '#808080', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffa500'].map(c => (
               <button 
                 key={c} 
                 onClick={() => { setColor(c); setTool('pen'); }} 
                 className={`w-5 h-5 retro-border flex-shrink-0 transition-transform ${color === c && tool !== 'eraser' ? 'scale-125 ring-2 ring-[var(--primary)]' : ''}`} 
                 style={{ backgroundColor: c }} 
               />
            ))}
          </div>
          
          {/* Classic Toolbar Buttons */}
          <div className="ml-auto flex gap-2">
              <button onClick={() => setGridEnabled(!gridEnabled)} className={`p-2 bg-[var(--bg-window)] retro-border retro-shadow-dark ${gridEnabled ? 'bg-[var(--accent)]' : ''}`} title="Toggle Tracing Grid"><Grid size={16}/></button>
              <button onClick={handleUndo} disabled={undoStack.length <= 1} className="p-2 bg-[var(--bg-window)] retro-border retro-shadow-dark active:scale-95 disabled:opacity-50" title="Undo"><Undo2 size={16}/></button>
              <button onClick={handleClear} className="p-2 bg-[var(--bg-window)] retro-border retro-shadow-dark text-red-600 active:scale-95" title="Clear Canvas"><Trash2 size={16}/></button>
          </div>
        </div>
      )}

      <div 
        className={`flex-1 relative touch-none select-none ${gridEnabled ? 'bg-pattern-grid' : ''} overflow-hidden cursor-none`} 
        style={{ backgroundColor: '#ffffff' }}
        onPointerMove={handlePointerMove} 
        onPointerDown={handlePointerDown} 
        onPointerUp={handlePointerUp}
        onPointerLeave={() => setFakeCursor(p => ({ ...p, show: false }))}
        onPointerEnter={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setFakeCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top, show: true });
        }}
      >
        <canvas ref={canvasRef} onMouseDown={handlePointerDown} onMouseMove={handlePointerMove} onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp} onTouchStart={handlePointerDown} onTouchMove={handlePointerMove} onTouchEnd={handlePointerUp} className="absolute inset-0 w-full h-full bg-transparent" />
        
        {/* Local Custom Brush Cursor */}
        {fakeCursor.show && isDrawer && (
          <div 
            className="absolute pointer-events-none z-[100] transform -translate-x-1/2 -translate-y-1/2" 
            style={{ left: `${fakeCursor.x}px`, top: `${fakeCursor.y}px` }}
          >
            <div 
              className="rounded-full border border-black bg-transparent"
              style={{
                width: `${Math.max(6, brushSize * (tool === 'eraser' ? 4 : 1))}px`,
                height: `${Math.max(6, brushSize * (tool === 'eraser' ? 4 : 1))}px`,
                boxShadow: '0 0 0 1px white'
              }}
            ></div>
          </div>
        )}

        {/* Partner Cursor */}
        {partnerCursor.show && !isDrawer && (
          <div className="absolute pointer-events-none z-[100] transition-all duration-75" style={{ left: partnerCursor.x, top: partnerCursor.y }}>
            <PenTool size={16} className="text-[var(--primary)] -scale-x-100" />
            <div className="bg-[var(--primary)] text-white text-[8px] font-black px-1 rounded-sm -mt-1 ml-4 uppercase whitespace-nowrap shadow-sm border border-white/50">{partnerName}</div>
          </div>
        )}

        {floatingEmojis.map(e => (
            <div key={e.id} className="absolute text-4xl animate-float-up pointer-events-none select-none z-50 drop-shadow-lg" style={{ left: `${e.left}%`, top: `${e.top}%` }}>{e.emj}</div>
        ))}
      </div>

      {isDrawer && (
        <div className="p-4 bg-[var(--accent)] text-[var(--text-on-accent)] retro-border-t flex flex-wrap justify-center items-center gap-6 sm:gap-8 shadow-md">
            <div className="text-center">
                <p className="text-[10px] font-black opacity-55 uppercase tracking-[0.2em] mb-1">Secret Word</p>
                <div className="text-xl sm:text-2xl font-black tracking-widest uppercase text-[var(--primary)]">{word}</div>
            </div>
            <div className="w-px h-8 bg-current opacity-20 hidden sm:block"></div>
            <div className="text-center">
                <p className="text-[10px] font-black opacity-55 uppercase tracking-[0.2em] mb-1">Guesser's Progress</p>
                <div className="text-xl sm:text-2xl font-black tracking-[0.3em] uppercase text-[var(--text-on-accent)]">{displayWord.join(' ')}</div>
            </div>
            <div className="w-px h-8 bg-current opacity-20 hidden sm:block"></div>
            <RetroButton onClick={useHint} className="px-4 py-2 text-xs font-bold uppercase tracking-wider" variant="white">
               Hint (-1 pt)
            </RetroButton>
        </div>
      )}

      {!isDrawer && (
        <div className="p-4 sm:p-5 bg-[var(--bg-window)] text-[var(--text-main)] retro-border-t shadow-lg">
          <div className="flex flex-col gap-4 max-w-2xl mx-auto">
            {/* Word progress indicator */}
            <div className="flex items-center justify-between px-3 py-2 bg-[var(--bg-main)] text-[var(--text-main)] retro-border shadow-inner">
               <span className="font-extrabold text-[11px] sm:text-xs uppercase opacity-70 tracking-widest">Secret Word Progress</span>
               <span className="font-black text-base sm:text-xl tracking-[0.4em] text-[var(--primary)] uppercase select-none">{displayWord.join(' ')}</span>
            </div>

            {/* Chat Compose Box style typing area */}
            <form onSubmit={submitGuess} className="flex items-center gap-2 w-full">
                <div className="flex-1 relative flex items-center bg-[var(--bg-window)] text-[var(--text-main)] retro-border shadow-inner px-3 py-1 min-h-[44px]">
                    <span className="text-[var(--text-muted)] mr-2 select-none shrink-0"><Smile size={18} /></span>
                    <input 
                      type="text" 
                      value={guess} 
                      onChange={e=>setGuess(e.target.value)} 
                      placeholder="Type your guess here..." 
                      className="w-full bg-transparent focus:outline-none uppercase font-black text-sm sm:text-base tracking-widest text-[var(--text-main)] placeholder-[var(--text-muted)]/50 py-1" 
                      autoFocus 
                    />
                </div>
                <RetroButton type="submit" className="px-6 h-[44px] text-xs sm:text-sm uppercase tracking-wider font-black">
                   Guess
                </RetroButton>
                <RetroButton type="button" onClick={handleGiveUp} variant="white" className="px-4 h-[44px] text-xs sm:text-sm whitespace-nowrap uppercase tracking-wider font-black">
                   Give Up
                </RetroButton>
            </form>

            {/* Emoji Reactions grid */}
            <div className="bg-[var(--bg-main)] retro-border p-3 flex flex-col gap-2.5">
                <p className="text-[10px] font-black opacity-60 uppercase tracking-[0.2em] mb-0.5">Send drawing reaction</p>
                <div className="flex flex-wrap gap-2">
                   {['👍', '🤣', '👎', '❤️', '🔥', '👀'].map(emj => (
                      <button 
                        key={emj} 
                        type="button"
                        onClick={() => triggerGuesserEmoji(emj)} 
                        className="w-10 h-10 flex items-center justify-center text-xl hover:scale-110 active:translate-y-[1px] active:shadow-none transition-all bg-[var(--bg-window)] text-[var(--text-main)] retro-border retro-shadow-dark"
                      >
                        {emj}
                      </button>
                   ))}
                </div>
            </div>
          </div>
        </div>
      )}
    </RetroWindow>
  );
}
