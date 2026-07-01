import React, { useState, useEffect } from 'react';
import { Heart, Lock, Unlock } from 'lucide-react';
import { RetroWindow, RetroButton } from '../components/UI.jsx';
import { DesktopOnly } from '../components/MobileOnly.jsx';
import { playAudio } from '../utils/audio.js';
import { useGlobalSync } from '../hooks/useSupabaseSync.js';
import { useAuth } from '../context/instances.js';

export function TimeCapsuleApp({ onClose, sfx }) {
  const { userId } = useAuth();
  const [letters, setLetters] = useGlobalSync('time_capsule_letters', []);
  const [activeTab, setActiveTab] = useState('inbox'); 
  const [newLetter, setNewLetter] = useState(''); 
  const [unlockMins, setUnlockMins] = useState('1'); 
  const [now, setNow] = useState(Date.now());
  const [readingLetter, setReadingLetter] = useState(null);

  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  
  const handleSend = () => { 
    if (!newLetter.trim()) return; 
    playAudio('send', sfx); 
    setLetters([...letters, { id: Date.now(), senderId: userId, text: newLetter, unlockDate: Date.now() + parseInt(unlockMins) * 60000 }]); 
    setNewLetter(''); 
    setActiveTab('inbox'); 
  };
  
  const getTimeLeft = (unlockDate) => { 
    const diff = unlockDate - now; 
    if (diff <= 0) return 'Unlocked!'; 
    return `${Math.floor(diff / 60000)}m ${Math.floor((diff % 60000) / 1000)}s`; 
  };

  if (readingLetter) {
     const handleDownloadLetter = async () => {
       playAudio('click', sfx);
       const el = document.getElementById('letter-paper');
       if (!el) return;
       try {
         const html2canvas = (await import('html2canvas')).default;
         const canvas = await html2canvas(el, { 
           backgroundColor: '#fdfbf7', 
           scale: 2,
           useCORS: true,
           allowTaint: false
         });
         const a = document.createElement('a');
         a.href = canvas.toDataURL('image/png');
         a.download = `letter_${readingLetter.id}.png`;
         a.click();
       } catch(e) { 
         console.error(e);
         alert("Failed to generate image. Please try again.");
       }
     };
     return (
       <RetroWindow title="reading_letter.exe" onClose={()=>setReadingLetter(null)} className="w-full max-w-2xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col" noPadding>
          <div id="letter-paper" className="flex-1 p-8 sm:p-12 overflow-y-auto relative" style={{ 
            backgroundColor: '#fdfbf7', 
            backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, #e8ddd0 31px, #e8ddd0 32px)',
            backgroundPositionY: '60px'
          }}>
             <div className="absolute top-0 right-0 w-16 h-16 bg-[var(--color-destructive)] rounded-bl-full shadow-md z-10 flex items-center justify-center"><Heart size={20} className="text-white -mt-2 -ml-2"/></div>
             <div className="mb-8 pb-4 border-b-2 border-dashed" style={{ borderColor: '#d4c5b0', color: '#8b7355' }}>
               <p className="font-bold text-sm"><span className="uppercase tracking-widest opacity-60">From:</span> {readingLetter.senderId === userId ? 'You' : 'Partner'}</p>
               <p className="font-bold text-sm mt-1"><span className="uppercase tracking-widest opacity-60">To:</span> {readingLetter.senderId === userId ? 'Partner' : 'You'}</p>
               <p className="text-xs opacity-40 mt-2">{new Date(readingLetter.id || Date.now()).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
             </div>
             <p className="font-serif text-lg leading-loose whitespace-pre-wrap break-words max-w-full-break" style={{ color: '#3a2f26' }}>{readingLetter.text}</p>
             <p className="text-right italic font-bold mt-8" style={{ color: '#8b7355' }}>— {readingLetter.senderId === userId ? 'You' : 'Partner'} 💌</p>
          </div>
          <div className="flex gap-2 p-3 retro-border-t bg-[var(--bg-main)] shrink-0">
            <DesktopOnly>
              <RetroButton className="flex-1 py-2 text-sm" onClick={handleDownloadLetter}>📥 Download Letter</RetroButton>
            </DesktopOnly>
            <RetroButton variant="secondary" className="flex-1 py-2 text-sm" onClick={() => setReadingLetter(null)}>Close</RetroButton>
          </div>
       </RetroWindow>
     );
  }

  return (
    <RetroWindow title="time_capsule.exe" onClose={onClose} className="w-full max-w-3xl h-[calc(100dvh-4rem)] max-h-[800px] flex flex-col relative" confirmOnClose hasUnsavedChanges={newLetter.trim() !== ''} onSaveBeforeClose={() => { handleSend(); onClose && onClose(); }} sfx={sfx} noPadding>
      <div className="flex border-b-2 retro-border shrink-0 z-20 relative">
        <button onClick={() => {playAudio('click', sfx); setActiveTab('inbox')}} className={`flex-1 py-3 font-bold ${activeTab === 'inbox' ? 'bg-[var(--primary)] text-white' : 'bg-[var(--bg-window)] text-[var(--text-main)] opacity-70'}`}>Locked Inbox</button>
        <button onClick={() => {playAudio('click', sfx); setActiveTab('write')}} className={`flex-1 py-3 font-bold border-l-2 retro-border ${activeTab === 'write' ? 'bg-[var(--secondary)] text-white' : 'bg-[var(--bg-window)] text-[var(--text-main)] opacity-70'}`}>Write Letter</button>
      </div>
      {activeTab === 'write' ? (
        <div className="flex-1 p-4 sm:p-6 bg-[var(--bg-main)] flex flex-col gap-4 overflow-y-auto">
           <textarea value={newLetter} onChange={e=>setNewLetter(e.target.value)} placeholder="Write a time capsule letter to your partner... Make it meaningful. (It will be locked until the time expires)" className="flex-1 min-h-[200px] p-6 retro-border retro-bg-window focus:outline-none resize-none font-serif text-base sm:text-lg leading-relaxed shadow-inner" style={{ caretColor: 'var(--primary)' }} />
           <div className="flex flex-col sm:flex-row gap-4 items-end bg-[var(--bg-window)] p-4 retro-border retro-shadow-dark shrink-0">
              <div className="flex-1 w-full"><label className="font-bold text-sm block mb-1">Seal for duration:</label><select value={unlockMins} onChange={e=>setUnlockMins(e.target.value)} className="w-full p-3 font-bold retro-border bg-[var(--bg-window)] text-[var(--text-main)] cursor-pointer"><option value="1" className="bg-[var(--bg-window)] text-[var(--text-main)]">1 Minute (Test)</option><option value="60" className="bg-[var(--bg-window)] text-[var(--text-main)]">1 Hour</option><option value="1440" className="bg-[var(--bg-window)] text-[var(--text-main)]">1 Day</option><option value="10080" className="bg-[var(--bg-window)] text-[var(--text-main)]">1 Week</option></select></div>
              <RetroButton variant="primary" onClick={handleSend} className="px-8 py-3 w-full sm:w-auto flex items-center justify-center gap-2"><Lock size={18}/> Lock & Send</RetroButton>
           </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg-main)]">
           {(!letters || letters.length === 0) && <p className="text-center opacity-50 mt-10 font-bold uppercase tracking-widest text-sm">Inbox is empty. Time to write!</p>}
           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
           {letters && letters.map(l => { 
               const isLocked = l.unlockDate > now; 
               return ( 
                 <div key={l.id} onClick={() => { if(!isLocked) { playAudio('click', sfx); setReadingLetter(l); } else { playAudio('click', sfx); } }} className={`relative w-full aspect-video sm:aspect-square md:aspect-[4/3] retro-border shadow-[4px_4px_0_rgba(0,0,0,0.2)] cursor-not-allowed transition-transform hover:-translate-y-2 ${isLocked ? 'bg-[#f4d06f]' : 'bg-[var(--bg-window)] cursor-pointer'}`}>
                    {isLocked ? (
                       <div className="absolute inset-0 overflow-hidden flex flex-col items-center justify-center">
                          <div className="absolute top-0 w-[120%] h-0 border-t-[80px] sm:border-t-[100px] border-t-[#e8c050] border-l-[150px] sm:border-l-[200px] border-l-transparent border-r-[150px] sm:border-r-[200px] border-r-transparent z-10 drop-shadow-md"></div>
                          <div className="absolute z-20 w-14 h-14 bg-[var(--color-destructive)] rounded-full flex flex-col items-center justify-center text-[var(--bg-window)] retro-border shadow-xl hover:scale-110 transition-transform"><Lock size={20}/></div>
                          <div className="absolute bottom-3 sm:bottom-4 z-20 font-bold text-xs opacity-90 bg-black text-white px-3 py-1 rounded-full shadow-lg">{getTimeLeft(l.unlockDate)}</div>
                       </div>
                    ) : (
                       <div className="absolute inset-0 p-4 flex flex-col items-center justify-center bg-[var(--bg-window)] overflow-hidden border-4 border-dashed border-[var(--bg-main)] m-1 hover:bg-[var(--accent)] transition-colors">
                          <Unlock size={28} className="text-[var(--primary)] mb-3"/>
                           <p className="text-sm italic text-center font-serif truncate w-full text-[var(--text-main)] font-bold">Tap to open...</p>
                           <span className="absolute bottom-3 text-[10px] font-bold opacity-50 uppercase tracking-widest">From: {l.senderId === userId ? 'You' : 'Partner'}</span>
                        </div>
                     )}
                  </div> 
               ) 
           })}
           </div>
        </div>
      )}
    </RetroWindow>
  );
}
