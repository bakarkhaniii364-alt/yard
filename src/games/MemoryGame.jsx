import React, { useState, useEffect, useRef } from 'react';
import { RetroWindow, RetroButton, ShareOutcomeOverlay } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { getScore } from '../utils/helpers.js';
import { incrementUserScore } from '../utils/userDataHelpers.js';
import { Star, RefreshCw, Eye, Lightbulb, Image as ImageIcon } from 'lucide-react';
import { useAssetSync } from '../hooks/useAssetSync.js';
import { useGlobalSync } from '../hooks/useSupabaseSync.js';

const DECKS = {
    emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔'],
    animals: ['🦅','🦆','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🐢'],
    food: ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🍈','🍒','🍑','🥭','🍍','🥥','🥝']
};

export function MemoryGame({ config, setScores, onBack, sfx, onWin, onShareToChat, onSaveToScrapbook, profile, myName, userId, partnerId, isHost, roomId, partnerName }) {
  const { assets } = useAssetSync(roomId || 'global', 'scrapbook');
  
  const isRemoteCompetitive = config?.mode === 'competitive' && roomId && partnerId;

  // Shared remote state for competitive multiplayer
  const [remoteState, setRemoteState] = useGlobalSync(`memory_${roomId}`, null);

  const [cards, setCards] = useState([]); 
  const [flipped, setFlipped] = useState([]); 
  
  // For solo/coop: local solved. For remote: use remoteState.solved
  const [localSolved, setLocalSolved] = useState([]); 
  const solved = isRemoteCompetitive ? (remoteState?.solved || []) : localSolved;
  const setSolved = isRemoteCompetitive
    ? (fn) => {
        const newSolved = typeof fn === 'function' ? fn(remoteState?.solved || []) : fn;
        setRemoteState({ ...(remoteState || {}), solved: newSolved });
      }
    : setLocalSolved;

  const [disabled, setDisabled] = useState(false); 
  
  // Turns: 1 = player 1 (host), 2 = player 2 (guest). 
  // In remote: synced via remoteState. Locally: useState for solo.
  const [localTurn, setLocalTurn] = useState(1);
  const turn = isRemoteCompetitive ? (remoteState?.turn || 1) : localTurn;
  
  const [localP1Score, setLocalP1Score] = useState(0);
  const [localP2Score, setLocalP2Score] = useState(0);
  const p1Score = isRemoteCompetitive ? (remoteState?.p1Score || 0) : localP1Score;
  const p2Score = isRemoteCompetitive ? (remoteState?.p2Score || 0) : localP2Score;
  
  // Determine if it's my turn in remote mode
  const myTurnNum = isRemoteCompetitive ? (isHost ? 1 : 2) : turn;
  const isMyTurn = !isRemoteCompetitive || turn === myTurnNum;
  
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  
  const [peekAvailable, setPeekAvailable] = useState(2);
  const [flashlightMode, setFlashlightMode] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [combo, setCombo] = useState(1);
  const [gameOverOverlay, setGameOverOverlay] = useState(false);

  // Sync solved/turn from remote when they change
  useEffect(() => {
    if (isRemoteCompetitive && remoteState?.solved && remoteState?.cards && cards.length === 0) {
      // Load shared cards from remote state (host initialized them)
      setCards(remoteState.cards);
      setTimerActive(true);
    }
  }, [isRemoteCompetitive, remoteState?.solved, remoteState?.cards, cards.length]);

  useEffect(() => { 
    if (!isRemoteCompetitive) shuffleCards(); 
  }, [config.diff, config.category, isRemoteCompetitive]);
  
  // Host initializes shared cards in remote mode
  useEffect(() => {
    if (isRemoteCompetitive && isHost && !remoteState) {
      shuffleCards(true);
    }
  }, [isRemoteCompetitive, isHost, remoteState]);
  
  useEffect(() => {
     let interval = null;
     if (timerActive) interval = setInterval(() => setTime(t => t+1), 1000);
     else clearInterval(interval);
     return () => clearInterval(interval);
  }, [timerActive]);

  const shuffleCards = (publishRemote = false) => { 
      const fallbackDeck = DECKS[config.category] || DECKS.emojis;
      const pairCount = config.diff === 'easy' ? 8 : config.diff === 'medium' ? 12 : 16;
      
      const useScrapbook = assets && assets.length >= 8;
      const baseDeck = useScrapbook ? assets.slice(0, pairCount).map(a => ({ content: a.url, isImage: true })) : fallbackDeck.slice(0, pairCount).map(e => ({ content: e, isImage: false }));

      const shuffled = [...baseDeck, ...baseDeck]
          .sort(() => Math.random() - 0.5)
          .map((item, id) => ({ id, ...item })); 

      setCards(shuffled); setFlipped([]); setLocalSolved([]); setLocalTurn(1); setLocalP1Score(0); setLocalP2Score(0); setMoves(0); setTime(0); setTimerActive(true); setCombo(1); setPeekAvailable(2); setGameOverOverlay(false);
      
      if (publishRemote && isRemoteCompetitive) {
        setRemoteState({ cards: shuffled, solved: [], turn: 1, p1Score: 0, p2Score: 0 });
      }
  };


  const handleCardClick = (index) => {
    if (disabled || flipped.length >= 2 || flipped.includes(index) || solved.includes(index)) return;
    // Block clicks when not my turn in remote competitive
    if (isRemoteCompetitive && !isMyTurn) return;
    playAudio('click', sfx);
    const newFlipped = [...flipped, index]; 
    setFlipped(newFlipped);
    
    if (newFlipped.length === 2) {
      setMoves(m => m+1);
      setDisabled(true); 
      const match = cards[newFlipped[0]].content === cards[newFlipped[1]].content;
      
      setTimeout(() => {
        if (match) {
          playAudio('win', sfx);
          const newSolved = [...solved, ...newFlipped]; 
          
          let pointsEarned = 1 * combo;
          const newP1 = turn === 1 ? p1Score + pointsEarned : p1Score;
          const newP2 = turn === 2 ? p2Score + pointsEarned : p2Score;
          setCombo(c => c+1);

          if (isRemoteCompetitive) {
            // Push full update to remote
            setRemoteState({ ...remoteState, solved: newSolved, p1Score: newP1, p2Score: newP2 });
          } else {
            setLocalSolved(newSolved);
            if (config.mode === 'competitive') {
              turn === 1 ? setLocalP1Score(newP1) : setLocalP2Score(newP2);
            }
          }
            
          if (newSolved.length === cards.length) { 
            setTimerActive(false);
            setScores(prev => incrementUserScore(prev, userId, 'memory', 1, myName || profile?.name || 'You')); 
            onWin(); 
            setTimeout(() => setGameOverOverlay(true), 1500);
          }
        } else { 
            setCombo(1);
            if (isRemoteCompetitive) {
              const nextTurn = turn === 1 ? 2 : 1;
              setRemoteState({ ...remoteState, turn: nextTurn });
            } else if (config.mode === 'competitive') {
              setLocalTurn(turn === 1 ? 2 : 1);
            }
        }
        setFlipped([]); setDisabled(false);
      }, 800);
    }
  };

  const usePeek = () => {
      if (peekAvailable <= 0 || disabled) return;
      playAudio('click', sfx);
      setPeekAvailable(p => p - 1);
      const unsolved = cards.map((_, i) => i).filter(i => !solved.includes(i));
      setFlipped(unsolved);
      setDisabled(true);
      setTimeout(() => { setFlipped([]); setDisabled(false); }, 1000);
  };

  const handleMouseMove = (e) => {
      if (!flashlightMode) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.pageX || e.clientX) - (rect.left + window.scrollX);
      const y = (e.pageY || e.clientY) - (rect.top + window.scrollY);
      setMousePos({ x, y });
  };



  const gridCols = config.diff === 'easy' ? 'grid-cols-4' : config.diff === 'medium' ? 'grid-cols-4 sm:grid-cols-6' : 'grid-cols-4 sm:grid-cols-8';
  const cardSize = config.diff === 'easy' ? 'w-16 h-20 sm:w-20 sm:h-24 text-3xl sm:text-4xl' : config.diff === 'medium' ? 'w-12 h-16 sm:w-16 sm:h-20 text-2xl sm:text-3xl' : 'w-10 h-14 sm:w-14 sm:h-16 text-xl sm:text-2xl';

  return (
    <>
    <RetroWindow title={`memory_${config.mode || 'solo'}.exe`} className="w-full max-w-4xl h-[calc(100dvh-4rem)] max-h-[850px] relative" onClose={onBack} confirmOnClose sfx={sfx} noPadding>
      
      <div className="bg-[var(--border)] text-[var(--bg-window)] p-2 flex justify-between items-center font-bold px-4 z-10 relative">
         <span>⏱️ {Math.floor(time/60)}:{(time%60).toString().padStart(2, '0')}</span>
         <span className="opacity-70 text-sm">Moves: {moves}</span>
      </div>
      
      <div className="p-2 retro-bg-accent retro-border-b flex justify-between items-center z-10 relative">
          <div className="flex gap-2">
              <button disabled={peekAvailable<=0 || disabled} onClick={usePeek} className="text-xs retro-bg-window text-[var(--text-main)] p-1 px-2 retro-border rounded flex items-center gap-1 disabled:opacity-50"><Eye size={12}/> Peek ({peekAvailable})</button>
              <button onClick={() => setFlashlightMode(f=>!f)} className={`text-xs retro-bg-window text-[var(--text-main)] p-1 px-2 retro-border rounded flex items-center gap-1 ${flashlightMode ? 'ring-2 ring-yellow-400' : ''}`}><Lightbulb size={12}/> Flashlight</button>
          </div>
          <div className="font-bold text-[var(--primary)] mr-2 flex items-center gap-1">Combo: {combo}x {combo>1 && <span className="animate-bounce">🔥</span>}</div>
      </div>

      <div className="flex flex-col items-center pb-8 pt-4 flex-1 overflow-y-auto relative" onMouseMove={handleMouseMove} onTouchMove={(e)=>handleMouseMove(e.touches[0])}>
        
        {flashlightMode && (
             <div className="absolute inset-0 pointer-events-none z-20" style={{
                 background: `radial-gradient(circle 250px at ${mousePos.x}px ${mousePos.y}px, transparent 0%, #000000ee 100%)`, 
                 opacity: 0.95
             }}></div>
        )}

        <div className={`flex w-full justify-between items-center px-4 sm:px-8 mb-6 font-bold text-xs sm:text-base z-30 ${flashlightMode ? 'opacity-40' : 'opacity-100'}`}>
            {config.mode === 'competitive' ? (
                <>
                <div className={`p-2 px-4 transition-all duration-300 ${turn === 1 ? 'retro-bg-primary scale-110' : 'retro-bg-window opacity-70'} retro-border`}>
                  {isRemoteCompetitive ? (isHost ? '⚡ You' : 'Partner') : 'P1'}: {p1Score}
                </div>
                {isRemoteCompetitive && <div className={`text-xs font-black uppercase px-2 ${isMyTurn ? 'text-green-600 animate-pulse' : 'opacity-40'}`}>{isMyTurn ? 'YOUR TURN' : 'WAIT...'}</div>}
                <div className={`p-2 px-4 transition-all duration-300 ${turn === 2 ? 'retro-bg-secondary scale-110' : 'retro-bg-window opacity-70'} retro-border`}>
                  {isRemoteCompetitive ? (!isHost ? '⚡ You' : 'Partner') : 'P2'}: {p2Score}
                </div>
                </>
            ) : ( <div className="text-center w-full opacity-60">Team Effort</div>)}
        </div>
        
        <div className={`grid ${gridCols} gap-2 sm:gap-3 z-10 px-2`}>
          {cards.map((card, i) => { 
            const isFlipped = flipped.includes(i) || solved.includes(i); 
            return (
                <div key={i} onClick={() => handleCardClick(i)} className={`${cardSize} cursor-pointer`} style={{ perspective: '600px' }}>
                    <div className={`relative w-full h-full preserve-3d transition-transform duration-500 ${isFlipped ? 'rotate-y-180' : ''} ${solved.includes(i) ? 'opacity-40 grayscale' : ''}`}>
                        {/* FRONT — card back (star pattern, visible when NOT flipped) */}
                        <div className="absolute inset-0 backface-hidden retro-border retro-shadow-dark flex items-center justify-center hover:-translate-y-1 transition-transform" style={{ backgroundColor: 'var(--secondary)' }}>
                            <div className="absolute inset-2 border-2 border-dashed opacity-30 rounded-sm" style={{ borderColor: 'var(--bg-window)' }}></div>
                            <Star size={24} style={{ color: 'var(--bg-window)', opacity: 0.6 }}/>
                        </div>
                        {/* BACK — card face (content, visible when flipped) */}
                        <div className="absolute inset-0 backface-hidden rotate-y-180 retro-border flex items-center justify-center overflow-hidden" style={{ backgroundColor: 'var(--bg-window)' }}>
                            {card.isImage ? (
                                <img src={card.content} alt="memory" className="w-full h-full object-cover" />
                            ) : (
                                <span>{card.content}</span>
                            )}
                        </div>
                    </div>
                </div>
            ); 
          })}
        </div>
        <RetroButton className="mt-8 px-6 sm:px-8 py-3 text-sm sm:text-base z-30 relative" onClick={() => {playAudio('click', sfx); shuffleCards()}}><RefreshCw size={16} className="inline mr-2" /> restart memory</RetroButton>
      </div>

    </RetroWindow>

    {gameOverOverlay && (() => {
      const outcomeStats = {
          "Time": `${Math.floor(time/60)}:${(time%60).toString().padStart(2, '0')}`,
          "Total Moves": moves,
          "Max Combo": `${combo}x`
      };
      if (config.mode === 'competitive') { outcomeStats["Final Score"] = `${p1Score} - ${p2Score}`; outcomeStats.Winner = p1Score > p2Score ? 'P1 Wins!' : p2Score > p1Score ? 'P2 Wins!' : 'Draw!'; }
      else { outcomeStats.Result = "Team Victory!"; }
      return (
        <ShareOutcomeOverlay
          isSolo={(typeof config !== "undefined" && config?.mode === "solo") || (typeof mode !== "undefined" && mode === "solo") || (typeof gameMode !== "undefined" && gameMode === "solo") || (typeof config !== "undefined" && config?.mode === "practice")}
          gameName={`Memory Match`}
          stats={outcomeStats}
          onClose={() => {shuffleCards(); onBack();}}
          onShareToChat={onShareToChat}
          onSaveToScrapbook={onSaveToScrapbook}
          sfx={sfx}
          profile={profile}
          partnerNickname={profile?.partnerNickname}
          onRematch={shuffleCards}
        />
      );
    })()}
    </>
  );
}
