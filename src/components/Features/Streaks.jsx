import React, { useEffect } from 'react';
import { useLocalStorage } from '../../hooks/useLocalStorage.js';
import { Flame } from 'lucide-react';

export function useStreaks() {
  const [streakData, setStreakData] = useLocalStorage('streak_data', { lastLogin: null, count: 0, best: 0 });
  useEffect(() => {
    const today = new Date().toDateString();
    if (streakData.lastLogin === today) return;
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    let newCount = streakData.lastLogin === yesterday ? streakData.count + 1 : 1;
    let newBest = Math.max(streakData.best, newCount);
    setStreakData({ lastLogin: today, count: newCount, best: newBest });
  }, []);
  return streakData;
}

export function StreakBadge({ streak }) {
  if (!streak || streak.count <= 0) return null;
  return (
    <div className="flex items-center gap-1 border-2 border-border bg-accent text-accent-text px-2 py-1 text-xs font-bold" title={`Best: ${streak.best} days`}>
      <Flame size={14} className="text-orange-500" />
      <span>{streak.count}</span>
    </div>
  );
}
