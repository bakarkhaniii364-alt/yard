import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { RetroWindow, RetroButton, ShareOutcomeOverlay } from '../components/UI.jsx';
import { useGlobalSync } from '../hooks/useSupabaseSync.js';
import { useAuth, useCall } from '../context/instances.js';
import { playAudio } from '../utils/audio.js';

const COLORS = ['red', 'blue', 'green', 'yellow'];
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'];
const WILD_VALUES = ['wild', 'wild_draw4'];

// Helper to generate a unique ID for each card
const generateId = () => Math.random().toString(36).substring(2, 9);

const createDeck = () => {
  const deck = [];
  COLORS.forEach(color => {
    deck.push({ id: generateId(), color, value: '0' });
    for (let i = 1; i <= 9; i++) {
      deck.push({ id: generateId(), color, value: String(i) });
      deck.push({ id: generateId(), color, value: String(i) });
    }
    ['skip', 'reverse', 'draw2'].forEach(val => {
      deck.push({ id: generateId(), color, value: val });
      deck.push({ id: generateId(), color, value: val });
    });
  });
  for (let i = 0; i < 4; i++) {
    deck.push({ id: generateId(), color: 'wild', value: 'wild' });
    deck.push({ id: generateId(), color: 'wild', value: 'wild_draw4' });
  }
  return deck.sort(() => Math.random() - 0.5);
};

const getCardColorClass = (color) => {
  switch(color) {
    case 'red': return 'bg-[var(--color-destructive)] text-white';
    case 'blue': return 'bg-[var(--color-cta)] text-white';
    case 'green': return 'bg-[var(--color-game)] text-white';
    case 'yellow': return 'bg-yellow-400 text-border';
    default: return 'bg-border text-window'; // Wild
  }
};

const CardUI = ({ card, onClick, className = "", hidden = false }) => {
  if (hidden || card.color === 'back') {
    return (
      <div className={`w-[60px] h-[90px] sm:w-[86px] sm:h-[128px] retro-border-thick rounded-[6px] bg-[var(--color-destructive)] flex items-center justify-center relative retro-shadow-dark ${className}`} style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 12px, rgba(0,0,0,0.3) 12px, rgba(0,0,0,0.3) 16px)' }}>
      </div>
    );
  }

  const isWild = card.color === 'wild';
  const displayVal = card.value === 'skip' ? 'Ø' : card.value === 'reverse' ? '⇄' : card.value === 'draw2' ? '+2' : card.value === 'wild' ? 'W' : card.value === 'wild_draw4' ? '+4' : card.value;

  const innerStyle = isWild ? {
      background: 'conic-gradient(#ef4444 90deg, #3b82f6 90deg 180deg, #facc15 180deg 270deg, #22c55e 270deg)',
      color: 'white',
      textShadow: '2px 2px 0 var(--border)'
  } : {};

  return (
    <div 
      onClick={onClick}
      className={`w-[60px] h-[90px] sm:w-[86px] sm:h-[128px] retro-border-thick rounded-[6px] flex flex-col justify-center items-center relative select-none retro-shadow-dark ${getCardColorClass(card.color)} ${onClick ? 'cursor-pointer hover:-translate-y-5 hover:scale-110 hover:z-[100] transition-all' : ''} ${className}`}
    >
      <div className="w-[72%] h-[62%] bg-window border-2 border-border flex justify-center items-center text-[22px] sm:text-[36px] font-bold text-border rounded-[4px]" style={innerStyle}>
        {displayVal}
      </div>
    </div>
  );
};

