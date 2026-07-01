import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { isTestMode } from '../lib/testMode.js';

let winderAudioCtx = null;
let noiseBuffer = null;

function getNoiseBuffer(ctx) {
  if (noiseBuffer) return noiseBuffer;
  const bufferSize = ctx.sampleRate * 0.02; // 20ms
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuffer = buffer;
  return noiseBuffer;
}

// Custom high-quality mechanical click sound
function playFidgetTick(enabled) {
  if (!enabled) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!winderAudioCtx || winderAudioCtx.state === 'closed') {
      winderAudioCtx = new AC();
    }
    if (winderAudioCtx.state === 'suspended') {
      winderAudioCtx.resume();
    }
    const ctx = winderAudioCtx;
    const now = ctx.currentTime;

    // 1. Noise transient (metal scrape / tooth release)
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = getNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3000, now);
    filter.Q.setValueAtTime(4, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.18, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.006);

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseSource.start(now);
    noiseSource.stop(now + 0.01);

    // 2. High-pitch chime (metallic ring)
    const osc1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(2400, now);
    osc1.frequency.exponentialRampToValueAtTime(1000, now + 0.008);
    g1.gain.setValueAtTime(0.08, now);
    g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.008);

    osc1.connect(g1);
    g1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.01);

    // 3. Lower mechanical thud
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(450, now);
    g2.gain.setValueAtTime(0.06, now);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);

    osc2.connect(g2);
    g2.connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.015);
  } catch (e) {}
}

