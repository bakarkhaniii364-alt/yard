import React, { useState } from 'react';
import { Moon, Send, Trash2 } from 'lucide-react';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { useGlobalSync } from '../hooks/useSupabaseSync.js';

export function DreamJournal({ onClose, sfx, userId, roomProfiles = {} }) {
  const [entries, setEntries] = useGlobalSync('dream_journal', []);
  const [newDream, setNewDream] = useState('');
  const [interpretation, setInterpretation] = useState('');
  const [tab, setTab] = useState('write');

  const addDream = () => {
    if (!newDream.trim()) return;
    playAudio('send', sfx);
    setEntries([{ id: Date.now(), text: newDream, interpretation, date: new Date().toLocaleDateString(), mood: '🌙', authorId: userId }, ...entries]);
    setNewDream(''); setInterpretation(''); setTab('journal');
  };

  const deleteDream = (id) => { playAudio('click', sfx); setEntries(entries.filter(e => e.id !== id)); };

  const getUserName = (id) => {
    if (id === userId) return 'You';
    return roomProfiles[id]?.name || 'Partner';
  };

  return (
    <RetroWindow title="dream_journal.exe" onClose={onClose} className="w-full max-w-2xl h-[calc(100dvh-4rem)] max-h-[800px]" confirmOnClose hasUnsavedChanges={() => newDream.trim() !== '' || interpretation.trim() !== ''} onSaveBeforeClose={() => { addDream(); onClose && onClose(); }} sfx={sfx} noPadding>
      <div className="flex border-b-2 retro-border shrink-0">
        <button onClick={() => setTab('write')} className={`flex-1 py-3 font-bold ${tab === 'write' ? 'retro-bg-primary text-[var(--text-on-primary)]' : 'retro-bg-window text-[var(--text-main)] opacity-70'}`}><Moon size={14} className="inline mr-1"/> Write Dream</button>
        <button onClick={() => setTab('journal')} className={`flex-1 py-3 font-bold border-l-2 retro-border ${tab === 'journal' ? 'retro-bg-secondary text-[var(--text-on-secondary)]' : 'retro-bg-window text-[var(--text-main)] opacity-70'}`}>📖 Journal ({entries.length})</button>
      </div>
      {tab === 'write' ? (
        <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
          <h3 className="font-bold text-lg">What did you dream about?</h3>
          <textarea value={newDream} onChange={e => setNewDream(e.target.value)} placeholder="Describe your dream..." className="min-h-[150px] p-4 retro-border retro-bg-window focus:outline-none resize-none font-serif text-base leading-relaxed text-[var(--text-main)]" />
          <textarea value={interpretation} onChange={e => setInterpretation(e.target.value)} placeholder="Your interpretation (optional)..." className="min-h-[60px] p-3 retro-border retro-bg-window focus:outline-none resize-none text-sm text-[var(--text-main)]" />
          <RetroButton onClick={addDream} className="py-3 flex items-center justify-center gap-2"><Send size={16}/> Save Dream</RetroButton>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          {entries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-5 select-none">
              <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="36" cy="36" r="28" fill="var(--secondary)" fillOpacity="0.15"/>
                <path d="M44 28 C44 38 36 44 28 44 C28 50 36 56 44 52 C52 48 56 38 52 30 C50 27 47 26 44 28Z" fill="var(--secondary)" fillOpacity="0.8"/>
                <circle cx="22" cy="18" r="2" fill="var(--accent)"/>
                <circle cx="52" cy="22" r="1.5" fill="var(--accent)" fillOpacity="0.7"/>
                <circle cx="14" cy="36" r="1" fill="var(--accent)" fillOpacity="0.5"/>
                <circle cx="58" cy="50" r="1.5" fill="var(--accent)" fillOpacity="0.6"/>
              </svg>
              <div className="text-center">
                <p className="font-black text-sm uppercase tracking-widest opacity-60">No dreams recorded</p>
                <p className="text-[10px] font-bold opacity-40 mt-1 mb-4">Your subconscious is waiting to be explored 🌙</p>
                <button onClick={() => setTab('write')}
                        className="px-4 py-2 retro-border bg-primary text-[var(--text-on-primary)] text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all">
                  Write Your First Dream
                </button>
              </div>
            </div>
          )}
          {entries.map(e => (
            <div key={e.id} className="retro-border retro-bg-window p-4 mb-3 retro-shadow-dark">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-black uppercase opacity-40">By {getUserName(e.authorId)} • {e.date}</span>
                <button onClick={() => deleteDream(e.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button>
              </div>
              <p className="font-serif leading-relaxed text-[var(--text-main)] break-words whitespace-pre-wrap max-w-full-break">{e.text}</p>
              {e.interpretation && <p className="text-sm italic opacity-60 mt-2 border-t border-dashed pt-2 border-[var(--border)] break-words whitespace-pre-wrap max-w-full-break">💭 {e.interpretation}</p>}
            </div>
          ))}
        </div>
      )}
    </RetroWindow>
  );
}
