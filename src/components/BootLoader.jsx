import React, { useState, useEffect } from 'react';
import { playAudio } from '../utils/audio.js';

export function BootLoader({ onComplete, sfxEnabled }) {
  const [step, setStep] = useState(0);
  const messages = [
    "INITIALIZING SECURE HANDSHAKE...",
    "DECRYPTING SANCTUARY PROTOCOLS...",
    "MOUNTING ENCRYPTED VOLUMES...",
    "VERIFYING IDENTITY TOKEN...",
    "ESTABLISHING REAL-TIME SYNC...",
    "ENTERING YARD.EXE_"
  ];

  useEffect(() => {
    // 6 messages. 15ms interval * 6 = 90ms. 10ms delay = 100ms total.
    const interval = setInterval(() => {
      setStep((prev) => {
        if (prev < messages.length - 1) {
          if (sfxEnabled) playAudio('click');
          return prev + 1;
        }
        clearInterval(interval);
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 10);
        return prev;
      });
    }, 15);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 w-full h-[100dvh] flex flex-col items-center justify-center bg-main z-[9999] p-4">
      <div className="flex flex-col items-start gap-2 p-6 border-[3px] border-border bg-window shadow-[8px_8px_0_var(--border)] w-full max-w-sm">
        <div className="flex items-center gap-2 mb-4 border-b-2 border-border/20 w-full pb-2">
            <div className="w-3 h-3 bg-primary animate-pulse rounded-full"></div>
            <span className="font-black text-[10px] uppercase tracking-tighter opacity-50">System Boot v1.0.4</span>
        </div>
        {messages.slice(0, step + 1).map((msg, i) => (
          <p key={i} className={`text-[10px] font-black uppercase tracking-widest ${i === step ? 'text-primary animate-pulse' : 'text-main-text opacity-40'}`}>
            {`> ${msg}`}
          </p>
        ))}
        {/* Blinking cursor at the end */}
        {step === messages.length - 1 && (
          <div className="w-3 h-4 bg-primary animate-ping mt-2"></div>
        )}
      </div>
      <div className="mt-8 flex flex-col items-center gap-2 opacity-30">
          <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                  <div key={i} className={`w-1.5 h-1.5 bg-border rounded-full ${i <= (step % 5) ? 'opacity-100' : 'opacity-20'}`}></div>
              ))}
          </div>
          <span className="text-[8px] font-bold uppercase tracking-[0.4em]">Sanctuary Link Active</span>
      </div>
    </div>
  );
}