export function UnoGame({ onBack, isHost, myPlayerId, oppPlayerId, isMultiplayer, config, userId, setScores, sfx, onWin, partnerName, myName }) {
  const { sendData } = useCall();
  const { roomId } = useAuth();
  const [gameState, setGameState] = useGlobalSync(`uno_${roomId}`, null);

  // 1. WebRTC Data Channel Listener
  useEffect(() => {
    const handleData = (e) => {
      const data = e.detail;
      if (data.type === 'uno_move' && data.roomId === roomId) {
        console.log('[UNO] Received Move via P2P:', data.state);
        setGameState(data.state);
      }
    };
    window.addEventListener('webrtc_data', handleData);
    return () => window.removeEventListener('webrtc_data', handleData);
  }, [roomId, setGameState]);

  // Optimized setter that sends via P2P first
  const broadcastMove = useCallback((newState) => {
    // 1. P2P (Low Latency)
    const p2pSent = typeof sendData === 'function'
      ? sendData({ type: 'uno_move', roomId, state: newState })
      : false;
    if (p2pSent) console.log('[UNO] Move broadcast via P2P');
    
    // 2. Supabase (Reliability/Persistence)
    setGameState(newState);
  }, [roomId, sendData, setGameState]);

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pendingWildCard, setPendingWildCard] = useState(null);
  const [actionMessage, setActionMessage] = useState("");
  const aiTimeoutRef = useRef(null);

  const showMessage = (msg) => {
      setActionMessage(msg);
      setTimeout(() => setActionMessage(curr => curr === msg ? "" : curr), 1500);
  };

  // Initialize game
  useEffect(() => {
    if (isHost && (!gameState || gameState.winner)) {
      const initTimer = setTimeout(() => {
        if (gameState && !gameState.winner) return; // Already initialized by someone else or previous run
        
        console.log('[UNO] Host initializing game state...');
        let deck = createDeck();
        const p1Hand = deck.splice(0, 7);
        const p2Hand = deck.splice(0, 7);
        let firstCard = deck.pop();
        
        // Safety: Ensure first card is not wild
        let attempts = 0;
        while (firstCard.color === 'wild' && attempts < 10) {
            deck.unshift(firstCard);
            firstCard = deck.pop();
            attempts++;
        }
        
        const initialState = {
          deck,
          discard: [firstCard],
          hands: {
            [myPlayerId]: p1Hand,
            [oppPlayerId]: p2Hand
          },
          turn: myPlayerId,
          currentColor: firstCard.color,
          unoCalled: { [myPlayerId]: false, [oppPlayerId]: false },
          winner: null,
          initializedAt: Date.now()
        };
        broadcastMove(initialState);
      }, 1000); // Reduced to 1s
      return () => clearTimeout(initTimer);
    }
  }, [isHost, gameState?.winner, myPlayerId, oppPlayerId, broadcastMove]);

  const { deck, discard, hands, turn, currentColor, unoCalled, winner } = gameState || {};
  const topCard = discard ? discard[discard.length - 1] : null;
  const isMyTurn = turn === myPlayerId;

  const myHand = hands ? hands[myPlayerId] || [] : [];
  const oppHand = hands ? hands[oppPlayerId] || [] : [];

  const isValidPlay = (card) => {
    if (card.color === 'wild') return true;
    if (card.color === currentColor) return true;
    if (card.value === topCard.value) return true;
    return false;
  };

  const drawCards = (playerId, amount, currentDeck, currentHands) => {
    let newDeck = [...currentDeck];
    let newDiscard = [...discard];
    const drawn = [];
    
    for (let i = 0; i < amount; i++) {
      if (newDeck.length === 0) {
        const top = newDiscard.pop();
        newDeck = newDiscard.sort(() => Math.random() - 0.5);
        newDiscard = [top];
      }
      if (newDeck.length > 0) drawn.push(newDeck.pop());
    }

    const newHand = [...currentHands[playerId], ...drawn];
    return { newDeck, newDiscard, newHand };
  };

  const endTurn = (nextPlayer, newGameStateUpdates) => {
      broadcastMove({
          ...gameState,
          ...newGameStateUpdates,
          turn: nextPlayer
      });
  };

  const playCard = (card, chosenColor = null) => {
    if (!isValidPlay(card) && card.color !== 'wild') return;

    let newHands = { ...hands };
    newHands[myPlayerId] = myHand.filter(c => c.id !== card.id);
    let newDiscard = [...discard, card];
    let newDeck = [...deck];
    
    let nextColor = chosenColor || card.color;
    let nextTurn = oppPlayerId;
    let newUnoCalled = { ...unoCalled };

    // Automatic Penalty for dropping to 1 card without calling UNO
    if (newHands[myPlayerId].length === 1 && !unoCalled[myPlayerId]) {
        showMessage('Penalty! +2 for no UNO call');
        playAudio('error', sfx);
        const res = drawCards(myPlayerId, 2, newDeck, newHands);
        newDeck = res.newDeck;
        newDiscard = res.newDiscard;
        newHands[myPlayerId] = res.newHand;
    }

    if (newHands[myPlayerId].length === 0) {
       // WIN!
       playAudio('win', sfx);
       if (onWin) onWin();
       if (setScores) {
           setScores(p => ({ ...p, uno: { ...(p.uno || {}), [userId]: (p.uno?.[userId] || 0) + 1 } }));
       }
       broadcastMove({ ...gameState, winner: myPlayerId, hands: newHands, discard: newDiscard });
       return;
    }

    playAudio('place', sfx);

    // Apply effects
    if (card.value === 'skip' || card.value === 'reverse') {
       showMessage(card.value === 'skip' ? 'SKIP!' : 'REVERSE!');
       // In 2-player, reverse is skip.
       nextTurn = myPlayerId;
    } else if (card.value === 'draw2') {
       showMessage('+2 DRAW!');
       const res = drawCards(oppPlayerId, 2, newDeck, newHands);
       newDeck = res.newDeck;
       newDiscard = res.newDiscard;
       newHands[oppPlayerId] = res.newHand;
       nextTurn = myPlayerId; // skip their turn
    } else if (card.value === 'wild_draw4') {
       showMessage('+4 DRAW!');
       const res = drawCards(oppPlayerId, 4, newDeck, newHands);
       newDeck = res.newDeck;
       newDiscard = res.newDiscard;
       newHands[oppPlayerId] = res.newHand;
       nextTurn = myPlayerId; // skip their turn
    } else if (card.color === 'wild') {
       showMessage('WILD!');
    }

    // Reset Uno status if I had 1 card and drew, or update if I forgot
    if (newHands[myPlayerId].length !== 1) newUnoCalled[myPlayerId] = false;

    broadcastMove({
        deck: newDeck,
        discard: newDiscard,
        hands: newHands,
        turn: nextTurn,
        currentColor: nextColor,
        unoCalled: newUnoCalled,
        winner: null
    });
  };

  const handleCardClick = (card) => {
    if (!isMyTurn || winner) return;
    if (!isValidPlay(card)) {
        playAudio('error', sfx);
        return;
    }

    if (card.color === 'wild') {
        setPendingWildCard(card);
        setShowColorPicker(true);
    } else {
        playCard(card);
    }
  };

  const handleDraw = () => {
    if (!isMyTurn || winner) return;
    playAudio('click', sfx);
    
    const res = drawCards(myPlayerId, 1, deck, hands);
    let newUnoCalled = { ...unoCalled };
    newUnoCalled[myPlayerId] = false;

    broadcastMove({
        ...gameState,
        deck: res.newDeck,
        discard: res.newDiscard,
        hands: { ...hands, [myPlayerId]: res.newHand },
        turn: oppPlayerId,
        unoCalled: newUnoCalled
    });
  };

  const callUno = () => {
      if (winner) return;
      if (myHand.length <= 2) {
          playAudio('success', sfx);
          showMessage('UNO!');
          broadcastMove({ ...gameState, unoCalled: { ...gameState.unoCalled, [myPlayerId]: true }});
      }
  };

  const catchOpponent = () => {
      if (winner) return;
      if (oppHand.length === 1 && !unoCalled[oppPlayerId]) {
          playAudio('error', sfx);
          const res = drawCards(oppPlayerId, 2, deck, hands);
          broadcastMove({
              ...gameState,
              deck: res.newDeck,
              discard: res.newDiscard,
              hands: { ...gameState.hands, [oppPlayerId]: res.newHand }
          });
      }
  };

  const catchPlayer = (targetId) => {
      if (winner) return;
      playAudio('error', sfx);
      const res = drawCards(targetId, 2, deck, hands);
      broadcastMove({
          ...gameState,
          deck: res.newDeck,
          discard: res.newDiscard,
          hands: { ...gameState.hands, [targetId]: res.newHand }
      });
  };

  // AI Logic
  useEffect(() => {
      if (!gameState) return;
      if (!isMultiplayer && turn === 'ai' && !winner) {
          aiTimeoutRef.current = setTimeout(() => {
              const aiHand = hands['ai'] || [];
              const top = discard[discard.length - 1];
              
              const valid = aiHand.filter(c => 
                  c.color === 'wild' || 
                  c.color === currentColor || 
                  c.value === top.value
              );

              if (valid.length > 0) {
                  // Strategy: play highest value first
                  valid.sort((a, b) => {
                      const aAct = typeof a.value === 'string' ? 20 : a.value;
                      const bAct = typeof b.value === 'string' ? 20 : b.value;
                      return bAct - aAct;
                  });
                  const cardToPlay = valid[0];
                  
                  // Call uno randomly if 2 cards left
                  let newUno = { ...unoCalled };
                  if (aiHand.length === 2 && Math.random() > 0.2) {
                      newUno['ai'] = true;
                  }

                  let chosenCol = null;
                  if (cardToPlay.color === 'wild') {
                      const colCounts = {red:0, blue:0, green:0, yellow:0};
                      aiHand.forEach(c => { if(c.color !== 'wild') colCounts[c.color]++; });
                      chosenCol = Object.keys(colCounts).reduce((a, b) => colCounts[a] > colCounts[b] ? a : b) || 'red';
                  }

                  let newHands = { ...hands };
                  newHands['ai'] = aiHand.filter(c => c.id !== cardToPlay.id);
                  let newDiscard = [...discard, cardToPlay];
                  let newDeck = [...deck];
                  let nextTurn = myPlayerId;

                  if (newHands['ai'].length === 0) {
                      broadcastMove({ ...gameState, winner: 'ai', hands: newHands, discard: newDiscard });
                      playAudio('error', sfx);
                      return;
                  }

                  if (cardToPlay.value === 'skip' || cardToPlay.value === 'reverse') {
                     nextTurn = 'ai';
                  } else if (cardToPlay.value === 'draw2') {
                     const res = drawCards(myPlayerId, 2, newDeck, newHands);
                     newDeck = res.newDeck; newDiscard = res.newDiscard; newHands[myPlayerId] = res.newHand;
                     nextTurn = 'ai'; 
                  } else if (cardToPlay.value === 'wild_draw4') {
                     const res = drawCards(myPlayerId, 4, newDeck, newHands);
                     newDeck = res.newDeck; newDiscard = res.newDiscard; newHands[myPlayerId] = res.newHand;
                     nextTurn = 'ai'; 
                  }

                  broadcastMove({
                      ...gameState, deck: newDeck, discard: newDiscard, hands: newHands, turn: nextTurn, currentColor: chosenCol || cardToPlay.color, unoCalled: newUno
                  });
                  playAudio('place', sfx);

              } else {
                  const res = drawCards('ai', 1, deck, hands);
                  broadcastMove({
                      ...gameState, deck: res.newDeck, discard: res.newDiscard, hands: { ...gameState.hands, ['ai']: res.newHand }, turn: myPlayerId
                  });
                  playAudio('click', sfx);
              }
          }, 1500);
          return () => clearTimeout(aiTimeoutRef.current);
      }
  }, [turn, winner, isMultiplayer]);

  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-main h-full w-full">
        <div className="relative w-24 h-32 mb-4 flex items-center justify-center">
           <CardUI card={{color:'back'}} hidden={true} className="absolute inset-0 animate-bounce" />
           <CardUI card={{color:'back'}} hidden={true} className="absolute inset-0 animate-pulse delay-75" style={{ transform: 'rotate(10deg)' }} />
           <CardUI card={{color:'back'}} hidden={true} className="absolute inset-0 animate-pulse delay-150" style={{ transform: 'rotate(-10deg)' }} />
        </div>
        <div className="font-black text-2xl uppercase tracking-widest text-primary animate-pulse text-center">Shuffling Deck...</div>
      </div>
    );
  }

  return (
    <RetroWindow title={isMultiplayer ? "Retro Uno — " + (myName || 'You') + " vs " + (partnerName || 'Partner') : "Retro Uno — vs CPU"} onClose={() => { setGameState(null); onBack(); }} confirmOnClose sfx={sfx} noPadding>
      <div className="flex w-[800px] h-[600px] max-w-full max-h-[85vh] bg-main text-main-text font-mono select-none overflow-hidden touch-none relative">
        
         {/* Sidebar */}
         <div className="flex flex-col w-[200px] shrink-0 h-full bg-window border-r-2 border-border relative z-10">
              <div className="bg-border px-4 py-2 text-window font-bold tracking-widest uppercase text-sm border-b-2 border-border">
                  sys.log
              </div>
              <div className="flex-1 p-3 flex flex-col gap-3">
                  <div className="flex-1 border-2 border-border bg-main p-2 overflow-y-auto text-xs flex flex-col gap-1 shadow-[inset_2px_2px_0_rgba(0,0,0,0.1)]">
                      <div className="font-bold opacity-80">&gt; init seq...</div>
                      <div className="font-bold opacity-80">&gt; load complete.</div>
                      <div className="font-bold text-primary">&gt; {actionMessage || 'awaiting action...'}</div>
                      {unoCalled[oppPlayerId] && <div className="font-bold text-primary">&gt; OPP CALLED UNO!</div>}
                  </div>
                  <button 
                      onClick={callUno} 
                      disabled={myHand.length > 2 || unoCalled[myPlayerId]}
                      className={`font-black text-xl py-3 border-2 border-border transition-transform uppercase ${myHand.length <= 2 && !unoCalled[myPlayerId] ? 'bg-primary text-primary-text shadow-retro active:translate-y-[2px] active:translate-x-[2px] active:shadow-none animate-pulse cursor-pointer' : 'bg-gray-400 text-white cursor-not-allowed translate-y-[2px] translate-x-[2px]'}`}
                  >
                      Call UNO!
                  </button>
              </div>
         </div>

         {/* Main Game Area */}
         <div className="flex-1 flex flex-col relative overflow-hidden bg-main">
             
             {/* Action Message Overlay */}
             <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[48px] sm:text-[64px] font-black text-primary pointer-events-none transition-all duration-200 z-[500] ${actionMessage ? 'opacity-100 scale-110 -rotate-6' : 'opacity-0 scale-90'}`} style={{ textShadow: '4px 4px 0 var(--border), -2px -2px 0 var(--bg-window), 2px -2px 0 var(--bg-window), -2px 2px 0 var(--bg-window), 2px 2px 0 var(--bg-window)' }}>
                 {actionMessage}
             </div>

             {/* Opponent Hand */}
             <div className="flex justify-center overflow-hidden w-full h-[120px] mt-4 opacity-90 scale-[0.75] origin-top pointer-events-none">
                 {oppHand.map((c, i) => (
                     <div key={i} className={`shrink-0 ${i > 0 ? '-ml-12' : ''}`} style={{ zIndex: i }}>
                         <CardUI card={{color:'back'}} hidden={true} />
                     </div>
                 ))}
             </div>

             <div className="absolute top-4 right-4 bg-window border-2 border-border px-3 py-1 text-xs font-bold shadow-[2px_2px_0_var(--border)]">
                 {isMultiplayer ? partnerName || 'Partner' : 'CPU'}: {oppHand.length}
             </div>

             {/* Center Play Area */}
             <div className="flex justify-center items-center gap-[40px] flex-1">
                  <div onClick={handleDraw} className="relative cursor-pointer hover:-translate-y-2 active:translate-y-0 transition-transform after:content-['DRAW'] after:absolute after:-bottom-6 after:left-1/2 after:-translate-x-1/2 after:w-full after:text-center after:font-bold after:bg-border after:text-window after:border-2 after:border-border after:text-[12px]">
                      <div className="relative">
                         <CardUI card={{color:'back'}} hidden={true} className="shadow-[4px_4px_0_rgba(0,0,0,0.3)] z-[2]" />
                         <CardUI card={{color:'back'}} hidden={true} className="absolute top-1 left-1 z-[1]" />
                      </div>
                  </div>

                  <div className="relative">
                      {discard.length > 0 && (
                         <CardUI card={discard[discard.length - 1]} className="rotate-[4deg]" />
                      )}
                      <div className={`absolute -bottom-6 left-0 w-full h-[10px] border-2 border-border shadow-retro ${getCardColorClass(currentColor)}`}></div>
                  </div>
             </div>

             {/* Turn Indicator */}
             <div className={`absolute left-[20px] font-bold bg-window border-2 border-border px-[15px] py-[8px] text-[16px] shadow-retro transition-all duration-400 z-10 uppercase ${isMyTurn ? 'bottom-[150px] border-primary' : 'top-[150px] border-border'}`}>
                 {isMyTurn ? 'Your Turn' : isMultiplayer ? "Partner's Turn" : 'CPU Processing...'}
             </div>

             {/* My Hand */}
             <div className="flex flex-wrap justify-center content-end w-full px-4 pb-4 pt-16 min-h-[200px] z-20">
                {myHand.map((c, i) => {
                    const valid = isValidPlay(c);
                    return (
                        <div 
                            key={c.id} 
                            className={`shrink-0 transition-transform ${!valid && isMyTurn ? 'opacity-70 cursor-not-allowed' : ''} ${i > 0 ? '-ml-8 sm:-ml-10' : ''} -mt-16 hover:-translate-y-4 relative group`}
                            style={{ zIndex: i }}
                        >
                            <div className="absolute inset-0 z-50 hidden group-hover:block pointer-events-none"></div>
                            <CardUI card={c} onClick={() => valid && handleCardClick(c)} className="group-hover:shadow-[0_10px_20px_rgba(0,0,0,0.5)]" />
                        </div>
                    )
                })}
             </div>
             
             {/* Mobile Call UNO button */}
             <div className="md:hidden absolute bottom-4 right-4 z-[50]">
                 {myHand.length <= 2 && !unoCalled[myPlayerId] && (
                     <button onClick={callUno} className="bg-primary text-primary-text border-2 border-border shadow-retro font-black px-4 py-2 animate-pulse active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all">UNO!</button>
                 )}
             </div>

         </div>

         {/* Color Picker Modal */}
         {showColorPicker && (
              <div className="absolute inset-0 bg-black/60 z-[1000] flex justify-center items-center">
                  <div className="bg-window border-2 border-border p-[20px] sm:p-[30px] shadow-retro max-w-[350px] w-[90%] text-center">
                      <h2 className="text-[20px] sm:text-[24px] font-black uppercase mb-[20px] text-main-text">Select Color</h2>
                      <div className="grid grid-cols-2 gap-[10px]">
                          {COLORS.map(c => (
                              <button key={c} onClick={() => { playCard(pendingWildCard, c); setShowColorPicker(false); setPendingWildCard(null); }} className={`h-[60px] sm:h-[80px] border-2 border-border font-bold text-[18px] uppercase flex justify-center items-center shadow-retro active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all ${getCardColorClass(c)}`}>
                                  {c}
                              </button>
                          ))}
                      </div>
                  </div>
              </div>
         )}

         {/* Outcome Modal */}
         {winner && (
            <ShareOutcomeOverlay isSolo={(typeof config !== "undefined" && config?.mode === "solo") || (typeof mode !== "undefined" && mode === "solo") || (typeof gameMode !== "undefined" && gameMode === "solo") || (typeof config !== "undefined" && config?.mode === "practice")} partnerNickname={(typeof config !== "undefined" && config?.mode === "vs_ai") || (typeof mode !== "undefined" && mode === "vs_ai") || (typeof gameMode !== "undefined" && gameMode === "vs_ai") ? "AI" : undefined}
              outcome={winner === myPlayerId ? 'win' : 'loss'}
              score={`Cards Left: You(${myHand.length}) vs Opp(${oppHand.length})`}
              gameName="Retro Uno"
              onClose={() => onBack()}
              onRematch={() => {
                  let d = createDeck();
                  const p1Hand = d.splice(0, 7);
                  const p2Hand = d.splice(0, 7);
                  let firstCard = d.pop();
                  while (firstCard.color === 'wild') {
                      d.unshift(firstCard);
                      firstCard = d.pop();
                  }
                  broadcastMove({
                    deck: d,
                    discard: [firstCard],
                    hands: { [myPlayerId]: p1Hand, [oppPlayerId]: p2Hand },
                    turn: myPlayerId,
                    currentColor: firstCard.color,
                    unoCalled: { [myPlayerId]: false, [oppPlayerId]: false },
                    winner: null,
                    initializedAt: Date.now()
                  });
              }}
            />
         )}
      </div>
    </RetroWindow>
  );
}
