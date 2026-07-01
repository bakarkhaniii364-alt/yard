import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RetroWindow, RetroButton, ShareOutcomeOverlay } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { useGlobalSync, useBroadcast } from '../hooks/useSupabaseSync.js';
import { Keyboard } from 'lucide-react';
import { incrementUserScore } from '../utils/userDataHelpers.js';

const PASSAGES = [
  "I love you without knowing how, or when, or from where. I love you simply, without problems or pride.",
  "Whatever our souls are made of, his and mine are the same. He's more myself than I am.",
  "I have died every day waiting for you. Darling, don't be afraid I have loved you for a thousand years.",
  "You have bewitched me, body and soul, and I love, I love, I love you. I never wish to be parted from you.",
  "I saw that you were perfect, and so I loved you. Then I saw that you were not perfect and I loved you even more.",
  "In all the world, there is no heart for me like yours. In all the world, there is no love for you like mine.",
  "You are my heart, my life, my one and only thought. I love you more than words can express.",
  "Grow old along with me! The best is yet to be, the last of life, for which the first was made.",
];

export function TypingRace({ config, setScores, onBack, sfx, onWin, onShareToChat, profile, myName, userId, partnerId, isHost, roomId, partnerName }) {
  const isMultiplayer = !!(roomId && partnerId);

  // Shared passage selection (host picks)
  const [syncState, setSyncState] = useGlobalSync(`typing_${roomId}`, null);

  const [partnerProgress, setPartnerProgress] = useState({ wpm: 0, progress: 0, finished: false });
  
  // State ref for broadcast listener
  const progressStateRef = useRef({ userId, isMultiplayer, setPartnerProgress });
  useEffect(() => {
    progressStateRef.current = { userId, isMultiplayer, setPartnerProgress };
  }, [userId, isMultiplayer]);
  
  // Broadcast listener for incoming progress
  useEffect(() => {
    if (!isMultiplayer) return;
    const handleIncomingProgress = (payload) => {
      const state = progressStateRef.current;
      if (payload.sender !== state.userId) {
        state.setPartnerProgress({ wpm: payload.wpm, progress: payload.progress, finished: payload.finished });
      }
    };
    
    window.addEventListener(`broadcast_typing_progress_${roomId}`, (e) => handleIncomingProgress(e.detail));
    return () => window.removeEventListener(`broadcast_typing_progress_${roomId}`, handleIncomingProgress);
  }, [isMultiplayer, roomId, userId]);
  
  // Broadcast live progress (WPM + progress %) - transient, not persisted
  const sendProgress = useBroadcast(`typing_progress_${roomId}`, () => {
    // Listener callback - broadcast channel setup
  });

  // Initialize: host picks passage
  useEffect(() => {
    if (isMultiplayer && isHost && !syncState) {
      const passage = PASSAGES[Math.floor(Math.random() * PASSAGES.length)];
      setSyncState({ passage, startedAt: null, winner: null });
    }
  }, [isMultiplayer, isHost, syncState]);

  const [localPassage, setLocalPassage] = useState(() => PASSAGES[Math.floor(Math.random() * PASSAGES.length)]);
  const passage = isMultiplayer ? (syncState?.passage || '') : localPassage;

  const [typed, setTyped] = useState('');
  const [started, setStarted] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [errors, setErrors] = useState(0);
  const [showOverlay, setShowOverlay] = useState(false);
  const inputRef = useRef(null);
  const lastBroadcast = useRef(0);

  useEffect(() => { inputRef.current?.focus(); }, [passage]);

  // Broadcast my progress every 500ms
  const broadcastProgress = useCallback((typedVal, isFinished = false) => {
    const now = Date.now();
    if (!isMultiplayer || now - lastBroadcast.current < 400) return;
    lastBroadcast.current = now;
    const elapsed = startTime ? (now - startTime) / 60000 : 0.001;
    const wpm = elapsed > 0 ? Math.round((typedVal.split(' ').length / elapsed)) : 0;
    const progress = Math.round((typedVal.length / passage.length) * 100);
    sendProgress({ sender: userId, wpm, progress, finished: isFinished });
  }, [isMultiplayer, startTime, passage, userId, sendProgress]);

  const handleInput = useCallback((e) => {
    if (!passage) return;
    const val = e.target.value;
    if (!started) {
      setStarted(true);
      setStartTime(Date.now());
      if (isMultiplayer && isHost && syncState && !syncState.startedAt) {
        setSyncState({ ...syncState, startedAt: Date.now() });
      }
    }

    let newErrors = 0;
    for (let i = 0; i < val.length; i++) { if (val[i] !== passage[i]) newErrors++; }
    setErrors(newErrors);
    setTyped(val);
    broadcastProgress(val, false);

    if (val === passage) {
      const end = Date.now();
      setEndTime(end);
      playAudio('win', sfx);
      onWin?.();
      broadcastProgress(val, true);
      if (isMultiplayer && !syncState?.winner) {
        setSyncState({ ...syncState, winner: userId, finishedAt: end });
      }
      if (setScores) setScores(prev => incrementUserScore(prev, userId, 'typing', wpm, myName || profile?.name || 'You'));
      setTimeout(() => setShowOverlay(true), 500);
    }
  }, [passage, started, sfx, onWin, broadcastProgress, isMultiplayer, isHost, syncState, userId, setSyncState]);

  // Detect partner winning
  useEffect(() => {
    if (isMultiplayer && syncState?.winner && syncState.winner !== userId && !endTime) {
      setTimeout(() => setShowOverlay(true), 800);
    }
  }, [syncState?.winner, userId, isMultiplayer, endTime]);

  const wpm = endTime && startTime ? Math.round((passage.split(' ').length / Math.max(0.0001, (endTime - startTime) / 60000))) : (started && startTime ? Math.round((typed.split(' ').length / Math.max(0.0001, (Date.now() - startTime) / 60000))) : 0);
  const accuracy = typed.length > 0 ? Math.round(((typed.length - errors) / typed.length) * 100) : 100;
  const progress = Math.min(100, Math.round((typed.length / (passage.length || 1)) * 100));

  const restart = () => { setTyped(''); setStarted(false); setStartTime(null); setEndTime(null); setErrors(0); setShowOverlay(false); if (isMultiplayer && isHost) setSyncState({ passage: PASSAGES[Math.floor(Math.random() * PASSAGES.length)], startedAt: null, winner: null }); else setLocalPassage(PASSAGES[Math.floor(Math.random() * PASSAGES.length)]); inputRef.current?.focus(); };

  const iWon = endTime && (!isMultiplayer || syncState?.winner === userId);
  const partnerWon = isMultiplayer && syncState?.winner === partnerId;



  // Waiting for host to initialize passage
  if (isMultiplayer && !syncState?.passage) {
    return (
      <div className="flex flex-col items-center justify-center p-8 h-full">
        <Keyboard size={48} className="animate-pulse mb-4 opacity-50"/>
        <div className="font-black text-xl uppercase animate-pulse">{isHost ? 'Setting up race...' : 'Waiting for partner...'}</div>
      </div>
    );
  }

  return (
    <>
    <RetroWindow title="typing_race.exe" className="w-full max-w-2xl h-[calc(100dvh-4rem)] max-h-[700px]" onClose={onBack} confirmOnClose sfx={sfx} noPadding>
      <div className="bg-border text-window p-2 px-4 flex justify-between font-bold text-sm">
        <span><Keyboard size={14} className="inline mr-1"/> WPM: {wpm}</span>
        <span>Accuracy: {accuracy}%</span>
        {isMultiplayer && <span className="text-xs opacity-70">Partner: {partnerProgress.wpm} WPM ({partnerProgress.progress}%)</span>}
      </div>

      {/* My progress bar */}
      <div className="w-full h-2 bg-main relative">
        <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }}></div>
        {isMultiplayer && (
          <div className="absolute top-0 h-full bg-secondary/40 transition-all" style={{ width: `${partnerProgress.progress}%` }}></div>
        )}
      </div>

      {isMultiplayer && (
        <div className="flex text-[10px] font-bold px-4 py-1 bg-window border-b border-border">
          <span className="flex-1 text-primary">You: {progress}%</span>
          <span className="flex-1 text-right text-secondary">Partner: {partnerProgress.progress}%</span>
        </div>
      )}

      <div className="flex-1 p-6 flex flex-col gap-6">
        <div className="border-2 border-border shadow-retro p-6 bg-main font-mono text-lg sm:text-xl leading-relaxed tracking-wide select-none">
          {passage.split('').map((char, i) => {
            let color = 'opacity-40';
            if (i < typed.length) { color = typed[i] === char ? 'text-primary font-bold' : 'text-[var(--color-destructive)] bg-red-100 font-bold'; }
            else if (i === typed.length) { color = 'bg-accent text-main-text font-bold animate-pulse'; }
            return <span key={i} className={color}>{char}</span>;
          })}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={typed}
          onChange={handleInput}
          disabled={!!endTime || partnerWon}
          autoFocus
          onPaste={(e) => e.preventDefault()}
          onDrop={(e) => e.preventDefault()}
          autoComplete="off"
          className="w-full p-4 border-2 border-border bg-window text-main-text font-mono text-lg focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder={started ? '' : 'Start typing to begin the race...'}
        />
        {partnerWon && !endTime && (
          <div className="text-center font-black text-secondary animate-bounce">Partner finished first! 🏆</div>
        )}
        <div className="flex justify-between text-sm font-bold opacity-60">
          <span>Progress: {progress}%</span>
          <span>Errors: {errors}</span>
        </div>
      </div>
    </RetroWindow>

    {showOverlay && (
      <ShareOutcomeOverlay
        isSolo={!isMultiplayer}
        gameName="Typing Race"
        outcome={isMultiplayer ? (iWon ? 'win' : 'loss') : undefined}
        stats={{
          WPM: wpm,
          Accuracy: `${accuracy}%`,
          Time: endTime && startTime ? `${((endTime - startTime) / 1000).toFixed(1)}s` : '—',
          ...(isMultiplayer ? { 'Partner WPM': partnerProgress.wpm, Result: iWon ? '🏆 You Won!' : '🥈 Partner Won!' } : {})
        }}
        onClose={() => { restart(); onBack(); }}
        onRematch={restart}
        onShareToChat={onShareToChat}
        sfx={sfx}
        profile={profile}
      />
    )}
    </>
  );
}
