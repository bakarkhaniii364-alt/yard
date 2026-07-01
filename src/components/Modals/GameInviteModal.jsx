import React from 'react';
import { Gamepad2 } from 'lucide-react';
import { RetroWindow, RetroButton } from '../UI.jsx';
import { playAudio } from '../../utils/audio.js';

export function GameInviteModal({ invite, partnerName, onAccept, onDecline, sfx }) {
  const titles = {
    tictactoe: 'Tic-Tac-Toe',
    'tic-tac-toe': 'Tic-Tac-Toe',
    pictionary: 'Pictionary',
    memory: 'Memory Match',
    wordle: 'Retro Word',
    sudoku: 'Sudoku',
    chess: 'Chess',
    quiz: 'Couples Quiz',
    '2048': '2048',
    typing: 'Typing Race',
    wyr: 'Would You Rather',
    uno: 'Retro Uno',
    retrouno: 'Retro Uno',
    othello: 'Othello',
    pool: '8-Ball Pool',
    '8-ballpool': '8-Ball Pool',
    '8ballpool': '8-Ball Pool',
    bluff: 'Cheat (Bluff)'
  };
  
  const gameId = invite?.metadata?.gameId || invite?.gameId || '';
  let title = titles[gameId?.toLowerCase().replace(/[^a-z0-9]/g, '')] || gameId || 'Game';
  
  if (title === 'Game' && invite?.text?.toLowerCase().includes('tic-tac-toe')) title = 'Tic-Tac-Toe';
  if (title === 'Game' && invite?.text?.toLowerCase().includes('chess')) title = 'Chess';
  if (title === 'Game' && invite?.text?.toLowerCase().includes('uno')) title = 'Retro Uno';
  if (title === 'Game' && invite?.text?.toLowerCase().includes('pool')) title = '8-Ball Pool';
  if (title === 'Game' && invite?.text?.toLowerCase().includes('typing')) title = 'Typing Race';

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-lg px-4 animate-in slide-in-from-top duration-300">
      <RetroWindow title="incoming_invite.exe" onClose={onDecline} className="w-full border-4 border-dashed border-[var(--primary)] shadow-[0_4px_25px_rgba(0,0,0,0.3)] bg-window" data-testid="game-invite-modal" noPadding>
        <div className="flex items-center gap-4 p-4 text-left">
          <Gamepad2 size={36} className="text-[var(--primary)] animate-bounce flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-black uppercase truncate text-primary">{partnerName} invited you!</h2>
            <h3 className="text-xs font-bold opacity-80 truncate">Game: {title} ({invite?.metadata?.mode || invite?.mode || 'remote'})</h3>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <RetroButton variant="white" onClick={() => { playAudio('click', sfx); onDecline(); }} className="px-3 py-1.5 text-xs text-black border-dashed">Decline</RetroButton>
            <RetroButton variant="primary" onClick={() => { playAudio('click', sfx); onAccept(); }} className="px-3 py-1.5 text-xs text-white font-black" data-testid="accept-game-btn">Accept & Join</RetroButton>
          </div>
        </div>
      </RetroWindow>
    </div>
  );
}
