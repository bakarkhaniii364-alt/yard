import React, { useState, useEffect, useCallback } from 'react';
import { RetroWindow, RetroButton, ShareOutcomeOverlay } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { getScore } from '../utils/helpers.js';
import { incrementUserScore } from '../utils/userDataHelpers.js';
import { RotateCcw, Trophy } from 'lucide-react';

function createGrid() {
  const grid = Array(4).fill(null).map(() => Array(4).fill(0));
  addRandom(grid); addRandom(grid);
  return grid;
}
function addRandom(grid) {
  const empty = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (grid[r][c] === 0) empty.push([r, c]);
  if (empty.length === 0) return;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  grid[r][c] = Math.random() < 0.9 ? 2 : 4;
}
function slide(row) {
  let arr = row.filter(x => x !== 0);
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] === arr[i + 1]) { arr[i] *= 2; arr[i + 1] = 0; }
  }
  arr = arr.filter(x => x !== 0);
  while (arr.length < 4) arr.push(0);
  return arr;
}
function moveGrid(grid, dir) {
  let newGrid = grid.map(r => [...r]);
  let moved = false;
  if (dir === 'left') {
    for (let r = 0; r < 4; r++) { const newRow = slide(newGrid[r]); if (JSON.stringify(newRow) !== JSON.stringify(newGrid[r])) moved = true; newGrid[r] = newRow; }
  } else if (dir === 'right') {
    for (let r = 0; r < 4; r++) { const newRow = slide([...newGrid[r]].reverse()).reverse(); if (JSON.stringify(newRow) !== JSON.stringify(newGrid[r])) moved = true; newGrid[r] = newRow; }
  } else if (dir === 'up') {
    for (let c = 0; c < 4; c++) { const col = [newGrid[0][c], newGrid[1][c], newGrid[2][c], newGrid[3][c]]; const newCol = slide(col); if (JSON.stringify(newCol) !== JSON.stringify(col)) moved = true; for (let r = 0; r < 4; r++) newGrid[r][c] = newCol[r]; }
  } else if (dir === 'down') {
    for (let c = 0; c < 4; c++) { const col = [newGrid[0][c], newGrid[1][c], newGrid[2][c], newGrid[3][c]].reverse(); const newCol = slide(col).reverse(); if (JSON.stringify(newCol) !== JSON.stringify([newGrid[0][c], newGrid[1][c], newGrid[2][c], newGrid[3][c]])) moved = true; for (let r = 0; r < 4; r++) newGrid[r][c] = newCol[r]; }
  }
  if (moved) addRandom(newGrid);
  return { grid: newGrid, moved };
}
function isGameOver(grid) {
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { if (grid[r][c] === 0) return false; if (c < 3 && grid[r][c] === grid[r][c + 1]) return false; if (r < 3 && grid[r][c] === grid[r + 1][c]) return false; }
  return true;
}
function getScore2048(grid) { let s = 0; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) s += grid[r][c]; return s; }
const TILE_COLORS = { 0: 'var(--bg-main)', 2: 'var(--bg-window)', 4: 'var(--accent)', 8: 'var(--secondary)', 16: 'var(--primary)', 32: '#f97316', 64: '#ef4444', 128: '#eab308', 256: '#a855f7', 512: '#ec4899', 1024: '#14b8a6', 2048: '#fbbf24' };

export function Game2048({ config, setScores, onBack, sfx, onWin, onShareToChat, profile, myName, userId, partnerId, partnerName }) {
  const [grid, setGrid] = useState(createGrid);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => parseInt(localStorage.getItem('2048_best') || '0'));
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  const handleMove = useCallback((dir) => {
    if (gameOver) return;
    const { grid: newGrid, moved } = moveGrid(grid, dir);
    if (!moved) return;
    playAudio('electronic_slide', sfx);
    const newScore = getScore2048(newGrid);
    setGrid(newGrid); setScore(newScore);
    if (newScore > best) { setBest(newScore); localStorage.setItem('2048_best', String(newScore)); }
    const has2048 = newGrid.some(r => r.some(c => c >= 2048));
    if (has2048 && !won) { 
      setWon(true); 
      onWin(); 
      // Record win for this user
      if (userId) {
        setScores(prev => incrementUserScore(prev, userId, '2048', 1, myName || profile?.name || 'You'));
      }
      setTimeout(() => setShowOverlay(true), 500); 
    }
    if (isGameOver(newGrid)) { setGameOver(true); setTimeout(() => setShowOverlay(true), 500); }
  }, [grid, gameOver, won, best, sfx, onWin, userId, setScores]);

  useEffect(() => {
    const handleKey = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) { e.preventDefault(); }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) { handleMove(e.key.replace('Arrow', '').toLowerCase()); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleMove]);

  // Touch swipe
  const [touchStart, setTouchStart] = useState(null);
  const handleTouchStart = (e) => setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  const handleTouchEnd = (e) => {
    if (!touchStart) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    if (Math.abs(dx) > Math.abs(dy)) { handleMove(dx > 0 ? 'right' : 'left'); }
    else { handleMove(dy > 0 ? 'down' : 'up'); }
    setTouchStart(null);
  };

  const restart = () => { setGrid(createGrid()); setScore(0); setGameOver(false); setWon(false); setShowOverlay(false); };



  return (
    <>
    <RetroWindow title="2048.exe" className="w-full max-w-lg h-[calc(100dvh-4rem)] max-h-[700px]" onClose={onBack} confirmOnClose sfx={sfx} noPadding>
      <div className="bg-[var(--border)] text-[var(--bg-window)] p-2 px-4 flex justify-between font-bold text-sm">
        <span>Score: {score}</span><span>Best: {best}</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="grid grid-cols-4 gap-2 w-full max-w-[320px] aspect-square p-2 retro-border retro-shadow-dark" style={{ backgroundColor: 'var(--bg-main)' }}>
          {grid.flat().map((val, i) => (
            <div key={i} className="aspect-square retro-border flex items-center justify-center font-bold text-lg sm:text-2xl transition-all duration-100" style={{
              backgroundColor: TILE_COLORS[val] || TILE_COLORS[2048],
              color: val >= 8 ? 'var(--bg-window)' : 'var(--text-main)',
              transform: val > 0 ? 'scale(1)' : 'scale(0.8)',
            }}>
              {val > 0 ? val : ''}
            </div>
          ))}
        </div>
        <p className="text-xs font-bold opacity-50">Use arrow keys or swipe to play</p>
        <RetroButton variant="secondary" onClick={restart} className="px-6 py-2 text-sm"><RotateCcw size={14} className="inline mr-2"/>Restart</RetroButton>
      </div>
    </RetroWindow>

    {showOverlay && (
      <ShareOutcomeOverlay
        isSolo={(typeof config !== "undefined" && config?.mode === "solo") || (typeof mode !== "undefined" && mode === "solo") || (typeof gameMode !== "undefined" && gameMode === "solo") || (typeof config !== "undefined" && config?.mode === "practice")}
        gameName="2048"
        stats={{ Score: score, "Best": best, Result: won ? '🏆 You hit 2048!' : 'Game Over' }}
        onClose={() => { restart(); onBack(); }}
        onRematch={restart}
        onShareToChat={onShareToChat}
        sfx={sfx}
        profile={profile}
        partnerNickname={profile?.partnerNickname}
      />
    )}
    </>
  );
}
