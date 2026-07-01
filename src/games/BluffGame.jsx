import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RetroWindow, RetroButton, ShareOutcomeOverlay } from '../components/UI.jsx';
import { useGlobalSync, useBroadcast } from '../hooks/useSupabaseSync.js';
import { playAudio } from '../utils/audio.js';

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const generateId = () => Math.random().toString(36).substring(2, 9);

const createDeck = () => {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: generateId(), suit, rank, color: (suit === '♥' || suit === '♦') ? 'red' : 'black' });
    }
  }
  return deck.sort(() => Math.random() - 0.5);
};

const CardUI = ({ card, onClick, selected, hidden = false }) => {
  if (hidden) {
    return (
      <div className="w-16 h-24 sm:w-20 sm:h-32 bg-[var(--border)] retro-border border-4 rounded-md flex items-center justify-center retro-shadow-dark shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] bg-pattern-grid">
         <div className="w-8 h-8 rounded-full border-2 border-[var(--bg-window)] flex items-center justify-center">
            <span className="font-black text-[var(--bg-window)] text-xs rotate-45">?</span>
         </div>
      </div>
    );
  }

  return (
    <div 
      onClick={onClick}
      className={`w-16 h-24 sm:w-20 sm:h-32 bg-white retro-border border-4 rounded-md flex flex-col relative select-none transition-transform cursor-pointer ${selected ? '-translate-y-4 retro-shadow-dark ring-2 ring-[var(--primary)]' : 'hover:-translate-y-2'}`}
    >
      <div className={`absolute top-1 left-1 font-black text-[10px] sm:text-xs leading-none ${card.color === 'red' ? 'text-red-600' : 'text-black'}`}>
          <div>{card.rank}</div>
          <div>{card.suit}</div>
      </div>
      <div className={`flex-1 flex items-center justify-center font-black text-3xl sm:text-4xl ${card.color === 'red' ? 'text-red-600' : 'text-black'}`}>
        {card.suit}
      </div>
      <div className={`absolute bottom-1 right-1 font-black text-[10px] sm:text-xs leading-none rotate-180 ${card.color === 'red' ? 'text-red-600' : 'text-black'}`}>
          <div>{card.rank}</div>
          <div>{card.suit}</div>
      </div>
    </div>
  );
};

