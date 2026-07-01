const fs = require('fs');

// 1. Update index.jsx
let code = fs.readFileSync('src/games/index.jsx', 'utf8');

// Replace "High Scores" with "Leaderboard"
code = code.replace(/>High Scores<\/button>/g, '>Leaderboard</button>');

// Hide diffs for partner modes, except Pictionary
// Find where diffs are rendered:
// {activeModeObj?.diffs && (
code = code.replace(/\{activeModeObj\?\.diffs && \(/g, "{activeModeObj?.diffs && (topCategory !== 'partner' || gameRoute === 'pictionary') && (");

// Add options to Pictionary
// Pictionary is: { id: 'coop_remote', label: 'Play with Partner', type: 'remote', desc: 'One draws, the other guesses in real-time.' }
code = code.replace(/pictionary: \{ title: 'Pictionary', desc: 'Draw and guess the hidden word.', color: '#fca5a5', modes: \[\n    \{ id: 'coop_remote', label: 'Play with Partner', type: 'remote', desc: 'One draws, the other guesses in real-time.' \}\n  \]\}/, 
`pictionary: { title: 'Pictionary', desc: 'Draw and guess the hidden word.', color: '#fca5a5', modes: [
    { id: 'coop_remote', label: 'Play with Partner', type: 'remote', desc: 'One draws, the other guesses in real-time.', diffs: ['easy', 'hard'], options: [{key: 'genre', label: 'Word Genre', choices: ['General', 'Animals', 'Movies', 'Food']}] }
  ]}`);

// Add leaderboard fetch logic
if (!code.includes('const [leaderboardData')) {
    code = code.replace(/const \[view, setView\] = useState\('arcade'\);/, `const [view, setView] = useState('arcade');
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  useEffect(() => {
     if (view === 'scores') {
         setLoadingLeaderboard(true);
         import('../lib/supabase.js').then(({ supabase }) => {
             supabase.from('highscores').select('*').order('score', { ascending: false }).limit(100)
               .then(({ data }) => {
                   if (data) setLeaderboardData(data);
                   setLoadingLeaderboard(false);
               }).catch(() => setLoadingLeaderboard(false));
         });
     }
  }, [view]);`);
}

// Replace the Hall of Fame UI
const newLeaderboardUI = `          <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[var(--bg-window)] text-[var(--text-main)]">
             <div className="max-w-4xl mx-auto border-4 border-double border-[var(--border)] p-4 sm:p-8 relative">
                <h2 className="text-2xl sm:text-3xl font-black text-center mb-8 uppercase tracking-[0.3em]">Global Leaderboard</h2>
                
                {loadingLeaderboard ? (
                    <div className="flex justify-center py-12"><Loader className="animate-spin text-[var(--primary)]" size={32}/></div>
                ) : leaderboardData.length > 0 ? (
                    <div className="space-y-8">
                       {/* Group by Game and Mode */}
                       {Object.entries(
                           leaderboardData.reduce((acc, curr) => {
                               const key = curr.game_id + ' | ' + curr.mode;
                               if (!acc[key]) acc[key] = [];
                               acc[key].push(curr);
                               return acc;
                           }, {})
                       ).map(([groupKey, scores]) => (
                           <div key={groupKey} className="bg-[var(--bg-main)] retro-border p-4">
                               <h3 className="font-black text-xl uppercase text-[var(--primary)] mb-4 bg-black text-white inline-block px-3 py-1">{groupKey}</h3>
                               <div className="space-y-2">
                                  {scores.slice(0, 10).map((s, i) => (
                                      <div key={s.id || i} className="flex justify-between items-center bg-white p-2 border-b-2 border-dashed border-[var(--border)]">
                                          <div className="flex items-center gap-4">
                                              <span className="font-black text-xl opacity-40 w-6">#{i+1}</span>
                                              <span className="font-bold">{s.player_name || 'Unknown'}</span>
                                          </div>
                                          <span className="font-black text-[var(--secondary)] text-xl">{s.score}</span>
                                      </div>
                                  ))}
                               </div>
                           </div>
                       ))}
                    </div>
                ) : (
                    <div className="text-center opacity-60 font-bold py-12">No highscores recorded yet. Be the first!</div>
                )}
             </div>
          </div>`;

code = code.replace(/<div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-\[var\(--bg-window\)\] text-\[var\(--text-main\)\].*?<\/div>\n          <\/div>/s, newLeaderboardUI);

fs.writeFileSync('src/games/index.jsx', code);
console.log('ActivitiesHub Leaderboard & Options Patched');
