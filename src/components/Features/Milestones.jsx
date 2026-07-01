import React from 'react';
import { RetroWindow, RetroButton } from '../UI.jsx';
import { Trophy } from 'lucide-react';

const MILESTONES_LIST = [
  { days: 1, label: 'Day One ❤️' }, { days: 7, label: 'One Week!' }, { days: 30, label: 'One Month 🌙' },
  { days: 50, label: '50 Days 🎯' }, { days: 100, label: '100 Days! 💯' }, { days: 150, label: '150 Days 🌟' },
  { days: 200, label: '200 Days ✨' }, { days: 365, label: 'ONE YEAR! 🎉' }, { days: 500, label: '500 Days 🏆' },
  { days: 730, label: 'TWO YEARS 💫' }, { days: 1000, label: '1000 DAYS! 🌈' }, { days: 1095, label: 'THREE YEARS 🎊' },
];

export function getMilestoneToday(anniversary) {
  if (!anniversary) return null;
  const start = new Date(anniversary);
  if (isNaN(start.getTime())) return null;
  const diff = Math.floor((new Date() - start) / (1000 * 60 * 60 * 24));
  return MILESTONES_LIST.find(m => m.days === diff) || null;
}

export function MilestoneCelebration({ milestone, onClose }) {
  if (!milestone) return null;
  return (
    <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4">
      <RetroWindow title="milestone.exe" onClose={onClose} className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-4 py-6">
          <Trophy size={48} className="text-primary animate-bounce" />
          <h2 className="text-2xl font-bold text-center text-main-text">{milestone.label}</h2>
          <p className="text-sm opacity-60 text-center">Congratulations on reaching {milestone.days} days together!</p>
          <RetroButton onClick={onClose} className="px-8 py-3">Celebrate! 🎉</RetroButton>
        </div>
      </RetroWindow>
    </div>
  );
}