export function BluffGame({ config, sfx, userId, partnerId, setScores, onWin, onBack, roomId, partnerName, myName }) {
  const isMultiplayer = config.mode === '1v1_remote';
  const myId = isMultiplayer ? userId : 'p1';
  const oppId = isMultiplayer ? partnerId : 'ai';
  const isHost = !isMultiplayer || userId < partnerId;

  const [gameState, setGameState] = useGlobalSync(`bluff_${roomId}`, null);
  const [myHand, setMyHand] = useState([]);
  const [selectedCards, setSelectedCards] = useState([]);
  
  const trueCenterPile = useRef([]);
  const gameStateRef = useRef(gameState);
  
  // Update gameStateRef whenever gameState changes
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  
  // Broadcast senders with listeners embedded
  const sendDeal = useBroadcast(`bluff_deal_${roomId}`, (msg) => {
    if (isMultiplayer && msg.to === myId && msg.type === 'deal') {
      setMyHand(msg.hand);
    }
  });
  
  const sendPlayCards = useBroadcast(`bluff_play_${roomId}`, (msg) => {
    if (isMultiplayer && isHost && msg.type === 'play_cards') {
      trueCenterPile.current.push(...msg.cards);
    }
  });
  
  const sendTakePile = useBroadcast(`bluff_take_${roomId}`, (msg) => {
    if (msg.to === myId) {
      setMyHand(prev => [...prev, ...msg.cards].sort((a,b) => RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank)));
      playAudio('error', sfx);
    }
  });
  
  const sendPassTurn = useBroadcast(`bluff_pass_${roomId}`, (msg) => {
    if (isHost && isMultiplayer && msg.type === 'pass_turn') {
      setGameState(prev => ({
        ...prev,
        turn: oppId,
        targetRankIdx: (prev.targetRankIdx + 1) % 13,
        phase: 'action'
      }));
    }
  });
  
  // Listener for bluff call messages - will be processed by effect below
  const sendCallBluff = useBroadcast(`bluff_call_${roomId}`, () => {
    // Listener callback handled via effect
  });

  // Initialization (Host)
  useEffect(() => {
    if (isHost && !gameState) {
      setTimeout(() => {
        const deck = createDeck();
        const h1 = deck.splice(0, 26);
        const h2 = deck.splice(0, 26);
        
        setMyHand(h1);
        
        if (isMultiplayer) {
           sendDeal({ type: 'deal', to: oppId, hand: h2 });
        } else {
           trueCenterPile.current.aiHand = h2;
        }

        setGameState({
          turn: myId,
          targetRankIdx: 0,
          centerCount: 0,
          lastPlay: null,
          handsCount: { [myId]: 26, [oppId]: 26 },
          phase: 'action', 
          revealResult: null,
          winner: null
        });
      }, 2000);
    }
  }, [isHost, gameState, myId, oppId, setGameState, isMultiplayer, sendDeal]);

  const handlePlayCards = () => {
     if (selectedCards.length === 0 || selectedCards.length > 4) return;
     
     const cardsToPlay = selectedCards.map(c => c);
     setMyHand(prev => prev.filter(c => !selectedCards.some(sc => sc.id === c.id)));
     setSelectedCards([]);
     playAudio('place', sfx);

     if (isHost) {
         trueCenterPile.current.push(...cardsToPlay);
     } else {
         sendPlayCards({ type: 'play_cards', to: oppId, cards: cardsToPlay });
     }

     const newHandsCount = { ...gameState.handsCount, [myId]: gameState.handsCount[myId] - cardsToPlay.length };
     
     setGameState({
         ...gameState,
         centerCount: gameState.centerCount + cardsToPlay.length,
         lastPlay: { player: myId, count: cardsToPlay.length, rank: RANKS[gameState.targetRankIdx] },
         handsCount: newHandsCount,
         phase: 'reaction'
     });
  };

  const processBluffCall = useCallback((callerId, lastPlayerId) => {
     const currentGS = gameStateRef.current;
     if (!currentGS || !currentGS.lastPlay) return;

     const lastCards = trueCenterPile.current.slice(-currentGS.lastPlay.count);
     const targetRank = currentGS.lastPlay.rank;
     const isLying = lastCards.some(c => c.rank !== targetRank);
     
     const loser = isLying ? lastPlayerId : callerId;
     
     const pileToTake = [...trueCenterPile.current];
     trueCenterPile.current = [];

     if (loser === myId) {
         setMyHand(prev => [...prev, ...pileToTake].sort((a,b) => RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank)));
         playAudio('error', sfx);
     } else if (!isMultiplayer && loser === 'ai') {
         trueCenterPile.current.aiHand = [...(trueCenterPile.current.aiHand || []), ...pileToTake];
         playAudio('success', sfx);
     } else if (isMultiplayer) {
         sendTakePile({ type: 'take_pile', to: loser, cards: pileToTake });
     }

     setGameState({
         ...currentGS,
         phase: 'reveal',
         revealResult: {
             caller: callerId,
             isLying,
             cardsRevealed: lastCards,
             loser
         }
     });
  }, [myId, isMultiplayer, sendTakePile, setGameState, sfx]);
  
  // Store processBluffCall in ref so it can be accessed by broadcast listeners
  const processBluffCallRef = useRef(processBluffCall);
  useEffect(() => { processBluffCallRef.current = processBluffCall; }, [processBluffCall]);
  
  // Listen for bluff call messages from opponent
  useEffect(() => {
    const handleBluffCall = (event) => {
      const msg = event.detail || event;
      if (isHost && isMultiplayer && msg && msg.type === 'call_bluff') {
        processBluffCallRef.current(oppId, myId);
      }
    };
    window.addEventListener('sync_broadcast', handleBluffCall);
    return () => window.removeEventListener('sync_broadcast', handleBluffCall);
  }, [isHost, isMultiplayer, oppId, myId]);

  const handleCallBluff = () => {
     if (!isHost) {
         // Ask host to process
         sendCallBluff({ type: 'call_bluff', to: oppId });
         // We must rely on state syncing from host
     } else {
         processBluffCallRef.current(myId, oppId);
     }
  };

  const handlePass = () => {
     playAudio('click', sfx);
     if (isHost) {
         setGameState({
             ...gameState,
             turn: myId,
             targetRankIdx: (gameState.targetRankIdx + 1) % 13,
             phase: 'action'
         });
     } else {
         sendPassTurn({ type: 'pass_turn', to: oppId });
     }
  };

  const advanceAfterReveal = () => {
     // Check win condition
     if (gameState.handsCount[gameState.revealResult.loser] === 0) {
         // Wait, the loser just took cards, so they can't be at 0.
         // But the winner might be at 0!
         const winnerId = gameState.revealResult.loser === myId ? oppId : myId;
         if (gameState.handsCount[winnerId] === 0) {
             if (winnerId === myId && onWin) onWin();
             if (setScores && winnerId === myId) setScores(p => ({ ...p, bluff: { ...(p.bluff || {}), [userId]: (p.bluff?.[userId] || 0) + 1 } }));
             setGameState({ ...gameState, winner: winnerId });
             return;
         }
     }

     // Winner of the challenge starts next
     const nextTurn = gameState.revealResult.loser === myId ? oppId : myId;
     setGameState({
         ...gameState,
         turn: nextTurn,
         targetRankIdx: (gameState.targetRankIdx + 1) % 13,
         centerCount: 0,
         lastPlay: null,
         phase: 'action',
         revealResult: null
     });
  };

  // AI Turn Logic
  useEffect(() => {
      if (!gameState || isMultiplayer || gameState.winner) return;

      if (gameState.phase === 'action' && gameState.turn === 'ai') {
          const timer = setTimeout(() => {
              const aiHand = trueCenterPile.current.aiHand || [];
              const targetRank = RANKS[gameState.targetRankIdx];
              
              // Find matching cards
              let toPlay = aiHand.filter(c => c.rank === targetRank);
              const isLying = toPlay.length === 0 || (Math.random() < (config.diff === 'hard' ? 0.4 : 0.2));
              
              if (isLying) {
                  // Pick 1-2 random non-matching cards
                  const nonMatching = aiHand.filter(c => c.rank !== targetRank);
                  if (nonMatching.length > 0) {
                      toPlay = [nonMatching[Math.floor(Math.random() * nonMatching.length)]];
                      if (nonMatching.length > 1 && Math.random() > 0.5) toPlay.push(nonMatching[Math.floor(Math.random() * nonMatching.length)]);
                  }
              }

              if (toPlay.length === 0) toPlay = [aiHand[0]]; // fallback

              trueCenterPile.current.aiHand = aiHand.filter(c => !toPlay.some(tc => tc.id === c.id));
              trueCenterPile.current.push(...toPlay);

              playAudio('place', sfx);
              setGameState(p => ({
                  ...p,
                  centerCount: p.centerCount + toPlay.length,
                  lastPlay: { player: 'ai', count: toPlay.length, rank: targetRank },
                  handsCount: { ...p.handsCount, ai: p.handsCount.ai - toPlay.length },
                  phase: 'reaction'
              }));
          }, 1500);
          return () => clearTimeout(timer);
      }

      if (gameState.phase === 'reaction' && gameState.lastPlay.player === myId) {
          const timer = setTimeout(() => {
              const aiHand = trueCenterPile.current.aiHand || [];
              const myCountOfRank = aiHand.filter(c => c.rank === gameState.lastPlay.rank).length;
              
              // If AI holds all 4, player MUST be lying. Otherwise random chance.
              const willCall = myCountOfRank === 4 || Math.random() < (config.diff === 'hard' ? 0.35 : 0.15);
              
              if (willCall) {
                  processBluffCall('ai', myId);
              } else {
                  playAudio('click', sfx);
                  setGameState(p => ({
                     ...p, turn: 'ai', targetRankIdx: (p.targetRankIdx + 1) % 13, phase: 'action'
                  }));
              }
          }, 2000);
          return () => clearTimeout(timer);
      }

  }, [gameState, isMultiplayer, config.diff, myId]);

  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-[var(--bg-main)] h-full w-full">
        <div className="relative w-24 h-32 mb-4 flex items-center justify-center">
           <CardUI hidden={true} className="absolute inset-0 animate-bounce" />
           <CardUI hidden={true} className="absolute inset-0 animate-pulse delay-75" style={{ transform: 'rotate(10deg)' }} />
        </div>
        <div className="font-black text-2xl uppercase tracking-widest text-[var(--secondary)] animate-pulse text-center">Dealing Cards...</div>
      </div>
    );
  }

  const { turn, targetRankIdx, centerCount, lastPlay, handsCount, phase, revealResult, winner } = gameState;
  const isMyTurn = turn === myId;
  const targetRank = RANKS[targetRankIdx];

  const sortedMyHand = [...myHand].sort((a,b) => RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank));

  return (
    <RetroWindow title={isMultiplayer ? "Retro Bluff — " + (myName || 'You') + " vs " + (partnerName || 'Partner') : "Retro Bluff — vs AI"} onClose={() => { setGameState(null); onBack(); }} confirmOnClose sfx={sfx} noPadding>
      <div className="flex flex-col items-center justify-between p-4 w-[800px] h-[600px] max-w-full max-h-[85vh] bg-[var(--bg-main)] text-[var(--text-main)] font-mono select-none overflow-hidden touch-none relative">
        
         {/* Opponent Info */}
        <div className="w-full flex justify-between items-start px-4">
            <div className="bg-[var(--bg-window)] text-[var(--text-main)] font-bold text-xs px-3 py-2 retro-border uppercase flex flex-col items-center retro-shadow-dark">
                <span>{isMultiplayer ? partnerName || 'Partner' : 'AI'}</span>
                <span className="text-xl text-[var(--secondary)]">{handsCount[oppId]} Cards</span>
            </div>
            
            <div className="bg-[var(--bg-window)] text-[var(--text-main)] px-6 py-3 retro-border retro-shadow-dark flex flex-col items-center">
                <span className="font-black text-[10px] uppercase opacity-70 mb-1">Target Rank</span>
                <span className="font-black text-4xl leading-none text-[var(--primary)]">{targetRank}</span>
            </div>
        </div>

        {/* Action Prompts */}
        <div className="w-full flex flex-col items-center justify-center mt-4">
             {phase === 'action' && isMyTurn && <div className="text-xl sm:text-3xl font-black text-[var(--primary)] uppercase animate-bounce text-center bg-[var(--bg-window)] retro-border-thick px-6 py-2 retro-shadow-dark">YOUR TURN: Play {targetRank}s</div>}
             {phase === 'action' && !isMyTurn && <div className="text-lg font-black opacity-70 uppercase text-center bg-[var(--bg-window)] retro-border-thick px-6 py-2 shadow-inner">{isMultiplayer ? partnerName || 'Partner' : 'Opponent'} is choosing {targetRank}s...</div>}
             {phase === 'reaction' && lastPlay && lastPlay.player !== myId && <div className="text-xl sm:text-3xl font-black text-[var(--primary)] uppercase animate-pulse text-center bg-[var(--bg-window)] retro-border-thick px-6 py-2 retro-shadow-dark">CALL BLUFF or PASS?</div>}
             {phase === 'reaction' && lastPlay && lastPlay.player === myId && <div className="text-lg font-black opacity-70 uppercase text-center bg-[var(--bg-window)] retro-border-thick px-6 py-2 shadow-inner">Waiting for {isMultiplayer ? partnerName || 'Partner' : 'opponent'} to react...</div>}
        </div>

        {/* Center Play Area */}
        <div className="flex flex-col items-center justify-center flex-1 w-full my-8">
            {phase === 'reveal' && revealResult ? (
                <div className="bg-white p-6 retro-border retro-shadow-dark flex flex-col items-center animate-in zoom-in-50 duration-300 z-50">
                    <h3 className="font-black text-2xl uppercase tracking-widest text-red-600 mb-4">
                        {revealResult.isLying ? 'BLUFF CALLED!' : 'TRUTH TOLD!'}
                    </h3>
                    <div className="flex gap-2 mb-4">
                        {revealResult.cardsRevealed.map((c, i) => <CardUI key={i} card={c} />)}
                    </div>
                    <p className="font-bold text-sm uppercase mb-4 text-center">
                        {revealResult.caller === myId ? 'You' : isMultiplayer ? partnerName || 'Partner' : 'Opponent'} called bluff.<br/>
                        {revealResult.loser === myId ? 'You take' : isMultiplayer ? (partnerName || 'Partner') + ' takes' : 'Opponent takes'} the pile!
                    </p>
                    <RetroButton onClick={advanceAfterReveal} className="px-8 py-2">Continue</RetroButton>
                </div>
            ) : (
                <div className="relative flex justify-center items-center h-[140px]">
                    {centerCount > 0 ? (
                        <div className="flex items-center -space-x-10 sm:-space-x-12">
                            {[...Array(Math.min(centerCount, 15))].map((_, i) => (
                                <div key={i} className="transition-all hover:-translate-y-2 relative" style={{ zIndex: i }}>
                                    <CardUI hidden={true} />
                                </div>
                            ))}
                            <div className="z-50 ml-4 bg-[var(--primary)] text-[var(--bg-main)] font-black text-2xl px-3 py-1 retro-border-thick shadow-md animate-pulse">
                                {centerCount}
                            </div>
                        </div>
                    ) : (
                        <div className="w-20 h-32 border-4 border-dashed border-[var(--border)] rounded-md flex items-center justify-center opacity-50">
                            <span className="font-black text-[var(--border)] text-xs uppercase tracking-widest rotate-90">Pile</span>
                        </div>
                    )}
                </div>
            )}

            {/* Reaction Controls */}
            {phase === 'reaction' && lastPlay && lastPlay.player !== myId && (
                <div className="mt-8 flex gap-4 animate-in slide-in-from-bottom-4">
                    <RetroButton variant="primary" onClick={handlePass} className="px-6 py-4 text-sm font-black animate-pulse">Pass & Play</RetroButton>
                    <RetroButton variant="accent" onClick={handleCallBluff} className="px-6 py-4 text-sm font-black bg-[var(--color-destructive)] text-white hover:bg-[var(--color-destructive)]">Call Bluff!</RetroButton>
                </div>
            )}
        </div>

        {/* My Hand & Action */}
        <div className="w-full flex flex-col items-center">
            {phase === 'action' && isMyTurn && (
                <RetroButton 
                   onClick={handlePlayCards} 
                   disabled={selectedCards.length === 0 || selectedCards.length > 4}
                   className="mb-4 px-8 py-3 text-sm z-20 retro-shadow-dark animate-bounce"
                >
                    {selectedCards.length > 0 ? `Play ${selectedCards.length} Card${selectedCards.length > 1 ? 's' : ''} as ${targetRank}` : `Select Cards to Play as ${targetRank}`}
                </RetroButton>
            )}

            <div className="flex flex-wrap justify-center content-end w-full px-4 pb-4 pt-16 min-h-[200px] z-20">
               {sortedMyHand.map((c, i) => {
                   const isSelected = selectedCards.some(sc => sc.id === c.id);
                   return (
                       <div 
                           key={c.id} 
                           className={`shrink-0 transition-transform ${i > 0 ? '-ml-8 sm:-ml-10' : ''} -mt-16 hover:-translate-y-4 relative group`}
                           style={{ zIndex: i + (isSelected ? 50 : 0) }}
                       >
                           <CardUI 
                              card={c} 
                              selected={isSelected}
                              onClick={() => {
                                  if (phase !== 'action' || !isMyTurn) return;
                                  if (isSelected) setSelectedCards(p => p.filter(sc => sc.id !== c.id));
                                  else if (selectedCards.length < 4) setSelectedCards(p => [...p, c]);
                              }} 
                           />
                       </div>
                   )
               })}
            </div>
        </div>

        {winner && (
          <ShareOutcomeOverlay isSolo={(typeof config !== "undefined" && config?.mode === "solo") || (typeof mode !== "undefined" && mode === "solo") || (typeof gameMode !== "undefined" && gameMode === "solo") || (typeof config !== "undefined" && config?.mode === "practice")} partnerNickname={(typeof config !== "undefined" && config?.mode === "vs_ai") || (typeof mode !== "undefined" && mode === "vs_ai") || (typeof gameMode !== "undefined" && gameMode === "vs_ai") ? "AI" : undefined}
            outcome={winner === myId ? 'win' : 'loss'}
            score={winner === myId ? 'You emptied your hand!' : isMultiplayer ? `${partnerName || 'Partner'} emptied their hand!` : 'Opponent emptied their hand!'}
            gameName="Retro Bluff"
            onClose={() => onBack()}
          />
        )}
      </div>
    </RetroWindow>
  );
}
