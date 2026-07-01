import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RetroWindow, RetroButton, ShareOutcomeOverlay } from '../components/UI.jsx';
import { useGlobalSync } from '../hooks/useSupabaseSync.js';
import { playAudio } from '../utils/audio.js';
import { AlertCircle } from 'lucide-react';

const SIZE = 8;
const EMPTY = 0;
const BLACK = 1;
const WHITE = -1;

const DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1]
];

// Heuristic weights for AI
const WEIGHTS = [
  [120, -20,  20,   5,   5,  20, -20, 120],
  [-20, -40,  -5,  -5,  -5,  -5, -40, -20],
  [ 20,  -5,  15,   3,   3,  15,  -5,  20],
  [  5,  -5,   3,   3,   3,   3,  -5,   5],
  [  5,  -5,   3,   3,   3,   3,  -5,   5],
  [ 20,  -5,  15,   3,   3,  15,  -5,  20],
  [-20, -40,  -5,  -5,  -5,  -5, -40, -20],
  [120, -20,  20,   5,   5,  20, -20, 120]
];

const getInitialBoard = () => {
  const b = Array(SIZE).fill(null).map(() => Array(SIZE).fill(EMPTY));
  b[3][3] = WHITE;
  b[4][4] = WHITE;
  b[3][4] = BLACK;
  b[4][3] = BLACK;
  return b;
};

const getFlips = (board, r, c, player) => {
  if (board[r][c] !== EMPTY) return [];
  const flips = [];
  for (const [dr, dc] of DIRS) {
    let nr = r + dr, nc = c + dc;
    const currentFlips = [];
    while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === -player) {
      currentFlips.push([nr, nc]);
      nr += dr;
      nc += dc;
    }
    if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === player && currentFlips.length > 0) {
      flips.push(...currentFlips);
    }
  }
  return flips;
};

const getValidMoves = (board, player) => {
  const moves = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (getFlips(board, r, c, player).length > 0) moves.push({ r, c });
    }
  }
  return moves;
};

const countPieces = (board) => {
  let b = 0, w = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === BLACK) b++;
      else if (board[r][c] === WHITE) w++;
    }
  }
  return { b, w };
};

// Minimax AI
const evaluate = (board, player) => {
  let score = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== EMPTY) {
        score += board[r][c] * WEIGHTS[r][c];
      }
    }
  }
  return player === BLACK ? score : -score;
};

const minimax = (board, depth, alpha, beta, player) => {
  const moves = getValidMoves(board, player);
  if (depth === 0 || moves.length === 0) {
    if (moves.length === 0 && getValidMoves(board, -player).length === 0) {
      const { b, w } = countPieces(board);
      return (b - w) * 1000 * player; // Terminal state bonus
    }
    return evaluate(board, player);
  }

  let maxEval = -Infinity;
  for (const { r, c } of moves) {
    const newBoard = board.map(row => [...row]);
    const flips = getFlips(newBoard, r, c, player);
    newBoard[r][c] = player;
    for (const [fr, fc] of flips) newBoard[fr][fc] = player;
    
    const ev = -minimax(newBoard, depth - 1, -beta, -alpha, -player);
    maxEval = Math.max(maxEval, ev);
    alpha = Math.max(alpha, ev);
    if (beta <= alpha) break;
  }
  return maxEval;
};

const getBestMove = (board, player, diff) => {
  const depth = diff === 'hard' ? 4 : diff === 'medium' ? 2 : 1;
  const moves = getValidMoves(board, player);
  if (moves.length === 0) return null;
  
  // Randomness for easy mode
  if (diff === 'easy' && Math.random() > 0.5) return moves[Math.floor(Math.random() * moves.length)];

  let bestMove = null;
  let maxEval = -Infinity;
  for (const { r, c } of moves) {
    const newBoard = board.map(row => [...row]);
    const flips = getFlips(newBoard, r, c, player);
    newBoard[r][c] = player;
    for (const [fr, fc] of flips) newBoard[fr][fc] = player;
    
    const ev = -minimax(newBoard, depth - 1, -Infinity, Infinity, -player);
    if (ev > maxEval) {
      maxEval = ev;
      bestMove = { r, c };
    }
  }
  return bestMove || moves[0];
};

