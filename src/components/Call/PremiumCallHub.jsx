import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PhoneOff, MicOff, Mic, Volume2, VolumeX,
         Maximize2, Minimize2, VideoOff, Camera, Monitor, MonitorOff,
         Phone, Video, WifiOff, Settings, Loader, MessageSquare,
         RefreshCw, ChevronDown, Smile, Hand, Zap, ExternalLink,
         Grid2X2, Sidebar } from 'lucide-react';
import { playAudio } from '../../utils/audio.js';
import { useVoiceActivity } from '../../hooks/useVoiceActivity.js';
import { useMobile } from '../../hooks/useMobile.js';
import { DesktopOnly } from '../MobileOnly.jsx';

// ── Quality Badge ─────────────────────────────────────────────────────────────
function QualityBadge({ quality }) {
  const colors = { good: 'bg-[var(--color-game)]', fair: 'bg-yellow-400', poor: 'bg-[var(--color-destructive)]' };
  const labels  = { good: 'HD',          fair: 'SD',            poor: 'LOW'         };
  return (
    <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest text-white ${
      quality === 'good' ? 'bg-[var(--color-game)]/70' : quality === 'fair' ? 'bg-yellow-500/70' : 'bg-[var(--color-destructive)]/70'
    }`}>
      <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${colors[quality]}`} />
      {labels[quality]}
    </div>
  );
}

