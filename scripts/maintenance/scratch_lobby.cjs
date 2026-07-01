const fs = require('fs');
let code = fs.readFileSync('src/games/index.jsx', 'utf8');

// 1. Ensure ConfirmDialog is imported
if (!code.includes('ConfirmDialog')) {
    code = code.replace(/import { RetroButton, RetroWindow, RetroInput, ScoreboardCountdown } from '\.\.\/components\/UI\.jsx';/, "import { RetroButton, RetroWindow, RetroInput, ScoreboardCountdown, ConfirmDialog } from '../components/UI.jsx';");
}

// 2. Insert state for showLeaveConfirm
if (!code.includes('const [showLeaveConfirm')) {
    code = code.replace(/const \[selectedDiff, setSelectedDiff\] = useState\('normal'\);/, "const [selectedDiff, setSelectedDiff] = useState('normal');\n  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);");
}

// 3. Update handleCreateLobby
code = code.replace(/setLobbyState\(\{ gameId: gameRoute, status: 'waiting', players: \[userId\], config: /g, "setLobbyState({ gameId: gameRoute, status: 'waiting', players: [userId], hostId: userId, config: ");

// 4. Update handleJoinLobby
code = code.replace(/setLobbyState\(prev => \(\{ \.\.\.prev, players: \[\.\.\.\(prev\.players \|\| \[\]\), userId\] \}\)\);/g, "setLobbyState(prev => ({ ...prev, players: [...(prev.players || []), userId] }));");

// 5. Add leaveLobby and handleLeaveClick methods
const leaveLogic = `
  const leaveLobby = () => {
      setLobbyState(prev => {
          const newPlayers = (prev.players || []).filter(p => p !== userId);
          if (newPlayers.length === 0) {
              return { gameId: null, status: 'waiting', players: [], config: null };
          }
          return { ...prev, players: newPlayers };
      });
      setShowLeaveConfirm(false);
      navigate('/arcade');
  };

  const handleLeaveClick = () => {
      const currentPlayers = lobbyState?.players || [];
      const partnerInLobby = currentPlayers.includes(partnerId);
      if (!partnerInLobby) {
          setShowLeaveConfirm(true);
      } else {
          leaveLobby();
      }
  };

  // 2. Game Details / Mode Selector Phase
`;
code = code.replace(/\/\/ 2\. Game Details \/ Mode Selector Phase/, leaveLogic);

// 6. Update Lobby Phase Render
const lobbyRender = `  // 3. Lobby Waiting Phase
  if (currentPhase === 'lobby') {
    const currentPlayers = lobbyState?.players || [];
    const partnerInLobby = currentPlayers.includes(partnerId);
    const isReady = currentPlayers.includes(userId) && partnerInLobby;
    const isPartnerWhoWasLeft = !partnerInLobby && currentPlayers.length === 1 && lobbyState?.hostId !== userId;

    return (
      <>
      <RetroWindow title={\`lobby_\${gameRoute}.exe\`} onClose={handleLeaveClick} className="w-full max-w-2xl bg-white" noPadding>
         <div className="flex flex-col h-full items-center justify-center p-8 text-center bg-white">
            <h2 className="text-3xl font-black uppercase mb-2 text-[var(--primary)]">Arcade Lobby</h2>
            
            <div className="bg-[var(--bg-window)] border-2 border-black border-dashed px-6 py-2 mb-8 inline-flex flex-col items-center">
                <span className="font-black text-[var(--primary)] uppercase tracking-widest text-xl">{game.title}</span>
                <span className="text-xs font-bold opacity-70 uppercase tracking-widest mt-1">Mode: {lobbyState.config?.mode} | {lobbyState.config?.diff ? \`Diff: \${lobbyState.config.diff}\` : 'Standard'}</span>
            </div>

            <div className="flex gap-8 items-center justify-center mb-10 w-full">
               <div className="flex flex-col items-center">
                  <div className="w-20 h-20 bg-[var(--primary)] retro-border flex items-center justify-center text-[var(--text-on-primary)] shadow-[4px_4px_0_0_var(--border)]">
                     <span className="font-black text-2xl">P1</span>
                  </div>
                  <span className="mt-3 font-bold text-xs uppercase bg-black text-white px-2 py-1">READY</span>
               </div>

               <div className="text-2xl font-black opacity-30">VS</div>

               <div className="flex flex-col items-center">
                  <div className={\`w-20 h-20 retro-border flex items-center justify-center transition-all \${partnerInLobby ? 'bg-[var(--secondary)] text-[var(--text-on-secondary)] shadow-[4px_4px_0_0_var(--border)]' : 'bg-transparent border-dashed opacity-50'}\`}>
                     <span className="font-black text-2xl">{partnerInLobby ? 'P2' : '?'}</span>
                  </div>
                  {partnerInLobby ? (
                     <span className="mt-3 font-bold text-xs uppercase bg-black text-white px-2 py-1 animate-pulse">READY</span>
                  ) : (
                     <span className="mt-3 font-bold text-[10px] uppercase flex items-center gap-1 opacity-60"><Loader size={12} className="animate-spin" /> Waiting</span>
                  )}
               </div>
            </div>

            {lobbyState.status === 'starting' ? (
                <div className="py-4">
                    <ScoreboardCountdown count={3} onComplete={() => setLobbyState(prev => ({ ...prev, status: 'playing' }))} sfx={sfx} />
                </div>
            ) : isReady ? (
               <button onClick={() => setLobbyState(prev => ({ ...prev, status: 'starting' }))} className="bg-[var(--primary)] text-[var(--text-on-primary)] font-black text-xl px-12 py-4 retro-border shadow-[4px_4px_0_0_var(--border)] hover:translate-y-[2px] hover:shadow-none transition-all animate-pulse cursor-pointer">
                 START GAME
               </button>
            ) : (
               <div className="flex flex-col gap-3">
                 <p className={\`text-xs font-bold italic \${isPartnerWhoWasLeft ? 'text-red-500 opacity-100' : 'opacity-60'}\`}>
                    {isPartnerWhoWasLeft ? 'Your partner has left the lobby.' : 'Waiting for partner to accept the invite...'}
                 </p>
                 <RetroButton onClick={() => onShareToChat(\`Join my lobby for \${game.title}!\`, null, { gameId: gameRoute, mode: lobbyState.config?.mode, type: 'game_invite_modal' })} className="text-xs">
                    {isPartnerWhoWasLeft ? 'Send Invite Again' : 'Resend Invite'}
                 </RetroButton>
               </div>
            )}
         </div>
      </RetroWindow>
      {showLeaveConfirm && (
        <ConfirmDialog 
          title="leave_lobby.exe" 
          message="Are you sure you want to leave lobby? An invitation has been sent to your partner." 
          onConfirm={() => { playAudio('click', sfx); leaveLobby(); }} 
          onCancel={() => { playAudio('click', sfx); setShowLeaveConfirm(false); }} 
          showSave={false} 
          sfx={sfx}
        />
      )}
      </>
    );
  }`;
  
const startIdx = code.indexOf('  // 3. Lobby Waiting Phase');
const endIdx = code.indexOf('  // 4. Active Game Phase');
code = code.slice(0, startIdx) + lobbyRender + '\n\n' + code.slice(endIdx);

fs.writeFileSync('src/games/index.jsx', code);
console.log('Lobby logic injected.');
