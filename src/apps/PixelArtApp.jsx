import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { Download, Trash2, PaintBucket, Eraser, Pipette, MousePointer2, Undo, Redo, Pencil } from 'lucide-react';
import { useGlobalSync } from '../hooks/useSupabaseSync.js';

const PALETTE = ['#5c3a21','#e94560','#4f9ef8','#f9e2af','#b5c99a','#ffffff','#000000','#ff6b6b','#a855f7','#14b8a6','#f97316','#ec4899'];

export function PixelArtApp({ onClose, sfx, onSaveToScrapbook, userId }) {
  const SIZE = 24;
  const [grid, setGrid] = useGlobalSync('pixel_art_grid', Array(SIZE).fill(null).map(() => Array(SIZE).fill('#ffffff')));
  const [localGrid, setLocalGrid] = useState(grid);
  const [color, setColor] = useState('#5c3a21');
  const [tool, setTool] = useState('pen'); 
  const [isDrawing, setIsDrawing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const colorInputRef = useRef(null);
  const gridRef = useRef(null);
  const drawingRef = useRef(false);

  // Local History State
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);

  // Initialize history on first load
  useEffect(() => {
    if (grid && history.length === 0) {
      setHistory([grid]);
      setHistoryStep(0);
    }
  }, [grid]);

  useEffect(() => {
    setLocalGrid(grid);
  }, [grid]);

  const pushToHistory = (newGrid) => {
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(newGrid);
    if (newHistory.length > 20) newHistory.shift(); 
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyStep > 0) {
      playAudio('click', sfx);
      const prevStep = historyStep - 1;
      setHistoryStep(prevStep);
      setGrid(history[prevStep]);
    }
  };

  const handleRedo = () => {
    if (historyStep < history.length - 1) {
      playAudio('click', sfx);
      const nextStep = historyStep + 1;
      setHistoryStep(nextStep);
      setGrid(history[nextStep]);
    }
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
    // Sync the final state to Supabase once drawing is done
    setGrid(localGrid);
    if (JSON.stringify(grid) !== JSON.stringify(localGrid)) {
        pushToHistory(localGrid);
    }
  };

  const paint = (r, c) => {
    if (tool === 'bucket') {
      floodFill(r, c, localGrid[r][c], color);
      return;
    }
    const newGrid = localGrid.map(row => [...row]);
    newGrid[r][c] = tool === 'eraser' ? '#ffffff' : color;
    setLocalGrid(newGrid);
    setDirty(true);
  };

  const floodFill = (r, c, targetColor, replacementColor) => {
    if (targetColor === replacementColor) return;
    const newGrid = localGrid.map(row => [...row]);
    const stack = [[r, c]];
    while (stack.length > 0) {
      const [currR, currC] = stack.pop();
      if (currR < 0 || currR >= SIZE || currC < 0 || currC >= SIZE) continue;
      if (newGrid[currR][currC] !== targetColor) continue;
      newGrid[currR][currC] = replacementColor;
      stack.push([currR + 1, currC], [currR - 1, currC], [currR, currC + 1], [currR, currC - 1]);
    }
    setGrid(newGrid);
    setDirty(true);
  };

  const paintRef = useRef(paint);
  const handlePointerUpRef = useRef(handlePointerUp);

  useEffect(() => {
    paintRef.current = paint;
    handlePointerUpRef.current = handlePointerUp;
  }, [paint, handlePointerUp]);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    const handleTouchStart = (e) => {
      e.preventDefault();
      drawingRef.current = true;
      setIsDrawing(true);
      const touch = e.touches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      if (target && target.dataset.r !== undefined && target.dataset.c !== undefined) {
        paintRef.current(parseInt(target.dataset.r), parseInt(target.dataset.c));
      }
    };

    const handleTouchMove = (e) => {
      e.preventDefault();
      if (!drawingRef.current) return;
      const touch = e.touches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      if (target && target.dataset.r !== undefined && target.dataset.c !== undefined) {
        paintRef.current(parseInt(target.dataset.r), parseInt(target.dataset.c));
      }
    };

    const handleTouchEnd = (e) => {
      e.preventDefault();
      drawingRef.current = false;
      setIsDrawing(false);
      handlePointerUpRef.current();
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const clear = () => { 
    playAudio('click', sfx); 
    const newGrid = Array(SIZE).fill(null).map(() => Array(SIZE).fill('#ffffff'));
    setGrid(newGrid);
    pushToHistory(newGrid);
  };

   const handleExport = () => {
    playAudio('click', sfx);
    const canvas = document.createElement('canvas');
    const px = 16;
    canvas.width = SIZE * px; canvas.height = SIZE * px;
    const ctx = canvas.getContext('2d');
    grid.forEach((row, r) => row.forEach((c, ci) => { ctx.fillStyle = c; ctx.fillRect(ci * px, r * px, px, px); }));
    const url = canvas.toDataURL('image/png');
    if (onSaveToScrapbook) onSaveToScrapbook(url);
    const a = document.createElement('a'); a.href = url; a.download = `pixel_art_${Date.now()}.png`; a.click();
    setDirty(false);
  };

  const toolBtnClass = (t) => `p-2 rounded-md retro-border transition-all flex items-center justify-center gap-1 ${
    tool === t 
      ? 'bg-[var(--primary)] text-[var(--primary-text)] shadow-[inset_2px_2px_0_rgba(0,0,0,0.2)] scale-110 z-10' 
      : 'bg-[var(--bg-window)] text-[var(--text-main)] opacity-70 hover:opacity-100 hover:bg-[var(--accent)]'
  }`;

  return (
    <RetroWindow title="pixel_art.exe" onClose={onClose} className="w-full max-w-2xl h-[calc(100dvh-4rem)] max-h-[800px]" confirmOnClose hasUnsavedChanges={dirty} onSaveBeforeClose={() => { handleExport(); onClose && onClose(); }} sfx={sfx} noPadding>
      <div className="p-2 bg-[var(--bg-window)] border-b-2 border-border flex flex-wrap gap-2 items-center select-none">
        <div className="flex gap-1 flex-wrap">
          {PALETTE.map(c => (
            <button key={c} onClick={() => { setColor(c); if(tool==='eraser') setTool('pen'); }} className={`w-5 h-5 rounded-sm retro-border transition-transform ${color === c && tool !== 'eraser' ? 'ring-2 ring-[var(--primary)] scale-125 z-10' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />
          ))}
          <div className="relative w-6 h-6 flex-shrink-0 ml-1">
             <input type="color" ref={colorInputRef} value={color} onChange={(e) => { setColor(e.target.value); if(tool==='eraser') setTool('pen'); }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" title="Custom Color" />
             <div className="absolute inset-0 rounded-sm retro-border flex items-center justify-center pointer-events-none" style={{backgroundColor: color}}>
                <Pipette size={12} className="text-white mix-blend-difference" />
             </div>
          </div>
        </div>
        
        <div className="h-6 w-px bg-border/20 mx-1"></div>
        
        <div className="flex gap-1">
          <button onClick={() => { playAudio('click', sfx); setTool('pen'); }} className={toolBtnClass('pen')} title="Pen Tool">
            <Pencil size={18} />
          </button>
          <button onClick={() => { playAudio('click', sfx); setTool('eraser'); }} className={toolBtnClass('eraser')} title="Eraser Tool">
            <Eraser size={18} />
            {tool === 'eraser' && <span className="text-[9px] font-black uppercase">Eraser</span>}
          </button>
          <button onClick={() => { playAudio('click', sfx); setTool('bucket'); }} className={toolBtnClass('bucket')} title="Fill Bucket">
            <PaintBucket size={18} />
          </button>
        </div>

        <div className="h-6 w-px bg-border/20 mx-1"></div>

        <div className="flex gap-1">
          <button onClick={handleUndo} disabled={historyStep <= 0} className="p-2 retro-border bg-[var(--bg-window)] text-[var(--text-main)] disabled:opacity-20 hover:bg-[var(--accent)] transition-colors" title="Undo"><Undo size={18}/></button>
          <button onClick={handleRedo} disabled={historyStep >= history.length - 1} className="p-2 retro-border bg-[var(--bg-window)] text-[var(--text-main)] disabled:opacity-20 hover:bg-[var(--accent)] transition-colors" title="Redo"><Redo size={18}/></button>
        </div>

        <RetroButton variant="white" onClick={() => { clear(); setDirty(false); }} className="px-2 py-1 text-xs ml-auto retro-border"><Trash2 size={12}/></RetroButton>
        <RetroButton onClick={handleExport} className="px-3 py-1 text-xs retro-border"><Download size={12} className="mr-1 inline"/>Save</RetroButton>
      </div>
      
      <div className="flex-1 flex items-center justify-center p-1 sm:p-4 overflow-auto touch-none">
        <div 
          ref={gridRef}
          className={`retro-border retro-shadow-dark aspect-square w-full min-w-[340px] sm:min-w-[400px] max-w-[480px] grid select-none mx-auto`} 
          style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)`, gridTemplateRows: `repeat(${SIZE}, 1fr)`, cursor: tool === 'bucket' ? 'cell' : 'crosshair', touchAction: 'none' }}
          onMouseLeave={() => { drawingRef.current = false; handlePointerUp(); }}
          onMouseUp={() => { drawingRef.current = false; handlePointerUp(); }}
        >
          {localGrid.map((row, r) => row.map((c, ci) => (
            <div key={`${r}-${ci}`}
              style={{ backgroundColor: c, border: '0.5px solid rgba(0,0,0,0.05)' }}
              onMouseDown={() => { drawingRef.current = true; setIsDrawing(true); paint(r, ci); }}
              onMouseEnter={() => { if (drawingRef.current) paint(r, ci); }}
              data-r={r}
              data-c={ci}
            />
          )))}
        </div>
      </div>
    </RetroWindow>
  );
}