// ── Device Selector Popover ───────────────────────────────────────────────────
function DeviceSelector({ onChangeDevice, onClose }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState({ audioinput: '', videoinput: '' });
  const [testStream, setTestStream] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [outputVol, setOutputVol] = useState(() => Number(localStorage.getItem('call_output_volume') || 1));
  const [inputVol,  setInputVol]  = useState(() => Number(localStorage.getItem('call_input_volume')  || 1));

  const { volume: testVolume } = useVoiceActivity(testStream);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices()
      .then(list => {
        setDevices(list.filter(d => d.kind === 'audioinput' || d.kind === 'videoinput'));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    return () => {
      if (testStream) testStream.getTracks().forEach(t => t.stop());
    };
  }, [testStream]);

  const audioDevices = devices.filter(d => d.kind === 'audioinput');
  const videoDevices = devices.filter(d => d.kind === 'videoinput');

  const handleChange = (kind, deviceId) => {
    setSelected(prev => ({ ...prev, [kind]: deviceId }));
    onChangeDevice?.(kind, deviceId);
  };

  const handleVolChange = (v) => {
    setOutputVol(v);
    localStorage.setItem('call_output_volume', v);
    window.dispatchEvent(new CustomEvent('call_volume_change', { detail: { volume: v } }));
  };

  const handleInputVolChange = (v) => {
    setInputVol(v);
    localStorage.setItem('call_input_volume', v);
    // In a real app we'd apply this to the local gain node, 
    // for now we'll just persist the setting for CallContext to pick up.
  };

  const toggleMicTest = async () => {
    if (isTesting) {
      if (testStream) testStream.getTracks().forEach(t => t.stop());
      setTestStream(null);
      setIsTesting(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setTestStream(stream);
        setIsTesting(true);
      } catch (e) { console.error('Mic test failed:', e); }
    }
  };

  return (
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-72 bg-window retro-border-thick z-[60] shadow-[6px_6px_0px_var(--border)] animate-in fade-in zoom-in-95 duration-150">
      <div className="px-3 py-2 border-b-2 border-border flex items-center justify-between"
           style={{ backgroundColor: 'var(--bg-header)', color: 'var(--text-on-header)' }}>
        <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
          <Settings size={11} /> Device Settings
        </span>
        <button onClick={onClose} className="p-0.5 hover:bg-white/10 transition-colors text-xs font-black">✕</button>
      </div>
      <div className="p-3 flex flex-col gap-4">
        {loading ? (
          <p className="text-[10px] font-bold opacity-50 text-center py-2">Scanning devices...</p>
        ) : (
          <>
            {/* Mic Test Section */}
            <div className="p-2 retro-border bg-border/5">
              <p className="text-[9px] font-black uppercase tracking-widest opacity-50 mb-2">Mic Check</p>
              <div className="h-2 w-full bg-border/20 rounded-full overflow-hidden mb-3">
                <div className="h-full bg-[var(--color-game)] transition-all duration-75" 
                     style={{ width: `${Math.min(100, testVolume * 300)}%` }} />
              </div>
              <button onClick={toggleMicTest}
                      className={`w-full py-1.5 text-[9px] font-black uppercase tracking-widest retro-border transition-all ${isTesting ? 'bg-[var(--color-destructive)] text-white' : 'bg-primary text-white hover:brightness-110'}`}>
                {isTesting ? 'Stop Mic Test' : 'Test Your Mic'}
              </button>
            </div>

            {/* Output Volume */}
            <div className="space-y-2">
               <p className="text-[9px] font-black uppercase tracking-widest opacity-50 flex items-center justify-between">
                  <span className="flex items-center gap-1"><Volume2 size={10} /> Output Volume</span>
                  <span className="font-mono">{Math.round(outputVol * 100)}%</span>
               </p>
               <div className="relative h-6 flex items-center group/slider">
                  <div className="absolute inset-x-0 h-1 bg-border/20 rounded-full" />
                  <div className="absolute h-1 bg-primary rounded-full transition-all" style={{ width: `${outputVol * 100}%` }} />
                  <input type="range" min="0" max="1" step="0.01" value={outputVol} 
                         onChange={e => handleVolChange(Number(e.target.value))}
                         className="absolute inset-0 w-full opacity-0 cursor-pointer z-10" />
                  <div className="absolute w-4 h-4 bg-window retro-border shadow-sm pointer-events-none transition-all group-hover/slider:scale-110" 
                       style={{ left: `calc(${outputVol * 100}% - 8px)` }}>
                     <div className="absolute inset-1 bg-primary/20" />
                  </div>
               </div>
            </div>

            {/* Input Volume */}
            <div className="space-y-2">
               <p className="text-[9px] font-black uppercase tracking-widest opacity-50 flex items-center justify-between">
                  <span className="flex items-center gap-1"><Mic size={10} /> Input Volume</span>
                  <span className="font-mono">{Math.round(inputVol * 100)}%</span>
               </p>
               <div className="relative h-6 flex items-center group/slider">
                  <div className="absolute inset-x-0 h-1 bg-border/20 rounded-full" />
                  <div className="absolute h-1 bg-accent rounded-full transition-all" style={{ width: `${inputVol * 100}%` }} />
                  <input type="range" min="0" max="1" step="0.01" value={inputVol} 
                         onChange={e => handleInputVolChange(Number(e.target.value))}
                         className="absolute inset-0 w-full opacity-0 cursor-pointer z-10" />
                  <div className="absolute w-4 h-4 bg-window retro-border shadow-sm pointer-events-none transition-all group-hover/slider:scale-110" 
                       style={{ left: `calc(${inputVol * 100}% - 8px)` }}>
                     <div className="absolute inset-1 bg-accent/20" />
                  </div>
               </div>
            </div>

            {videoDevices.length > 0 && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest opacity-50 mb-1.5 flex items-center gap-1">
                  <Camera size={9} /> Camera
                </p>
                <div className="flex flex-col gap-1 max-h-24 overflow-y-auto custom-scrollbar pr-1">
                  {videoDevices.map(d => (
                    <button key={d.deviceId}
                      onClick={() => handleChange('videoinput', d.deviceId)}
                      className={`text-left text-[9px] font-bold px-2 py-1.5 retro-border transition-colors ${selected.videoinput === d.deviceId ? 'bg-primary text-white' : 'bg-window hover:bg-border/20'}`}>
                      {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {devices.length === 0 && (
              <p className="text-[10px] font-bold opacity-40 text-center py-2">No devices found</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Stream Tile ───────────────────────────────────────────────────────────────
function StreamTile({ stream, label, isSpeaking, isMuted: tileMuted, avatarSrc, mirrored, muted, onClick, isActive, isScreenShare, className = '' }) {
  const videoRef = useRef(null);
  useEffect(() => {
    const v = videoRef.current;
    if (v && stream) {
      v.srcObject = stream;
      v.play().catch(() => {});
    }
  }, [stream]);
  const hasVideo = stream && stream.getVideoTracks().some(t => t.enabled && t.readyState === 'live');
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden bg-black flex items-center justify-center select-none transition-all duration-300 cursor-pointer group/tile ${
        isActive ? 'ring-2 ring-primary' : ''
      } ${isSpeaking ? 'shadow-[0_0_20px_rgba(34,197,94,0.5)] ring-2 ring-green-500' : ''} ${className}`}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className={`w-full h-full object-cover ${mirrored ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900/80 p-4 text-center">
          {isScreenShare ? (
            <div className="flex flex-col items-center gap-3 animate-pulse">
              <div className="p-3 bg-primary/20 retro-border text-primary animate-bounce">
                <Monitor size={32} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Tuning in...</p>
              <p className="text-[8px] font-bold opacity-60 text-white uppercase">Waiting for stream signal</p>
            </div>
          ) : avatarSrc ? (
            <img src={avatarSrc} className="w-16 h-16 retro-border object-cover opacity-70" onError={e => e.target.style.display='none'} alt="" />
          ) : (
            <div className="w-16 h-16 bg-border/20 retro-border flex items-center justify-center"><VideoOff size={28} className="text-white/30" /></div>
          )}
        </div>
      )}
      {/* Label */}
      <div className="absolute top-2 left-2 bg-black/80 px-2 py-0.5 text-[9px] text-white font-black uppercase tracking-widest z-10 flex items-center gap-1.5 border border-white/10">
        {label}
        {isSpeaking && <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-game)] shadow-[0_0_6px_#22c55e] animate-pulse" />}
      </div>
      {tileMuted && (
        <div className="absolute top-2 right-2 bg-[var(--color-destructive)]/90 p-1 retro-border z-10"><MicOff size={10} className="text-white" /></div>
      )}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/tile:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
        <span className="bg-window text-main-text border border-border px-3 py-1.5 text-[9px] font-black uppercase tracking-widest shadow-sm">
          Click to Focus
        </span>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function PremiumCallHub({
  calling, callDuration, callStatus, callQuality = 'good',
  isMuted, isDeafened, isCameraOff, isScreenSharing,
  onMicToggle, onDeafenToggle, onCameraToggle, onEndCall,
  onScreenShare, onStopScreenShare,
  onRestartIce, onChangeDevice,
  partnerName, partnerPfp, sfx, remoteStream, remoteScreenStream, localStream, isRinging, type,
  isPartnerTyping, isPartnerCameraOff,
  onReaction, onRaiseHand,
  localScreenStream, isPartnerScreenSharing,
}) {
  const remoteVideoRef = useRef(null);

  // Get user profile for "You" fallback
  const myProfile = JSON.parse(localStorage.getItem('user_profile') || '{}');
  const myPfp = myProfile?.pfp;

  const isMobile = useMobile();

  // ── Mobile Minimized Bubble Coordinates & State ──
  const [bubblePos, setBubblePos] = useState(() => {
    if (typeof window === 'undefined') return { x: 200, y: 100 };
    return { x: window.innerWidth - 74, y: 100 }; // 10px from right margin
  });

  const bubbleTouchStart = useRef({ x: 0, y: 0, posX: 0, posY: 0, moved: false });
  const [isDraggingBubble, setIsDraggingBubble] = useState(false);

  const handleBubbleTouchStart = (e) => {
    const touch = e.touches[0];
    bubbleTouchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      posX: bubblePos.x,
      posY: bubblePos.y,
      moved: false
    };
    setIsDraggingBubble(true);
  };

  const handleBubbleTouchMove = (e) => {
    const touch = e.touches[0];
    const deltaX = touch.clientX - bubbleTouchStart.current.x;
    const deltaY = touch.clientY - bubbleTouchStart.current.y;
    
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      bubbleTouchStart.current.moved = true;
    }
    
    const newX = Math.max(10, Math.min(window.innerWidth - 74, bubbleTouchStart.current.posX + deltaX));
    const newY = Math.max(10, Math.min(window.innerHeight - 74, bubbleTouchStart.current.posY + deltaY));
    
    setBubblePos({ x: newX, y: newY });
  };

  const handleBubbleTouchEnd = () => {
    setIsDraggingBubble(false);
    if (!bubbleTouchStart.current.moved) {
      // Tap to restore call overlay
      playAudio('click', sfx);
      setIsMinimized(false);
    } else {
      // Messenger-style: Snap to left or right screen edge
      const middleX = window.innerWidth / 2;
      const targetX = (bubblePos.x + 32) < middleX ? 10 : window.innerWidth - 74;
      setBubblePos(prev => ({ ...prev, x: targetX }));
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setBubblePos(prev => {
        const nextX = Math.max(10, Math.min(window.innerWidth - 74, prev.x));
        const nextY = Math.max(10, Math.min(window.innerHeight - 74, prev.y));
        return { x: nextX, y: nextY };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Window State
  const [pos,  setPos]  = useState(() => {
    if (typeof window === 'undefined') return { x: 0, y: 0 };
    if (window.innerWidth <= 768) return { x: 0, y: 0 };
    const defaultW = 850;
    const defaultH = 530;
    return { 
      x: Math.max(0, (window.innerWidth - defaultW) / 2), 
      y: Math.max(0, (window.innerHeight - defaultH) / 2) 
    };
  });
  const [size, setSize] = useState(() => {
    if (typeof window === 'undefined') return { w: 850, h: 530 };
    if (window.innerWidth <= 768) return { w: window.innerWidth, h: window.innerHeight };
    return { w: 850, h: 530 };
  });
  const [layoutMode, setLayoutMode] = useState('focused'); // 'grid' | 'focused'
  const [focusedStream, setFocusedStream] = useState('remote'); // 'remote' | 'local-cam' | 'local-screen'
  const [isMinimized, setIsMinimized] = useState(false);
  const [showDevices, setShowDevices] = useState(false);
  const [isCameraChanging, setIsCameraChanging] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [partnerHandRaised, setPartnerHandRaised] = useState(false);
  const [reactions, setReactions] = useState([]);

  // Voice Activity Detection
  const { isSpeaking: mySpeaking } = useVoiceActivity(localStream);
  const { isSpeaking: partnerSpeaking } = useVoiceActivity(remoteStream);

  // Listen for signals via custom events from CallContext
  useEffect(() => {
    const handleReaction = (e) => {
      const id = Math.random();
      setReactions(prev => [...prev, { id, emoji: e.detail.emoji, x: 20 + Math.random() * 60 }]);
      setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 3000);
      playAudio('pop', sfx);
    };
    const handleHand = (e) => {
      setPartnerHandRaised(e.detail.raised);
      if (e.detail.raised) playAudio('ding', sfx);
    };

    window.addEventListener('call_reaction', handleReaction);
    window.addEventListener('call_raise_hand', handleHand);
    return () => {
      window.removeEventListener('call_reaction', handleReaction);
      window.removeEventListener('call_raise_hand', handleHand);
    };
  }, [sfx]);

  const handleSendReaction = (emoji) => {
    onReaction?.(emoji);
    const id = Math.random();
    setReactions(prev => [...prev, { id, emoji, x: 20 + Math.random() * 60 }]);
    setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 3000);
  };

  const handleToggleHand = () => {
    const next = !isHandRaised;
    setIsHandRaised(next);
    onRaiseHand?.(next);
  };

  const handlePiP = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (remoteVideoRef.current) {
        await remoteVideoRef.current.requestPictureInPicture();
      }
    } catch (e) { console.error('PiP failed:', e); }
  };

  // ICE Reconnect Countdown
  const [iceCountdown, setIceCountdown] = useState(null);
  const iceTimerRef = useRef(null);

  useEffect(() => {
    if (callStatus === 'reconnecting' && iceCountdown === null) {
      setIceCountdown(15);
    } else if (callStatus !== 'reconnecting') {
      setIceCountdown(null);
      if (iceTimerRef.current) clearInterval(iceTimerRef.current);
    }
  }, [callStatus]);

  useEffect(() => {
    if (iceCountdown === null) return;
    if (iceCountdown <= 0) { if (iceTimerRef.current) clearInterval(iceTimerRef.current); return; }
    iceTimerRef.current = setInterval(() => setIceCountdown(c => c - 1), 1000);
    return () => { if (iceTimerRef.current) clearInterval(iceTimerRef.current); };
  }, [iceCountdown]);

  // Drag + Resize via refs
  const drag   = useRef(null);
  const resize = useRef(null);

  // Remote stream binding
  useEffect(() => {
    const v = remoteVideoRef.current;
    if (v && remoteStream && !isPartnerCameraOff) { 
      v.srcObject = remoteStream; 
      v.play().catch(() => {}); 
    }
  }, [remoteStream, isMinimized, isPartnerCameraOff]);

  // Local PIP using callback ref
  const localVideoCallbackRef = useCallback((node) => {
    if (node && localStream && !isCameraOff) {
      node.srcObject = localStream;
      node.play().catch(() => {});
    }
  }, [localStream, isCameraOff]);

  // Camera toggle with spinner
  const handleCameraToggle = () => {
    setIsCameraChanging(true);
    onCameraToggle?.();
    setTimeout(() => setIsCameraChanging(false), 1200);
  };

  // Build active stream list
  const activeStreams = [
    { id: 'remote', stream: remoteStream, label: partnerName.split(' ')[0], isSpeaking: partnerSpeaking, muted: false, avatarSrc: partnerPfp },
    ...(isPartnerScreenSharing ? [{ id: 'remote-screen', stream: remoteScreenStream, label: `${partnerName.split(' ')[0]}'s Screen`, isSpeaking: false, muted: true, avatarSrc: null, isScreenShare: true }] : []),
    ...(!isCameraOff && localStream ? [{ id: 'local-cam', stream: localStream, label: 'You (Camera)', isSpeaking: mySpeaking, muted: true, avatarSrc: null, mirrored: true }] : []),
    ...(localScreenStream ? [{ id: 'local-screen', stream: localScreenStream, label: 'You (Screen)', isSpeaking: false, muted: true, avatarSrc: null, isScreenShare: true }] : []),
  ];

  // Auto-focus remote on mount; keep focused valid
  useEffect(() => {
    const ids = activeStreams.map(s => s.id);
    if (!ids.includes(focusedStream)) setFocusedStream(ids[0] || 'remote');
  }, [activeStreams.length]);

  // Auto-focus on partner's screen share when it starts
  useEffect(() => {
    if (isPartnerScreenSharing) {
      setFocusedStream('remote-screen');
    }
  }, [isPartnerScreenSharing]);

  // Pointer move
  const onPointerMove = useCallback((e) => {
    const cx = e.clientX, cy = e.clientY;
    if (drag.current) {
      const { startX, startY, startPosX, startPosY } = drag.current;
      setPos({ x: startPosX + (cx - startX), y: startPosY + (cy - startY) });
      return;
    }
    if (resize.current) {
      const { dir, startX, startY, startW, startH, startPosX, startPosY } = resize.current;
      let nW = startW, nH = startH, nX = startPosX, nY = startPosY;
      const dx = cx - startX, dy = cy - startY;
      if (dir.includes('e')) nW = startW + dx;
      if (dir.includes('s')) nH = startH + dy;
      if (dir.includes('w')) { nW = startW - dx; nX = startPosX + dx; }
      if (dir.includes('n')) { nH = startH - dy; nY = startPosY + dy; }
      setSize({ w: Math.max(300, nW), h: Math.max(220, nH) });
      if (dir.includes('w') && nW > 300) setPos(p => ({ ...p, x: nX }));
      if (dir.includes('n') && nH > 220) setPos(p => ({ ...p, y: nY }));
    }
  }, []);

  const onPointerUp = useCallback(() => { drag.current = null; resize.current = null; }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup',   onPointerUp);
    return () => {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup',   onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  const startDrag = (e) => {
    if (isMobile) return;
    if (e.target.closest('button') || resize.current) return;
    drag.current = { startX: e.clientX, startY: e.clientY, startPosX: pos.x, startPosY: pos.y };
  };
  const startResize = (dir, e) => {
    if (isMobile) return;
    e.preventDefault(); e.stopPropagation();
    resize.current = { dir, startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h, startPosX: pos.x, startPosY: pos.y };
  };

  const mins  = Math.floor(callDuration / 60);
  const secs  = callDuration % 60;
  const timer = `${mins}:${String(secs).padStart(2, '0')}`;
  const isReconnecting = callStatus === 'reconnecting';

  // ── MINIMIZED DOCK ──────────────────────────────────────────────────────────
  if (isMinimized && !isMobile) {
    return (
      <div className="fixed bottom-6 left-6 z-[950] w-72 bg-window retro-border-thick overflow-hidden"
           style={{ boxShadow: '4px 4px 0 var(--border)' }}>
        <div className="p-3 flex items-center gap-3">
          <div className="w-12 h-12 retro-border overflow-hidden bg-black flex-shrink-0">
            {type === 'video' && remoteStream && !isPartnerCameraOff
              ? <video ref={remoteVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${partnerSpeaking ? 'ring-2 ring-green-500' : ''}`} />
              : <div className={`w-full h-full relative ${partnerSpeaking ? 'ring-2 ring-green-500' : ''}`}>
                  <img src={partnerPfp} className="w-full h-full object-cover" onError={e => e.target.style.display='none'} alt="" />
                </div>
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary truncate">{partnerName}</p>
            <p className="text-[9px] font-bold opacity-50 uppercase">
              {isRinging ? 'Ringing...' : isReconnecting ? '⚠ Reconnecting' : timer}
            </p>
          </div>
          <div className="flex gap-1.5">
            <button onClick={onMicToggle}
                    className={`p-1.5 retro-border retro-shadow-dark active:translate-y-[1px] active:shadow-none ${isMuted ? 'bg-[var(--color-destructive)] text-white' : 'bg-window hover:bg-border'} transition-all`}>
              {isMuted ? <MicOff size={14}/> : <Mic size={14}/>}
            </button>
            <button onClick={() => setIsMinimized(false)}
                    className="p-1.5 retro-border retro-shadow-dark active:translate-y-[1px] active:shadow-none bg-primary text-white hover:opacity-80 transition-all"
                    style={{ color: 'var(--text-on-primary)' }}>
              <Maximize2 size={14}/>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── MINIMIZED BUBBLE (MOBILE) ───────────────────────────────────────────────
  if (isMinimized && isMobile) {
    const hasVideo = type === 'video' && remoteStream && !isPartnerCameraOff;
    return (
      <div
        onTouchStart={handleBubbleTouchStart}
        onTouchMove={handleBubbleTouchMove}
        onTouchEnd={handleBubbleTouchEnd}
        className="fixed z-[950] w-16 h-16 rounded-full bg-window flex items-center justify-center select-none touch-none"
        style={{
          left: `${bubblePos.x}px`,
          top: `${bubblePos.y}px`,
          boxShadow: '4px 4px 0 var(--border)',
          border: '3px solid var(--border)',
          transition: isDraggingBubble ? 'none' : 'left 0.2s ease-out, top 0.2s ease-out',
        }}
      >
        <div className={`w-full h-full rounded-full overflow-hidden relative flex items-center justify-center bg-black ${partnerSpeaking ? 'ring-4 ring-green-500 ring-offset-2 ring-offset-window' : ''}`}>
          {hasVideo ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-black/60 rounded-full">
              {partnerPfp ? (
                <img
                  src={partnerPfp}
                  className="w-full h-full object-cover rounded-full"
                  onError={(e) => { e.target.style.display = 'none'; }}
                  alt=""
                />
              ) : (
                <VideoOff size={20} className="text-white/30" />
              )}
            </div>
          )}
          
          {/* Diagnostic / Mic Muted / Reconnecting badges */}
          {isMuted && (
            <div className="absolute bottom-0 right-0 bg-[var(--color-destructive)] p-0.5 rounded-full border border-window shadow">
              <MicOff size={8} className="text-white" />
            </div>
          )}
          {isReconnecting && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-full">
              <Loader size={16} className="text-yellow-400 animate-spin" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── FULL WINDOW ─────────────────────────────────────────────────────────────
  return (
    <div
      className={`fixed z-[900] flex flex-col bg-window retro-border-thick call-overlay-hud ${isMobile ? 'is-mobile-hub' : ''}`}
      style={{
        left: isMobile ? 0 : `${pos.x}px`,
        top: isMobile ? 0 : `${pos.y}px`,
        width: isMobile ? '100vw' : `${size.w}px`,
        height: isMobile ? (window.innerWidth <= 768 ? '100dvh' : `${size.h}px`) : `${size.h}px`,
        boxShadow: isMobile ? 'none' : '4px 4px 0 var(--border)',
        borderRadius: isMobile ? 0 : undefined,
      }}
    >
      {/* Resize handles - disabled on mobile via startResize but hiding for clarity */}
      {!isMobile && (
        <>
          <div className="absolute top-0 left-2 right-2 h-1.5 cursor-n-resize z-50"   onMouseDown={e => startResize('n', e)} />
          <div className="absolute bottom-0 left-2 right-2 h-1.5 cursor-s-resize z-50" onMouseDown={e => startResize('s', e)} />
          <div className="absolute left-0 top-2 bottom-2 w-1.5 cursor-w-resize z-50"   onMouseDown={e => startResize('w', e)} />
          <div className="absolute right-0 top-2 bottom-2 w-1.5 cursor-e-resize z-50"  onMouseDown={e => startResize('e', e)} />
          <div className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-50"  onMouseDown={e => startResize('nw', e)} />
          <div className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-50" onMouseDown={e => startResize('ne', e)} />
          <div className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-50" onMouseDown={e => startResize('sw', e)} />
          <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-50" onMouseDown={e => startResize('se', e)} />
        </>
      )}

      {/* Title Bar */}
      <div
        className={`shrink-0 px-3 py-2 flex items-center justify-between border-b-2 border-border select-none ${isMobile ? '' : 'cursor-grab active:cursor-grabbing'}`}
        style={{ backgroundColor: 'var(--bg-header)', color: 'var(--text-on-header)' }}
        onMouseDown={startDrag}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          <div className={`w-2 h-2 shrink-0 rounded-full ${isReconnecting ? 'bg-yellow-400 animate-pulse' : 'bg-[var(--color-game)]'}`} />
          {type === 'video' ? <Video size={13} className="shrink-0 text-pink-300"/> : <Phone size={13} className="shrink-0 text-cyan-300"/>}
          <span className="text-[11px] font-black uppercase tracking-widest truncate">{type === 'video' ? 'VIDEO CALL' : 'AUDIO CALL'} - {partnerName}</span>
          <span className="opacity-40 text-xs shrink-0">|</span>
          <span className="text-[11px] font-bold opacity-70 shrink-0">{isRinging ? '···' : isReconnecting ? '⚠' : timer}</span>
          {isPartnerTyping && !isRinging && (
            <div className="flex items-center gap-1 bg-primary/20 px-2 py-0.5 rounded text-[9px] font-black animate-in fade-in">
              <MessageSquare size={9} />
              <span className="hidden sm:inline">typing...</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {!isRinging && <QualityBadge quality={callQuality} />}
          {document.pictureInPictureEnabled && remoteStream && !isPartnerCameraOff && (
            <button onClick={handlePiP} className="p-1.5 retro-border retro-shadow-dark bg-window text-main-text hover:bg-accent hover:text-accent-text transition-all active:translate-y-[1px] active:shadow-none" title="Picture in Picture">
              <ExternalLink size={14}/>
            </button>
          )}
          <button onClick={() => { playAudio('click', sfx); setIsMinimized(true); }} className="p-1.5 retro-border retro-shadow-dark bg-window text-main-text hover:bg-accent hover:text-accent-text transition-all active:translate-y-[1px] active:shadow-none" title="Minimize">
            <Minimize2 size={14}/>
          </button>
          <button onClick={onEndCall} className="p-1.5 retro-border retro-shadow-dark active:translate-y-[1px] active:shadow-none bg-[var(--color-destructive)] text-white hover:bg-red-700 transition-all" title="Hang Up">
            <PhoneOff size={14}/>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="relative flex-1 min-h-0 bg-black overflow-hidden group flex items-center justify-center">
        {isReconnecting && (
          <div className="absolute inset-0 z-40 bg-black/85 flex flex-col items-center justify-center gap-4">
            <WifiOff size={36} className="text-yellow-400 animate-bounce"/>
            <p className="text-[10px] font-black text-white uppercase tracking-[0.2em]">
              Reconnecting{iceCountdown !== null && iceCountdown > 0 ? `… ${iceCountdown}s` : ''}
            </p>
            {iceCountdown !== null && iceCountdown <= 0 && (
              <div className="flex gap-3 mt-2 animate-in fade-in">
                <button onClick={() => { onRestartIce?.(); setIceCountdown(15); }}
                        className="flex items-center gap-2 px-4 py-2 retro-border retro-shadow-dark bg-primary text-white text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all">
                  <RefreshCw size={12}/> Retry
                </button>
                <button onClick={onEndCall}
                        className="flex items-center gap-2 px-4 py-2 retro-border retro-shadow-dark bg-[var(--color-destructive)] text-white text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all">
                  <PhoneOff size={12}/> End
                </button>
              </div>
            )}
          </div>
        )}

        {isRinging ? (
          <div className="flex flex-col items-center gap-5 z-10">
            <div className="w-24 h-24 retro-border overflow-hidden relative bg-black animate-pulse">
              <img src={partnerPfp} className="w-full h-full object-cover opacity-60" onError={e => e.target.style.display='none'} alt=""/>
              <div className="absolute inset-0 flex items-center justify-center">
                {type === 'video' ? <Video size={36} className="text-white/80"/> : <Phone size={36} className="text-white/80"/>}
              </div>
            </div>
            <p className="text-[10px] font-black text-white uppercase tracking-[0.25em]">Ringing {partnerName}…</p>
          </div>
        ) : (
          <>
            {/* ─ GRID MODE ─ */}
            {layoutMode === 'grid' ? (
              <div className={`w-full h-full grid gap-1 p-1 ${
                activeStreams.length === 1 ? 'grid-cols-1' :
                activeStreams.length === 2 ? 'grid-cols-2' : 'grid-cols-2 grid-rows-2'
              }`}>
                {activeStreams.map(s => (
                  <StreamTile
                    key={s.id}
                    stream={s.stream}
                    label={s.label}
                    isSpeaking={s.isSpeaking}
                    isMuted={s.id === 'local-cam' && isMuted}
                    avatarSrc={s.avatarSrc}
                    mirrored={s.mirrored}
                    muted={s.muted}
                    onClick={() => setFocusedStream(s.id)}
                    isScreenShare={s.isScreenShare}
                    className="w-full h-full"
                  />
                ))}
              </div>
            ) : (
              /* ─ FOCUSED MODE ─ */
              <div className="w-full h-full flex flex-col">
                {/* Main focused stream */}
                <div className="flex-1 min-h-0">
                  {(() => {
                    const focused = activeStreams.find(s => s.id === focusedStream) || activeStreams[0];
                    if (!focused) return null;
                    return (
                      <StreamTile
                        stream={focused.stream}
                        label={focused.label}
                        isSpeaking={focused.isSpeaking}
                        isMuted={focused.id === 'local-cam' && isMuted}
                        avatarSrc={focused.avatarSrc}
                        mirrored={focused.mirrored}
                        muted={focused.muted}
                        isScreenShare={focused.isScreenShare}
                        className="w-full h-full"
                      />
                    );
                  })()}
                </div>
                {/* Thumbnail strip for other streams */}
                {activeStreams.length > 1 && (
                  <div className="shrink-0 flex gap-1 p-1 bg-black/50 overflow-x-auto">
                    {activeStreams.filter(s => s.id !== focusedStream).map(s => (
                      <StreamTile
                        key={s.id}
                        stream={s.stream}
                        label={s.label}
                        isSpeaking={s.isSpeaking}
                        isMuted={s.id === 'local-cam' && isMuted}
                        avatarSrc={s.avatarSrc}
                        mirrored={s.mirrored}
                        muted={s.muted}
                        onClick={() => setFocusedStream(s.id)}
                        isActive={focusedStream === s.id}
                        isScreenShare={s.isScreenShare}
                        className="w-32 h-20 shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/60 transition-all"
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="absolute top-2 left-2 flex gap-1.5 z-30">
              {isMuted    && <div className="p-1.5 bg-[var(--color-destructive)]/90 text-white rounded-full retro-border"><MicOff  size={12}/></div>}
              {isDeafened && <div className="p-1.5 bg-[var(--color-destructive)]/90 text-white rounded-full retro-border"><VolumeX size={12}/></div>}
              {isCameraOff && type === 'video' && <div className="p-1.5 bg-[var(--color-destructive)]/90 text-white rounded-full retro-border"><VideoOff size={12}/></div>}
              {partnerHandRaised && (
                <div className="px-2 py-1 bg-yellow-400 text-black rounded retro-border text-[9px] font-black animate-bounce flex items-center gap-1 shadow-lg">
                  <Hand size={10} fill="currentColor" /> {partnerName.split(' ')[0]} raised hand!
                </div>
              )}
            </div>

            <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
              {reactions.map(r => (
                <div key={r.id} 
                     className="absolute bottom-0 text-3xl animate-reaction-rise transition-opacity"
                     style={{ left: `${r.x}%` }}>
                  {r.emoji}
                </div>
              ))}
            </div>

            {!isReconnecting && (
              <div className="absolute top-2 right-2 bg-black/70 px-2 py-0.5 retro-border text-[9px] text-white font-black tracking-widest uppercase z-30">LIVE</div>
            )}
          </>
        )}
        {/* Hover Controls (Retro Styled) */}

        <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 sm:gap-2 bg-window px-3 sm:px-4 py-2 sm:py-3 retro-border-thick transition-all duration-300 z-50 shadow-[6px_6px_0px_rgba(0,0,0,0.3)] ${isMobile ? 'opacity-100 w-[95%] justify-center flex-wrap' : 'opacity-0 group-hover:opacity-100'}`}>
          <button onClick={onMicToggle} 
                  className={`p-2 sm:p-2.5 retro-border retro-shadow-dark active:translate-y-[2px] active:shadow-none transition-all hover:scale-110 ${isMuted ? 'bg-[var(--color-destructive)] text-white' : 'bg-window hover:bg-accent hover:text-accent-text'}`} title="Mute (Shift+M)">
            {isMuted ? <MicOff size={14} className="sm:size-5"/> : <Mic size={14} className="sm:size-5"/>}
          </button>
          <button onClick={onDeafenToggle} 
                  className={`p-2 sm:p-2.5 retro-border retro-shadow-dark active:translate-y-[2px] active:shadow-none transition-all hover:scale-110 ${isDeafened ? 'bg-[var(--color-destructive)] text-white' : 'bg-window hover:bg-accent hover:text-accent-text'}`} title="Deafen (Shift+D)">
            {isDeafened ? <VolumeX size={14} className="sm:size-5"/> : <Volume2 size={14} className="sm:size-5"/>}
          </button>
          <button onClick={handleCameraToggle} 
                  className={`p-2 sm:p-2.5 retro-border retro-shadow-dark active:translate-y-[2px] active:shadow-none transition-all hover:scale-110 relative ${isCameraOff ? 'bg-[var(--color-destructive)] text-white' : 'bg-window hover:bg-accent hover:text-accent-text'}`} title="Camera (Shift+V)">
            {isCameraChanging
              ? <Loader size={14} className="sm:size-5 animate-spin"/>
              : isCameraOff ? <VideoOff size={14} className="sm:size-5"/> : <Camera size={14} className="sm:size-5"/>
            }
          </button>
          
          <DesktopOnly>
            <button onClick={() => isScreenSharing ? onStopScreenShare?.() : onScreenShare?.()}
                    className={`p-2.5 retro-border retro-shadow-dark active:translate-y-[2px] active:shadow-none transition-all hover:scale-110 ${isScreenSharing ? 'bg-[var(--color-cta)] text-white' : 'bg-window hover:bg-accent hover:text-accent-text'}`} title="Screen Share (Shift+S)">
              {isScreenSharing ? <MonitorOff size={14} className="sm:size-5"/> : <Monitor size={14} className="sm:size-5"/>}
            </button>
            {/* Layout toggle */}
            <button onClick={() => setLayoutMode(m => m === 'grid' ? 'focused' : 'grid')}
                    className={`p-2.5 retro-border retro-shadow-dark active:translate-y-[2px] active:shadow-none transition-all hover:scale-110 ${layoutMode === 'grid' ? 'bg-accent text-accent-text' : 'bg-window hover:bg-accent hover:text-accent-text'}`}
                    title={layoutMode === 'grid' ? 'Switch to Focused View' : 'Switch to Grid View'}>
              {layoutMode === 'grid' ? <Sidebar size={14} className="sm:size-5"/> : <Grid2X2 size={14} className="sm:size-5"/>}
            </button>
          </DesktopOnly>
          
          <div className="w-px h-6 sm:h-8 bg-border mx-0.5 sm:mx-1 opacity-20"/>
          
          <div className="relative group/react">
            <button className="p-2 sm:p-2.5 retro-border retro-shadow-dark active:translate-y-[2px] active:shadow-none transition-all hover:scale-110 bg-window hover:bg-accent hover:text-accent-text">
              <Smile size={14} className="sm:size-5"/>
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/react:flex items-center gap-1 sm:gap-1.5 bg-window retro-border-thick p-1.5 sm:p-2 shadow-xl animate-in fade-in slide-in-from-bottom-2">
              {['❤️', '🔥', '😂', '😮', '😢', '👍'].map(emoji => (
                <button key={emoji} onClick={() => handleSendReaction(emoji)}
                        className="p-1 sm:p-1.5 hover:bg-border rounded transition-all hover:scale-125 text-lg sm:text-xl">
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleToggleHand}
                  className={`p-2 sm:p-2.5 retro-border retro-shadow-dark active:translate-y-[2px] active:shadow-none transition-all hover:scale-110 ${isHandRaised ? 'bg-yellow-400 text-black' : 'bg-window hover:bg-accent hover:text-accent-text'}`} title="Raise Hand">
            <Hand size={14} className="sm:size-5" fill={isHandRaised ? "currentColor" : "none"} />
          </button>
          
          <div className="w-px h-6 sm:h-8 bg-border mx-0.5 sm:mx-1 opacity-20"/>

          <div className="relative">
            <button onClick={() => setShowDevices(p => !p)}
                    className={`p-2 sm:p-2.5 retro-border retro-shadow-dark active:translate-y-[2px] active:shadow-none transition-all hover:scale-110 ${showDevices ? 'bg-accent text-accent-text' : 'bg-window hover:bg-accent hover:text-accent-text'}`} title="Device Settings">
              <Settings size={14} className="sm:size-5"/>
            </button>
            {showDevices && (
              <DeviceSelector onChangeDevice={onChangeDevice} onClose={() => setShowDevices(false)} />
            )}
          </div>

          <div className="w-px h-6 sm:h-8 bg-border mx-0.5 sm:mx-1 opacity-20"/>

          <button onClick={onEndCall} 
                  className="p-2.5 sm:p-3 retro-border-thick shadow-[3px_3px_0_var(--border)] sm:shadow-[4px_4px_0_var(--border)] active:translate-y-[2px] active:shadow-none bg-[var(--color-destructive)] text-white hover:bg-red-700 hover:scale-110 transition-all" title="End Call">
            <PhoneOff size={isMobile ? 18 : 22} className="rotate-[135deg]"/>
            <span style={{ display: 'none' }}>End</span>
          </button>
        </div>
      </div>
    </div>
  );
}
