import React from 'react';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { Gamepad2, Users, Trophy } from 'lucide-react';

export function ArcadeView({ theme, sfxEnabled }) {
  return (
    <div className="w-full max-w-5xl mx-auto h-[90vh] p-4 flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-4xl font-black uppercase tracking-widest text-primary drop-shadow-md flex items-center justify-center gap-3">
          <Gamepad2 size={40} /> THE ARCADE <Gamepad2 size={40} />
        </h1>
        <p className="opacity-80 mt-2">Challenge your friends to real-time and turn-based games.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-1">
        {/* Example Game Card */}
        <RetroWindow title="Coming Soon" className="flex flex-col">
          <div className="flex-1 p-6 flex flex-col items-center justify-center text-center gap-4 bg-[var(--bg-main)]">
            <div className="w-20 h-20 rounded-full bg-[var(--bg-window)] border-4 border-primary flex items-center justify-center retro-shadow">
              <span className="text-4xl">🎲</span>
            </div>
            <h3 className="font-bold text-xl uppercase">Ludo</h3>
            <p className="text-sm opacity-70">2-4 Players • Turn-based</p>
          </div>
          <div className="p-4 border-t-2 border-[var(--border)] bg-[var(--bg-window)]">
            <RetroButton className="w-full justify-center">Play Now</RetroButton>
          </div>
        </RetroWindow>

        <RetroWindow title="Coming Soon" className="flex flex-col">
          <div className="flex-1 p-6 flex flex-col items-center justify-center text-center gap-4 bg-[var(--bg-main)]">
            <div className="w-20 h-20 rounded-full bg-[var(--bg-window)] border-4 border-primary flex items-center justify-center retro-shadow">
              <span className="text-4xl">♟️</span>
            </div>
            <h3 className="font-bold text-xl uppercase">Chess</h3>
            <p className="text-sm opacity-70">2 Players • Turn-based</p>
          </div>
          <div className="p-4 border-t-2 border-[var(--border)] bg-[var(--bg-window)]">
            <RetroButton className="w-full justify-center">Play Now</RetroButton>
          </div>
        </RetroWindow>
      </div>
    </div>
  );
}
