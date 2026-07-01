import React from 'react';
import { RetroWindow } from '../components/UI.jsx';

export function ChannelsView({ theme, sfxEnabled }) {
  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col md:flex-row gap-4 h-[90vh] p-4">
      {/* Sidebar - Server List */}
      <RetroWindow title="Servers" className="w-full md:w-64 h-full flex flex-col">
        <div className="p-4 flex-1 overflow-y-auto">
          <p className="text-sm opacity-70 italic">Your servers will appear here...</p>
        </div>
      </RetroWindow>

      {/* Main Chat Area */}
      <RetroWindow title="General - Chat" className="flex-1 h-full flex flex-col">
        <div className="flex-1 p-4 overflow-y-auto mesh-bg">
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <h2 className="text-2xl font-black uppercase tracking-widest text-primary-text drop-shadow-md">Welcome to Yard</h2>
            <p className="opacity-80">This channel is looking a little empty.</p>
          </div>
        </div>
        <div className="p-4 border-t-2 border-[var(--border)] bg-[var(--bg-window)]">
          <input 
            type="text" 
            placeholder="Type a message..." 
            className="w-full bg-[var(--bg-main)] text-[var(--text-main)] px-4 py-3 rounded-none retro-border focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </RetroWindow>
    </div>
  );
}