export function PocketWatchWinder({ initialDate, onClose, onJumpToDate, roomId, sfx }) {
  const [dates, setDates] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rotationAngle, setRotationAngle] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const dialRef = useRef(null);
  const containerRef = useRef(null);
  const dragRef = useRef(null);
  const lastAngleRef = useRef(0);
  const rotationRef = useRef(0);
  const stateRef = useRef({ selectedIndex, rotationAngle, dates, isDragging });

  // Keep stateRef up to date to prevent stale closures inside event handlers
  useEffect(() => {
    stateRef.current = { selectedIndex, rotationAngle, dates, isDragging };
  }, [selectedIndex, rotationAngle, dates, isDragging]);

  // Handle clicking outside the winder to close it
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        // Prevent closing if we clicked the date divider button that triggers the winder
        if (e.target.closest('.retro-date-divider-btn')) {
          return;
        }
        onClose();
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick, true);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick, true);
    };
  }, [onClose]);

  // Generate range of dates from oldest message to today (runs ONCE per roomId)
  useEffect(() => {
    async function loadOldestDate() {
      try {
        let date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days fallback
        if (!isTestMode() && roomId) {
          const { data } = await supabase
            .from('chat_messages')
            .select('created_at')
            .eq('room_id', roomId)
            .order('created_at', { ascending: true })
            .limit(1);
          if (data && data[0]) {
            date = new Date(data[0].created_at);
          }
        }
        
        const list = [];
        const today = new Date();
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(today);
        end.setHours(23, 59, 59, 999);
        
        let temp = new Date(start);
        while (temp <= end) {
          list.push(new Date(temp));
          temp.setDate(temp.getDate() + 1);
        }
        
        setDates(list);
      } catch (err) {
        console.error('[timewinder] Error generating dates:', err);
      } finally {
        setLoading(false);
      }
    }
    loadOldestDate();
  }, [roomId]);

  // Synchronize index and rotation when dates list is loaded or initialDate changes
  useEffect(() => {
    if (dates.length === 0 || isDragging) return;
    const init = initialDate ? new Date(initialDate) : new Date();
    init.setHours(0, 0, 0, 0);
    let matchIdx = dates.findIndex(d => d.toDateString() === init.toDateString());
    if (matchIdx === -1) {
      let minDiff = Infinity;
      let closest = 0;
      dates.forEach((d, idx) => {
        const diff = Math.abs(d - init);
        if (diff < minDiff) {
          minDiff = diff;
          closest = idx;
        }
      });
      matchIdx = closest;
    }
    
    setSelectedIndex(matchIdx);
    setRotationAngle(matchIdx * 30);
    rotationRef.current = matchIdx * 30;
  }, [initialDate, dates, isDragging]);

  // Handle pointer down on the dial wheel
  const handleDialDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return; // Left click only
    if (!dialRef.current || dates.length === 0) return;

    e.preventDefault();
    const rect = dialRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const angle = Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);

    dragRef.current = { cx, cy };
    lastAngleRef.current = angle;
    setIsDragging(true);
    playFidgetTick(sfx);
  };

  // Drag updates on window mouse/touch move
  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e) => {
      if (!dragRef.current) return;
      const { cx, cy } = dragRef.current;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const currentAngle = Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
      
      let delta = currentAngle - lastAngleRef.current;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      
      lastAngleRef.current = currentAngle;

      const step = 30; // 30 degrees per date item
      const list = stateRef.current.dates;
      const maxRotation = list.length > 0 ? (list.length - 1) * step : 0;
      const nextRotation = Math.max(0, Math.min(maxRotation, rotationRef.current + delta));
      rotationRef.current = nextRotation;
      setRotationAngle(nextRotation);

      const newIndex = Math.max(0, Math.min(list.length - 1, Math.round(nextRotation / step)));

      if (newIndex !== stateRef.current.selectedIndex) {
        setSelectedIndex(newIndex);
        playFidgetTick(sfx);
      }
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      
      // Snap dial smoothly to closest date division
      const currentIdx = stateRef.current.selectedIndex;
      const snapAngle = currentIdx * 30;
      rotationRef.current = snapAngle;
      setRotationAngle(snapAngle);

      // Instantly trigger history jump on release
      const targetDate = stateRef.current.dates[currentIdx];
      if (targetDate) {
        onJumpToDate(targetDate);
      }
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [isDragging, sfx, onJumpToDate]);

  const formatDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Layout visible dates around dial circle
  const visibleDates = [];
  const radius = 80;
  const windowSize = 6;

  for (let i = -windowSize; i <= windowSize; i++) {
    const idx = selectedIndex + i;
    if (idx >= 0 && idx < dates.length) {
      visibleDates.push({ date: dates[idx], idx });
    }
  }

  return (
    <div
      ref={containerRef}
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] w-64 h-64 sm:w-72 sm:h-72 force-circular border-4 border-border bg-window flex flex-col items-center justify-center select-none animate-in zoom-in duration-200"
      style={{ boxShadow: 'none' }}
    >
      <>
        {/* Alignment indicator notch */}
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center">
          <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-primary" />
          <div className="w-0.5 h-3 bg-primary" />
        </div>

        {/* Fidget Dial Wheel (spin drag target) */}
        <div
          ref={dialRef}
          onMouseDown={handleDialDown}
          onTouchStart={handleDialDown}
          className="w-[84%] h-[84%] force-circular border-4 border-dashed border-primary/30 bg-primary/10 flex items-center justify-center cursor-grab active:cursor-grabbing relative"
          style={{
            transform: `rotate(${rotationAngle}deg)`,
            transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
          }}
        >


          {/* Circular layout of dates */}
          {visibleDates.map(({ date, idx }) => {
            const dateAngle = idx * -30 - 90;
            const dateString = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
            
            const angleRad = (dateAngle * Math.PI) / 180;
            const x = radius * Math.cos(angleRad);
            const y = radius * Math.sin(angleRad);

            // Calculate continuous angular difference relative to current rotationAngle
            let degDiff = (rotationAngle - idx * 30) % 360;
            if (degDiff > 180) degDiff -= 360;
            if (degDiff < -180) degDiff += 360;
            const absDegDiff = Math.abs(degDiff);

            // Cosine-based opacity fading: smooth fading near top/middle notch, 0 at >=90 degrees
            const baseOpacity = absDegDiff < 90 ? Math.pow(Math.cos((degDiff * Math.PI) / 180), 1.5) : 0;
            const opacity = loading ? 0 : baseOpacity;

            return (
              <div
                key={idx}
                className={`absolute font-black tracking-tight select-none uppercase pointer-events-none text-center text-[9px] ${
                  absDegDiff < 15 ? 'text-primary' : 'text-main-text'
                }`}
                style={{
                  left: `calc(50% + ${x}px)`,
                  top: `calc(50% + ${y}px)`,
                  // Scale active date slightly up and inactive dates slightly down for a premium look
                  transform: `translate(-50%, -50%) rotate(${-rotationAngle}deg) scale(${absDegDiff < 15 ? 1.15 : 0.85})`,
                  // Add transition to keep the date label upright and scale/fade smoothly during snaps
                  transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), color 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                  opacity: opacity,
                }}
              >
                {dateString}
              </div>
            );
          })}
        </div>

        {/* Centered Date Read-out (replacing the axle details) */}
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-25 text-center transition-opacity duration-300"
          style={{ opacity: loading ? 0 : 1 }}
        >
          <div className="text-[7px] font-black uppercase opacity-50 tracking-[0.2em] mb-1 leading-none">jump to</div>
          <div className="text-[10px] font-black uppercase text-primary tracking-tight leading-tight">
            {dates[selectedIndex] ? (
              <>
                <div>{dates[selectedIndex].toLocaleDateString([], { weekday: 'short' })},</div>
                <div className="mt-0.5">{dates[selectedIndex].toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              </>
            ) : ''}
          </div>
        </div>
      </>
    </div>
  );
}
