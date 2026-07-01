import React, { useState, useEffect, useRef } from 'react';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { useGlobalSync, useBroadcast } from '../hooks/useSupabaseSync.js';
import { useCall } from '../context/instances.js';
import { Brush } from 'lucide-react';
import { playAudio } from '../utils/audio.js';

export function PersistentDoodleApp({ onClose, sfx, userId, onSaveToScrapbook }) {
  const [doodleData, setDoodleData] = useGlobalSync('persistent_doodle', { img: null, lastUpdate: 0, updater: null });
  const { sendData } = useCall();
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#5c3a21');
  const [brushSize, setBrushSize] = useState(4);
  const containerRef = useRef(null);
  const lastPosRef = useRef({ x: 0, y: 0 });

  const handleSaveToAlbum = () => {
    playAudio('click', sfx);
    const dataUrl = canvasRef.current.toDataURL('image/png');
    if (onSaveToScrapbook) onSaveToScrapbook(dataUrl);
    const a = document.createElement('a'); a.href = dataUrl; a.download = `shared_canvas_${Date.now()}.png`; a.click();
  };

  // P2P Stroke synchronization
  useBroadcast('doodle_p2p_stroke', (payload) => {
    if (payload.updater === userId) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.strokeStyle = payload.color;
    ctx.lineWidth = payload.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(payload.fromX, payload.fromY);
    ctx.lineTo(payload.toX, payload.toY);
    ctx.stroke();
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !doodleData.img) return;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = doodleData.img;
  }, [doodleData.img]);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (doodleData.img) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = doodleData.img;
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  useEffect(() => {
    initCanvas();
    window.addEventListener('resize', initCanvas);
    return () => window.removeEventListener('resize', initCanvas);
  }, []);

  const getCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) };
  };

  const handlePointerDown = (e) => {
    setIsDrawing(true);
    const { x, y } = getCoords(e);
    lastPosRef.current = { x, y };
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
  };

  const handlePointerMove = (e) => {
    if (!isDrawing) return;
    const { x, y } = getCoords(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();

    // Broadcast stroke P2P
    sendData && sendData({
      type: 'broadcast',
      event: 'doodle_p2p_stroke',
      payload: { 
        fromX: lastPosRef.current.x, 
        fromY: lastPosRef.current.y, 
        toX: x, 
        toY: y, 
        color, 
        size: brushSize,
        updater: userId 
      }
    });
    lastPosRef.current = { x, y };
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    // Persist to DB only on lift
    const dataUrl = canvasRef.current.toDataURL('image/png');
    setDoodleData({ img: dataUrl, lastUpdate: Date.now(), updater: userId });
  };

  return (
    <RetroWindow title="shared_canvas.exe" onClose={onClose} className="w-full max-w-4xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col" noPadding>
      <div className="p-2 bg-[var(--bg-window)] border-b-2 border-border flex gap-4 items-center select-none overflow-x-auto no-scrollbar">
        <div className="flex gap-1">
          {['#5c3a21', '#e94560', '#4f9ef8', '#f4d06f', '#4ade80', '#000000'].map(c => (
            <button key={c} onClick={() => setColor(c)} className={`w-5 h-5 rounded-sm retro-border transition-transform ${color === c ? 'scale-125 ring-2 ring-[var(--primary)] z-10' : 'hover:scale-110'}`} style={{ backgroundColor: c }} />
          ))}
        </div>
        <input type="range" min="1" max="20" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-16 sm:w-24 accent-[var(--primary)]" />
        
        <RetroButton variant="white" onClick={handleSaveToAlbum} className="px-3 py-1 text-[10px] retro-border ml-auto flex items-center gap-1 shrink-0"><Brush size={12}/> Save to Album</RetroButton>

        <span className="text-[10px] font-bold uppercase opacity-50 text-[var(--text-main)] shrink-0">
          {doodleData.updater === userId ? 'You are drawing' : 'Last update by partner'}
        </span>
      </div>
      <div className="flex-1 bg-white relative touch-none shadow-inner" ref={containerRef} style={{ 
          backgroundImage: 'radial-gradient(rgba(0,0,0,0.05) 1px, transparent 0)',
          backgroundSize: '30px 30px'
        }}>
        <canvas 
          ref={canvasRef} 
          onMouseDown={handlePointerDown} 
          onMouseMove={handlePointerMove} 
          onMouseUp={handlePointerUp} 
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          className="absolute inset-0 w-full h-full cursor-crosshair" 
        />
      </div>
      <div className="p-2 bg-[var(--bg-window)] retro-border-t text-[9px] font-bold opacity-40 text-center uppercase italic">
        * This drawing is shared and persistent. It never expires. *
      </div>
    </RetroWindow>
  );
}
