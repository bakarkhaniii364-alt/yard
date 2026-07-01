import React, { useState, useEffect, useRef } from 'react';
import { RetroWindow, RetroButton, ShareOutcomeOverlay, ConfirmDialog } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { incrementUserScore } from '../utils/userDataHelpers.js';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { useGlobalSync, useBroadcast } from '../hooks/useSupabaseSync.js';
import { useAuth } from '../context/instances.js';
import { RefreshCw } from 'lucide-react';

const PATH = [
  [1,6], [2,6], [3,6], [4,6], [5,6], // 0-4
  [6,5], [6,4], [6,3], [6,2], [6,1], [6,0], // 5-10
  [7,0], [8,0], // 11-12
  [8,1], [8,2], [8,3], [8,4], [8,5], // 13-17
  [9,6], [10,6], [11,6], [12,6], [13,6], [14,6], // 18-23
  [14,7], [14,8], // 24-25
  [13,8], [12,8], [11,8], [10,8], [9,8], // 26-30
  [8,9], [8,10], [8,11], [8,12], [8,13], [8,14], // 31-36
  [7,14], [6,14], // 37-38
  [6,13], [6,12], [6,11], [6,10], [6,9], // 39-43
  [5,8], [4,8], [3,8], [2,8], [1,8], [0,8], // 44-49
  [0,7], [0,6] // 50-51
];

const HOME_STRETCH = {
  red: [[1,7], [2,7], [3,7], [4,7], [5,7]],
  green: [[7,1], [7,2], [7,3], [7,4], [7,5]],
  yellow: [[13,7], [12,7], [11,7], [10,7], [9,7]],
  blue: [[7,13], [7,12], [7,11], [7,10], [7,9]]
};

const START_INDEX = { red: 0, green: 13, yellow: 26, blue: 39 };
const END_INDEX = { red: 50, green: 11, yellow: 24, blue: 37 };
const SAFE_SPOTS = [0, 8, 13, 21, 26, 34, 39, 47];

const BASE_POSITIONS = {
  red: [[2,2], [2,3], [3,2], [3,3]],
  green: [[11,2], [11,3], [12,2], [12,3]],
  yellow: [[11,11], [11,12], [12,11], [12,12]],
  blue: [[2,11], [2,12], [3,11], [3,12]]
};

// Exact colors from classic Ludo
const COLORS = {
  red: '#e52c27',
  green: '#009e4d',
  yellow: '#ffcf00',
  blue: '#2051a5'
};

const INITIAL_TOKENS = [
  { id: 'r0', color: 'red', pos: -1 }, { id: 'r1', color: 'red', pos: -1 }, { id: 'r2', color: 'red', pos: -1 }, { id: 'r3', color: 'red', pos: -1 },
  { id: 'g0', color: 'green', pos: -1 }, { id: 'g1', color: 'green', pos: -1 }, { id: 'g2', color: 'green', pos: -1 }, { id: 'g3', color: 'green', pos: -1 },
  { id: 'y0', color: 'yellow', pos: -1 }, { id: 'y1', color: 'yellow', pos: -1 }, { id: 'y2', color: 'yellow', pos: -1 }, { id: 'y3', color: 'yellow', pos: -1 },
  { id: 'b0', color: 'blue', pos: -1 }, { id: 'b1', color: 'blue', pos: -1 }, { id: 'b2', color: 'blue', pos: -1 }, { id: 'b3', color: 'blue', pos: -1 }
];

const generateRandomPerks = () => {
  const perks = {};
  const types = ['extra_roll', 'boost', 'shield'];
  const eligibleIndices = [];
  for (let i = 0; i < 52; i++) {
    if (!SAFE_SPOTS.includes(i) && 
        i !== START_INDEX.red && 
        i !== START_INDEX.green && 
        i !== START_INDEX.yellow && 
        i !== START_INDEX.blue) {
      eligibleIndices.push(i);
    }
  }
  const shuffled = eligibleIndices.sort(() => Math.random() - 0.5);
  for (let k = 0; k < 5; k++) {
    if (shuffled[k] !== undefined) {
      perks[shuffled[k]] = types[k % types.length];
    }
  }
  return perks;
};


