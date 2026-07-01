import React, { useState, useRef } from 'react';
import { Image as ImageIcon, Brush } from 'lucide-react';
import { RetroWindow, ImageViewerOverlay } from '../components/UI.jsx';
import { SecureImage } from '../components/SecureMedia.jsx';
import { useAssetSync } from '../hooks/useAssetSync.js';
import { useGlobalSync } from '../hooks/useSupabaseSync.js';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { playAudio } from '../utils/audio.js';

export function ScrapbookApp({ onClose, images: propImages = [], sfx, userId, roomId }) {
  const { assets, uploadAsset } = useAssetSync(roomId); // Fetch all assets for the room
  const [layoutMode, setLayoutMode] = useLocalStorage('scrapbook_mode', 'grid');
  const [layout, setLayout] = useGlobalSync('scrapbook_layout', {});
  const [page, setPage] = useState(1);
  const [viewerContext, setViewerContext] = useState({ items: [], index: 0, isOpen: false });
  const fileInputRef = useRef(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      await uploadAsset(file, 'scrapbook', userId);
      playAudio('click', sfx);
    } catch (err) {
      console.error(err);
      alert('Failed to import photo: ' + err.message);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  
  const normalizedImages = assets.map(a => a.url);
  const images = [...new Set([...normalizedImages, ...(propImages || [])])];
  const visibleImages = images.slice(0, page * 12);
  const containerRef = useRef(null);

  const handleDragStart = (e, url) => {
    if (layoutMode === 'grid') return;
    const rect = containerRef.current.getBoundingClientRect();
    const handleMove = (moveEvent) => {
      const clientX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const clientY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      setLayout(prev => ({ ...prev, [url]: { ...prev[url], x, y } }));
    };
    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleUp);
  };

  const rotateImage = (url) => {
    setLayout(prev => ({
      ...prev,
      [url]: { ...prev[url], rotate: ((prev[url]?.rotate || 0) + 15) % 360 }
    }));
  };

  return (
    <RetroWindow title="scrapbook_v2.exe" onClose={onClose} className="w-full max-w-5xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col" noPadding>
      {viewerContext.isOpen && (
        <ImageViewerOverlay
          images={viewerContext.items}
          currentIndex={viewerContext.index}
          onClose={() => setViewerContext(p => ({ ...p, isOpen: false }))}
          onNext={() => setViewerContext(p => ({ ...p, index: (p.index + 1) % p.items.length }))}
          onPrev={() => setViewerContext(p => ({ ...p, index: (p.index - 1 + p.items.length) % p.items.length }))}
          sfx={sfx}
        />
      )}
      <div className="p-3 bg-[var(--bg-main)] border-b-2 retro-border flex items-center justify-between shrink-0">
        <div className="flex gap-2">
          <button onClick={() => setLayoutMode('grid')} className={`px-3 py-1 text-xs font-bold retro-border ${layoutMode === 'grid' ? 'retro-bg-primary text-[var(--text-on-primary)]' : 'bg-[var(--bg-window)] text-[var(--text-main)]'}`}>Grid View</button>
          <button onClick={() => setLayoutMode('collage')} className={`px-3 py-1 text-xs font-bold retro-border ${layoutMode === 'collage' ? 'retro-bg-primary text-[var(--text-on-primary)]' : 'bg-[var(--bg-window)] text-[var(--text-main)]'}`}>Collage Mode</button>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            accept="image/*" 
            className="hidden" 
            onChange={handleImportFile} 
          />
          <button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={isImporting} 
            className="px-3 py-1 text-xs font-bold retro-border bg-[var(--bg-window)] text-[var(--text-main)] hover:bg-[var(--accent)] hover:text-[var(--text-on-accent)] disabled:opacity-50 flex items-center gap-1"
          >
            {isImporting ? 'Importing...' : 'Import Photo'}
          </button>
        </div>
        <h2 className="font-black text-xs uppercase tracking-[0.2em] hidden sm:block">Memory Collection</h2>
        <div className="flex gap-2"><span className="text-[10px] font-bold opacity-40 uppercase mr-2 mt-2">{images.length} photos</span></div>
      </div>
      <div className="flex-1 overflow-auto bg-[var(--bg-main)] relative p-4" ref={containerRef}>
        {layoutMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {images.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-16 gap-5 select-none">
                <div className="relative">
                  <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="8" y="16" width="64" height="50" rx="4" fill="var(--primary)" fillOpacity="0.15" stroke="var(--primary)" strokeWidth="2.5" strokeDasharray="6 3"/>
                    <circle cx="30" cy="35" r="6" fill="var(--accent)" fillOpacity="0.7"/>
                    <path d="M12 56 L28 42 L38 52 L52 38 L68 56 Z" fill="var(--primary)" fillOpacity="0.3"/>
                    <rect x="32" y="56" width="16" height="16" rx="8" fill="var(--primary)"/>
                    <path d="M40 61 V67 M37 64 H43" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="text-center">
                  <p className="font-black text-sm uppercase tracking-widest opacity-60">No memories yet</p>
                  <p className="text-[10px] font-bold opacity-40 mt-1">Share images in chat to fill your album ❤️</p>
                </div>
              </div>
            )}
            {visibleImages.map((url, i) => (
              <div key={i} className="group relative aspect-square retro-border bg-[var(--bg-window)] p-1 retro-shadow-dark hover:-translate-y-1 transition-transform">
                <SecureImage url={url} alt="memory" loading="lazy" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                   <button onClick={() => setViewerContext({ 
                     items: images.map((url, idx) => ({ 
                       url, 
                       metadata: { title: 'Memory Piece', sender: 'Shared Album' } 
                     })), 
                     index: i, 
                     isOpen: true 
                   })} className="p-2 bg-[var(--bg-window)] text-[var(--text-main)] retro-border hover:bg-[var(--accent)] hover:text-[var(--text-on-accent)]"><ImageIcon size={16}/></button>
                   <button onClick={() => { playAudio('click', sfx); setLayoutMode('collage'); setLayout(p => ({ ...p, [url]: { x: 10 + Math.random()*70, y: 10+Math.random()*70, rotate: 0 } })); }} className="p-2 bg-[var(--bg-window)] text-[var(--text-main)] retro-border hover:bg-[var(--accent)] hover:text-[var(--text-on-accent)]" title="Add to Collage"><Brush size={16}/></button>
                </div>
              </div>
            ))}
            {visibleImages.length < images.length && (
               <button onClick={() => setPage(p => p + 1)} className="aspect-square retro-border border-dashed border-2 flex flex-col items-center justify-center opacity-40 hover:opacity-100 transition-opacity">
                  <span className="font-black text-2xl">+</span><span className="text-[10px] font-bold">More</span>
               </button>
            )}
          </div>
        ) : (
          <div className="w-full h-full min-h-[1000px] relative bg-pattern-grid opacity-80">
            {images.map((url, i) => {
              const pos = layout[url] || { x: 10 + (i % 5) * 15, y: 10 + Math.floor(i / 5) * 20, rotate: (i * 7) % 30 - 15 };
              return (
                <div key={i} onMouseDown={(e) => handleDragStart(e, url)} onTouchStart={(e) => handleDragStart(e, url)} style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: `translate(-50%, -50%) rotate(${pos.rotate || 0}deg)`, zIndex: i + 10 }} className="absolute w-32 sm:w-48 bg-[var(--bg-window)] text-[var(--text-main)] p-1 sm:p-2 retro-border shadow-xl cursor-grab active:cursor-grabbing group select-none">
                   <SecureImage url={url} alt="" className="w-full h-auto pointer-events-none" />
                   <div className="absolute inset-0 cursor-pointer" onClick={() => setViewerContext({ 
                     items: images.map((url, idx) => ({ 
                       url, 
                       metadata: { title: 'Memory Piece', sender: 'Shared Album' } 
                     })), 
                     index: i, 
                     isOpen: true 
                   })} />
                   <div className="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 flex gap-1 z-20">
                      <button onClick={(e) => { e.stopPropagation(); rotateImage(url); }} className="p-1 bg-[var(--bg-window)] text-[var(--text-main)] retro-border rounded-full shadow-md hover:bg-[var(--accent)] hover:text-[var(--text-on-accent)]"><Brush size={12}/></button>
                   </div>
                </div>
              );
            })}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[var(--border)] text-[var(--text-on-border)] px-6 py-2 rounded-full font-bold text-xs border border-[var(--border-light)] pointer-events-none z-[100]">DRAG PHOTOS TO CREATE A COLLAGE ❤️</div>
          </div>
          )}
       </div>
    </RetroWindow>
  );
}
