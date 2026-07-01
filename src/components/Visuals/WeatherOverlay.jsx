import React from 'react';
import { Snowflake } from 'lucide-react';

export function WeatherOverlay({ weather }) {
  if (weather === 'clear') return null;
  const particles = Array.from({ length: 30 });
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {particles.map((_, i) => (
        <div key={i} className="absolute" style={{ left: `${Math.random() * 100}%`, top: `-100px`, animation: `${weather} ${Math.random() * 2 + (weather === 'rain' ? 1 : 3)}s linear infinite`, animationDelay: `${Math.random() * 2}s` }}>
          {weather === 'rain' ? <div className="w-[2px] h-10 bg-blue-400 opacity-50 rounded-full" /> : <Snowflake size={16} className="text-white opacity-80" />}
        </div>
      ))}
    </div>
  )
}
