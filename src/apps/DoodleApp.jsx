import React, { useState, useEffect, useRef } from 'react';
import { getStroke } from 'perfect-freehand';
import { Download, Brush, Trash2, Pencil, Eraser, PaintBucket, Square, Circle, Minus, Send, Pipette, Undo as UndoIcon } from 'lucide-react';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { SecureImage } from '../components/SecureMedia.jsx';
import { playAudio } from '../utils/audio.js';
import { useAssetSync } from '../hooks/useAssetSync.js';
import { floodFill } from '../utils/helpers.js';
import { base64ToBlob } from '../utils/file.js';

function getSvgPathFromStroke(stroke) {
  if (!stroke.length) return "";
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...stroke[0], "Q"]
  );
  d.push("Z");
  return d.join(" ");
}

export function DoodleViewer({ doodle, onClose, onRedoodle, onReplyToChat, profileName, sfx }) {
  const imageUrl = doodle.url || doodle.img;
  const handleDownload = () => { playAudio('click', sfx); const a = document.createElement('a'); a.href = imageUrl; a.download = `doodle_from_partner_${Date.now()}.png`; a.click(); };
  const handleReplyChat = () => { playAudio('send', sfx); if (onReplyToChat) onReplyToChat(`💌 ${profileName || 'You'} replied to a doodle`, imageUrl); };
  return (
    <RetroWindow title="received_doodle.msg" onClose={onClose} className="w-full max-w-2xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col">
       <div className="flex-1 bg-[#fdfbf7] p-6 sm:p-8 flex flex-col retro-border shadow-inner relative overflow-y-auto">
          <div className="border-b-2 border-dashed border-[var(--border)] pb-4 mb-6 flex flex-col gap-2">
             <div className="flex justify-between items-end"><span className="font-bold text-lg sm:text-xl text-[var(--primary)]">From: <span className="text-[var(--text-main)]">Partner ❤️</span></span><span className="text-xs opacity-50">{new Date(doodle.created_at || doodle.id).toLocaleDateString()}</span></div>
             <div className="font-bold text-lg sm:text-xl text-[var(--secondary)]">To: <span className="text-[var(--text-main)]">{profileName || 'Me'} ✨</span></div>
          </div>
          <div className="flex-1 flex items-center justify-center bg-white retro-border retro-shadow-dark p-2 mb-6 min-h-[300px]"><SecureImage url={imageUrl} alt="Doodle from partner" className="max-w-full max-h-full object-contain" /></div>
          <p className="text-center italic opacity-50 text-sm mb-6">* Saved automatically to your Scrapbook *</p>
          <div className="flex-1 flex flex-col sm:flex-row gap-3 justify-center mt-auto">
             <RetroButton variant="secondary" onClick={handleDownload} className="px-5 py-3 flex items-center justify-center gap-2 retro-border"><Download size={18}/> Save</RetroButton>
             <RetroButton variant="primary" onClick={() => onRedoodle(imageUrl)} className="px-5 py-3 flex items-center justify-center gap-2 retro-border"><Brush size={18}/> Redoodle</RetroButton>
             {onReplyToChat && <RetroButton variant="accent" onClick={handleReplyChat} className="px-5 py-3 flex items-center justify-center gap-2 retro-border"><Send size={18}/> Reply in Chat</RetroButton>}
          </div>
       </div>
    </RetroWindow>
  );
}

