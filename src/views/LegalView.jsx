import React, { useState, useEffect, useRef } from 'react';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { ShieldCheck, FileText, ExternalLink, Heart, Trash2, Lock, PenTool, Sparkle, Gamepad2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function LegalView({ onClose, onAccept, isOverlay = false }) {
  const navigate = useNavigate();

  return (
    <div className={`w-full h-[100dvh] flex items-center justify-center p-4 overflow-hidden ${isOverlay ? 'fixed inset-0 z-[var(--z-modal)] bg-black/40' : 'bg-transparent'}`}>
      <RetroWindow 
        title="terms_of_service.pdf" 
        onClose={onClose || (() => navigate(-1))} 
        className="w-full max-w-2xl h-full max-h-[700px] flex flex-col shadow-2xl"
        noPadding
      >
        <div className="flex-1 overflow-y-auto no-scrollbar bg-window p-6 sm:p-10 space-y-10">
            <header className="border-b-4 border-border pb-6">
                <div className="flex items-center gap-4">
                    <ShieldCheck size={32} className="text-primary" />
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tighter text-main-text">Terms of Service</h1>
                        <p className="font-bold opacity-40 text-[9px] uppercase tracking-[0.3em]">Legal Terms & Privacy Agreement</p>
                    </div>
                </div>
            </header>

            <div className="space-y-8">
                <section className="space-y-2">
                    <h2 className="text-base font-black uppercase flex items-center gap-2 text-primary">
                        <Gamepad2 size={16} /> 01. The Mission
                    </h2>
                    <p className="text-sm leading-relaxed font-medium opacity-80 text-main-text italic">
                        "Yard is your gaming hub and community space."
                    </p>
                    <p className="text-sm leading-relaxed font-medium opacity-70 text-main-text">
                        We aim to provide a retro gaming experience for you and your guild. No intrusive tracking, just games.
                    </p>
                </section>

                <section className="space-y-2">
                    <h2 className="text-base font-black uppercase flex items-center gap-2 text-secondary">
                        <Lock size={16} fill="currentColor" /> 02. Sovereign Data
                    </h2>
                    <p className="text-sm leading-relaxed font-medium opacity-70 text-main-text">
                        You retain ownership of your media and game data. Your data is stored securely.
                    </p>
                </section>

                <section className="space-y-2">
                    <h2 className="text-base font-black uppercase flex items-center gap-2 text-accent">
                        <Trash2 size={16} fill="currentColor" /> 03. The 'Burn it Down' Clause
                    </h2>
                    <p className="text-sm leading-relaxed font-medium opacity-70 text-main-text">
                        In Yard, deletion is absolute. If you choose to delete your account or guild, we trigger an Atomic Cascade Deletion. There is no recovery.
                    </p>
                </section>

                <section className="space-y-2">
                    <h2 className="text-base font-black uppercase flex items-center gap-2 opacity-50">
                        <FileText size={16} fill="currentColor" /> 04. Conduct
                    </h2>
                    <p className="text-sm leading-relaxed font-medium opacity-70 text-main-text">
                        By using Yard, you agree to treat the community with respect. We reserve the right to suspend accounts for toxic behavior or illegal activities.
                    </p>
                </section>
            </div>

            <footer className="pt-8 border-t-2 border-dashed border-border flex flex-col items-center gap-4">
                <div className="flex gap-8">
                    <a href="mailto:support.yard.app@gmail.com" className="text-[10px] font-black uppercase underline hover:text-primary tracking-widest flex items-center gap-1">Contact Support</a>
                    <a href="https://www.facebook.com/bakarkhaniii/" target="_blank" rel="noreferrer" className="text-[10px] font-black uppercase underline hover:text-secondary inline-flex items-center gap-1 tracking-widest">Developer <ExternalLink size={10} /></a>
                </div>
                <p className="text-[9px] font-black uppercase tracking-[0.4em] opacity-20 italic">
                    Built for gamers.
                </p>
            </footer>
        </div>

        {onAccept && (
            <div className="p-4 bg-border/10 border-t-2 border-border flex justify-end">
                <RetroButton variant="primary" onClick={onAccept}>I Accept the Terms</RetroButton>
            </div>
        )}
      </RetroWindow>
    </div>
  );
}
