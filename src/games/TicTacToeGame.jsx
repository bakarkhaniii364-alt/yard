import React, { useState, useEffect, useRef } from 'react';
import { RetroWindow, RetroButton, ShareOutcomeOverlay, ConfirmDialog } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { getScore } from '../utils/helpers.js';
import { incrementUserScore } from '../utils/userDataHelpers.js';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { useGlobalSync, useBroadcast } from '../hooks/useSupabaseSync.js';
import { useAuth } from '../context/instances.js';
import { RefreshCw } from 'lucide-react';

export function TicTacToe({ config, setScores, onBack, sfx, onWin, onShareToChat, onSaveToScrapbook, profile, myName, userId, isHost, isMultiplayer, myPlayerId, oppPlayerId, partnerName }) {
  const { roomId } = useAuth();
  const [syncedState, setSyncedState] = useGlobalSync(`tictactoe_${roomId}`, null);
  
  // Restart handshake states
  const [showMyRestartModal, setShowMyRestartModal] = useState(false);
  const [waitingForPartnerRestart, setWaitingForPartnerRestart] = useState(false);
  const [showPartnerRestartModal, setShowPartnerRestartModal] = useState(false);

  const sendRestartAction = useBroadcast(`ttt_restart_${roomId}`, (action) => {
    if (action.sender === userId) return;
    if (action.type === 'request_restart') {
      setShowPartnerRestartModal(true);
    } else if (action.type === 'accept_restart') {
      performLocalReset();
      setWaitingForPartnerRestart(false);
      setShowPartnerRestartModal(false);
    } else if (action.type === 'decline_restart') {
      setWaitingForPartnerRestart(false);
      setShowPartnerRestartModal(false);
      alert(`${partnerName || 'Partner'} declined the restart request.`);
    }
  });

  const size = config.size || 3;
  const p1 = config.p1Avatar || 'X';
  const p2 = config.p2Avatar || 'O';
  const matchType = config.matchType || 1;
  const winsRequired = Math.ceil(matchType / 2);

  const [localGameState, setLocalGameState] = useState({
    board: Array(size * size).fill(null),
    xIsNext: true,
    p1Wins: 0,
    p2Wins: 0,
    pieceQueue: [],
    winLine: null,
    status: 'playing'
  });

  // Zero-Latency Sync: Local state is source of truth for UI, but synced with DB
  useEffect(() => {
    if (isMultiplayer && syncedState) {
      setLocalGameState(syncedState);
      // If remote state resets to 'playing', dismiss any lingering game-over overlay
      if (syncedState.status === 'playing') {
        setGameOverOverlay(false);
        processedWinRef.current = false;
      }
    }
  }, [syncedState, isMultiplayer]);

  const gameState = localGameState;

  const updateGameState = (updates, isRemote = false) => {
    setLocalGameState(prev => {
      const newState = { ...(prev || {}), ...updates };
      // Only push to DB if we are the one making the move
      if (isMultiplayer && !isRemote) {
        setSyncedState(newState);
      }
      return newState;
    });
  };

  const board = gameState?.board || Array(size * size).fill(null);
  const xIsNext = gameState?.xIsNext ?? true;
  const p1Wins = gameState?.p1Wins || 0;
  const p2Wins = gameState?.p2Wins || 0;
  const pieceQueue = gameState?.pieceQueue || [];
  const winLine = gameState?.winLine || null;

  const [gameOverOverlay, setGameOverOverlay] = useState(false);
  const processedWinRef = useRef(false);
  const [stats, setLocalStats] = useLocalStorage('tictactoe_lifetime', { wins: 0, losses: 0, draws: 0 });

  // State ref for broadcast listener
  const gameStateRef = useRef({ board, xIsNext, p1Wins, p2Wins, pieceQueue, winLine, gameState, gameOverOverlay, myPlayerId, p1, p2 });
  
  // Update ref when state changes
  useEffect(() => {
    gameStateRef.current = { board, xIsNext, p1Wins, p2Wins, pieceQueue, winLine, gameState, gameOverOverlay, myPlayerId, p1, p2 };
  }, [board, xIsNext, p1Wins, p2Wins, pieceQueue, winLine, gameState, gameOverOverlay, myPlayerId, p1, p2]);
  
  // Broadcast listener for incoming moves
  const sendMove = useBroadcast(`ttt_move_${roomId}`, (move) => {
    if (move.sender === userId) return;
    handleMove(move.index, true);
  });

  // Initialize multiplayer game state on session startup
  const didResetRef = useRef(false);
  useEffect(() => {
    if (isMultiplayer && isHost && !didResetRef.current && syncedState === null) {
      didResetRef.current = true;
      updateGameState({
        board: Array(size * size).fill(null),
        xIsNext: true,
        p1Wins: 0,
        p2Wins: 0,
        pieceQueue: [],
        winLine: null,
        status: 'playing'
      });
    }
  }, [isMultiplayer, isHost, size, syncedState]);

  const calculateWinner = (squares) => {
    const minReq = size === 3 ? 3 : 4;
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const player = squares[r * size + c];
            if (!player) continue;
            if (c + minReq <= size) {
                let match = true; const path = [];
                for(let k=0; k<minReq; k++) { path.push(r * size + c + k); if(squares[r * size + c + k] !== player) match = false; }
                if (match) return { player, line: path, dir: 'h' };
            }
            if (r + minReq <= size) {
                let match = true; const path = [];
                for(let k=0; k<minReq; k++) { path.push((r + k) * size + c); if(squares[(r + k) * size + c] !== player) match = false; }
                if (match) return { player, line: path, dir: 'v' };
            }
            if (r + minReq <= size && c + minReq <= size) {
                let match = true; const path = [];
                for(let k=0; k<minReq; k++) { path.push((r + k) * size + c + k); if(squares[(r + k) * size + c + k] !== player) match = false; }
                if (match) return { player, line: path, dir: 'd1' };
            }
            if (r + minReq <= size && c - minReq + 1 >= 0) {
                let match = true; const path = [];
                for(let k=0; k<minReq; k++) { path.push((r + k) * size + c - k); if(squares[(r + k) * size + c - k] !== player) match = false; }
                if (match) return { player, line: path, dir: 'd2' };
            }
        }
    }
    return null;
  };

  const handleMove = (i, isRemote = false) => {
    if (board[i] || winLine || gameState.status === 'done' || gameOverOverlay) return;
    
    // Multiplayer turn check
    if (isMultiplayer && !isRemote) {
      const myTurn = (myPlayerId === 'p1' && xIsNext) || (myPlayerId === 'p2' && !xIsNext);
      if (!myTurn) return;
    }

    const player = xIsNext ? p1 : p2;
    handlePlacePiece(i, player, isRemote);

    if (isMultiplayer && !isRemote) {
      sendMove({ index: i, sender: userId });
    }
  };

  const handlePlacePiece = (i, player, isRemote = false) => {
    playAudio('chalk', sfx); 
    let newBoard = [...board]; 
    let newQueue = [...pieceQueue];
    
    if (config.mode === 'memory') {
      const maxPieces = size === 3 ? 3 : 4;
      const playerPieces = newQueue.filter(p => p.player === player);
      if (playerPieces.length >= maxPieces) { 
        const oldest = newQueue.find(p => p.player === player); 
        newBoard[oldest.index] = null; 
        newQueue = newQueue.filter(p => p !== oldest); 
      }
      newQueue.push({ player, index: i });
    }
    
    newBoard[i] = player; 
    
    const winInfo = calculateWinner(newBoard);
    const isDraw = !winInfo && newBoard.every(sq => sq !== null);

    const nextX = player === p1 ? false : true;

    updateGameState({
      board: newBoard,
      pieceQueue: newQueue,
      xIsNext: nextX,
      winLine: winInfo ? winInfo.line : null,
      status: (winInfo || isDraw) ? 'done' : 'playing'
    }, isRemote);
  };

  const winData = calculateWinner(board); 
  const isDraw = !winData && board.every(sq => sq !== null);

  useEffect(() => {
    if (winData && !processedWinRef.current) {
      processedWinRef.current = true;
      playAudio('win', sfx);
      
      const newP1Wins = winData.player === p1 ? p1Wins + 1 : p1Wins;
      const newP2Wins = winData.player === p2 ? p2Wins + 1 : p2Wins;
      const matchOver = newP1Wins >= winsRequired || newP2Wins >= winsRequired;

      setTimeout(() => {
          if (matchOver) {
              setGameOverOverlay(true);
              if (winData.player === p1) {
                  if (onWin) onWin(); 
                  if (setScores) setScores(prev => incrementUserScore(prev, userId, 'tictactoe', 1, myName || profile?.name || 'You'));
                  setLocalStats(p => ({...p, wins: p.wins+1}));
              } else {
                  setLocalStats(p => ({...p, losses: p.losses+1}));
              }
          } else {
              updateGameState({
                board: Array(size * size).fill(null),
                pieceQueue: [],
                winLine: null,
                xIsNext: true,
                p1Wins: newP1Wins,
                p2Wins: newP2Wins,
                status: 'playing'
              });
          }
      }, 1500);
      
    } else if (isDraw && !processedWinRef.current) { 
        processedWinRef.current = true;
        setTimeout(() => {
             setLocalStats(p => ({...p, draws: p.draws+1}));
             updateGameState({
               board: Array(size * size).fill(null),
               pieceQueue: [],
               winLine: null,
               xIsNext: true,
               status: 'playing'
             });
        }, 1500); 
    } else if (!winData && !isDraw) {
        processedWinRef.current = false;
    }
  }, [winData, isDraw]);

  // AI Logic
  useEffect(() => {
    if (config.mode === 'vs_ai' && !xIsNext && !winData && !isDraw && gameState.status === 'playing') { 
        const timer = setTimeout(() => { 
            const aiMove = makeAIMove([...board], size, p2, p1, config.diff || 'medium'); 
            if (aiMove !== null) handleMove(aiMove, true); 
        }, 400); 
        return () => clearTimeout(timer); 
    }
  }, [xIsNext, board, winData, isDraw, config, gameState.status]);

  const handleClick = (i) => { 
    handleMove(i, false);
  };
  
  const performLocalReset = () => {
    updateGameState({
      board: Array(size*size).fill(null),
      xIsNext: true,
      p1Wins: 0,
      p2Wins: 0,
      pieceQueue: [],
      winLine: null,
      status: 'playing'
    });
    setGameOverOverlay(false);
    processedWinRef.current = false;
  };

  const resetSeries = () => { 
    playAudio('click', sfx); 
    if (isMultiplayer) {
      setShowMyRestartModal(true);
    } else {
      performLocalReset();
    }
  };



  const renderWinLine = () => {
    if (!winLine || size > 3) return null; // Simplified CSS line for 3x3. For 4x4 and 5x5, dynamic strike lines are complex.
    const [a, b, c] = winLine; let style = {};
    if (a === 0 && c === 2) style = { top: '16%', left: '5%', width: '90%', height: '8px' }; else if (a === 3 && c === 5) style = { top: '50%', left: '5%', width: '90%', height: '8px', transform: 'translateY(-50%)' }; else if (a === 6 && c === 8) style = { bottom: '16%', left: '5%', width: '90%', height: '8px' }; else if (a === 0 && c === 6) style = { left: '16%', top: '5%', height: '90%', width: '8px' }; else if (a === 1 && c === 7) style = { left: '50%', top: '5%', height: '90%', width: '8px', transform: 'translateX(-50%)' }; else if (a === 2 && c === 8) style = { right: '16%', top: '5%', height: '90%', width: '8px' }; else if (a === 0 && c === 8) style = { top: '50%', left: '-10%', width: '120%', height: '8px', transform: 'rotate(45deg)' }; else if (a === 2 && c === 6) style = { top: '50%', left: '-10%', width: '120%', height: '8px', transform: 'rotate(-45deg)' }; 
    return <div className="absolute bg-[var(--primary)] retro-border shadow-[0_0_15px_var(--primary)] z-10 pointer-events-none rounded-full animate-in zoom-in-0" style={style}></div>;
  };

  const oppName = isMultiplayer 
    ? `${partnerName || 'Partner'} (${p2})` 
    : (config.mode === '1v1_local' || config.mode === 'memory' ? `P2 (${p2})` : `AI (${p2})`);

  const renderCrowns = (wins) => {
      let crowns = [];
      for(let i=0; i<winsRequired; i++) {
          crowns.push(<span key={i} className={`text-xl ${i < wins ? 'text-yellow-400 opacity-100' : 'text-gray-400 opacity-30 grayscale'} drop-shadow-md`}>👑</span>);
      }
      return <div className="flex gap-1">{crowns}</div>;
  }

  // Calculate cell size
  const cellSize = size === 3 ? 'w-20 h-20 sm:w-24 sm:h-24 text-4xl' : size === 4 ? 'w-16 h-16 sm:w-20 sm:h-20 text-3xl' : 'w-12 h-12 sm:w-16 sm:h-16 text-2xl';

  return (
    <>
    <RetroWindow title={`${myName || 'You'} vs ${isMultiplayer ? (partnerName || 'Partner') : 'AI'} - TicTacToe`} className="w-full max-w-md h-[calc(100dvh-4rem)] max-h-[750px]" onClose={onBack} confirmOnClose sfx={sfx}>
      <div className="flex flex-col items-center pb-8 pt-4">
        
        {matchType > 1 && (
            <div className="flex w-full justify-between px-4 sm:px-8 mb-6 bg-[var(--bg-window)] retro-border p-2 shadow-inner">
                <div className="flex flex-col items-center"><span className="text-[var(--primary-hover)] font-bold text-sm mb-1">P1 ({p1})</span>{renderCrowns(p1Wins)}</div>
                <div className="font-bold text-xs opacity-50 uppercase tracking-widest pt-5">Best of {matchType}</div>
                <div className="flex flex-col items-center"><span className="text-[var(--secondary)] font-bold text-sm mb-1">{oppName}</span>{renderCrowns(p2Wins)}</div>
            </div>
        )}

        {matchType === 1 && <div className="flex w-full justify-between px-8 mb-4 font-bold text-lg"><span className="text-[var(--primary-hover)]">P1 ({p1}): {p1Wins}</span><span className="text-[var(--secondary)]">{oppName}: {p2Wins}</span></div>}

        <div className={`mb-6 font-bold text-sm sm:text-lg px-6 py-2 retro-border retro-shadow-dark text-center w-3/4 max-w-xs ${!winData && !isDraw ? (xIsNext ? 'retro-bg-primary' : 'retro-bg-secondary') : 'retro-bg-accent'}`}>{winData ? `Round to ${winData.player}!` : isDraw ? "Round Draw!" : config.mode === 'vs_ai' ? (xIsNext ? `Your Turn (${p1})` : 'AI is thinking...') : `Player ${xIsNext ? p1 : p2}'s Turn`}</div>
        
        <div className="relative p-2 bg-[var(--border)] retro-border retro-shadow-dark rounded-sm">
          <div className="grid gap-2 z-0 relative" style={{gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`}}>
            {board.map((cell, i) => {
              let isFading = false;
              let isWinningPiece = false;
              if (config.mode === 'memory' && cell) { 
                  const playerPieces = pieceQueue.filter(p => p.player === cell); 
                  const maxP = size===3?3:4;
                  if (playerPieces.length === maxP && playerPieces[0].index === i) isFading = true; 
              }
              if (winLine && winLine.includes(i)) isWinningPiece = true;

              return ( 
                  <button key={i} onClick={() => handleClick(i)} className={`${cellSize} retro-bg-window flex items-center justify-center font-bold transition-all duration-300 transform ${isFading && !winData ? 'animate-pulse opacity-30 drop-shadow-none' : ''} ${isDraw ? 'animate-fall opacity-0 delay-700' : ''} ${isWinningPiece ? 'scale-110 !bg-[var(--accent)] ring-2 ring-[var(--border)] z-10' : ''}`}><span className={cell === p1 ? 'text-[var(--primary-hover)] drop-shadow-md' : 'text-[var(--secondary)] drop-shadow-md'}>{cell}</span></button> 
              )
            })}
          </div>
          {renderWinLine()}
        </div>
        <RetroButton className="mt-8 px-6 py-3 text-sm opacity-80 border-dashed" onClick={resetSeries}><RefreshCw size={14} className="inline mr-2" /> restart series</RetroButton>
      </div>
    </RetroWindow>

    {showMyRestartModal && (
      <ConfirmDialog
        title="restart_series.exe"
        message="Are you sure you want to request a game series restart?"
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
      <div className="fixed inset-0 z-[var(--z-modal)] bg-black/35 flex items-center justify-center p-4 animate-in fade-in duration-200">
        <RetroWindow title="waiting.exe" onClose={() => {
          setWaitingForPartnerRestart(false);
          sendRestartAction({ type: 'decline_restart', sender: userId });
        }} className="w-full max-w-sm">
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <span className="text-sm font-bold animate-pulse text-primary">WAITING FOR PARTNER...</span>
            <p className="text-xs opacity-75 font-medium">Sent a request to restart the series to {partnerName || 'partner'}.</p>
            <RetroButton variant="secondary" className="mt-4 px-6 py-2" onClick={() => {
              setWaitingForPartnerRestart(false);
              sendRestartAction({ type: 'decline_restart', sender: userId });
            }}>Cancel Request</RetroButton>
          </div>
        </RetroWindow>
      </div>
    )}

    {showPartnerRestartModal && (
      <ConfirmDialog
        title="restart_requested.exe"
        message={`Your partner ${partnerName || ''} wants to restart the game series. Restart?`}
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
        isSolo={(typeof config !== "undefined" && config?.mode === "solo") || (typeof mode !== "undefined" && mode === "solo") || (typeof gameMode !== "undefined" && gameMode === "solo") || (typeof config !== "undefined" && config?.mode === "practice")}
        gameName={`Tic-Tac-Toe (${config.mode})`}
        stats={{ Series: `Best of ${matchType}`, Result: `${p1Wins >= winsRequired ? p1 : p2} takes the crown!`, "Final Score": `${p1Wins} - ${p2Wins}`, "Life Wins": stats.wins, "Life Losses": stats.losses }}
        onClose={() => {performLocalReset(); onBack();}}
        onRematch={resetSeries}
        onShareToChat={onShareToChat}
        onSaveToScrapbook={onSaveToScrapbook}
        sfx={sfx}
        partnerNickname={config.mode === 'vs_ai' ? 'AI' : undefined}
      />
    )}
    </>
  );
}

function makeAIMove(board, size, aiPlayer, humanPlayer, difficulty) {
    const emptyCells = board.map((c, i) => c === null ? i : null).filter(c => c !== null);
    if (emptyCells.length === 0) return null;

    // Difficulty-based randomness
    const randomChance = difficulty === 'easy' ? 0.6 : difficulty === 'medium' ? 0.3 : 0.05;
    if (Math.random() < randomChance) {
        return emptyCells[Math.floor(Math.random() * emptyCells.length)];
    }

    // 1. Can AI win in next move?
    for (let move of emptyCells) {
        const tempBoard = [...board];
        tempBoard[move] = aiPlayer;
        if (checkWin(tempBoard, size, aiPlayer)) return move;
    }

    // 2. Can Human win in next move? (Block them)
    for (let move of emptyCells) {
        const tempBoard = [...board];
        tempBoard[move] = humanPlayer;
        if (checkWin(tempBoard, size, humanPlayer)) return move;
    }

    // 3. Strategic moves (Center, then corners, then random)
    const center = Math.floor((size * size) / 2);
    if (board[center] === null) return center;

    const corners = [0, size - 1, size * (size - 1), size * size - 1];
    const availableCorners = corners.filter(i => board[i] === null);
    if (availableCorners.length > 0) return availableCorners[Math.floor(Math.random() * availableCorners.length)];

    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
}

function checkWin(squares, size, player) {
    const minReq = size === 3 ? 3 : 4;
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (squares[r * size + c] !== player) continue;
            if (c + minReq <= size) {
                let match = true;
                for(let k=0; k<minReq; k++) { if(squares[r * size + c + k] !== player) match = false; }
                if (match) return true;
            }
            if (r + minReq <= size) {
                let match = true;
                for(let k=0; k<minReq; k++) { if(squares[(r + k) * size + c] !== player) match = false; }
                if (match) return true;
            }
            if (r + minReq <= size && c + minReq <= size) {
                let match = true;
                for(let k=0; k<minReq; k++) { if(squares[(r + k) * size + c + k] !== player) match = false; }
                if (match) return true;
            }
            if (r + minReq <= size && c - minReq + 1 >= 0) {
                let match = true;
                for(let k=0; k<minReq; k++) { if(squares[(r + k) * size + c - k] !== player) match = false; }
                if (match) return true;
            }
        }
    }
    return false;
}