export function OthelloGame({ config, sfx, userId, partnerId, setScores, onWin, onBack, roomId, partnerName, myName, isHost, isMultiplayer }) {
  const myColor = isMultiplayer ? (userId > partnerId ? BLACK : WHITE) : BLACK;
  const aiColor = WHITE;


  const [gameState, setGameState] = useGlobalSync(`othello_${roomId}`, {
    board: getInitialBoard(),
    turn: BLACK,
    history: [],
    gameOver: false,
    winner: null,
    skipMessage: null
  });

  useEffect(() => {
    if (isHost && (!gameState || gameState.gameOver)) {
      setGameState({
        board: getInitialBoard(),
        turn: BLACK,
        history: [],
        gameOver: false,
        winner: null,
        skipMessage: null
      });
    }
  }, [isHost, gameState?.gameOver]);

  const board = gameState?.board || getInitialBoard();
  const currentTurn = gameState?.turn || BLACK;
  const gameOver = gameState?.gameOver;

  const validMoves = useMemo(() => getValidMoves(board, currentTurn), [board, currentTurn]);
  const isMyTurn = !isMultiplayer ? currentTurn === myColor : currentTurn === myColor;

  const checkGameState = useCallback((b, t) => {
    const myMoves = getValidMoves(b, t);
    const oppMoves = getValidMoves(b, -t);
    
    if (myMoves.length === 0 && oppMoves.length === 0) {
      const { b: black, w: white } = countPieces(b);
      let winnerColor = null;
      if (black > white) winnerColor = BLACK;
      if (white > black) winnerColor = WHITE;
      return { over: true, winner: winnerColor };
    }
    if (myMoves.length === 0) {
      return { over: false, skip: true };
    }
    return { over: false, skip: false };
  }, []);

  const handleMove = (r, c) => {
    if (!isMyTurn || gameOver) return;
    const flips = getFlips(board, r, c, currentTurn);
    if (flips.length === 0) return;

    playAudio('place', sfx);
    applyMove(r, c, currentTurn, flips);
  };

  const applyMove = (r, c, player, flips) => {
    const newBoard = board.map(row => [...row]);
    newBoard[r][c] = player;
    for (const [fr, fc] of flips) newBoard[fr][fc] = player;

    let nextTurn = -player;
    let skipMsg = null;
    let over = false;
    let winner = null;

    const stateCheck = checkGameState(newBoard, nextTurn);
    if (stateCheck.over) {
      over = true;
      winner = stateCheck.winner;
      if (winner === myColor && onWin) onWin();
      if (winner && setScores) {
        if (isMultiplayer) {
           const winnerId = winner === BLACK ? (userId > partnerId ? userId : partnerId) : (userId > partnerId ? partnerId : userId);
           setScores(p => ({ ...p, othello: { ...(p.othello || {}), [winnerId]: (p.othello?.[winnerId] || 0) + 1 } }));
        } else if (winner === myColor) {
           setScores(p => ({ ...p, othello: { ...(p.othello || {}), [userId]: (p.othello?.[userId] || 0) + 1 } }));
        }
      }
    } else if (stateCheck.skip) {
      skipMsg = `${nextTurn === BLACK ? 'Black' : 'White'} has no valid moves. Turn skipped.`;
      nextTurn = player; // Skip their turn
      // Double check if skipping ends the game (though checkGameState handles it mostly)
      const reCheck = checkGameState(newBoard, nextTurn);
      if (reCheck.over) {
         over = true;
         winner = reCheck.winner;
      }
    }

    setGameState({
      board: newBoard,
      turn: nextTurn,
      history: [...(gameState.history || []), { r, c, player }],
      gameOver: over,
      winner: winner,
      skipMessage: skipMsg
    });
  };

  // AI Turn
  useEffect(() => {
    if (!isMultiplayer && currentTurn === aiColor && !gameOver) {
      const timer = setTimeout(() => {
        const move = getBestMove(board, aiColor, config.diff || 'medium');
        if (move) {
          const flips = getFlips(board, move.r, move.c, aiColor);
          applyMove(move.r, move.c, aiColor, flips);
          playAudio('place', sfx);
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [currentTurn, isMultiplayer, gameOver, board, aiColor, config.diff]);

  const { b: countB, w: countW } = countPieces(board);

  return (
    <RetroWindow title={isMultiplayer ? "Othello — " + (myName || 'You') + " vs " + (partnerName || 'Partner') : "Othello — vs AI"} onClose={onBack} confirmOnClose sfx={sfx} noPadding>
      <div className="flex flex-col items-center justify-center p-4 min-h-[60vh] bg-[var(--bg-main)]">
        
        <div className="flex items-center justify-between w-full max-w-sm mb-6 bg-[var(--bg-window)] p-4 retro-border retro-shadow-dark">
          <div className={`flex flex-col items-center ${currentTurn === BLACK ? 'animate-pulse scale-110' : 'opacity-50'}`}>
            <div className="w-8 h-8 bg-black rounded-full shadow-[2px_2px_0_0_rgba(0,0,0,0.5)] border-2 border-black mb-1"></div>
            <span className="font-black text-[10px] uppercase">{isMultiplayer ? (myColor === BLACK ? 'You' : partnerName || 'Partner') : 'You'} : {countB}</span>
          </div>
          <div className="font-black text-xl tracking-widest uppercase">vs</div>
          <div className={`flex flex-col items-center ${currentTurn === WHITE ? 'animate-pulse scale-110' : 'opacity-50'}`}>
            <div className="w-8 h-8 bg-white rounded-full shadow-[2px_2px_0_0_rgba(0,0,0,0.5)] border-2 border-black mb-1"></div>
            <span className="font-black text-[10px] uppercase">{isMultiplayer ? (myColor === WHITE ? 'You' : partnerName || 'Partner') : 'AI'} : {countW}</span>
          </div>
        </div>

        {gameState?.skipMessage && (
          <div className="bg-yellow-200 text-yellow-800 font-bold px-4 py-2 retro-border retro-shadow-dark mb-4 text-xs animate-bounce flex items-center gap-2">
            <AlertCircle size={14} /> {gameState.skipMessage}
            <button onClick={() => setGameState(p => ({...p, skipMessage: null}))} className="ml-2 font-black">X</button>
          </div>
        )}

        <div className="bg-[var(--border)] retro-border-thick p-2 retro-shadow-dark mb-8 max-w-full overflow-hidden">
          <div className="grid grid-cols-8 gap-[2px] bg-[var(--border)]">
            {board.map((row, r) => row.map((cell, c) => {
              const isValid = validMoves.some(m => m.r === r && m.c === c);
              return (
                <div 
                  key={`${r}-${c}`} 
                  onClick={() => handleMove(r, c)}
                  className={`w-8 h-8 sm:w-12 sm:h-12 flex items-center justify-center bg-[var(--bg-window)] transition-colors ${isValid && isMyTurn ? 'hover:bg-[var(--bg-main)] cursor-pointer' : ''}`}
                >
                  {cell !== EMPTY && (
                    <div className={`w-[85%] h-[85%] rounded-full shadow-none border-[3px] border-[var(--border)] ${cell === BLACK ? 'bg-black' : 'bg-white'} animate-in zoom-in duration-300`}></div>
                  )}
                  {cell === EMPTY && isValid && isMyTurn && (
                    <div className="w-2 h-2 rounded-full bg-[var(--primary)] opacity-50 shadow-sm"></div>
                  )}
                </div>
              );
            }))}
          </div>
        </div>

        {gameOver && (
          <ShareOutcomeOverlay isSolo={(typeof config !== "undefined" && config?.mode === "solo") || (typeof mode !== "undefined" && mode === "solo") || (typeof gameMode !== "undefined" && gameMode === "solo") || (typeof config !== "undefined" && config?.mode === "practice")} partnerNickname={(typeof config !== "undefined" && config?.mode === "vs_ai") || (typeof mode !== "undefined" && mode === "vs_ai") || (typeof gameMode !== "undefined" && gameMode === "vs_ai") ? "AI" : undefined}
            outcome={gameState.winner === myColor ? 'win' : gameState.winner === null ? 'draw' : 'loss'}
            score={`Black: ${countB} | White: ${countW}`}
            gameName="Othello"
            onClose={() => setGameState({ board: getInitialBoard(), turn: BLACK, history: [], gameOver: false, winner: null })}
            onRematch={() => setGameState({ board: getInitialBoard(), turn: BLACK, history: [], gameOver: false, winner: null })}
          />
        )}
      </div>
    </RetroWindow>
  );
}
