import React from 'react';
import { Mail } from 'lucide-react';

export function FloatingEnvelope({ doodle, onClick, onReadLater }) {
  return (
    <div className="envelope-wrapper drop-shadow-xl flex flex-col items-center gap-1 group" style={{ top: `${doodle.y}vh`, left: `${doodle.x}vw` }}>
      <div className="relative cursor-pointer hover:scale-110 transition-transform active:scale-95" onClick={() => onClick(doodle)}>
        <Mail size={64} className="text-white fill-[var(--primary)]" />
        <span className="absolute -top-2 -right-2 bg-[var(--color-destructive)] text-white text-[10px] font-black px-2 py-0.5 rounded-full border-2 border-white animate-pulse">NEW!</span>
      </div>
      <button 
        onClick={(e) => { e.stopPropagation(); onReadLater?.(doodle); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 underline decoration-2 underline-offset-2 hover:text-primary"
      >
        Read later
      </button>
    </div>
  );
}