// Physical Dice Component
const Dice = ({ value, rolling, color }) => {
  const [rotations, setRotations] = useState({ x: 0, y: 0 });

  const FACE_ROTATIONS = {
    1: { x: 0, y: 0 },
    2: { x: 0, y: -90 },
    3: { x: 0, y: 90 },
    4: { x: -90, y: 0 },
    5: { x: 90, y: 0 },
    6: { x: 180, y: 0 }
  };

  useEffect(() => {
    if (rolling) {
      // Rapid spin animation using cumulative rotation to spin forward
      setRotations(prev => {
        const nextX = prev.x + 720 + Math.random() * 360;
        const nextY = prev.y + 720 + Math.random() * 360;
        return { x: nextX, y: nextY };
      });
    } else {
      // Settle on face
      const base = FACE_ROTATIONS[value || 1];
      setRotations(prev => {
        const currentXSpins = Math.ceil(prev.x / 360);
        const currentYSpins = Math.ceil(prev.y / 360);
        return {
          x: currentXSpins * 360 + base.x,
          y: currentYSpins * 360 + base.y
        };
      });
    }
  }, [rolling, value]);

  const dotColor = color === '#ffcf00' ? '#000' : '#fff';

  return (
    <div className="w-16 h-16 [perspective:1000px] z-50">
      <div 
        className="w-full h-full relative [transform-style:preserve-3d] transition-transform duration-500 ease-out"
        style={{ transform: `rotateX(${rotations.x}deg) rotateY(${rotations.y}deg)` }}
      >
        {[
          { rot: 'rotateY(0deg)', dots: [4] }, // 1
          { rot: 'rotateY(90deg)', dots: [0, 8] }, // 2
          { rot: 'rotateY(-90deg)', dots: [0, 4, 8] }, // 3
          { rot: 'rotateX(90deg)', dots: [0, 2, 6, 8] }, // 4
          { rot: 'rotateX(-90deg)', dots: [0, 2, 4, 6, 8] }, // 5
          { rot: 'rotateY(180deg)', dots: [0, 1, 2, 6, 7, 8] } // 6
        ].map((face, i) => (
          <div 
            key={i} 
            className="absolute w-full h-full border-2 border-black rounded-xl grid grid-cols-3 grid-rows-3 p-2 gap-1 bg-white"
            style={{ 
              transform: `${face.rot} translateZ(32px)`,
              backgroundColor: color || '#fff'
            }}
          >
            {Array.from({ length: 9 }).map((_, di) => (
              <div key={di} className="w-full h-full flex items-center justify-center">
                {face.dots.includes(di) && (
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dotColor }} />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export function LudoGame({ config, setScores, onBack, sfx, onWin, onShareToChat, onSaveToScrapbook, profile, myName, userId, isHost, isMultiplayer, myPlayerId, partnerName }) {
  const { roomId } = useAuth();
  const [syncedState, setSyncedState] = useGlobalSync(`ludo_${roomId}`, null);

  const [showMyRestartModal, setShowMyRestartModal] = useState(false);
  const [waitingForPartnerRestart, setWaitingForPartnerRestart] = useState(false);
  const [showPartnerRestartModal, setShowPartnerRestartModal] = useState(false);

  const sendRestartAction = useBroadcast(`ludo_restart_${roomId}`, (action) => {
    if (action.sender === userId) return;
    if (action.type === 'request_restart') setShowPartnerRestartModal(true);
    else if (action.type === 'accept_restart') {
      performLocalReset();
      setWaitingForPartnerRestart(false);
      setShowPartnerRestartModal(false);
    } else if (action.type === 'decline_restart') {
      setWaitingForPartnerRestart(false);
      setShowPartnerRestartModal(false);
      alert(`${partnerName || 'Partner'} declined the restart request.`);
    }
  });

  const is2ColorsMode = config.colorsMode === '2_colors';
  const p1Colors = is2ColorsMode ? ['red', 'yellow'] : ['red'];
  const p2Colors = is2ColorsMode ? ['blue', 'green'] : ['yellow'];
  const p1WinsReq = is2ColorsMode ? 8 : 4;
  
  const turnOrder = is2ColorsMode ? ['red', 'blue', 'yellow', 'green'] : ['red', 'yellow'];

  const getNextTurnIndex = (currIdx, currentTokens) => {
    let nextIdx = currIdx;
    for (let i = 0; i < turnOrder.length; i++) {
      nextIdx = (nextIdx + 1) % turnOrder.length;
      const nextColor = turnOrder[nextIdx];
      const colorTokens = currentTokens.filter(t => t.color === nextColor);
      const finishedCount = colorTokens.filter(t => t.pos === 105).length;
      if (colorTokens.length > 0 && finishedCount < colorTokens.length) {
        return nextIdx;
      }
    }
    return nextIdx;
  };

  const [localGameState, setLocalGameState] = useState(() => ({
    tokens: INITIAL_TOKENS.filter(t => p1Colors.includes(t.color) || p2Colors.includes(t.color)),
    turnIndex: 0,
    diceValue: 1,
    diceRolled: false,
    rolling: false,
    status: 'playing',
    msg: "Player 1's turn to roll",
    p1Wins: 0,
    p2Wins: 0,
    perks: generateRandomPerks()
  }));

  const [gameOverOverlay, setGameOverOverlay] = useState(false);
  const processedWinRef = useRef(false);

  useEffect(() => {
    if (isMultiplayer && syncedState) {
      setLocalGameState(syncedState);
      if (syncedState.status === 'playing') {
        setGameOverOverlay(false);
        processedWinRef.current = false;
      }
    }
  }, [syncedState, isMultiplayer]);

  const updateGameState = (updates, isRemote = false) => {
    setLocalGameState(prev => {
      const newState = { ...prev, ...updates };
      if (isMultiplayer && !isRemote) {
        setSyncedState(newState);
      }
      return newState;
    });
  };

  const sendAction = useBroadcast(`ludo_action_${roomId}`, (action) => {
    if (action.sender === userId) return;
    if (action.type === 'roll_start') {
      updateGameState({ rolling: true }, true);
      playAudio('pop', sfx);
    } else if (action.type === 'roll_end') {
      updateGameState(action.state, true);
    } else if (action.type === 'move') {
      updateGameState(action.state, true);
      playAudio('tap', sfx);
    }
  });

  const didResetRef = useRef(false);
  useEffect(() => {
    if (isMultiplayer && isHost && !didResetRef.current && syncedState === null) {
      didResetRef.current = true;
      performLocalReset();
    }
  }, [isMultiplayer, isHost, syncedState]);

  const gameState = localGameState;
  const { tokens, turnIndex, diceValue, diceRolled, rolling, status, msg } = gameState;
  const currentTurnColor = turnOrder[turnIndex];
  
  const isMyTurn = isMultiplayer 
    ? (myPlayerId === 'p1' && p1Colors.includes(currentTurnColor)) || (myPlayerId === 'p2' && p2Colors.includes(currentTurnColor))
    : true;

  const rollDice = () => {
    if (status !== 'playing' || diceRolled || rolling) return;
    if (isMultiplayer && !isMyTurn) return;

    playAudio('pop', sfx);
    updateGameState({ rolling: true });
    if (isMultiplayer) sendAction({ type: 'roll_start', sender: userId });

    setTimeout(() => {
      // Cryptographically secure random roll
      let val;
      if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
        const array = new Uint32Array(1);
        window.crypto.getRandomValues(array);
        val = (array[0] % 6) + 1;
      } else {
        val = Math.floor(Math.random() * 6) + 1;
      }
      
      let nextMsg = `Rolled a ${val}.`;
      
      const myTokens = tokens.filter(t => t.color === currentTurnColor);
      let canMove = false;
      for (let t of myTokens) {
        if (t.pos === -1 && val === 6) { canMove = true; break; }
        if (t.pos >= 0 && t.pos < 100) { canMove = true; break; }
        if (t.pos >= 100 && t.pos + val <= 105) { canMove = true; break; }
      }

      let updates = { rolling: false, diceValue: val, diceRolled: true, msg: nextMsg };

      if (!canMove) {
        updates.msg = `Rolled a ${val}. No moves possible!`;
      }

      updateGameState(updates);
      if (isMultiplayer) sendAction({ type: 'roll_end', state: updates, sender: userId });

      if (!canMove) {
        setTimeout(() => nextTurn(val, updates), 1500);
      }
    }, 500); // 500ms rolling animation
  };

  const nextTurn = (val = diceValue, currentUpdates = {}) => {
    if (val === 6 && currentUpdates.diceRolled === false) { 
        updateGameState({ ...currentUpdates, diceRolled: false, msg: `${currentTurnColor} gets an extra turn for rolling 6!` });
        return;
    }

    let nextIdx = getNextTurnIndex(turnIndex, tokens);
    let nextColor = turnOrder[nextIdx];
    let nextUpdates = {
      ...currentUpdates,
      turnIndex: nextIdx,
      diceRolled: false,
      msg: `${nextColor}'s turn to roll`
    };
    
    updateGameState(nextUpdates);
  };

  const handleTokenClick = (token) => {
    if (status !== 'playing' || !diceRolled || rolling || token.color !== currentTurnColor) return;
    if (isMultiplayer && !isMyTurn) return;

    const val = diceValue;
    if (token.pos === -1 && val !== 6) return;

    playAudio('click', sfx);

    let newTokens = [...tokens];
    let tIdx = newTokens.findIndex(t => t.id === token.id);
    let targetPos = -1;
    let extraTurn = false;
    let newMsg = '';
    
    // Clear shield on move
    newTokens[tIdx].shielded = false;

    if (token.pos === -1 && val === 6) {
      targetPos = START_INDEX[token.color];
    } else if (token.pos >= 0 && token.pos < 100) {
      const startI = START_INDEX[token.color];
      let currRelative = (token.pos - startI + 52) % 52;
      let targetRelative = currRelative + val;
      
      if (targetRelative > 50) {
        let homeIndex = targetRelative - 51;
        if (homeIndex <= 5) targetPos = 100 + homeIndex;
        else return; 
      } else {
        targetPos = (token.pos + val) % 52;
      }
    } else if (token.pos >= 100) {
      if (token.pos + val <= 105) targetPos = token.pos + val;
      else return; 
    }

    if (targetPos === -1) return;

    // Apply perks if landed on a perk cell
    let perkUsed = null;
    let perksState = { ...gameState.perks };
    if (targetPos >= 0 && targetPos < 100 && perksState[targetPos]) {
      perkUsed = perksState[targetPos];
      delete perksState[targetPos]; // Use it once
    }

    if (perkUsed) {
      playAudio('success', sfx);
      if (perkUsed === 'extra_roll') {
        extraTurn = true;
        newMsg = `Landed on Extra Roll! ⚡`;
      } else if (perkUsed === 'boost') {
        // Boost +3 steps
        targetPos = (targetPos + 3) % 52;
        newMsg = `BOOSTED! +3 steps forward! 🚀`;
      } else if (perkUsed === 'shield') {
        newTokens[tIdx].shielded = true;
        newMsg = `Shielded from next capture! 🛡️`;
      }
    }

    // Capture check
    if (targetPos >= 0 && targetPos < 100 && !SAFE_SPOTS.includes(targetPos)) {
      let captureIdx = newTokens.findIndex(t => t.pos === targetPos && t.color !== token.color);
      if (captureIdx !== -1) {
        if (newTokens[captureIdx].shielded) {
          // Shield breaks, token is safe
          newTokens[captureIdx].shielded = false;
          playAudio('wood_thud', sfx);
          newMsg = (newMsg ? newMsg + " | " : "") + `${newTokens[captureIdx].color}'s Shield absorbed capture! 🛡️`;
        } else {
          // Capture opponent token
          newTokens[captureIdx].pos = -1;
          extraTurn = true;
          playAudio('sink', sfx);
          newMsg = (newMsg ? newMsg + " | " : "") + `Captured a ${newTokens[captureIdx].color} token! ⚔️`;
        }
      }
    }

    newTokens[tIdx].pos = targetPos;
    if (targetPos === 105) {
      extraTurn = true;
      newMsg = `Token reached home! 🎉`;
    }

    let updates = { tokens: newTokens, perks: perksState, diceRolled: false, msg: newMsg || 'Moved token.' };
    
    const p1Finished = newTokens.filter(t => p1Colors.includes(t.color) && t.pos === 105).length;
    const p2Finished = newTokens.filter(t => p2Colors.includes(t.color) && t.pos === 105).length;

    if (p1Finished === p1WinsReq) {
      updates.status = 'done';
      updates.p1Wins = gameState.p1Wins + 1;
    } else if (p2Finished === p1WinsReq) {
      updates.status = 'done';
      updates.p2Wins = gameState.p2Wins + 1;
    } else {
      if (extraTurn || val === 6) {
        if (!newMsg) updates.msg = "Extra turn!";
        else if (val === 6 && !extraTurn) updates.msg = newMsg + " | Extra turn for rolling 6!";
      } else {
        let nextIdx = getNextTurnIndex(turnIndex, newTokens);
        updates.turnIndex = nextIdx;
        updates.msg = `${turnOrder[nextIdx]}'s turn to roll`;
      }
    }

    updateGameState(updates);
    if (isMultiplayer) sendAction({ type: 'move', state: updates, sender: userId });
  };

  useEffect(() => {
    if (status === 'done' && !processedWinRef.current) {
      processedWinRef.current = true;
      setGameOverOverlay(true);
      playAudio('win', sfx);

      // Point system integration
      if (setScores) {
        const p1Finished = tokens.filter(t => p1Colors.includes(t.color) && t.pos === 105).length;
        const p2Finished = tokens.filter(t => p2Colors.includes(t.color) && t.pos === 105).length;
        
        let didIWin = false;
        if (isMultiplayer) {
          if (p1Finished === p1WinsReq && myPlayerId === 'p1') didIWin = true;
          if (p2Finished === p1WinsReq && myPlayerId === 'p2') didIWin = true;
        } else {
          if (p1Finished === p1WinsReq) didIWin = true;
        }

        if (didIWin) {
          setScores(prev => incrementUserScore(prev, userId, 'ludo', 1, myName || profile?.name || 'You'));
          if (onWin) onWin();
        }
      }
    }
  }, [status, sfx, setScores, tokens, isMultiplayer, myPlayerId, userId, myName, profile, onWin, p1Colors, p2Colors, p1WinsReq]);

  const performLocalReset = () => {
    updateGameState({
      tokens: INITIAL_TOKENS.filter(t => p1Colors.includes(t.color) || p2Colors.includes(t.color)),
      turnIndex: 0,
      diceValue: 1,
      diceRolled: false,
      rolling: false,
      status: 'playing',
      msg: "Player 1's turn to roll",
      perks: generateRandomPerks()
    });
    setGameOverOverlay(false);
    processedWinRef.current = false;
  };

  // AI Logic
  useEffect(() => {
    if (!isMultiplayer && status === 'playing' && p2Colors.includes(currentTurnColor)) {
      if (!diceRolled && !rolling) {
        const timer = setTimeout(() => rollDice(), 800);
        return () => clearTimeout(timer);
      } else if (diceRolled && !rolling) {
        const timer = setTimeout(() => {
          const myTokens = tokens.filter(t => t.color === currentTurnColor);
          let movable = [];
          for (let t of myTokens) {
            if (t.pos === -1 && diceValue === 6) movable.push(t);
            else if (t.pos >= 0 && t.pos < 100) movable.push(t);
            else if (t.pos >= 100 && t.pos + diceValue <= 105) movable.push(t);
          }
          if (movable.length > 0) {
            let target = movable[Math.floor(Math.random() * movable.length)];
            handleTokenClick(target);
          }
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [turnIndex, diceRolled, diceValue, status, rolling]);

  const getTokensAtCell = (c, r) => {
    return tokens.filter(t => {
      if (t.pos === -1 || t.pos === 105) return false;
      
      if (t.pos >= 0 && t.pos < 100) {
        const p = PATH[t.pos];
        return p[0] === c && p[1] === r;
      }
      if (t.pos >= 100 && t.pos < 105) {
        const hIdx = t.pos - 100;
        const p = HOME_STRETCH[t.color][hIdx];
        return p[0] === c && p[1] === r;
      }
      return false;
    });
  };

  const isSafeCell = (c, r) => {
    const idx = PATH.findIndex(p => p[0] === c && p[1] === r);
    return idx !== -1 && SAFE_SPOTS.includes(idx);
  };

  const renderPerkOnCell = (c, r) => {
    const idx = PATH.findIndex(p => p[0] === c && p[1] === r);
    if (idx !== -1 && gameState.perks && gameState.perks[idx]) {
      const perk = gameState.perks[idx];
      const emojis = {
        extra_roll: '⚡',
        boost: '🚀',
        shield: '🛡️'
      };
      const titles = {
        extra_roll: 'Extra Roll',
        boost: 'Boost +3',
        shield: 'Shield'
      };
      return (
        <div 
          title={titles[perk]} 
          className="absolute inset-0 flex items-center justify-center text-[10px] sm:text-xs pointer-events-none select-none z-0 animate-pulse"
        >
          {emojis[perk]}
        </div>
      );
    }
    return null;
  };

  const renderYardSlot = (slotIdx, color) => {
    const colorPrefix = color === 'red' ? 'r' : color === 'green' ? 'g' : color === 'yellow' ? 'y' : 'b';
    const tokenId = `${colorPrefix}${slotIdx}`;
    const token = tokens.find(t => t.id === tokenId);
    
    const isCurrentTurnAndMyToken = token && token.color === currentTurnColor && diceRolled && isMyTurn;
    const isMovable = token && isCurrentTurnAndMyToken && diceValue === 6;

    return (
      <div className="w-full h-full relative">
        {/* Base circle in the yard */}
        <div className="absolute inset-0 m-auto w-4/5 h-4/5 rounded-full border-[1.5px] border-black/30 bg-white" />
        <div className="absolute inset-0 m-auto w-3/5 h-3/5 rounded-full" style={{ backgroundColor: COLORS[color] }} />
        
        {/* Render Token if in Yard */}
        {token && token.pos === -1 && (
          <button
            onClick={() => handleTokenClick(token)}
            style={{
              backgroundColor: COLORS[color],
            }}
            className={`absolute inset-0 m-auto w-[85%] h-[85%] rounded-full border-2 border-black
              shadow-[2px_2px_0px_0px_rgba(0,0,0,0.4)]
              transition-all duration-300 z-10 hover:scale-110
              ${isMovable ? 'animate-pulse ring-2 ring-black ring-offset-1 z-20 cursor-pointer' : 'cursor-pointer'}
              after:content-[''] after:absolute after:top-[15%] after:left-[15%] after:w-[30%] after:h-[30%] after:bg-white/40 after:rounded-full
            `}
          />
        )}
      </div>
    );
  };

  const renderYards = () => {
    const yards = [
      { color: 'red', col: '1 / span 6', row: '1 / span 6' },
      { color: 'green', col: '10 / span 6', row: '1 / span 6' },
      { color: 'yellow', col: '10 / span 6', row: '10 / span 6' },
      { color: 'blue', col: '1 / span 6', row: '10 / span 6' }
    ];

    return yards.map(y => (
      <div key={y.color} style={{ gridColumn: y.col, gridRow: y.row, backgroundColor: COLORS[y.color] }} className="border-2 border-black flex items-center justify-center p-[15%]">
        <div className="w-full h-full bg-white border-2 border-black relative rounded-sm p-2 grid grid-cols-2 grid-rows-2 gap-2 sm:p-3 sm:gap-3">
          {renderYardSlot(0, y.color)}
          {renderYardSlot(1, y.color)}
          {renderYardSlot(2, y.color)}
          {renderYardSlot(3, y.color)}
        </div>
      </div>
    ));
  };

  const renderPaths = () => {
    const cells = [];
    
    // Arm helper to push cells with token rendering inside
    const pushCell = (c, r, bg) => {
      const cellTokens = getTokensAtCell(c, r);
      
      cells.push(
        <div 
          key={`cell-${r}-${c}`} 
          style={{ gridColumn: c+1, gridRow: r+1, backgroundColor: bg }} 
          className="border-[1.5px] border-black box-border relative flex items-center justify-center w-full h-full"
        >
          {isSafeCell(c, r) && (
            <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none text-xs font-bold select-none">★</div>
          )}

          {renderPerkOnCell(c, r)}

          {cellTokens.map((t, index) => {
            const isCurrentTurnAndMyToken = t.color === currentTurnColor && diceRolled && isMyTurn;
            const isMovable = isCurrentTurnAndMyToken && (
              (t.pos >= 0 && t.pos < 100) ||
              (t.pos >= 100 && t.pos + diceValue <= 105)
            );

            let transform = '';
            if (cellTokens.length > 1) {
              const offsetX = (index % 2 === 0 ? -1 : 1) * 3;
              const offsetY = (index > 1 ? 3 : -3);
              transform = `translate(${offsetX}px, ${offsetY}px) scale(0.85)`;
            }

            return (
              <button
                key={t.id}
                onClick={() => handleTokenClick(t)}
                style={{
                  backgroundColor: COLORS[t.color],
                  transform,
                  zIndex: 10 + index
                }}
                className={`absolute w-[80%] h-[80%] max-w-[24px] max-h-[24px] aspect-square rounded-full border-2 border-black
                  shadow-[2px_2px_0px_0px_rgba(0,0,0,0.4)]
                  transition-all duration-300 hover:scale-110
                  ${isMovable ? 'animate-pulse ring-2 ring-black ring-offset-1 z-30 cursor-pointer' : 'cursor-pointer'}
                  after:content-[''] after:absolute after:top-[15%] after:left-[15%] after:w-[30%] after:h-[30%] after:bg-white/40 after:rounded-full
                `}
              >
                {t.shielded && (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] pointer-events-none">🛡️</span>
                )}
              </button>
            );
          })}
        </div>
      );
    };

    // Top arm
    for (let r=0; r<6; r++) {
      for (let c=6; c<=8; c++) {
        let bg = 'white';
        let idx = PATH.findIndex(p => p[0]===c && p[1]===r);
        if (idx === START_INDEX.green) bg = COLORS.green;
        let homeIdx = HOME_STRETCH.green.findIndex(p => p[0]===c && p[1]===r);
        if (homeIdx !== -1) bg = COLORS.green;
        pushCell(c, r, bg);
      }
    }
    // Bottom arm
    for (let r=9; r<15; r++) {
      for (let c=6; c<=8; c++) {
        let bg = 'white';
        let idx = PATH.findIndex(p => p[0]===c && p[1]===r);
        if (idx === START_INDEX.blue) bg = COLORS.blue;
        let homeIdx = HOME_STRETCH.blue.findIndex(p => p[0]===c && p[1]===r);
        if (homeIdx !== -1) bg = COLORS.blue;
        pushCell(c, r, bg);
      }
    }
    // Left arm
    for (let r=6; r<=8; r++) {
      for (let c=0; c<6; c++) {
        let bg = 'white';
        let idx = PATH.findIndex(p => p[0]===c && p[1]===r);
        if (idx === START_INDEX.red) bg = COLORS.red;
        let homeIdx = HOME_STRETCH.red.findIndex(p => p[0]===c && p[1]===r);
        if (homeIdx !== -1) bg = COLORS.red;
        pushCell(c, r, bg);
      }
    }
    // Right arm
    for (let r=6; r<=8; r++) {
      for (let c=9; c<15; c++) {
        let bg = 'white';
        let idx = PATH.findIndex(p => p[0]===c && p[1]===r);
        if (idx === START_INDEX.yellow) bg = COLORS.yellow;
        let homeIdx = HOME_STRETCH.yellow.findIndex(p => p[0]===c && p[1]===r);
        if (homeIdx !== -1) bg = COLORS.yellow;
        pushCell(c, r, bg);
      }
    }

    return cells;
  };

  const getFinishedCount = (color) => tokens.filter(t => t.color === color && t.pos === 105).length;



  // Determine dice position based on turn
  const dicePositionMap = {
    red: 'absolute -top-16 left-4 sm:top-4 sm:-left-24',
    green: 'absolute -top-16 right-4 sm:top-4 sm:-right-24',
    yellow: 'absolute -bottom-16 right-4 sm:bottom-4 sm:-right-24',
    blue: 'absolute -bottom-16 left-4 sm:bottom-4 sm:-left-24'
  };

  return (
    <>
      <RetroWindow title={`Ludo - ${is2ColorsMode ? '4 Tokens' : '2 Tokens'}`} className="w-full max-w-2xl h-[calc(100dvh-4rem)] max-h-[680px] flex flex-col" onClose={onBack} confirmOnClose sfx={sfx}>
        
        <div className="flex-1 w-full bg-[var(--bg-main)] flex flex-col items-center justify-center relative overflow-hidden">
          
          <div className="flex w-full max-w-[420px] justify-between px-4 py-2 bg-[var(--bg-window)] border-b-2 border-black z-20 mb-2">
            <div className="font-bold text-sm" style={{color: COLORS[p1Colors[0]]}}>P1: {p1Colors.join(', ')}</div>
            <div className="font-black text-sm uppercase px-4 bg-black text-white">{msg}</div>
            <div className="font-bold text-sm" style={{color: COLORS[p2Colors[0]]}}>P2: {p2Colors.join(', ')}</div>
          </div>

          <div className="relative w-full max-w-[420px] aspect-square mt-16 mb-16 sm:my-4 shrink-0">
            {/* Main Board with border, hard shadow and overflow hidden */}
            <div className="w-full h-full bg-white border-4 border-black p-0 shadow-[4px_4px_0px_0px_#000] overflow-hidden relative">
              <div className="w-full h-full grid relative" style={{ gridTemplateColumns: 'repeat(15, minmax(0, 1fr))', gridTemplateRows: 'repeat(15, minmax(0, 1fr))' }}>
                
                {renderYards()}
                {renderPaths()}
                
                {/* Center triangles */}
                <div className="relative w-full h-full" style={{ gridColumn: '7 / span 3', gridRow: '7 / span 3' }}>
                  <div className="absolute inset-0 bg-[#e52c27]" style={{ clipPath: 'polygon(0 0, 50% 50%, 0 100%)' }} />
                  <div className="absolute inset-0 bg-[#009e4d]" style={{ clipPath: 'polygon(0 0, 100% 0, 50% 50%)' }} />
                  <div className="absolute inset-0 bg-[#ffcf00]" style={{ clipPath: 'polygon(100% 0, 100% 100%, 50% 50%)' }} />
                  <div className="absolute inset-0 bg-[#2051a5]" style={{ clipPath: 'polygon(0 100%, 50% 50%, 100% 100%)' }} />
                  <div className="absolute inset-0 border-2 border-black pointer-events-none" />
                  
                  {/* Finished token indicators inside the triangles */}
                  <div className="absolute left-1.5 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-10">
                    {Array.from({ length: getFinishedCount('red') }).map((_, i) => (
                      <div key={i} className="w-2.5 h-2.5 rounded-full border border-black shadow-[1px_1px_0px_#000]" style={{ backgroundColor: COLORS.red }} />
                    ))}
                  </div>
                  <div className="absolute top-1.5 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                    {Array.from({ length: getFinishedCount('green') }).map((_, i) => (
                      <div key={i} className="w-2.5 h-2.5 rounded-full border border-black shadow-[1px_1px_0px_#000]" style={{ backgroundColor: COLORS.green }} />
                    ))}
                  </div>
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-10">
                    {Array.from({ length: getFinishedCount('yellow') }).map((_, i) => (
                      <div key={i} className="w-2.5 h-2.5 rounded-full border border-black shadow-[1px_1px_0px_#000]" style={{ backgroundColor: COLORS.yellow }} />
                    ))}
                  </div>
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                    {Array.from({ length: getFinishedCount('blue') }).map((_, i) => (
                      <div key={i} className="w-2.5 h-2.5 rounded-full border border-black shadow-[1px_1px_0px_#000]" style={{ backgroundColor: COLORS.blue }} />
                    ))}
                  </div>

                  {/* Diagonal lines to outline triangles */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-black stroke-[2px]">
                     <line x1="0" y1="0" x2="100%" y2="100%" />
                     <line x1="100%" y1="0" x2="0" y2="100%" />
                  </svg>
                </div>

              </div>
            </div>

            {/* Dice Overlay placed relative to the board wrapper container */}
            <div className={`${dicePositionMap[currentTurnColor]} transition-all duration-700 ease-in-out z-50 flex flex-col items-center gap-1 pointer-events-none`}>
               <div className="pointer-events-auto cursor-pointer" onClick={rollDice}>
                  <Dice value={diceValue} rolling={rolling} color={COLORS[currentTurnColor]} />
               </div>
               {status === 'playing' && !diceRolled && isMyTurn && !rolling && (
                  <div className="bg-black text-white text-[10px] font-black px-2 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] animate-bounce pointer-events-none mt-1 uppercase tracking-widest border-2 border-black">Roll!</div>
               )}
            </div>
          </div>

        </div>
      </RetroWindow>

      {/* Restart Modals */}
      {showMyRestartModal && (
        <ConfirmDialog
          title="restart.exe"
          message="Request game restart?"
          showCancel={true}
          onConfirm={() => {
            setShowMyRestartModal(false);
            setWaitingForPartnerRestart(true);
            sendRestartAction({ type: 'request_restart', sender: userId });
          }}
          onCancel={() => setShowMyRestartModal(false)}
          sfx={sfx}
        />
      )}
      {waitingForPartnerRestart && (
        <div className="fixed inset-0 z-[var(--z-modal)] bg-black/35 flex items-center justify-center p-4">
          <RetroWindow title="waiting.exe" onClose={() => { setWaitingForPartnerRestart(false); sendRestartAction({ type: 'decline_restart', sender: userId }); }}>
            <div className="text-center p-4 font-bold text-primary animate-pulse">WAITING FOR PARTNER...</div>
          </RetroWindow>
        </div>
      )}
      {showPartnerRestartModal && (
        <ConfirmDialog
          title="restart.exe"
          message={`${partnerName || 'Partner'} wants to restart. Accept?`}
          showCancel={true}
          onConfirm={() => {
            performLocalReset();
            sendRestartAction({ type: 'accept_restart', sender: userId });
            setShowPartnerRestartModal(false);
          }}
          onCancel={() => {
            sendRestartAction({ type: 'decline_restart', sender: userId });
            setShowPartnerRestartModal(false);
          }}
          sfx={sfx}
        />
      )}

      {gameOverOverlay && (
        <ShareOutcomeOverlay
          isSolo={!isMultiplayer}
          gameName="Ludo"
          stats={{Result: `${gameState.p1Wins > gameState.p2Wins ? 'Player 1' : 'Player 2'} wins!`}}
          onClose={() => {performLocalReset(); onBack();}}
          onRematch={() => {
            if (isMultiplayer) {
              setShowMyRestartModal(true);
            } else {
              performLocalReset();
            }
          }}
          onShareToChat={onShareToChat}
          onSaveToScrapbook={onSaveToScrapbook}
          sfx={sfx}
          partnerNickname={partnerName}
        />
      )}
    </>
  );
}

