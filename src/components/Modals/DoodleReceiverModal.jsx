import React, { useState } from 'react';
import { Heart, PenTool, MessageSquare, Download } from 'lucide-react';
import { RetroWindow, RetroButton } from '../UI.jsx';

export function DoodleReceiverModal({ doodleData, partnerName, onClose, onScrapbook, onRedoodle, onReply }) {
  const [hearted, setHearted] = useState(false);
  
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = doodleData;
    link.download = `doodle_from_partner_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleHeart = () => {
    if (hearted) return;
    setHearted(true);
    onScrapbook(doodleData);
  };
  
  return (
    <div className="fixed inset-0 z-[var(--z-modal)] bg-black/60 flex items-center justify-center p-4">
      <RetroWindow title={`doodle_from_${(partnerName || 'partner').toLowerCase()}.exe`} onClose={onClose} className="max-w-md w-full">
        <div className="flex flex-col items-center p-4 bg-white retro-border shadow-inner">
          <img src={doodleData} alt="Received Doodle" className="w-full aspect-square object-contain bg-gray-50 border-2 border-dashed border-gray-300 mb-6" style={{ imageRendering: 'pixelated' }} />
          <div className="grid grid-cols-2 gap-3 w-full">
            <RetroButton onClick={handleHeart} className={`flex items-center justify-center gap-2 py-3 ${hearted ? 'bg-pink-100 border-pink-400 text-pink-600' : 'bg-white'}`}><Heart size={18} className={hearted ? "fill-pink-500 text-pink-500 animate-bounce" : ""} />{hearted ? 'Saved!' : 'Heart'}</RetroButton>
            <RetroButton onClick={() => onRedoodle(doodleData)} variant="primary" className="flex items-center justify-center gap-2 py-3"><PenTool size={18} /> Redoodle</RetroButton>
            <RetroButton onClick={() => onReply(doodleData)} className="flex items-center justify-center gap-2 py-3 bg-blue-50 border-blue-300"><MessageSquare size={18} /> Reply</RetroButton>
            <RetroButton onClick={handleDownload} className="flex items-center justify-center gap-2 py-3 bg-gray-100"><Download size={18} /> Save Device</RetroButton>
          </div>
        </div>
      </RetroWindow>
    </div>
  );
}
