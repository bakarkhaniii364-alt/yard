import React, { useState, useEffect, useCallback } from 'react';
import { Keyboard, X, Phone, Video, Mic, Camera, PhoneOff, MessageSquare } from 'lucide-react';

const SHORTCUTS = [
  { keys: ['Shift', 'M'], description: 'Toggle Mute', category: 'call' },
  { keys: ['Shift', 'V'], description: 'Toggle Camera', category: 'call' },
  { keys: ['Shift', 'E'], description: 'End Call', category: 'call' },
  { keys: ['Shift', 'D'], description: 'Toggle Deafen', category: 'call' },
  { keys: ['Shift', 'S'], description: 'Share Screen', category: 'call' },
  { keys: ['Shift', 'C'], description: 'Go to Chat', category: 'nav' },
  { keys: ['Shift', 'G'], description: 'Go to Arcade', category: 'nav' },
  { keys: ['?'], description: 'Show this panel', category: 'app' },
  { keys: ['Esc'], description: 'Close panel / Cancel', category: 'app' },
];

/**
 * Global keyboard shortcuts handler.
 * Props:
 *   - isCalling: bool — is there an active call?
 *   - onMuteToggle, onCameraToggle, onEndCall, onDeafenToggle, onScreenShare: call handlers
 *   - onGoChat, onGoArcade: navigation handlers
 */
export function KeyboardShortcuts({
  isCalling, onMuteToggle, onCameraToggle, onEndCall,
  onDeafenToggle, onScreenShare, onGoChat, onGoArcade,
}) {
  const [showPanel, setShowPanel] = useState(false);

  const handleKey = useCallback((e) => {
    // Never fire if user is typing in an input/textarea/contenteditable
    const tag = e.target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;

    const shift = e.shiftKey;
    const key = e.key;

    if (key === '?') { e.preventDefault(); setShowPanel(p => !p); return; }
    if (key === 'Escape') { setShowPanel(false); return; }

    if (shift) {
      switch (key.toUpperCase()) {
        case 'M': if (isCalling) { e.preventDefault(); onMuteToggle?.(); } break;
        case 'V': if (isCalling) { e.preventDefault(); onCameraToggle?.(); } break;
        case 'E': if (isCalling) { e.preventDefault(); onEndCall?.(); } break;
        case 'D': if (isCalling) { e.preventDefault(); onDeafenToggle?.(); } break;
        case 'S': if (isCalling) { e.preventDefault(); onScreenShare?.(); } break;
        case 'C': e.preventDefault(); onGoChat?.(); break;
        case 'G': e.preventDefault(); onGoArcade?.(); break;
        default: break;
      }
    }
  }, [isCalling, onMuteToggle, onCameraToggle, onEndCall, onDeafenToggle, onScreenShare, onGoChat, onGoArcade]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  if (!showPanel) return null;

  const callShortcuts = SHORTCUTS.filter(s => s.category === 'call');
  const navShortcuts  = SHORTCUTS.filter(s => s.category === 'nav');
  const appShortcuts  = SHORTCUTS.filter(s => s.category === 'app');

  return (
    <div className="fixed inset-0 z-[990] bg-black/50 flex items-center justify-center p-4"
         onClick={() => setShowPanel(false)}>
      <div className="bg-window retro-border-thick shadow-[6px_6px_0px_var(--border)] w-full max-w-md animate-in zoom-in-95 fade-in duration-200"
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-border"
             style={{ backgroundColor: 'var(--bg-header)', color: 'var(--text-on-header)' }}>
          <div className="flex items-center gap-2">
            <Keyboard size={16} />
            <span className="font-black text-xs uppercase tracking-widest">Keyboard Shortcuts</span>
          </div>
          <button onClick={() => setShowPanel(false)} className="p-1 hover:bg-white/10 transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {/* Call Shortcuts */}
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.25em] opacity-40 mb-3 flex items-center gap-2">
              <Phone size={10} /> During Calls
            </p>
            <div className="flex flex-col gap-1.5">
              {callShortcuts.map(s => (
                <ShortcutRow key={s.description} {...s} muted={!isCalling} />
              ))}
            </div>
          </div>

          <div className="h-px bg-border opacity-20" />

          {/* Nav Shortcuts */}
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.25em] opacity-40 mb-3 flex items-center gap-2">
              <MessageSquare size={10} /> Navigation
            </p>
            <div className="flex flex-col gap-1.5">
              {navShortcuts.map(s => (
                <ShortcutRow key={s.description} {...s} />
              ))}
            </div>
          </div>

          <div className="h-px bg-border opacity-20" />

          {/* App Shortcuts */}
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.25em] opacity-40 mb-3 flex items-center gap-2">
              <Keyboard size={10} /> App
            </p>
            <div className="flex flex-col gap-1.5">
              {appShortcuts.map(s => (
                <ShortcutRow key={s.description} {...s} />
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t-2 border-border bg-border/5 text-center">
          <p className="text-[9px] font-bold opacity-40 uppercase tracking-widest">Press <kbd className="px-1.5 py-0.5 retro-border text-[9px] font-black">?</kbd> to toggle this panel</p>
        </div>
      </div>
    </div>
  );
}

function ShortcutRow({ keys, description, muted }) {
  return (
    <div className={`flex items-center justify-between py-1.5 px-2 transition-opacity ${muted ? 'opacity-30' : 'hover:bg-border/10'}`}>
      <span className="text-xs font-bold text-main-text">{description}</span>
      <div className="flex items-center gap-1">
        {keys.map((k, i) => (
          <React.Fragment key={k}>
            {i > 0 && <span className="text-[9px] opacity-40">+</span>}
            <kbd className="px-2 py-0.5 retro-border bg-window text-[10px] font-black shadow-[1px_1px_0px_var(--border)]">{k}</kbd>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
