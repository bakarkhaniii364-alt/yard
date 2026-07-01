import React from 'react';

export function Confetti({ active }) {
  if (!active) return null;
  const pieces = Array.from({ length: 60 }); 
  const colors = ['var(--primary)', 'var(--secondary)', 'var(--accent)'];
  return (
    <div className="fixed inset-0 pointer-events-none z-[200] overflow-hidden">
      {pieces.map((_, i) => (
        <div key={i} className="absolute w-3 h-3 animate-float" style={{ left: `${Math.random() * 100}%`, top: '-20px', backgroundColor: colors[Math.floor(Math.random() * colors.length)], animation: `rain ${Math.random() * 2 + 2}s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`, animationDelay: `${Math.random() * 0.5}s`, transform: `rotate(${Math.random() * 360}deg)` }} />
      ))}
    </div>
  )
}
