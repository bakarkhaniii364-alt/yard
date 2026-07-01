import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const Unit = React.memo(({ val, label }) => {
  const [displayVal, setDisplayVal] = useState(val);
  const [isFlipping, setIsFlipping] = useState(false);

  useEffect(() => {
    if (val !== displayVal) {
      setIsFlipping(true);
      const timer = setTimeout(() => {
        setDisplayVal(val);
        setIsFlipping(false);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [val, displayVal]);

  const currentStr = String(displayVal).padStart(2, '0');
  const nextStr = String(val).padStart(2, '0');

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-8 h-10 sm:w-10 sm:h-12 lg:w-12 lg:h-14 bg-window border-2 border-border shadow-[1.5px_1.5px_0px_0px_var(--border)] font-black text-lg sm:text-xl lg:text-2xl text-main-text perspective-1000 preserve-3d">
        <div className="absolute top-0 left-0 w-full h-1/2 bg-window overflow-hidden flex items-end justify-center pb-[1px] border-b border-border/10">
          <span className="translate-y-1/2">{nextStr}</span>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-window overflow-hidden flex items-start justify-center pt-[1px]">
          <span className="-translate-y-1/2">{currentStr}</span>
        </div>
        <div 
          className={`absolute top-0 left-0 w-full h-1/2 preserve-3d origin-bottom z-20 ${isFlipping ? 'transition-transform duration-[600ms] ease-in-out' : ''}`}
          style={{ 
            transform: isFlipping ? 'rotateX(-180deg)' : 'rotateX(0deg)',
            transformStyle: 'preserve-3d'
          }}
        >
          <div className="absolute inset-0 bg-window overflow-hidden flex items-end justify-center pb-[1px] backface-hidden border-b border-border/20" style={{ backfaceVisibility: 'hidden' }}>
            <span className="translate-y-1/2">{currentStr}</span>
          </div>
          <div className="absolute inset-0 bg-window overflow-hidden flex items-start justify-center pt-[1px] backface-hidden" style={{ backfaceVisibility: 'hidden', transform: 'rotateX(-180deg)' }}>
            <span className="-translate-y-1/2">{nextStr}</span>
          </div>
        </div>
        <div className="absolute top-1/2 left-0 w-full h-[1.5px] bg-border opacity-30 z-30"></div>
      </div>
      <span className="text-[10px] font-bold opacity-60 uppercase mt-1.5 tracking-tighter">{label}</span>
    </div>
  );
});

export function YardTimer({ anniversary }) {
  const [elapsed, setElapsed] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!anniversary) return;
    const start = new Date(anniversary);
    if (isNaN(start.getTime())) return;

    const update = () => {
      const now = new Date();
      let diff = now - start;
      if (diff < 0) diff = 0;

      const totalDays = Math.floor(diff / (1000 * 60 * 60 * 24));
      const years = Math.floor(totalDays / 365);
      const months = Math.floor((totalDays % 365) / 30);
      const days = totalDays % 30;
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setElapsed({ 
          years: Math.max(0, years), 
          months: Math.max(0, months), 
          days: Math.max(0, days), 
          hours: Math.max(0, hours), 
          minutes: Math.max(0, minutes), 
          seconds: Math.max(0, seconds), 
          totalDays: Math.max(0, totalDays) 
      });
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [anniversary]);

  if (!anniversary) {
    return (
      <div 
        onClick={() => navigate('/settings?highlight=established')}
        className="text-center text-xs opacity-50 font-bold py-2 cursor-pointer hover:opacity-100 hover:text-primary transition-all underline decoration-dashed"
      >
        Set established date in settings to show active time.
      </div>
    );
  }

  if (!elapsed) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap justify-center gap-1">
        {elapsed.years > 0 && <Unit val={elapsed.years} label="yr" />}
        {(elapsed.years > 0 || elapsed.months > 0) && <Unit val={elapsed.months} label="mo" />}
        <Unit val={elapsed.days} label="d" />
        <Unit val={elapsed.hours} label="h" />
        <Unit val={elapsed.minutes} label="m" />
        <Unit val={elapsed.seconds} label="s" />
      </div>
      <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{elapsed.totalDays} days active</p>
    </div>
  );
}
