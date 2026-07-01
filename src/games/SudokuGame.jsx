import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RetroWindow, RetroButton, ShareOutcomeOverlay } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { getScore } from '../utils/helpers.js';
import { incrementUserScore } from '../utils/userDataHelpers.js';
import { PenTool, Eraser, Lightbulb, Pause, Play, AlertCircle, RefreshCw } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { generateSudoku } from '../utils/sudokuGenerator.js';

export function Sudoku({ config, setScores, onBack, sfx, onWin, onShareToChat, onSaveToScrapbook, profile, myName, userId, partnerName }) {
  const [board, setBoard] = useState([]);
  const [solution, setSolution] = useState([]);
  const [selected, setSelected] = useState(null);
  const [time, setTime] = useState(0);
  const [paused, setPaused] = useState(false);
  const [tool, setTool] = useState('pen'); // 'pen', 'pencil', 'eraser'
  const [notesMode, setNotesMode] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [mistakesOverlay, setMistakesOverlay] = useState(false);
  const [gameOverOverlay, setGameOverOverlay] = useState(false);

  const [stats, setStats] = useLocalStorage('sudoku_stats', { played: 0, won: 0, bestTimeEasy: 9999, bestTimeMedium: 9999, bestTimeHard: 9999 });

  useEffect(() => { initSudoku(); }, [config.diff]);

  useEffect(() => {
    let interval = null;
    if (!paused && !gameOverOverlay && board.length > 0) interval = setInterval(() => setTime(t => t + 1), 1000);
    else clearInterval(interval);
    return () => clearInterval(interval);
  }, [paused, gameOverOverlay, board.length]);

  const initSudoku = () => {
    // Generate valid, uniquely solvable puzzle
    const { puzzle, solution } = generateSudoku(config.diff);
    
    const puzzle2D = [];
    for (let r = 0; r < 9; r++) {
      const row = [];
      for (let c = 0; c < 9; c++) {
        const val = puzzle[r][c] === 0 ? null : puzzle[r][c];
        row.push({ val, fixed: val !== null, notes: [], error: false });
      }
      puzzle2D.push(row);
    }
    setSolution(solution); setBoard(puzzle2D); setSelected(null); setTime(0); setPaused(false); setMistakes(0); setGameOverOverlay(false);
  };

  const checkWin = useCallback((currBoard, currentTime) => {
    let isWin = true;
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (currBoard[r][c].val === null) isWin = false;
    if (isWin) {
      playAudio('win', sfx);
      setScores(prev => incrementUserScore(prev, userId, 'sudoku', 1, myName || profile?.name || 'You'));
      onWin();
      setTimeout(() => setGameOverOverlay(true), 1500);
      setStats(p => {
        const s = { ...p, played: p.played + 1, won: p.won + 1 };
        if (config.diff === 'easy' && currentTime < s.bestTimeEasy) s.bestTimeEasy = currentTime;
        if (config.diff === 'medium' && currentTime < s.bestTimeMedium) s.bestTimeMedium = currentTime;
        if (config.diff === 'hard' && currentTime < s.bestTimeHard) s.bestTimeHard = currentTime;
        return s;
      });
    }
  }, [sfx, userId, onWin, config.diff, setScores, setStats]);

  const handleInput = useCallback((num, forceNotes = false) => {
    if (!selected || paused || gameOverOverlay) return;
    playAudio('click', sfx);
    const [r, c] = selected;
    if (board[r][c].fixed) return;
    const newBoard = board.map(row => row.map(cell => ({ ...cell })));

    const usePencil = forceNotes || tool === 'pencil';

    if (tool === 'eraser') {
      newBoard[r][c].val = null; newBoard[r][c].notes = []; newBoard[r][c].error = false;
      setBoard(newBoard); return;
    }

    if (usePencil) {
      if (newBoard[r][c].val !== null) return;
      const noteIdx = newBoard[r][c].notes.indexOf(num);
      if (noteIdx !== -1) newBoard[r][c].notes.splice(noteIdx, 1);
      else newBoard[r][c].notes.push(num);
      setBoard(newBoard);
      return;
    }

    if (num === solution[r][c]) {
      newBoard[r][c].val = num; newBoard[r][c].fixed = true; newBoard[r][c].notes = []; newBoard[r][c].error = false;
      setBoard(newBoard);
      checkWin(newBoard, time);
      // Clear notes in same row/col/box
      for (let i = 0; i < 9; i++) {
        newBoard[r][i].notes = newBoard[r][i].notes.filter(n => n !== num);
        newBoard[i][c].notes = newBoard[i][c].notes.filter(n => n !== num);
      }
      const boxR = Math.floor(r / 3) * 3, boxC = Math.floor(c / 3) * 3;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) newBoard[boxR + i][boxC + j].notes = newBoard[boxR + i][boxC + j].notes.filter(n => n !== num);
    } else {
      // Persist incorrect entry so user must erase or replace it; mark as error
      setMistakes(m => m + 1);
      setMistakesOverlay(true); setTimeout(() => setMistakesOverlay(false), 300);
      newBoard[r][c].val = num;
      newBoard[r][c].error = true;
      setBoard(newBoard);
    }
  }, [selected, paused, gameOverOverlay, board, solution, tool, sfx, checkWin, time]);

  const refs = useRef({});
  refs.current = { handleInput, selected, board, paused, gameOverOverlay, tool };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const { handleInput, selected, board, paused, gameOverOverlay, tool } = refs.current;
      if (gameOverOverlay || paused) return;

      let num = parseInt(e.key);
      if (isNaN(num) && e.code && e.code.startsWith('Digit')) {
        num = parseInt(e.code.slice(5));
      }

      if (e.key === '*') { setTool(t => t === 'pencil' ? 'pen' : 'pencil'); return; }

      if (!isNaN(num) && num >= 1 && num <= 9) {
        handleInput(num, tool === 'pencil');
      } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        if (!selected || !board.length) return;
        const [r, c] = selected;
        if (board[r][c]?.fixed) return;
        playAudio('click', sfx);
        setBoard(b => { const b2 = b.map(row => row.map(cell => ({ ...cell }))); b2[r][c].val = null; b2[r][c].notes = []; b2[r][c].error = false; return b2; });
      } else if (e.key === 'ArrowUp' && selected) { setSelected([Math.max(0, selected[0] - 1), selected[1]]); }
      else if (e.key === 'ArrowDown' && selected) { setSelected([Math.min(8, selected[0] + 1), selected[1]]); }
      else if (e.key === 'ArrowLeft' && selected) { setSelected([selected[0], Math.max(0, selected[1] - 1)]); }
      else if (e.key === 'ArrowRight' && selected) { setSelected([selected[0], Math.min(8, selected[1] + 1)]); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sfx]);

  const useHint = () => {
    if (paused) return;
    const empty = [];
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (!board[r][c].val && !board[r][c].fixed) empty.push([r, c]);
    if (empty.length === 0) return;
    playAudio('click', sfx);
    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    const newBoard = board.map(row => row.map(cell => ({ ...cell })));
    newBoard[r][c] = { val: solution[r][c], fixed: true, notes: [], error: false };
    setBoard(newBoard);
    checkWin(newBoard, time);
    setTime(t => t + 30); // 30s penalty
  };

  const handleRestart = () => {
    if (window.confirm("Restart puzzle? All progress will be lost.")) {
      playAudio('click', sfx); initSudoku();
    }
  };



  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  let filled = 0; if (board.length) { for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (board[r][c].val) filled++; }
  const progressPct = Math.round((filled / 81) * 100) || 0;
  const counts = Array(10).fill(0);
  if (board.length) { for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (board[r][c].val) counts[board[r][c].val]++; }

  // Only highlight number if selected cell HAS a value
  const selectedVal = selected ? board[selected[0]]?.[selected[1]]?.val : null;
  const selectedNum = selectedVal !== null ? selectedVal : null;

  return (
    <>
    <RetroWindow title={`sudoku_${config.diff}.exe`} className="w-full max-w-4xl h-[calc(100dvh-4rem)] max-h-[850px] flex flex-col" onClose={onBack} confirmOnClose sfx={sfx} noPadding>

      {mistakesOverlay && <div className="absolute inset-0 bg-[var(--color-destructive)]/20 z-[100] pointer-events-none mix-blend-overlay"></div>}

      <div className="bg-[var(--border)] text-[var(--bg-window)] p-2 flex justify-between items-center font-bold px-4 flex-shrink-0">
        <span className="uppercase tracking-widest text-xs">Sudoku — {config.diff}</span>
        <div className="flex gap-4 items-center">
          <span className="text-sm opacity-80">✗ {mistakes}</span>
          <span className="flex items-center gap-2 font-mono">
            {formatTime(time)}
            <button onClick={() => setPaused(!paused)} className="bg-white/20 p-1 rounded hover:bg-white/40">{paused ? <Play size={14} /> : <Pause size={14} />}</button>
          </span>
        </div>
      </div>

      <div className="w-full h-2 bg-[var(--bg-main)] relative">
        <div className="h-full bg-[var(--primary)] transition-all duration-300" style={{ width: `${progressPct}%` }}></div>
      </div>

      <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-center justify-center p-4 flex-1 overflow-y-auto relative">

        {paused && (
          <div className="absolute inset-0 z-50 bg-black/40 flex items-center justify-center flex-col text-white">
            <Pause size={64} className="mb-4 animate-pulse opacity-80" />
            <h2 className="text-3xl font-bold tracking-widest uppercase">Paused</h2>
            <RetroButton onClick={() => setPaused(false)} className="mt-6 px-12 py-3 text-lg">Resume</RetroButton>
          </div>
        )}

        {/* Board */}
        <div className="retro-border retro-shadow-dark p-1 flex-shrink-0 w-full max-w-[400px] sm:max-w-[480px] md:max-w-[540px] aspect-square select-none bg-[var(--border)]">
          {board.length > 0 && (
            <div className="w-full h-full grid grid-cols-9 grid-rows-9 gap-[1px] bg-[var(--border)]">
              {board.map((row, r) => row.map((cell, c) => {
                const isSelected = selected?.[0] === r && selected?.[1] === c;
                // Only highlight same number if a filled cell is selected
                const isNumHighlight = selectedNum !== null && cell.val === selectedNum && !isSelected;
                const isRelated = selected && (selected[0] === r || selected[1] === c || (Math.floor(r / 3) === Math.floor(selected[0] / 3) && Math.floor(c / 3) === Math.floor(selected[1] / 3)));

                let borders = `border-[0.5px] border-black/10 `;
                if (c % 3 === 2 && c !== 8) borders += `border-r-[3px] border-r-[var(--border)] `;
                if (r % 3 === 2 && r !== 8) borders += `border-b-[3px] border-b-[var(--border)] `;

                // Use inline style for highlights — Tailwind can't do opacity on CSS var() colors
                let cellStyle = { backgroundColor: 'var(--bg-window)' };
                let extraClass = '';
                if (cell.error) {
                  cellStyle.backgroundColor = 'rgba(239, 68, 68, 0.25)';
                } else if (isSelected) {
                  cellStyle.backgroundColor = 'rgba(0, 0, 0, 0.06)';
                } else if (isRelated) {
                  cellStyle.backgroundColor = 'var(--bg-main)';
                }

                const isNumMatch = selectedNum !== null && cell.val === selectedNum;

                return (
                  <div key={`${r}-${c}`}
                    onClick={() => { 
                      playAudio('click', sfx); 
                      setSelected([r, c]); 
                      if (tool === 'eraser' && !cell.fixed) {
                         setBoard(b => {
                             const nb = [...b];
                             nb[r] = [...nb[r]];
                             nb[r][c] = { ...nb[r][c], val: null, notes: [], error: false };
                             return nb;
                          });
                      }
                    }}
                    style={cellStyle}
                    className={`relative flex items-center justify-center cursor-pointer ${borders} ${extraClass} ${cell.fixed ? 'text-[var(--border)]' : 'text-[var(--primary)]'} ${isNumMatch ? 'font-black !text-[var(--secondary)] scale-110 text-lg sm:text-2xl md:text-3xl z-10' : (cell.fixed ? 'font-bold text-sm sm:text-xl md:text-2xl' : 'font-medium text-sm sm:text-xl md:text-2xl')} transition-all duration-200`}
                  >
                    {cell.val || ''}
                    {!cell.val && cell.notes.length > 0 && (
                      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 p-[2px]">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                          <div key={n} className="flex items-center justify-center text-[7px] sm:text-[9px] font-mono leading-none opacity-50 text-[var(--secondary)]">
                            {cell.notes.includes(n) ? n : ''}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }))}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-4 flex-1 w-full max-w-[340px] sm:max-w-[320px]">

              <div className="bg-[var(--bg-window)] retro-border p-3 text-xs font-bold opacity-70 uppercase tracking-widest text-center">
                * + number = note · arrows = navigate
              </div>

          {/* Tool Selector */}
          <div className="flex gap-2 bg-[var(--bg-main)] p-1 retro-border shadow-inner">
            <button onClick={() => setTool('pen')} className={`flex-1 py-2 flex justify-center items-center gap-1 font-bold text-sm rounded retro-border transition-colors ${tool === 'pen' ? 'bg-[var(--primary)] text-[var(--bg-window)]' : 'bg-[var(--bg-window)] opacity-60'}`}><PenTool size={14} /> Pen</button>
            <button onClick={() => setTool('pencil')} className={`flex-1 py-2 flex justify-center items-center gap-1 font-bold text-sm rounded retro-border transition-colors ${tool === 'pencil' ? 'bg-[var(--secondary)] text-[var(--bg-window)]' : 'bg-[var(--bg-window)] opacity-60'}`}><AlertCircle size={14} /> Note</button>
            <button onClick={() => setTool('eraser')} className={`flex-1 py-2 flex justify-center items-center gap-1 font-bold text-sm rounded retro-border transition-colors ${tool === 'eraser' ? 'bg-[var(--color-destructive)] text-white' : 'bg-[var(--bg-window)] opacity-60'}`}><Eraser size={14} /> Erase</button>
          </div>

          {/* Number Pad */}
          <div className="grid grid-cols-5 gap-1 sm:gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => {
              const isNumSelected = num === selectedNum;
              return (
                <RetroButton 
                  key={num} 
                  variant={counts[num] === 9 ? 'disabled' : (isNumSelected ? 'accent' : 'white')} 
                  className={`py-3 sm:py-4 text-xl sm:text-2xl font-bold ${isNumSelected ? 'scale-110 ring-2 ring-[var(--secondary)]' : ''}`} 
                  onClick={() => handleInput(num)} 
                  disabled={counts[num] === 9}
                >
                  {num}
                </RetroButton>
              );
            })}
            <RetroButton variant="accent" className="py-3 sm:py-4 text-xs sm:text-sm font-bold flex flex-col items-center justify-center leading-tight" onClick={useHint}><Lightbulb size={16} /> Hint</RetroButton>
          </div>

          <div className="mt-auto pt-4">
            <RetroButton variant="secondary" className="w-full py-2 sm:py-3 text-sm sm:text-base border-dashed opacity-80 hover:opacity-100" onClick={handleRestart}><RefreshCw size={14} className="inline mr-2" /> Restart Game</RetroButton>
          </div>

        </div>
      </div>
    </RetroWindow>

    {gameOverOverlay && (() => {
      const formatTimeStr = (s) => s >= 9999 ? 'N/A' : `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
      const outcomeStats = {
        "Difficulty": config.diff,
        "Time": formatTimeStr(time),
        "Mistakes": mistakes,
        "Best (Easy)": formatTimeStr(stats.bestTimeEasy),
        "Best (Medium)": formatTimeStr(stats.bestTimeMedium),
        "Best (Hard)": formatTimeStr(stats.bestTimeHard),
      };
      return (
        <ShareOutcomeOverlay
          isSolo={(typeof config !== "undefined" && config?.mode === "solo") || (typeof mode !== "undefined" && mode === "solo") || (typeof gameMode !== "undefined" && gameMode === "solo") || (typeof config !== "undefined" && config?.mode === "practice")}
          gameName={`Sudoku`}
          stats={outcomeStats}
          onClose={() => { initSudoku(); onBack(); }}
          onRematch={initSudoku}
          onShareToChat={onShareToChat}
          onSaveToScrapbook={onSaveToScrapbook}
          sfx={sfx}
          profile={profile}
          partnerNickname={profile?.partnerNickname}
        />
      );
    })()}
    </>
  );
}