export function DoodleApp({ onClose, initialDoodle, onSendDoodle, onSaveToScrapbook, sfx, roomId, userId }) {
  const { uploadAsset } = useAssetSync(roomId);
  const isNormalized = !!roomId;
  const canvasRef = useRef(null);
  const offscreenCanvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false); 
  const [tool, setTool] = useState('pen'); 
  const [color, setColor] = useState('#5c3a21'); 
  const [brushSize, setBrushSize] = useState(6);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const pointsRef = useRef([]);
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const [showCursor, setShowCursor] = useState(false);

  const startPosRef = useRef({ x: 0, y: 0 }); 
  const [history, setHistory] = useState([]);
  const [step, setStep] = useState(-1);
  const colorInputRef = useRef(null);
  const containerRef = useRef(null);
  
  const initCanvas = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect(); if (rect.width === 0 || rect.height === 0) return;
    
    const dpr = window.devicePixelRatio || 1;
    
    // Save current content before resizing
    const oldWidth = canvas.width;
    const oldHeight = canvas.height;
    let tempCanvas = null;
    if (canvas.dataset.initialized === 'true' && oldWidth > 0 && oldHeight > 0) {
      tempCanvas = document.createElement('canvas');
      tempCanvas.width = oldWidth;
      tempCanvas.height = oldHeight;
      const tCtx = tempCanvas.getContext('2d');
      if (offscreenCanvasRef.current) {
        tCtx.drawImage(offscreenCanvasRef.current, 0, 0);
      } else {
        tCtx.drawImage(canvas, 0, 0);
      }
    }

    canvas.width = rect.width * dpr; 
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    
    if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas');
    }
    const offscreen = offscreenCanvasRef.current;
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const oCtx = offscreen.getContext('2d');
    
    const drawOffscreenToCanvas = () => {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(offscreen, 0, 0);
      ctx.restore();
    };

    const backup = localStorage.getItem('yard_doodle_backup');

    if (initialDoodle && !canvas.dataset.initialized) { 
      const img = new Image(); 
      img.onload = () => { 
        oCtx.drawImage(img, 0, 0, offscreen.width, offscreen.height); 
        drawOffscreenToCanvas();
        const snapshot = offscreen.toDataURL();
        setHistory([snapshot]);
        setStep(0);
      }; 
      img.src = typeof initialDoodle === 'string' ? initialDoodle : initialDoodle.img; 
      canvas.dataset.initialized = 'true'; 
    } 
    else if (tempCanvas) {
      oCtx.drawImage(tempCanvas, 0, 0, offscreen.width, offscreen.height);
      drawOffscreenToCanvas();
    }
    else if (canvas.dataset.initialized === 'true') {
      drawOffscreenToCanvas();
    }
    else if (backup) {
      const img = new Image();
      img.onload = () => {
        oCtx.drawImage(img, 0, 0, offscreen.width, offscreen.height);
        drawOffscreenToCanvas();
        setHistory([backup]);
        setStep(0);
      };
      img.src = backup;
      canvas.dataset.initialized = 'true';
    }
    else { 
      oCtx.fillStyle = '#ffffff'; 
      oCtx.fillRect(0, 0, offscreen.width, offscreen.height); 
      drawOffscreenToCanvas();
      canvas.dataset.initialized = 'true'; 
      const snapshot = offscreen.toDataURL();
      setHistory([snapshot]);
      setStep(0);
    }
  };

  const saveSnapshot = () => {
    const offscreen = offscreenCanvasRef.current;
    if (!offscreen) return;
    const snapshot = offscreen.toDataURL();
    const newHistory = history.slice(0, step + 1);
    newHistory.push(snapshot);
    setHistory(newHistory);
    setStep(newHistory.length - 1);
    localStorage.setItem('yard_doodle_backup', snapshot);
  };

  const restoreSnapshot = (index) => {
    const snapshot = history[index];
    if (!snapshot) return;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.restore();
      
      const oCtx = offscreenCanvasRef.current.getContext('2d');
      oCtx.clearRect(0, 0, canvas.width, canvas.height);
      oCtx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = snapshot;
  };

  useEffect(() => { 
    initCanvas(); 
    const handleResize = () => initCanvas();
    window.addEventListener('resize', handleResize); 
    return () => window.removeEventListener('resize', handleResize); 
  }, [initialDoodle]);

  const getCoords = (e) => { 
    const canvas = canvasRef.current; 
    const rect = canvas.getBoundingClientRect(); 
    const clientX = e.touches ? e.touches[0].clientX : e.clientX; 
    const clientY = e.touches ? e.touches[0].clientY : e.clientY; 
    return { x: clientX - rect.left, y: clientY - rect.top }; 
  };

  const handlePointerDown = (e) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const { x, y } = getCoords(e);
    const dpr = window.devicePixelRatio || 1;
    
    if (tool.startsWith('stamp_')) { 
      const oCtx = offscreenCanvasRef.current.getContext('2d');
      oCtx.save();
      oCtx.scale(dpr, dpr);
      oCtx.font = '40px "Space Mono", monospace'; 
      oCtx.textAlign = 'center';  
      oCtx.textBaseline = 'middle'; 
      oCtx.fillText(tool.split('_')[1], x, y); 
      oCtx.restore();
      canvas.getContext('2d').drawImage(offscreenCanvasRef.current, 0, 0, canvas.width/dpr, canvas.height/dpr);
      setHasUnsavedChanges(true); 
      saveSnapshot();
      return; 
    }
    
    if (tool === 'fill') { 
      const rect = canvas.getBoundingClientRect();
      const fillX = Math.floor(x * (canvas.width / rect.width));
      const fillY = Math.floor(y * (canvas.height / rect.height));
      floodFill(offscreenCanvasRef.current, fillX, fillY, color); 
      
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(offscreenCanvasRef.current, 0, 0);
      ctx.restore();
      
      setHasUnsavedChanges(true); 
      saveSnapshot();
      return; 
    }
    
    setIsDrawing(true); 
    setHasUnsavedChanges(true); 
    startPosRef.current = { x, y }; 
    if (!['rect', 'circle', 'line'].includes(tool)) { 
      pointsRef.current = [[x, y, 0.5]];
    }
  };

  const handlePointerMove = (e) => {
    const { x, y } = getCoords(e);
    setCursorPos({ x, y });
    if (!showCursor) setShowCursor(true);
    if (!isDrawing || tool === 'fill' || tool.startsWith('stamp_')) return;
    const canvas = canvasRef.current; 
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(offscreenCanvasRef.current, 0, 0);
    ctx.restore();
    
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color; 
    ctx.fillStyle = tool === 'eraser' ? '#ffffff' : color;
    ctx.lineWidth = brushSize;
    
    if (['rect', 'circle', 'line'].includes(tool)) {
      let startX = startPosRef.current.x; let startY = startPosRef.current.y; let width = x - startX; let height = y - startY;
      if (e.shiftKey) { const maxDist = Math.max(Math.abs(width), Math.abs(height)); width = width < 0 ? -maxDist : maxDist; height = height < 0 ? -maxDist : maxDist; }
      ctx.beginPath();
      if (tool === 'rect') { ctx.rect(startX, startY, width, height); } 
      else if (tool === 'circle') { const rx = Math.abs(width / 2); const ry = Math.abs(height / 2); const cx = startX + width / 2; const cy = startY + height / 2; ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI); } 
      else if (tool === 'line') { ctx.moveTo(startX, startY); ctx.lineTo(x, y); }
      ctx.stroke();
    } else { 
      pointsRef.current.push([x, y, 0.5]);
      const stroke = getStroke(pointsRef.current, {
        size: tool === 'eraser' ? brushSize * 4 : brushSize,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5,
      });
      const pathData = getSvgPathFromStroke(stroke);
      const myPath = new Path2D(pathData);
      ctx.fill(myPath);
    }
  };

  const handlePointerUp = () => { 
    if(isDrawing){ 
      setIsDrawing(false); 
      const canvas = canvasRef.current;
      const oCtx = offscreenCanvasRef.current.getContext('2d');
      oCtx.clearRect(0, 0, canvas.width, canvas.height);
      oCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height);
      pointsRef.current = [];
      saveSnapshot();
    } 
  };

  const handleUndo = () => {
    if (step > 0) {
      playAudio('click', sfx);
      const newStep = step - 1;
      setStep(newStep);
      restoreSnapshot(newStep);
    }
  };

  const handleRedo = () => {
    if (step < history.length - 1) {
      playAudio('click', sfx);
      const newStep = step + 1;
      setStep(newStep);
      restoreSnapshot(newStep);
    }
  };

  const clearCanvas = () => { 
    playAudio('click', sfx); 
    const canvas = canvasRef.current; 
    const ctx = canvas.getContext('2d'); 
    const dpr = window.devicePixelRatio || 1;
    ctx.fillStyle = '#ffffff'; 
    ctx.fillRect(0, 0, canvas.width/dpr, canvas.height/dpr); 
    const oCtx = offscreenCanvasRef.current.getContext('2d');
    oCtx.fillStyle = '#ffffff';
    oCtx.fillRect(0, 0, canvas.width, canvas.height);
    setHasUnsavedChanges(true); 
    saveSnapshot();
  };

  const [showSentOverlay, setShowSentOverlay] = useState(false);
  const handleSend = async () => {
    playAudio('send', sfx);
    const dataUrl = canvasRef.current.toDataURL('image/png');
    if (onSendDoodle) onSendDoodle(isNormalized ? dataUrl : {img: dataUrl});
    setHasUnsavedChanges(false);
    localStorage.removeItem('yard_doodle_backup');
    setShowSentOverlay(true);
  };

   const handleSaveScrapbook = async () => {
    playAudio('click', sfx);
    const dataUrl = canvasRef.current.toDataURL('image/png');
    if (isNormalized) {
        try {
            const blob = base64ToBlob(dataUrl);
            const file = new File([blob], `scrapbook_${Date.now()}.png`, { type: 'image/png' });
            await uploadAsset(file, 'scrapbook', userId);
            setHasUnsavedChanges(false);
            localStorage.removeItem('yard_doodle_backup');
            alert('Saved to Scrapbook!');
        } catch (e) {
            alert("Failed to save: " + e.message);
        }
    } else {
        if (onSaveToScrapbook) onSaveToScrapbook(dataUrl);
        setHasUnsavedChanges(false);
        localStorage.removeItem('yard_doodle_backup');
        alert('Saved to Scrapbook!');
    }
  };

  const handleDownload = () => { 
    playAudio('click', sfx); 
    const dataUrl = canvasRef.current.toDataURL('image/png'); 
    const a = document.createElement('a'); 
    a.href = dataUrl; a.download = `doodle_${Date.now()}.png`; a.click(); 
  };

  const toolBtnClass = (t) => `p-2 rounded-md transition-all retro-border flex items-center justify-center ${
    tool === t 
      ? 'bg-[var(--primary)] text-[var(--primary-text)] shadow-[inset_2px_2px_0_rgba(0,0,0,0.2)] scale-105 z-10' 
      : 'bg-[var(--bg-window)] text-[var(--text-main)] opacity-70 hover:opacity-100 hover:bg-[var(--accent)]'
  }`;

  return (
    <RetroWindow title={initialDoodle ? "doodle_editor.exe" : "new_doodle.exe"} onClose={onClose} className="w-full max-w-4xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col" confirmOnClose hasUnsavedChanges={hasUnsavedChanges} onSaveBeforeClose={() => { handleSaveScrapbook(); onClose && onClose(); }} sfx={sfx} noPadding>
      <div className="p-2 bg-[var(--bg-window)] border-b-2 border-border flex flex-wrap gap-2 items-center select-none">
        <div className="flex gap-1 pr-2 border-r border-border/20">
          <button onClick={() => {playAudio('click', sfx); setTool('pen')}} className={toolBtnClass('pen')} title="Brush"><Pencil size={18} /></button>
          <button onClick={() => {playAudio('click', sfx); setTool('fill')}} className={toolBtnClass('fill')} title="Fill Bucket"><PaintBucket size={18}/></button>
          <button onClick={() => {playAudio('click', sfx); setTool('eraser')}} className={toolBtnClass('eraser')} title="Eraser"><Eraser size={18}/></button>
        </div>
        <div className="flex gap-1 px-2 border-r border-border/20">
          <button onClick={() => {playAudio('click', sfx); setTool('rect')}} className={toolBtnClass('rect')}><Square size={18}/></button>
          <button onClick={() => {playAudio('click', sfx); setTool('circle')}} className={toolBtnClass('circle')}><Circle size={18}/></button>
          <button onClick={() => {playAudio('click', sfx); setTool('line')}} className={toolBtnClass('line')}><Minus size={18} className="rotate-45"/></button>
        </div>
        <div className="flex items-center gap-2 px-2 border-r border-border/20 min-w-[120px]">
          <span className="text-[8px] font-black uppercase opacity-50 text-[var(--text-main)]">Size</span>
          <input type="range" min="1" max="50" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-full accent-[var(--primary)] h-1 bg-[var(--border)] rounded-lg appearance-none cursor-pointer" />
        </div>
        <div className="grid grid-cols-4 gap-1 px-2 items-center">
          {['#5c3a21', '#ffb6b9', '#a3c4f3', '#f9e2af', '#b5c99a', '#ffffff', '#000000', '#ff0000'].map(c => ( 
            <button key={c} onClick={() => { playAudio('click', sfx); setColor(c); if(tool==='eraser') setTool('pen'); }} className={`w-5 h-5 rounded-sm retro-border flex-shrink-0 transition-transform ${color === c && tool !== 'eraser' ? 'ring-2 ring-[var(--primary)] scale-125' : 'hover:scale-110'}`} style={{backgroundColor: c}} /> 
          ))}
          <div className="relative w-5 h-5 flex-shrink-0">
             <input type="color" ref={colorInputRef} value={color} onChange={(e) => { setColor(e.target.value); if(tool==='eraser') setTool('pen'); }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" title="Custom Color" />
             <div className="absolute inset-0 rounded-sm retro-border flex items-center justify-center pointer-events-none" style={{backgroundColor: color}}><Pipette size={12} className="text-white mix-blend-difference" /></div>
          </div>
        </div>
        <div className="ml-auto flex gap-2 items-center pl-2">
          <div className="flex gap-1 border-r border-border/20 pr-2">
            <button onClick={handleUndo} className={`p-2 rounded-md transition-all retro-border ${step > 0 ? 'bg-white text-black hover:bg-accent' : 'opacity-20 cursor-not-allowed'}`} disabled={step <= 0} title="Undo"><UndoIcon size={18}/></button>
            <button onClick={handleRedo} className={`p-2 rounded-md transition-all retro-border ${step < history.length - 1 ? 'bg-white text-black hover:bg-accent' : 'opacity-20 cursor-not-allowed'}`} disabled={step >= history.length - 1} title="Redo"><UndoIcon size={18} className="scale-x-[-1]"/></button>
          </div>
          <RetroButton variant="white" onClick={clearCanvas} className="px-3 py-1 text-xs retro-border"><Trash2 size={12}/> Clear</RetroButton>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 bg-[#f0f0f0] relative overflow-hidden cursor-none" onMouseEnter={() => setShowCursor(true)} onMouseLeave={() => setShowCursor(false)} style={{ backgroundImage: 'radial-gradient(rgba(0,0,0,0.05) 1px, transparent 0)', backgroundSize: '20px 20px' }}>
        <canvas ref={canvasRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} className="absolute inset-0 w-full h-full bg-white shadow-inner" style={{ touchAction: 'none' }} />
        {showCursor && (
          <div className="pointer-events-none absolute z-[9999] rounded-full border-2 border-white mix-blend-difference" style={{ left: cursorPos.x, top: cursorPos.y, width: tool === 'eraser' ? brushSize * 4 : brushSize, height: tool === 'eraser' ? brushSize * 4 : brushSize, transform: 'translate(-50%, -50%)', backgroundColor: tool === 'eraser' ? '#ffffff' : color, boxShadow: '0 0 0 1px black, inset 0 0 0 1px black', opacity: tool === 'fill' || tool.startsWith('stamp_') ? 0 : 1 }}>
             {(brushSize < 12 || tool === 'line') && ( <div className="absolute inset-0 flex items-center justify-center"><div className="w-full h-[1px] bg-white/40" /><div className="h-full w-[1px] bg-white/40 absolute" /></div> )}
          </div>
        )}
        {(tool === 'fill' || tool.startsWith('stamp_')) && showCursor && (
          <div 
            className="pointer-events-none absolute z-[9999] text-xl select-none" 
            style={{ 
              left: cursorPos.x, 
              top: cursorPos.y, 
              transform: tool === 'fill' ? 'translate(-15%, -85%) rotate(-15deg)' : 'translate(-50%, -50%)' 
            }}
          >
            {tool === 'fill' ? '🪣' : tool.split('_')[1]}
          </div>
        )}
      </div>
      <div className="p-3 retro-bg-window retro-border-t flex flex-wrap gap-2 justify-between">
        <div className="flex gap-2">
          <RetroButton variant="secondary" onClick={handleDownload} className="px-3 py-2 text-xs sm:text-sm flex items-center gap-2 retro-border"><Download size={14}/> Device</RetroButton>
          <RetroButton variant="white" onClick={handleSaveScrapbook} className="px-3 py-2 text-xs sm:text-sm flex items-center gap-2 retro-border"><Brush size={14}/> Album</RetroButton>
        </div>
        <RetroButton variant="primary" onClick={handleSend} className="px-6 py-2 text-sm sm:text-base flex items-center gap-2 retro-border">Send <Send size={16}/></RetroButton>
      </div>
      {showSentOverlay && (
        <div className="fixed inset-0 z-[250] bg-black/60 flex items-center justify-center p-4">
          <RetroWindow title="doodle_sent.msg" onClose={() => { setShowSentOverlay(false); onClose && onClose(); }} className="w-full max-w-sm" confirmOnClose={false}>
            <div className="p-4 text-center"><h3 className="font-bold text-lg text-[var(--primary)] mb-2">Doodle Sent</h3><p className="mb-4 opacity-70">Your doodle has been sent to your partner.</p><div className="flex gap-2"><RetroButton variant="white" className="flex-1" onClick={() => { playAudio('click', sfx); setShowSentOverlay(false); }}>Close</RetroButton><RetroButton className="flex-1" onClick={() => { playAudio('click', sfx); setShowSentOverlay(false); onClose && onClose(); }}>Done</RetroButton></div></div>
          </RetroWindow>
        </div>
      )}
    </RetroWindow>
  );
}
