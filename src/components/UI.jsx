import React, { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react';
import { X, MessageSquare, Download, Snowflake, Check, AlertTriangle, Eye, EyeOff, ChevronLeft, ChevronRight, Image as ImageIcon, Maximize2, Minimize2, Trash2, Heart, ExternalLink, Loader, Trash, Play, Pause, Volume2, VolumeX, Ban, Clock, Pencil, Scissors, Square, Circle, Type, Eraser, Save, Music } from 'lucide-react';

import { playAudio } from '../utils/audio.js';
import { DesktopOnly } from './MobileOnly.jsx';
import html2canvas from 'html2canvas';
import { SecureImage, SecureVideo, SecureAudio } from './SecureMedia.jsx';
import { useSignedUrl, parseSupabaseUrl } from '../hooks/useSignedUrl.js';

// ── Toast System ──
const ToastContext = createContext(null);
export function useToast() { return useContext(ToastContext); }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((messageOrObj, type = 'info', duration = 3000) => {
    // messageOrObj can be string or { message, action: { label, onClick }, type, duration }
    const id = Date.now() + Math.random();
    const toast = typeof messageOrObj === 'string' ? { id, message: messageOrObj, type, duration } : { id, ...messageOrObj };
    setToasts(prev => [...prev, toast]);
    const auto = toast.duration || duration;
    if (auto !== 0) setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), auto);
    return id;
  }, []);
  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="fixed top-4 right-4 z-[var(--z-toast)] flex flex-col gap-2 pointer-events-none max-w-sm w-full break-words">
        {toasts.map(t => {
          // Map toast type to semantic variables
          let bgColor = 'var(--bg-window)';
          let textColor = 'var(--text-main)';
          
          if (t.type === 'error') { bgColor = 'var(--color-danger)'; textColor = 'var(--text-on-danger)'; }
          if (t.type === 'success') { bgColor = 'var(--color-success)'; textColor = 'var(--text-on-success)'; }
          if (t.type === 'warn') { bgColor = 'var(--color-warning)'; textColor = 'var(--text-on-warning)'; }
          if (t.type === 'accent') { bgColor = 'var(--accent)'; textColor = 'var(--text-on-accent)'; }

          return (
            <div key={t.id} className="pointer-events-auto retro-border retro-shadow-dark p-3 flex items-start gap-2 font-bold text-sm animate-in slide-in-from-right duration-300"
              style={{ backgroundColor: bgColor, color: textColor }}>
              {t.type === 'success' && <Check size={16} className="shrink-0 mt-0.5" />}
              {t.type === 'warn' && <AlertTriangle size={16} className="shrink-0 mt-0.5" />}
              <div className="flex-1">
                <span>{t.message}</span>
                {t.detail && <div className="text-xs opacity-70 mt-1">{t.detail}</div>}
              </div>
              {t.action && (
                <button onClick={() => { t.action.onClick && t.action.onClick(); setToasts(prev => prev.filter(x => x.id !== t.id)); }} className="ml-2 px-2 py-1 bg-black/10 retro-border text-sm font-bold">{t.action.label}</button>
              )}
              <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="ml-2 shrink-0 opacity-70 hover:opacity-100"><X size={14} /></button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  );
}

export { WeatherOverlay } from './Visuals/WeatherOverlay.jsx';
export { Confetti } from './Visuals/Confetti.jsx';

// ── RetroWindow ──
export function RetroWindow({ title, onClose, children, className = "", noPadding = false, headerActions, onTitleClick, confirmOnClose = false, hasUnsavedChanges = false, onSaveBeforeClose, sfx, overflowVisible = false }) {
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [confirmType, setConfirmType] = React.useState('simple');

  const handleCloseClick = () => {
    if (!onClose) return;
    if (confirmOnClose) {
      if (typeof hasUnsavedChanges === 'function' ? hasUnsavedChanges() : hasUnsavedChanges) {
        setConfirmType('unsaved');
        return setShowConfirm(true);
      }
      setConfirmType('simple');
      return setShowConfirm(true);
    }
    playAudio('click', sfx);
    onClose();
  };

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Check if we should render fullscreen on mobile.
  // We identify dashboard windows by checking if the title is one of the dashboard modules.
  const isDashboardWindow = title && typeof title === 'string' && ['welcome.exe', 'together.timer', 'stats.sys', 'applications', 'radio.sys', 'chat_feed', 'tamagotchi', 'settings.exe'].some(w => title.toLowerCase().includes(w) || title.toLowerCase().endsWith(w));
  // If the window is a confirmation dialog or a smaller layout modal (like received_doodle.msg or doodle_sent.msg or reading_letter.msg), we keep its layout.
  const isSmallModal = title && typeof title === 'string' && (
    title.endsWith('.msg') || 
    title === 'Close' || 
    title === 'Unsaved Changes' || 
    title === 'confirm.exe' ||
    title.toLowerCase().includes('invite') ||
    title.toLowerCase().includes('doodle') ||
    title.toLowerCase().includes('left') ||
    title.toLowerCase().includes('success') ||
    title.toLowerCase().includes('request') ||
    title.toLowerCase().includes('sent') ||
    title.toLowerCase().includes('delete') ||
    title.toLowerCase().includes('terminate') ||
    title.toLowerCase().startsWith('day_')
  );
  
  // Chat window should be full screen but should NOT have pb-safe-navbar since the bottom nav is hidden.
  const isChatWindow = (title && typeof title === 'string' && (title.toLowerCase().includes('chat') || title.toLowerCase().includes('message') || title.toLowerCase().includes('|'))) || (typeof window !== 'undefined' && window.location.pathname.includes('/chat'));
  
  const isAuthScreen = title && typeof title === 'string' && (
    title.toLowerCase().includes('join yard') || 
    title.toLowerCase().includes('welcome back') || 
    title.toLowerCase().includes('partner') || 
    title.toLowerCase().includes('terminate_session')
  );

  const fullscreenClass = isMobile && !isSmallModal && !isDashboardWindow && !isAuthScreen
    ? (isChatWindow ? 'h-[100dvh] border-none shadow-none rounded-none' : 'h-[100dvh] pb-safe-navbar border-none shadow-none rounded-none')
    : '';

  return (
    <>
      <div className={`glass-window bg-window retro-border-thick retro-shadow-dark flex flex-col transform-gpu ${fullscreenClass} ${className}`}>
        <div className="window-header retro-border border-t-0 border-l-0 border-r-0 border-b-[2px] flex justify-between items-center p-1.5 flex-shrink-0 relative overflow-hidden" style={{ backgroundColor: 'var(--bg-header)', color: 'var(--text-on-header)' }}>
          <div className={`relative z-10 flex gap-2 items-center flex-1 ${onTitleClick ? 'cursor-pointer hover:opacity-70 transition-opacity' : ''}`} onClick={onTitleClick}>
            <div className="flex flex-col gap-[3px] w-5 flex-shrink-0">
              <div className="h-[2px] w-full bg-current opacity-50"></div>
              <div className="h-[2px] w-full bg-current opacity-50"></div>
              <div className="h-[2px] w-full bg-current opacity-50"></div>
            </div>
            <h2 className="font-black lowercase text-xs sm:text-sm tracking-tight flex items-center gap-2 flex-shrink-0" role="heading" aria-level="2" aria-label={title}>{title}</h2>
            <div className="flex-1 h-px bg-current opacity-30 ml-2"></div>
          </div>
          <div className="relative z-10 flex items-center gap-1.5">
            {headerActions}
            {onClose && (
              <button onClick={handleCloseClick} aria-label="Close" className="flex p-1.5 retro-border retro-shadow-dark hover:brightness-110 transition-all active:translate-y-[1px] active:shadow-none bg-[var(--color-destructive)] text-white" style={{ color: 'white' }}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        <div className={`window-body ${overflowVisible ? '!overflow-visible' : ''} flex flex-col text-main-text bg-window ${noPadding ? '!p-0 overflow-hidden min-h-0' : ''}`}>{children}</div>
      </div>
      {showConfirm && (
        <ConfirmDialog
          title={confirmType === 'unsaved' ? 'Unsaved Changes' : 'Close'}
          message={confirmType === 'unsaved' ? 'You have unsaved changes. Save before closing?' : 'Close this window? Progress may be lost.'}
          showSave={confirmType === 'unsaved'}
          showCancel={false}
          onSave={() => {
            playAudio('click', sfx);
            if (onSaveBeforeClose) onSaveBeforeClose();
            setShowConfirm(false);
            onClose && onClose();
          }}
          onConfirm={() => { playAudio('click', sfx); setShowConfirm(false); onClose && onClose(); }}
          onCancel={() => setShowConfirm(false)}
          sfx={sfx}
        />
      )}
    </>
  );
}

// ── RetroInput ──
export function RetroInput({ label, icon: Icon, type = 'text', error, className = "", ...props }) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className={`w-full ${error ? 'animate-shake' : ''} ${className}`}>
      <div className={`relative flex flex-col retro-input-container p-2 px-3 ${error ? 'border-[var(--color-destructive)] bg-red-50' : 'focus-within:ring-1 focus-within:ring-primary/20'}`}>
        {label && <label className="text-xs uppercase tracking-widest text-[var(--text-muted)] font-bold mb-0.5 select-none">{label}</label>}
        <div className="relative flex items-center">
          {Icon && <Icon size={14} className={`mr-2 shrink-0 transition-colors duration-300 ${error ? 'text-[var(--color-destructive)]' : 'opacity-50 text-[var(--text-main)] group-focus-within:opacity-100 group-focus-within:text-primary'}`} />}
          <input 
            type={inputType}
            className={`w-full bg-transparent outline-none font-bold text-sm text-[var(--text-main)] placeholder:uppercase placeholder:text-xs placeholder:text-[var(--text-disabled)] placeholder:tracking-widest ${isPassword ? 'pr-8' : ''}`} 
            {...props} 
          />
          {isPassword && (
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 top-1/2 -translate-y-1/2 opacity-30 hover:opacity-100 transition-opacity"
              tabIndex="-1"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-[10px] font-bold text-red-600 mt-1 animate-in fade-in slide-in-from-top-1">{error}</p>}
    </div>
  );
}

// ── RetroButton ──
export function RetroButton({ children, onClick, variant = 'primary', size = null, className = "", disabled = false, style = {}, type = "button", ...props }) {
  const base = "font-bold transition-all retro-button-active disabled:pointer-events-none retro-border flex items-center justify-center gap-2 select-none hover:brightness-110";
  
  const sizes = {
    lg: "h-10 px-6 text-[15px] font-bold uppercase tracking-wider", // Tier 2
    md: "h-8 px-4 text-xs font-bold uppercase tracking-widest",    // Tier 4
    sm: "h-6 px-2 text-[10px] font-bold uppercase tracking-widest", // Tier 5
    sq: "w-8 h-8 p-0 flex items-center justify-center text-xs font-bold",
    "sq-sm": "w-6 h-6 p-0 flex items-center justify-center text-[10px] font-bold"
  };

  const sizeClass = size ? (sizes[size] || "") : sizes.md;

  const variants = { 
    primary: { backgroundColor: 'var(--primary)', color: 'var(--text-on-primary)' }, 
    secondary: { backgroundColor: 'var(--secondary)', color: 'var(--text-on-secondary)' }, 
    white: { backgroundColor: 'var(--bg-window)', color: 'var(--text-main)' }, 
    accent: { backgroundColor: 'var(--accent)', color: 'var(--text-on-accent)' }, 
    custom: {},
    disabled: { 
      backgroundColor: 'var(--bg-disabled)', 
      color: 'var(--text-disabled)', 
      border: '2px dashed var(--text-disabled)',
    } 
  };
  
  const currentVariant = disabled ? variants.disabled : (variants[variant] || variants.primary);

  return (
    <button 
      type={type} 
      onClick={onClick} 
      disabled={disabled} 
      className={`${base} ${sizeClass} ${className}`}
      style={{ ...currentVariant, boxShadow: 'none', borderRadius: '0', ...style }}
      {...props}
    >
      {children}
    </button>
  );
}

// ── Confirm Dialog ──
export function ConfirmDialog({ title, message, onConfirm, onCancel, showSave = false, onSave, sfx, showCancel = false, confirmLabel = "Confirm", cancelLabel = "Cancel" }) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  return (
    <div className={`${isMobile ? 'absolute' : 'fixed'} inset-0 z-[var(--z-modal)] modal-backdrop flex items-center justify-center p-4 animate-in fade-in duration-200`}>
      <RetroWindow title={title || "confirm.exe"} onClose={onCancel} className="w-full max-w-sm" confirmOnClose={false}>
        <p className="font-bold text-sm mb-6">{message}</p>
        <div className="flex gap-2">
          {showSave ? (
            <>
              <RetroButton className="flex-1 py-2" onClick={() => { playAudio('click', sfx); onSave && onSave(); }}>Save & Close</RetroButton>
              <RetroButton variant="white" className="flex-1 py-2" onClick={() => { playAudio('click', sfx); onConfirm && onConfirm(); }}>Discard</RetroButton>
              {showCancel && <RetroButton variant="secondary" className="flex-1 py-2" onClick={() => { playAudio('click', sfx); onCancel && onCancel(); }}>Cancel</RetroButton>}
            </>
          ) : (
            <>
              {showCancel && <RetroButton variant="white" className="flex-1 py-2" onClick={() => { playAudio('click', sfx); onCancel && onCancel(); }}>{cancelLabel}</RetroButton>}
              <RetroButton className="flex-1 py-2" onClick={() => { playAudio('click', sfx); onConfirm && onConfirm(); }}>{confirmLabel}</RetroButton>
            </>
          )}
        </div>
      </RetroWindow>
    </div>
  );
}

// ── AppIcon ──
export function AppIcon({ icon, label, color, hue, onClick, badge }) {
  const bgColor = color || (hue != null ? `hsl(${hue}, 72%, 50%)` : 'var(--primary)');

  const handleKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick && onClick(); } };
  return (
    <div
      role="button" tabIndex={0}
      data-testid={`app-icon-${label.toLowerCase().replace(/\s+/g, '-')}`}
      className="flex flex-col items-center gap-2 group cursor-pointer select-none app-icon-mobile"
      onClick={onClick} onTouchStart={onClick} onKeyDown={handleKey}
    >
      <div className="w-16 h-16 sm:w-20 sm:h-20 retro-border retro-shadow-dark relative transition-all group-hover:-translate-y-1 group-active:translate-y-0.5 group-active:shadow-none overflow-hidden">
        <div className="absolute inset-0" style={{ backgroundColor: bgColor }} />
        <div className="absolute inset-0 flex items-center justify-center z-10 text-white">
          {React.cloneElement(icon, { size: 30, strokeWidth: 2 })}
        </div>
        {badge && (
          <div className="absolute top-0 right-0 bg-[var(--color-destructive)] text-white min-w-[20px] h-5 px-1 flex items-center justify-center font-black text-[10px] border-2 border-white shadow-[1px_1px_0px_0px_black] z-20 select-none">
            {badge}
          </div>
        )}
      </div>
      <span className="font-black uppercase tracking-tighter text-[10px] px-2 py-0.5 retro-border shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] text-main-text bg-window group-hover:bg-accent group-hover:text-accent-text transition-colors">
        {label}
      </span>
    </div>
  );
}

// ── ShareOutcomeOverlay ──
export function ShareOutcomeOverlay({ gameName, stats, resultImage, customElement, onClose, onShareToChat, onSaveToScrapbook, sfx, onRematch, profile, partnerNickname, isSolo }) {
  const localProfile = profile || (() => {
    try {
      return JSON.parse(localStorage.getItem('user_profile') || '{}');
    } catch(e) { return {}; }
  })();
  const playerName = localProfile?.name || 'You';
  const partner = partnerNickname || (() => {
    try {
      const couple = JSON.parse(localStorage.getItem('couple_data') || '{}');
      if (couple.partnerNickname) return couple.partnerNickname;
    } catch(e) {}
    return 'Partner';
  })();

  const handleChatShare = () => {
    playAudio('send', sfx);
    let statString = Object.entries(stats || {}).map(([k, v]) => `${k}: ${v}`).join(' | ');
    const msg = `🎮 *Played ${gameName}*\n_${statString}_`;
    onShareToChat(msg, resultImage);
  };

  const handleDownload = async () => {
    playAudio('click', sfx);
    if (typeof html2canvas === 'undefined') {
      alert('Unable to generate image because the screenshot library is currently unavailable.');
      return;
    }
    const card = document.getElementById('outcome-card');
    if (card) {
      const canvas = await html2canvas(card, {
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-window').trim() || '#fffdf9',
        scale: 2,
        useCORS: true
      });
      const img = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = img; a.download = `${gameName.replace(/ /g, '_')}_Result_${Date.now()}.png`;
      a.click();
    }
  };

  const handleSaveToAlbum = async () => {
    playAudio('click', sfx);
    if (!onSaveToScrapbook) return;
    let imgToSave = resultImage;
    if (!imgToSave) {
      if (typeof html2canvas === 'undefined') {
        alert('Unable to generate image because the screenshot library is currently unavailable.');
        return;
      }
      const card = document.getElementById('outcome-card');
      if (card) {
        const canvas = await html2canvas(card, {
          backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-window').trim() || '#fffdf9',
          scale: 2,
          useCORS: true
        });
        imgToSave = canvas.toDataURL('image/png');
      }
    }
    if (imgToSave) {
      onSaveToScrapbook(imgToSave);
    }
  };

  return (
    <div className="fixed inset-0 z-[var(--z-overlay)] modal-backdrop flex items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col animate-in zoom-in-95 duration-200">
        <RetroWindow
          title={`result_${gameName.toLowerCase().replace(/ /g, '_')}.exe`}
          onClose={onClose}
          className="w-full flex flex-col max-h-[calc(100dvh-2rem)]"
          noPadding
        >
          <div id="outcome-card" className="p-5 sm:p-6 flex flex-col gap-4 overflow-y-auto bg-window text-main-text">
            <div className="flex items-center justify-center gap-3 pb-3 border-b-2 border-dashed border-border">
              {isSolo ? (
                 <div className="flex items-center gap-2">
                    {localProfile?.pfp ? <img src={localProfile.pfp} alt="" className="w-8 h-8 rounded-none border-2 border-border object-cover bg-white shrink-0" /> : <div className="w-8 h-8 rounded-none border-2 border-border bg-accent text-accent-text flex items-center justify-center text-sm shrink-0">{localProfile?.emoji || '😊'}</div>}
                    <span className="font-bold text-sm truncate max-w-[100px]">{playerName} <span className="opacity-50">(Solo)</span></span>
                 </div>
              ) : (
                 <>
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      {localProfile?.pfp ? <img src={localProfile.pfp} alt="" className="w-8 h-8 rounded-none border-2 border-border object-cover bg-white shrink-0" /> : <div className="w-8 h-8 rounded-none border-2 border-border bg-accent text-accent-text flex items-center justify-center text-sm shrink-0">{localProfile?.emoji || '😊'}</div>}
                      <span className="font-bold text-sm truncate max-w-[100px]">{playerName}</span>
                    </div>
                    <span className="text-xs opacity-50 font-black uppercase tracking-widest px-2 py-1 bg-border text-window shrink-0 border-2 border-border">VS</span>
                    <div className="flex items-center gap-2 flex-1 justify-start">
                      <span className="font-bold text-sm truncate max-w-[100px] text-right">{partner}</span>
                      <div className="w-8 h-8 rounded-full retro-border retro-bg-secondary flex items-center justify-center text-sm shrink-0">💕</div>
                    </div>
                 </>
              )}
            </div>

            <h2 className="font-bold text-xl sm:text-2xl text-center text-[var(--primary)] uppercase tracking-widest">{gameName}</h2>

            {customElement ? (
              <div className="flex justify-center w-full">{customElement}</div>
            ) : resultImage ? (
              <div className="bg-[var(--bg-main)] p-2 retro-border shadow-inner">
                <img src={resultImage} alt="Game Result" className="w-full aspect-square object-cover" />
              </div>
            ) : null}

            <div className="space-y-2">
              {stats && Object.entries(stats).map(([key, val]) => (
                <div key={key} className="flex justify-between items-center font-bold border-b border-dashed border-[var(--border)]/30 pb-1">
                  <span className="uppercase opacity-60 tracking-wide text-xs">{String(key)}</span>
                  <span className="text-[var(--primary)] text-base">{String(val)}</span>
                </div>
              ))}
            </div>

            <div className="text-[9px] font-bold text-[var(--primary)]/50 border border-[var(--primary)]/30 rounded px-1 self-end -rotate-[10deg] uppercase tracking-widest">Yard Verified</div>
          </div>

          <div className="flex flex-col gap-2 p-4 border-t-2 border-dashed border-[var(--border)] bg-[var(--bg-main)] shrink-0">
            <div className="flex gap-2">
              <RetroButton onClick={handleChatShare} className="flex-1 py-2 flex justify-center items-center gap-2 text-sm"><MessageSquare size={16} /> Share</RetroButton>
              <DesktopOnly>
                <RetroButton variant="secondary" onClick={handleDownload} className="flex-1 py-2 flex justify-center items-center gap-2 text-sm"><Download size={16} /> Save</RetroButton>
              </DesktopOnly>
            </div>
            <DesktopOnly>
              {onSaveToScrapbook && <RetroButton variant="accent" onClick={handleSaveToAlbum} className="py-2 flex justify-center items-center gap-2 text-sm"><Download size={16} /> Save to Album</RetroButton>}
            </DesktopOnly>
            {onRematch && <RetroButton variant="primary" onClick={onRematch} className="py-2 flex justify-center items-center gap-2 text-sm font-bold">⚡ Rematch</RetroButton>}
          </div>
        </RetroWindow>
      </div>
    </div>
  );
}

export function ScoreboardCountdown({ count = 3, onComplete, sfx }) {
  const [current, setCurrent] = useState(count);
  const [isFlipping, setIsFlipping] = useState(false);

  useEffect(() => {
    if (current > 0) {
      const timer = setTimeout(() => {
        setIsFlipping(true);
        setTimeout(() => {
          setCurrent(prev => prev - 1);
          setIsFlipping(false);
          playAudio('click', sfx);
        }, 500);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (current === 0) {
      const finish = setTimeout(() => onComplete && onComplete(), 500);
      return () => clearTimeout(finish);
    }
  }, [current, onComplete, sfx]);

  return (
    <div className="fixed inset-0 z-[var(--z-boot)] flex items-center justify-center modal-backdrop pointer-events-none animate-in fade-in">
      <div className="relative w-80 h-80 bg-window retro-border-thick retro-shadow-dark flex flex-col items-center justify-between p-6 overflow-hidden animate-in zoom-in duration-300 select-none" style={{ backgroundColor: 'var(--bg-window)' }}>
        <div className="font-black text-xs sm:text-sm uppercase tracking-[0.3em] text-center text-main-text select-none animate-pulse opacity-70">
          🎮 Game will start in
        </div>
        <div className="flex-1 flex items-center justify-center select-none w-full">
          <div className={`relative text-8xl sm:text-9xl font-black leading-none select-none transition-all duration-300 transform-gpu ${isFlipping ? 'scale-0 rotate-12 opacity-0' : 'scale-100 rotate-0 opacity-100'}`} style={{ color: 'var(--primary)', textShadow: '4px 4px 0px var(--border)' }}>
            {current === 0 ? 'GO!' : current}
          </div>
        </div>
        <div className="w-full bg-[var(--bg-main)] p-2 retro-border text-center text-[10px] font-black uppercase tracking-widest text-main-text" style={{ backgroundColor: 'var(--bg-main)' }}>
          Get Ready! ⚡
        </div>
      </div>
    </div>
  );
}

// ── ImageViewerOverlay ──
export function ImageViewerOverlay({ images, currentIndex, onClose, onNext, onPrev, onDelete, onSaveToScrapbook, onReact, onJumpToMessage, sfx }) {
  if (currentIndex === null || !images || !images[currentIndex]) return null;
  
  const currentItem = typeof images[currentIndex] === 'string' ? { url: images[currentIndex], type: 'image' } : images[currentIndex];
  const currentUrl = currentItem.url;
  const currentType = currentItem.type || 'image';
  const isDeleted = currentItem.isDeleted;
  const metadata = currentItem.metadata || {};

  const [pos, setPos] = useState({ x: window.innerWidth / 2 - 350, y: window.innerHeight / 2 - 250 });
  const [size, setSize] = useState({ w: 700, h: 500 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showReactPicker, setShowReactPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const isViewOnce = !!metadata.isViewOnce;
  const [isViewingOnce, setIsViewingOnce] = useState(false);
  const hasBeenViewedRef = useRef(false);
  const deletedRef = useRef(false);

  if (isViewingOnce) {
    hasBeenViewedRef.current = true;
  }

  useEffect(() => {
    setIsViewingOnce(false);
    hasBeenViewedRef.current = false;
    deletedRef.current = false;
  }, [currentIndex]);

  const handleDeleteViewOnce = useCallback(() => {
    if (isViewOnce && hasBeenViewedRef.current && !deletedRef.current && onDelete) {
      deletedRef.current = true;
      onDelete(currentIndex, 'me');
    }
  }, [isViewOnce, currentIndex, onDelete]);

  useEffect(() => {
    return () => {
      if (isViewOnce && hasBeenViewedRef.current && !deletedRef.current && onDelete) {
        deletedRef.current = true;
        onDelete(currentIndex, 'me');
      }
    };
  }, [isViewOnce, currentIndex, onDelete]);

  const handleReleaseViewOnce = () => {
    if (isViewingOnce) {
      setIsViewingOnce(false);
      handleDeleteViewOnce();
      onClose();
    }
  };

  const drag = useRef(null);
  const resize = useRef(null);

  const isDirectUrl = !currentUrl || currentUrl.startsWith('blob:') || currentUrl.startsWith('data:');
  const { bucket, path } = isDirectUrl ? { bucket: null, path: null } : parseSupabaseUrl(currentUrl);
  const { signedUrl } = useSignedUrl(bucket, path);
  const downloadUrl = isDirectUrl ? currentUrl : (signedUrl || currentUrl);

  const reactions = [
    { emoji: '❤️', label: 'love' },
    { emoji: '😂', label: 'haha' },
    { emoji: '😮', label: 'wow' },
    { emoji: '👍', label: 'like' },
    { emoji: '😭', label: 'sobbing' }
  ];

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' && onNext) onNext();
      if (e.key === 'ArrowLeft' && onPrev) onPrev();
      if (e.key === 'Escape') onClose();
      if (e.key === 'f') setIsFullscreen(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNext, onPrev, onClose]);

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
      setSize({ w: Math.max(300, nW), h: Math.max(250, nH) });
      if (dir.includes('w') && nW > 300) setPos(p => ({ ...p, x: nX }));
      if (dir.includes('n') && nH > 250) setPos(p => ({ ...p, y: nY }));
    }
  }, []);

  const onPointerUp = useCallback(() => { drag.current = null; resize.current = null; }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    return () => {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  const startDrag = (e) => {
    if (e.target.closest('button') || e.target.closest('video') || resize.current) return;
    drag.current = { startX: e.clientX, startY: e.clientY, startPosX: pos.x, startPosY: pos.y };
  };
  
  const startResize = (dir, e) => {
    e.preventDefault(); e.stopPropagation();
    resize.current = { dir, startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h, startPosX: pos.x, startPosY: pos.y };
  };

  const handleDownload = () => {
    if (isDeleted || isViewOnce) return;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `yard_media_${Date.now()}.${currentType === 'video' ? 'mp4' : 'png'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    playAudio('click', sfx);
  };

  const windowStyle = isFullscreen ? {
    position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: 1000,
  } : {
    position: 'fixed', left: `${pos.x}px`, top: `${pos.y}px`, width: `${size.w}px`, height: `${size.h}px`, zIndex: 1000,
  };

  return (
    <div className={`flex flex-col bg-window retro-border-thick transition-all ${isFullscreen ? '' : 'retro-shadow-dark'}`} style={windowStyle}>
      {!isFullscreen && (
        <>
          <div className="absolute top-0 left-2 right-2 h-1.5 cursor-n-resize z-50" onMouseDown={e => startResize('n', e)} />
          <div className="absolute bottom-0 left-2 right-2 h-1.5 cursor-s-resize z-50" onMouseDown={e => startResize('s', e)} />
          <div className="absolute left-0 top-2 bottom-2 w-1.5 cursor-w-resize z-50" onMouseDown={e => startResize('w', e)} />
          <div className="absolute right-0 top-2 bottom-2 w-1.5 cursor-e-resize z-50" onMouseDown={e => startResize('e', e)} />
          <div className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-50" onMouseDown={e => startResize('nw', e)} />
          <div className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-50" onMouseDown={e => startResize('ne', e)} />
          <div className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-50" onMouseDown={e => startResize('sw', e)} />
          <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-50" onMouseDown={e => startResize('se', e)} />
        </>
      )}

      {/* Header 1: Main Title & Close */}
      <div 
        className="shrink-0 px-3 py-1.5 flex items-center justify-between border-b-2 border-border cursor-grab active:cursor-grabbing select-none"
        style={{ backgroundColor: 'var(--bg-header)', color: 'var(--text-on-header)' }}
        onMouseDown={!isFullscreen ? startDrag : undefined}
      >
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-[2px] w-4 shrink-0 opacity-50">
            <div className="h-[2px] w-full bg-current"></div>
            <div className="h-[2px] w-full bg-current"></div>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest truncate">media_viewer.exe {images.length > 1 ? `[${currentIndex + 1}/${images.length}]` : ''}</span>
        </div>
        <div className="flex items-center gap-1.5">
           <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-1.5 retro-border retro-shadow-dark bg-window/10 text-white hover:bg-white/20 transition-all active:translate-y-[1px] active:shadow-none" title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button onClick={onClose} className="p-1.5 bg-[var(--color-destructive)] text-white retro-border retro-shadow-dark hover:bg-red-700 transition-all active:translate-y-[1px] active:shadow-none"><X size={14} /></button>
        </div>
      </div>

      {/* Header 2: Metadata & Toolbelt */}
      <div className="shrink-0 px-3 py-2 flex items-center justify-between bg-window border-b-2 border-border shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <ImageIcon size={14} className={`shrink-0 ${isDeleted ? 'text-[var(--color-destructive)] opacity-50' : 'text-primary'}`} />
          <div className="flex flex-col min-w-0">
            <span className={`text-[10px] font-black uppercase tracking-tight truncate ${isDeleted ? 'line-through opacity-50' : ''}`}>{metadata.title || 'Media Message'}</span>
            {(metadata.sender || metadata.time) && (
              <span className="text-[9px] font-bold opacity-60 tracking-tight flex items-center gap-1">
                {metadata.sender && <span>by {metadata.sender}</span>}
                {metadata.time && <span>• {metadata.time}</span>}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-4">
          {onJumpToMessage && !isDeleted && !isViewOnce && (
             <button onClick={() => { playAudio('click', sfx); onJumpToMessage(currentIndex); }} className="p-1.5 retro-border bg-window hover:bg-accent/10 text-primary transition-colors flex items-center justify-center" title="Jump to Message"><MessageSquare size={14} /></button>
          )}
          <button onClick={handleDownload} disabled={isDeleted || isViewOnce} className="p-1.5 retro-border bg-window hover:bg-accent/10 transition-colors disabled:opacity-30 disabled:grayscale" title={isViewOnce ? "Download disabled for view-once media" : "Download"}><Download size={14} /></button>
          {onDelete && !isDeleted && !isViewOnce && (
             <button onClick={() => setShowDeleteConfirm(true)} className="p-1.5 retro-border bg-window hover:bg-[var(--color-destructive)]/10 text-red-600 transition-colors" title="Delete"><Trash2 size={14} /></button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden group">
        {isDeleted ? (
           <div className="flex flex-col items-center justify-center gap-4 text-white/40 select-none p-10 text-center">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center border-2 border-dashed border-white/10">
                 <Ban size={40} />
              </div>
              <div className="space-y-1">
                 <p className="font-black uppercase tracking-[0.2em] text-sm">Media Unavailable</p>
                 <p className="text-[10px] font-bold opacity-60">This {currentType} was deleted on {metadata.time || 'N/A'}</p>
              </div>
           </div>
        ) : isViewOnce ? (
          <div 
            className="w-full h-full flex items-center justify-center relative select-none touch-none cursor-pointer"
            onMouseDown={(e) => {
              if (e.button === 0) setIsViewingOnce(true);
            }}
            onMouseUp={handleReleaseViewOnce}
            onMouseLeave={handleReleaseViewOnce}
            onTouchStart={() => setIsViewingOnce(true)}
            onTouchEnd={handleReleaseViewOnce}
            onTouchCancel={handleReleaseViewOnce}
            onContextMenu={(e) => e.preventDefault()}
          >
            {currentType === 'video' ? (
              <video 
                src={downloadUrl} 
                className="max-w-full max-h-full object-contain pointer-events-none transition-all duration-300"
                style={{ filter: isViewingOnce ? 'none' : 'blur(40px) brightness(0.3)' }}
                autoPlay={isViewingOnce} 
                muted 
                loop 
                playsInline
              />
            ) : (
              <img 
                src={downloadUrl} 
                alt="preview" 
                className="max-w-full max-h-full object-contain shadow-2xl pointer-events-none transition-all duration-300" 
                style={{ filter: isViewingOnce ? 'none' : 'blur(40px) brightness(0.3)' }}
              />
            )}
            
            {!isViewingOnce && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-black/40 pointer-events-none">
                <div className="w-16 h-16 rounded-full bg-[var(--color-destructive)]/20 text-[var(--color-destructive)] flex items-center justify-center mb-4 border border-[var(--color-destructive)]/30 animate-pulse">
                  <Eye size={32} />
                </div>
                <div className="text-white font-black text-xs uppercase tracking-widest select-none text-center">
                  One time media. Hold to view.
                </div>
              </div>
            )}
            
            {isViewingOnce && (
              <div className="absolute top-4 right-4 bg-[var(--color-destructive)] text-white text-[9px] font-black uppercase px-3 py-1 tracking-widest retro-border shadow-md animate-pulse pointer-events-none">
                Release to destroy
              </div>
            )}
          </div>
        ) : currentType === 'video' ? (
           <RetroMediaPlayer 
            url={currentUrl} 
            type="video"
            className="max-w-full max-h-full" 
           />
        ) : (
           <SecureImage url={currentUrl} alt="preview" className="max-w-full max-h-full object-contain shadow-2xl" />
        )}
        
        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button onClick={onPrev} className="absolute left-6 w-14 h-14 bg-window retro-border retro-shadow-dark flex items-center justify-center hover:-translate-x-1 active:translate-x-0 active:shadow-none transition-all z-20 group/nav"><ChevronLeft size={32} className="group-hover/nav:scale-110 transition-transform" /></button>
            <button onClick={onNext} className="absolute right-6 w-14 h-14 bg-window retro-border retro-shadow-dark flex items-center justify-center hover:translate-x-1 active:translate-x-0 active:shadow-none transition-all z-20 group/nav"><ChevronRight size={32} className="group-hover/nav:scale-110 transition-transform" /></button>
          </>
        )}

        {/* Delete Confirmation Overlay */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-50 modal-backdrop flex items-center justify-center p-4 animate-in fade-in">
            <RetroWindow 
              title="delete_media.exe" 
              onClose={() => setShowDeleteConfirm(false)} 
              className="w-full max-w-[260px] animate-in zoom-in-95"
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-red-600 mb-1">
                   <AlertTriangle size={18} />
                   <span className="font-black uppercase tracking-widest text-xs">Delete Media?</span>
                </div>
                <p className="text-[10px] font-bold opacity-80 leading-relaxed">
                   {metadata.isMine ? "Do you want to delete this for yourself or everyone?" : "Are you sure you want to delete this message? This cannot be undone."}
                </p>
                <div className="flex flex-col gap-2 mt-1">
                   {metadata.isMine ? (
                     <>
                        <RetroButton variant="primary" onClick={() => { onDelete(currentIndex, 'everyone'); setShowDeleteConfirm(false); playAudio('click', sfx); }} className="py-2 text-xs">Delete for Everyone</RetroButton>
                        <RetroButton variant="white" onClick={() => { onDelete(currentIndex, 'me'); setShowDeleteConfirm(false); playAudio('click', sfx); }} className="py-2 text-xs">Delete for Me</RetroButton>
                     </>
                   ) : (
                     <RetroButton variant="primary" onClick={() => { onDelete(currentIndex, 'me'); setShowDeleteConfirm(false); playAudio('click', sfx); }} className="py-2 text-xs">Yes, Delete</RetroButton>
                   )}
                </div>
              </div>
            </RetroWindow>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="shrink-0 p-3 bg-window border-t-2 border-border flex items-center justify-between relative">
        <div className="flex gap-2">
          {onReact && !isDeleted && !isViewOnce && (
             <div className="relative">
                <button onClick={() => setShowReactPicker(!showReactPicker)} className={`px-4 py-2 bg-window text-main-text retro-border retro-shadow-dark flex items-center gap-2 font-bold text-xs uppercase tracking-widest hover:-translate-y-0.5 active:translate-y-0 transition-all ${showReactPicker ? 'bg-accent' : ''}`}>
                   <Heart size={16} className={showReactPicker ? 'text-white' : 'text-[var(--color-destructive)]'} /> React
                </button>
                
                {showReactPicker && (
                  <div className="absolute bottom-full left-0 mb-3 bg-window retro-border retro-shadow-dark p-1.5 flex gap-1.5 animate-in slide-in-from-bottom-2 duration-200 z-[60]">
                     {reactions.map(r => (
                       <button 
                        key={r.label} 
                        onClick={() => { onReact(currentIndex, r.emoji); setShowReactPicker(false); playAudio('click', sfx); }}
                        className="w-10 h-10 flex items-center justify-center text-xl hover:bg-accent/10 hover:scale-125 transition-all retro-border bg-window"
                        title={r.label}
                       >
                         {r.emoji}
                       </button>
                     ))}
                  </div>
                )}
             </div>
          )}
        </div>
        <div className="flex gap-2">
           {onSaveToScrapbook && currentType === 'image' && !isDeleted && !isViewOnce && (
             <button onClick={() => { onSaveToScrapbook(currentUrl); playAudio('click', sfx); }} className="px-4 py-2 bg-primary text-white retro-border retro-shadow-dark flex items-center gap-2 font-bold text-xs uppercase tracking-widest hover:-translate-y-0.5 active:translate-y-0 transition-all">
                <ImageIcon size={16} /> Save to Album
             </button>
           )}
        </div>
      </div>
    </div>
  );
}

// ── RetroMediaPlayer ──
// ── RetroMediaPlayer ──
export function RetroMediaPlayer({ url, type = 'video', className = "", autoPlay = true, muted = false, onClick, fileName }) {
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(muted);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const mediaRef = useRef(null);
  const id = useRef(Math.random().toString(36).substr(2, 9));

  useEffect(() => {
    const handleGlobalPlay = (e) => {
      if (e.detail.id !== id.current && isPlaying) {
        mediaRef.current?.pause();
        setIsPlaying(false);
      }
    };
    window.addEventListener('yard-media-play', handleGlobalPlay);
    return () => window.removeEventListener('yard-media-play', handleGlobalPlay);
  }, [isPlaying]);

  const togglePlay = (e) => {
    if (e) e.stopPropagation();
    if (isPlaying) {
      mediaRef.current?.pause();
      setIsPlaying(false);
    } else {
      window.dispatchEvent(new CustomEvent('yard-media-play', { detail: { id: id.current } }));
      mediaRef.current?.play();
      setIsPlaying(true);
    }
  };

  const toggleSpeed = (e) => {
    e.stopPropagation();
    const next = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(next);
    if (mediaRef.current) mediaRef.current.playbackRate = next;
  };

  const handleDownload = (e) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || `yard_${type}_${Date.now()}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleTimeUpdate = () => {
    if (mediaRef.current) {
      setProgress((mediaRef.current.currentTime / mediaRef.current.duration) * 100);
    }
  };

  const handleLoadedMetadata = () => {
    if (mediaRef.current) setDuration(mediaRef.current.duration);
  };

  const formatTime = (time) => {
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      className={`relative group/player overflow-hidden retro-border-thick cursor-pointer ${className} ${type === 'video' ? 'bg-black' : ''}`}
      onClick={onClick}
    >
      {type === 'video' ? (
        <>
          <SecureVideo 
            url={url} 
            ref={mediaRef}
            playsInline
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            className="w-full h-full object-cover"
            autoPlay={autoPlay}
            muted={isMuted}
          />
          {/* Video Controls overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover/player:opacity-100 transition-opacity flex flex-col justify-end p-4 gap-3 pointer-events-none group-hover/player:pointer-events-auto">
             <div className="h-1.5 bg-white/20 rounded-full overflow-hidden cursor-pointer relative" 
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const p = (e.clientX - rect.left) / rect.width;
                    if (mediaRef.current) mediaRef.current.currentTime = p * mediaRef.current.duration;
                  }}>
                <div className="absolute left-0 top-0 h-full bg-primary" style={{ width: `${progress}%` }} />
             </div>
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <button onClick={togglePlay} className="p-2 bg-primary text-white retro-border hover:brightness-110 shadow-lg">
                      {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                   </button>
                   <div className="text-[10px] font-black text-white uppercase tracking-widest bg-black/40 px-2 py-1 rounded">
                      {formatTime(mediaRef.current?.currentTime || 0)} / {formatTime(duration)}
                   </div>
                </div>
                <div className="flex items-center gap-2">
                   <button onClick={toggleSpeed} className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-[10px] font-black text-white transition-colors">
                      {playbackRate}x
                   </button>
                   <button onClick={() => setIsMuted(!isMuted)} className="p-2 text-white opacity-70 hover:opacity-100">
                      {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                   </button>
                </div>
             </div>
          </div>
        </>
      ) : (
        <div className="w-full flex items-center gap-3 p-3 bg-window/40 rounded-xl relative overflow-hidden">
           <button 
            onClick={togglePlay} 
            className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all flex-shrink-0 z-10"
           >
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
           </button>
           
           <div className="flex-1 flex flex-col gap-1 min-w-0 z-10">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                 <span className="text-[10px] font-black uppercase tracking-tight truncate opacity-70 flex-1">{fileName || 'Audio Message'}</span>
                 <button onClick={handleDownload} className="p-1 hover:text-primary transition-colors opacity-40 hover:opacity-100">
                    <Download size={12} />
                 </button>
              </div>

              <div 
                className="h-1.5 bg-black/10 rounded-full overflow-hidden cursor-pointer relative group/slider" 
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const p = (e.clientX - rect.left) / rect.width;
                  if (mediaRef.current) mediaRef.current.currentTime = p * mediaRef.current.duration;
                }}
              >
                 <div 
                  className="absolute left-0 top-0 h-full bg-primary transition-all duration-75" 
                  style={{ width: `${progress}%` }} 
                 />
                 <div 
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary border-2 border-white rounded-full shadow-md opacity-0 group-hover/slider:opacity-100 transition-opacity"
                  style={{ left: `${progress}%`, marginLeft: '-6px' }}
                 />
              </div>
              
              <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest opacity-50 mt-1">
                 <div className="flex items-center gap-2">
                    <span>{formatTime(mediaRef.current?.currentTime || 0)}</span>
                    <span className="opacity-30">/</span>
                    <span>{formatTime(duration)}</span>
                 </div>
                 <button onClick={toggleSpeed} className="px-1.5 py-0.5 bg-primary/10 rounded font-black text-primary hover:bg-primary/20 transition-colors">
                    {playbackRate}x
                 </button>
              </div>
           </div>

           <SecureAudio url={url}>
              {(signedUrl) => (
                <audio 
                  src={signedUrl} 
                  ref={mediaRef}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  autoPlay={autoPlay}
                  muted={isMuted}
                />
              )}
           </SecureAudio>
        </div>
      )}
    </div>
  );
}

// ── MediaEditorOverlay ──
export function MediaEditorOverlay({ file, type, onSave, onClose, sfx }) {
  const [data, setData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const canvasRef = useRef(null);
  const mediaRef = useRef(null);
  
  // Image states
  const [brushColor, setBrushColor] = useState('#ff0000');
  const [brushSize, setBrushSize] = useState(5);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Video/Audio states
  const [isMuted, setIsMuted] = useState(false);
  const [extractAudio, setExtractAudio] = useState(false);

  useEffect(() => {
    if (type === 'image') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext('2d');
          const maxDim = 800;
          let w = img.width, h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) { h = (h / w) * maxDim; w = maxDim; }
            else { w = (w / h) * maxDim; h = maxDim; }
          }
          canvas.width = w; canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);
          setData(canvas.toDataURL('image/png'));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    } else {
      const url = URL.createObjectURL(file);
      setData(url);
    }
  }, [file, type]);

  const handleDrawStart = (e) => {
    if (type !== 'image') return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const handleDrawMove = (e) => {
    if (!isDrawing || type !== 'image') return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleDrawEnd = () => setIsDrawing(false);

  const handleSave = async () => {
    setIsProcessing(true);
    playAudio('click', sfx);
    
    if (type === 'image') {
      const canvas = canvasRef.current;
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const editedFile = new File([blob], file.name, { type: 'image/png' });
      const dataUrl = canvas.toDataURL('image/png');
      onSave(editedFile, dataUrl);
    } else {
      onSave(file, data, { muted: isMuted, extractAudio });
    }
    setIsProcessing(false);
  };

  return (
    <div className="fixed inset-0 z-[var(--z-overlay)] bg-black/90 flex items-center justify-center p-4 animate-in fade-in">
       <RetroWindow title={`media_editor.exe - ${file.name}`} onClose={onClose} className="w-full max-w-4xl h-[85dvh]" noPadding>
          <div className="flex flex-col h-full bg-black/20">
             <div className="shrink-0 p-3 bg-window border-b-2 border-border flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                   {type === 'image' && (
                     <>
                        <div className="flex gap-1 bg-black/5 p-1 retro-border border-dashed">
                           {['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ffffff', '#000000'].map(c => (
                             <button key={c} onClick={() => setBrushColor(c)} className={`w-6 h-6 retro-border ${brushColor === c ? 'scale-110 ring-2 ring-primary' : ''}`} style={{ backgroundColor: c }} />
                           ))}
                        </div>
                        <input type="range" min="1" max="20" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-24 accent-primary" />
                     </>
                   )}
                   {(type === 'video' || type === 'audio') && (
                     <>
                        <button onClick={() => setIsMuted(!isMuted)} className={`p-2 retro-border transition-all ${isMuted ? 'bg-[var(--color-destructive)] text-white' : 'bg-window text-main-text'}`}>
                           {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                        </button>
                        {type === 'video' && (
                          <button onClick={() => setExtractAudio(!extractAudio)} className={`px-3 py-2 text-xs font-bold retro-border transition-all ${extractAudio ? 'bg-primary text-white' : 'bg-window text-main-text'}`}>
                             Extract Audio
                          </button>
                        )}
                     </>
                   )}
                </div>
                <div className="flex items-center gap-2">
                   <RetroButton variant="white" onClick={onClose} className="py-2 px-4 text-xs">Cancel</RetroButton>
                   <RetroButton onClick={handleSave} disabled={isProcessing} className="py-2 px-6 text-xs min-w-[100px]">
                      {isProcessing ? <Loader size={14} className="animate-spin" /> : <><Save size={14} /> Finish</>}
                   </RetroButton>
                </div>
             </div>

             <div className="flex-1 relative flex items-center justify-center overflow-hidden p-6 select-none">
                {type === 'image' && (
                   <div className="relative shadow-2xl bg-white cursor-crosshair">
                      <canvas 
                        ref={canvasRef} 
                        onMouseDown={handleDrawStart}
                        onMouseMove={handleDrawMove}
                        onMouseUp={handleDrawEnd}
                        onMouseLeave={handleDrawEnd}
                        className="max-w-full max-h-full"
                      />
                   </div>
                )}
                {type === 'video' && data && (
                   <video ref={mediaRef} src={data} controls className="max-w-full max-h-full shadow-2xl retro-border" muted={isMuted} />
                )}
                {type === 'audio' && data && (
                   <div className="w-full max-w-md p-10 bg-window retro-border-thick flex flex-col items-center gap-6">
                      <div className="w-24 h-24 bg-primary text-white rounded-full flex items-center justify-center shadow-2xl animate-pulse">
                         <Music size={48} />
                      </div>
                      <audio ref={mediaRef} src={data} controls className="w-full" muted={isMuted} />
                   </div>
                )}
             </div>
          </div>
       </RetroWindow>
    </div>
  );
}

// ── ViewOnceMedia ──
export function ViewOnceMedia({ url, type, className = "", onClick }) {
  return (
    <div 
      onClick={onClick}
      className={`w-full h-full min-h-[140px] min-w-[160px] flex flex-col items-center justify-center p-4 retro-border bg-window retro-shadow cursor-pointer hover:bg-accent/10 transition-colors group select-none ${className}`}
    >
      <div className="w-10 h-10 rounded-full bg-[var(--color-destructive)]/10 text-[var(--color-destructive)] flex items-center justify-center mb-2 group-active:scale-95 transition-transform">
        <Eye size={20} />
      </div>
      <span className="text-[10px] font-black uppercase text-[var(--color-destructive)] tracking-wider">View Once {type === 'video' ? 'Video' : 'Photo'}</span>
      <span className="text-[8px] font-bold text-main-text/60 mt-1 tracking-widest uppercase">Click to open</span>
    </div>
  );
}

// ── SkeletonText ──
export function SkeletonText({ className = "w-16 h-3" }) {
  return (
    <span 
      className={`inline-block bg-current opacity-15 animate-pulse rounded-sm ${className}`}
      style={{ verticalAlign: 'middle' }}
    />
  );
}

// ── getRetroPfpUrl ──
export function getRetroPfpUrl(username) {
  let hash = 0;
  const seed = username || 'You';
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#5f875f', '#87af87', '#afdfaf', '#dfdfaf', '#dfaf87', '#af875f',
    '#875f5f', '#af8787', '#dfafaf', '#dfafd7', '#af87af', '#875f87'
  ];
  const color = colors[Math.abs(hash) % colors.length];
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 5" width="100%" height="100%" shape-rendering="crispEdges">`;
  svg += `<rect width="5" height="5" fill="#f4f4f0"/>`;
  for (let x = 0; x < 3; x++) {
    for (let y = 0; y < 5; y++) {
      const bit = (Math.abs(hash) >> (x * 5 + y)) & 1;
      if (bit) {
        svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="${color}"/>`;
        if (x < 2) {
          svg += `<rect x="${4 - x}" y="${y}" width="1" height="1" fill="${color}"/>`;
        }
      }
    }
  }
  svg += `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

