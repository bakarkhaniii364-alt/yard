import React, { useRef, useEffect, useState } from 'react';
import { Music, Play, Pause, SkipForward, SkipBack, Volume2, Radio, Disc, BarChart3, Minus, Plus } from 'lucide-react';
import { RetroWindow } from './UI.jsx';

export const CHANNELS = [
    { name: "Bliss", url: "/assets/music/Bliss.mp3" },
    { name: "Ivy", url: "/assets/music/Ivy.mp3" },
    { name: "Electronic Chill", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
    { name: "Lofi Study Chords", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
    { name: "Synthwave Drive", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
    { name: "Cozy Jazz Cafe", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" }
];

import { isTestMode } from '../lib/testMode.js';

// ── RETRO AUDIO VISUALIZER ──
function RetroVisualizer({ audioRef, isPlaying }) {
    if (isTestMode()) {
        return <div className="w-[60px] h-[20px] bg-transparent opacity-80 mix-blend-screen" />;
    }
    const canvasRef = useRef(null);
    const animationRef = useRef(null);
    const contextRef = useRef(null);
    const analyzerRef = useRef(null);

    useEffect(() => {
        if (!audioRef.current || !isPlaying) {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            return;
        }

        try {
            // Initialize context and analyzer only once
            if (!contextRef.current) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                const ctx = new AudioContext();
                const analyzer = ctx.createAnalyser();
                
                // CRITICAL: createMediaElementSource can ONLY be called once per element
                // We store the source node in a property on the audio element to persist it
                if (!audioRef.current._sourceNode) {
                    try {
                        audioRef.current._sourceNode = ctx.createMediaElementSource(audioRef.current);
                        audioRef.current._sourceNode.connect(analyzer);
                        analyzer.connect(ctx.destination);
                    } catch (e) {
                        console.warn("Visualizer failed to connect:", e);
                    }
                }
                
                analyzer.fftSize = 64;
                
                contextRef.current = ctx;
                analyzerRef.current = analyzer;
            }

            // Resume context if it was suspended (browser policy)
            if (contextRef.current.state === 'suspended') {
                contextRef.current.resume();
            }

            const analyzer = analyzerRef.current;
            const bufferLength = analyzer.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');

            const draw = () => {
                animationRef.current = requestAnimationFrame(draw);
                analyzer.getByteFrequencyData(dataArray);

                ctx.clearRect(0, 0, canvas.width, canvas.height);
                const barWidth = (canvas.width / bufferLength) * 2.5;
                let x = 0;

                for (let i = 0; i < bufferLength; i++) {
                    const barHeight = (dataArray[i] / 255) * canvas.height;
                    const hue = (i / bufferLength) * 120 + 280; 
                    ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
                    
                    const segments = 6;
                    const segHeight = canvas.height / segments;
                    for (let j = 0; j < segments; j++) {
                        if (barHeight > j * segHeight) {
                            ctx.fillRect(x, canvas.height - (j + 1) * segHeight + 1, barWidth - 1, segHeight - 1);
                        }
                    }
                    x += barWidth;
                }
            };

            draw();
        } catch (err) {
            console.warn("[Visualizer] Audio setup failed:", err);
        }

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [isPlaying, audioRef]);

    return (
        <canvas 
            ref={canvasRef} 
            width={60} 
            height={20} 
            className="opacity-80 mix-blend-screen"
        />
    );
}

export function RadioPlayerCore({ radioState, setRadioState, audioRef }) {
  useEffect(() => {
     if (audioRef.current) {
        audioRef.current.volume = radioState.volume;
        if (radioState.isPlaying) {
             const playAudio = () => {
                 audioRef.current.play().catch(error => {
                     console.log("Audio playback prevented:", error);
                     if (error.name === 'NotAllowedError') {
                         setRadioState(prev => ({ ...prev, isPlaying: false }));
                     }
                 });
             };
             
             if (audioRef.current.readyState >= 2) {
                 playAudio();
             } else {
                 audioRef.current.oncanplay = () => {
                     playAudio();
                     audioRef.current.oncanplay = null;
                 };
             }
        }
        else audioRef.current.pause();
     }
  }, [radioState.isPlaying, radioState.volume, radioState.channelIdx, setRadioState]);

  return <audio ref={audioRef} src={CHANNELS[radioState?.channelIdx || 0]?.url} loop className="hidden" />;
}

export function StrayTray({ radioState, setRadioState, audioRef }) {
  const [showVolume, setShowVolume] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const timeoutRef = useRef(null);

  const handleMouseEnter = () => {
     if (timeoutRef.current) clearTimeout(timeoutRef.current);
     setIsExpanded(true);
  };
  
  const handleMouseLeave = () => {
     timeoutRef.current = setTimeout(() => {
        setIsExpanded(false);
        setShowVolume(false);
     }, 2000);
  };

  const togglePlay = () => setRadioState({ ...radioState, isPlaying: !radioState.isPlaying });
  const nextCh = () => setRadioState({ ...radioState, channelIdx: (radioState.channelIdx + 1) % CHANNELS.length });
  const prevCh = () => setRadioState({ ...radioState, channelIdx: (radioState.channelIdx - 1 + CHANNELS.length) % CHANNELS.length });

  return (
      <div 
         className={`fixed bottom-4 right-4 z-[200] flex items-center bg-[var(--bg-window)] p-2 rounded-full retro-border retro-shadow-dark transition-all duration-500 ${isExpanded ? 'gap-2' : 'gap-0'}`}
         onMouseEnter={handleMouseEnter}
         onMouseLeave={handleMouseLeave}
      >
         {/* Audio element moved to RadioPlayerCore */}
         
         {/* Always visible icon */}
         <div className={`flex items-center justify-center w-8 h-8 rounded-full cursor-pointer ${radioState?.isPlaying ? 'bg-[var(--primary)] text-white shadow-[0_0_10px_var(--primary)] animate-pulse' : 'bg-[var(--bg-main)] hover:bg-[var(--accent)]'}`} onClick={togglePlay}>
            <Radio size={14} />
         </div>

         {/* Expanded content */}
         <div 
             className="flex items-center transition-all duration-500 overflow-hidden"
             style={{ width: isExpanded ? (showVolume ? '385px' : '285px') : '0px', opacity: isExpanded ? 1 : 0 }}
         >
             <div className="flex bg-[var(--accent)] rounded-full px-3 py-1 items-center gap-2 mr-2 border border-[var(--border)] border-dashed shrink-0">
                <span className="text-[10px] font-black uppercase tracking-widest w-[60px] truncate">{CHANNELS[radioState?.channelIdx]?.name || CHANNELS[0].name}</span>
                <div className="w-8 h-4 overflow-hidden ml-1">
                    <RetroVisualizer audioRef={audioRef} isPlaying={radioState.isPlaying} />
                </div>
             </div>

             <div className="flex items-center gap-1 shrink-0">
                 <button 
                    onClick={() => setShowVolume(!showVolume)}
                    className={`p-2 rounded-full transition-colors ${showVolume ? 'bg-[var(--accent)]' : 'hover:bg-[var(--bg-main)]'}`}
                 >
                    <Volume2 size={14} className="opacity-70" />
                 </button>

                 <div 
                    className="flex items-center gap-2 transition-all duration-300 overflow-hidden"
                    style={{ width: showVolume ? '80px' : '0px', opacity: showVolume ? 1 : 0 }}
                 >
                    <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.05" 
                        value={radioState?.volume || 0.4} 
                        onChange={(e) => setRadioState({...radioState, volume: parseFloat(e.target.value)})} 
                        className="w-16 h-1 accent-[var(--primary)] cursor-pointer" 
                    />
                 </div>
             </div>

             <div className="flex items-center gap-1 border-l border-border/20 pl-2 shrink-0">
                <button onClick={prevCh} className="p-2 bg-[var(--bg-main)] hover:bg-[var(--accent)] rounded-full retro-border active:scale-95 transition-all">
                   <SkipBack size={14} fill="currentColor"/>
                </button>
                <button onClick={togglePlay} className={`p-2 rounded-full retro-border active:scale-95 transition-all ${radioState?.isPlaying ? 'bg-[var(--primary)] text-white shadow-[0_0_15px_var(--primary)]' : 'bg-[var(--bg-main)] hover:bg-[var(--accent)]'}`}>
                   {radioState?.isPlaying ? <Pause size={14} fill="currentColor"/> : <Play size={14} fill="currentColor" className="ml-0.5"/>}
                </button>
                <button onClick={nextCh} className="p-2 bg-[var(--bg-main)] hover:bg-[var(--accent)] rounded-full retro-border active:scale-95 transition-all">
                   <SkipForward size={14} fill="currentColor"/>
                </button>
             </div>
         </div>
      </div>
  );
}

export function DashboardRadio({ radioState, setRadioState }) {
  const togglePlay = () => setRadioState({ ...radioState, isPlaying: !radioState.isPlaying });
  const nextCh = () => setRadioState({ ...radioState, channelIdx: (radioState.channelIdx + 1) % CHANNELS.length });
  const prevCh = () => setRadioState({ ...radioState, channelIdx: (radioState.channelIdx - 1 + CHANNELS.length) % CHANNELS.length });

  return (
      <div className="flex flex-col h-full bg-window p-4 relative overflow-hidden">
        {/* Animated Background Gradients */}
        <div className={`absolute inset-0 transition-opacity duration-1000 ${radioState.isPlaying ? 'opacity-20' : 'opacity-0'}`}>
            <div className="absolute inset-0 bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-500 animate-gradient-slow"></div>
        </div>

        <div className="flex items-center gap-4 z-10">
          <div className={`relative w-20 h-20 rounded-full retro-bg-accent retro-border flex items-center justify-center retro-shadow-dark flex-shrink-0 ${radioState.isPlaying ? 'animate-spin-slow' : ''}`} style={{animationDuration: '4s'}}>
             <Disc size={40} className="opacity-80" />
             <div className="absolute w-4 h-4 bg-window retro-border rounded-full"></div>
             {/* Tiny digital numbers effect */}
             <div className="absolute -bottom-1 right-0 text-[8px] font-mono bg-black text-green-400 px-1 border border-border">
                {radioState.isPlaying ? 'PLAY' : 'STOP'}
             </div>
          </div>
          <div className="flex-1">
             <div className="font-black text-[var(--primary)] uppercase text-[10px] tracking-[0.3em] flex items-center gap-2">
                <BarChart3 size={14} className={radioState.isPlaying ? 'animate-bounce' : ''}/>
                FM RADIO
             </div>
              <div className="w-full max-w-[150px] overflow-hidden group/marquee">
                <div className={`font-black text-2xl leading-tight mt-1 lowercase whitespace-nowrap ${(CHANNELS[radioState.channelIdx]?.name || "").length > 12 ? 'animate-marquee' : ''}`}>
                    {CHANNELS[radioState.channelIdx]?.name || CHANNELS[0].name}
                </div>
              </div>
             <div className="flex items-center gap-2 mt-1">
                  <div className={`w-2 h-2 rounded-full ${radioState.isPlaying ? 'bg-[var(--color-destructive)] animate-pulse shadow-[0_0_8px_red]' : 'bg-gray-400'}`}></div>
                  <div className="text-[10px] font-black opacity-60 uppercase tracking-widest">{radioState.isPlaying ? 'Broadcasting' : 'Off Air'}</div>
             </div>
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-3 z-10 w-full max-w-full overflow-hidden">
            <div className="bg-window p-2 sm:p-3 retro-border flex items-center justify-between sm:justify-start gap-2 sm:gap-4 w-full max-w-full">
                <div className="flex items-center gap-1 shrink-0">
                    <button onClick={prevCh} className="w-10 h-10 bg-[var(--bg-main)] hover:bg-[var(--accent)] retro-border rounded flex items-center justify-center active:scale-95 transition-all">
                        <SkipBack size={18} fill="currentColor"/>
                    </button>
                    <button onClick={togglePlay} className={`w-10 h-10 font-black retro-border rounded active:scale-95 flex items-center justify-center transition-all ${radioState.isPlaying ? 'bg-[var(--primary)] text-white shadow-[0_0_10px_var(--primary)]' : 'bg-window hover:bg-accent'}`}>
                        {radioState.isPlaying ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor" className="ml-1"/>}
                    </button>
                    <button onClick={nextCh} className="w-10 h-10 bg-[var(--bg-main)] hover:bg-[var(--accent)] retro-border rounded flex items-center justify-center active:scale-95 transition-all">
                        <SkipForward size={18} fill="currentColor"/>
                    </button>
                </div>
                
                <div className="flex items-center justify-center gap-1 group bg-black/5 rounded-full px-2 py-1 border border-border/10 min-w-0 flex-1 max-w-[150px]">
                    <Volume2 size={12} className="opacity-40 shrink-0" />
                    <button 
                        onClick={(e) => { e.stopPropagation(); setRadioState({...radioState, volume: Math.max(0, (radioState.volume || 0.4) - 0.05)}); }}
                        className="w-5 h-5 flex items-center justify-center hover:bg-accent/20 rounded active:scale-90 transition-all shrink-0"
                    >
                        <Minus size={10} />
                    </button>
                    <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.05" 
                        value={radioState?.volume || 0.4} 
                        onChange={(e) => setRadioState({...radioState, volume: parseFloat(e.target.value)})} 
                        className="flex-1 min-w-[30px] max-w-[80px] h-1 accent-[var(--primary)] cursor-pointer chunky-slider transition-all" 
                    />
                    <button 
                        onClick={(e) => { e.stopPropagation(); setRadioState({...radioState, volume: Math.min(1, (radioState.volume || 0.4) + 0.05)}); }}
                        className="w-5 h-5 flex items-center justify-center hover:bg-accent/20 rounded active:scale-90 transition-all shrink-0"
                    >
                        <Plus size={10} />
                    </button>
                </div>
            </div>
        </div>


        <div className="absolute bottom-4 right-4 w-1/2 opacity-5 pointer-events-none text-9xl -mb-10 text-[var(--border)]"><Radio/></div>
      </div>
  );
}
