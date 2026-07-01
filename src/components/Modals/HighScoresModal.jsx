import React, { useState, useEffect } from 'react';
import { RetroWindow, RetroButton } from '../UI.jsx';
import { supabase } from '../../lib/supabase.js';

export function HighScoresModal({ roomId, onClose, sfxEnabled }) {
  const [highscores, setHighscores] = useState([]);
  const [loadingScores, setLoadingScores] = useState(false);

  const fetchHighscores = async () => {
    setLoadingScores(true);
    try {
      const { data, error } = await supabase
        .from('highscores')
        .select('*')
        .eq('room_id', roomId)
        .order('score', { ascending: false })
        .limit(20);
      if (!error && data) {
        setHighscores(data);
      } else {
        const cached = JSON.parse(localStorage.getItem('yard_local_highscores') || '[]');
        setHighscores(cached);
      }
    } catch (e) {
      const cached = JSON.parse(localStorage.getItem('yard_local_highscores') || '[]');
      setHighscores(cached);
    }
    setLoadingScores(false);
  };

  useEffect(() => {
    if (roomId) {
      fetchHighscores();
    }
  }, [roomId]);

  return (
    <div className="modal-backdrop fixed inset-0 z-[var(--z-modal)] flex items-center justify-center animate-in fade-in duration-200">
      <RetroWindow 
        title="arcade_leaderboards.exe" 
        onClose={onClose}
        sfx={sfxEnabled}
        className="universal-modal"
        noPadding
      >
          <div className="p-4 flex flex-col gap-4 overflow-y-auto">
            <div className="text-center">
              <h3 className="font-black text-lg uppercase tracking-wider text-primary">Scoreboard Records</h3>
              <p className="text-[10px] font-bold opacity-60 lowercase">Top scores submitted from the arcade cabinet</p>
            </div>

            {loadingScores ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 opacity-50">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
                <span className="text-[10px] font-black uppercase">Retrieving scores...</span>
              </div>
            ) : highscores.length === 0 ? (
              <div className="retro-border border-dashed p-8 bg-[var(--bg-main)] text-center opacity-65">
                <span className="text-3xl block mb-2">👾</span>
                <p className="text-xs font-black uppercase">No records submitted yet!</p>
                <p className="text-[10px] font-bold lowercase opacity-75 mt-1">Play games in the arcade to secure your high score.</p>
              </div>
            ) : (
              <div className="retro-border overflow-hidden">
                <table className="w-full text-left border-collapse text-xs font-bold">
                  <thead>
                    <tr className="bg-[var(--bg-header)] text-[var(--text-on-header)] border-b-2 border-border font-black uppercase text-[10px] tracking-tight">
                      <th className="p-2.5">Rank</th>
                      <th className="p-2.5">Player</th>
                      <th className="p-2.5">Game</th>
                      <th className="p-2.5 text-right">High Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {highscores.map((score, idx) => (
                      <tr 
                        key={score.id || idx} 
                        className="border-b border-border/20 last:border-0 hover:bg-black/5"
                      >
                        <td className="p-2.5 font-mono opacity-60">#{idx + 1}</td>
                        <td className="p-2.5 truncate max-w-[120px]">{score.player_name || 'Anonymous'}</td>
                        <td className="p-2.5 uppercase text-[10px] font-black tracking-tighter text-primary">{score.game_id || 'game'}</td>
                        <td className="p-2.5 text-right text-base text-secondary font-black">{score.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-dashed border-border/20">
              <RetroButton 
                variant="primary" 
                onClick={onClose} 
                className="px-6 py-2 text-xs uppercase"
              >
                Close
              </RetroButton>
            </div>
          </div>
        </RetroWindow>
      </div>
    );
  }
