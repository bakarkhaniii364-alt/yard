import React, { useState, useEffect, useRef } from 'react';
import { RetroWindow, RetroButton, ShareOutcomeOverlay } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { getScore } from '../utils/helpers.js';
import { incrementUserScore } from '../utils/userDataHelpers.js';
import { Chess } from 'chess.js';
import { RotateCcw, Flag, Image as ImageIcon, Settings, Clock, Crosshair, ClipboardCopy } from 'lucide-react';
import { useGlobalSync, useBroadcast } from '../hooks/useSupabaseSync.js';
import { supabase } from '../lib/supabase.js';

const PIECE_SKINS = {
    classic: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔', P: '♟', N: '♞', B: '♝', R: '♜', Q: '♛', K: '♚' },
    modern:  { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚', P: '♟', N: '♞', B: '♝', R: '♜', Q: '♛', K: '♚' }, // uses colors via css
};

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const PUZZLES = [
    "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1", // Mate in 1
    "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", // Ruy lopez
];

export function ChessEngine({ config, setScores, onBack, sfx, onWin, onShareToChat, onSaveToScrapbook, profile, myName, userId, isMultiplayer, isHost, roomId, partnerName }) {
  // Multiplayer sync
  const [syncedState, setSyncedState] = useGlobalSync(`chess_${roomId}`, null);

  const [chess] = useState(new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [selectedSq, setSelectedSq] = useState(null);
  const [validMoves, setValidMoves] = useState([]);
  
  // Host = White ('w'), Guest = Black ('b')
  const myColor = isMultiplayer ? (isHost ? 'w' : 'b') : 'w';
  const [isFlipped, setIsFlipped] = useState(isMultiplayer ? !isHost : false);
  const [skin, setSkin] = useState('classic');
  const [history, setHistory] = useState([]);
  
  const [wTime, setWTime] = useState(10 * 60);
  const [bTime, setBTime] = useState(10 * 60);
  const [gameOverResult, setGameOverResult] = useState(null);
  
  const [showSettings, setShowSettings] = useState(false);

  // State ref for accessing current game state in broadcast callback
  const gameStateRef = useRef({ chess, fen, history, setFen, setHistory, setSelectedSq, setValidMoves, setGameOverResult });
  
  // Update ref when state changes
  useEffect(() => {
    gameStateRef.current = { chess, fen, history, setFen, setHistory, setSelectedSq, setValidMoves, setGameOverResult };
  }, [chess, fen, history, gameOverResult]);
  
  // Broadcast listener for incoming moves
  useEffect(() => {
    if (!isMultiplayer) return;
    const handleIncomingMove = (payload) => {
      if (payload.sender === userId) return;
      try {
        const state = gameStateRef.current;
        state.chess.load(payload.fen);
        state.setFen(payload.fen);
        state.setHistory(state.chess.history({ verbose: true }));
        state.setSelectedSq(null);
        state.setValidMoves([]);
        if (state.chess.isCheckmate()) {
          state.setGameOverResult(`${state.chess.turn() === 'w' ? 'Black' : 'White'} Wins by Checkmate!`);
        }
      } catch(e) {}
    };
    
    window.addEventListener(`broadcast_chess_move_${roomId}`, (e) => handleIncomingMove(e.detail));
    return () => window.removeEventListener(`broadcast_chess_move_${roomId}`, handleIncomingMove);
  }, [isMultiplayer, roomId, userId]);
  
  const sendMove = useBroadcast(`chess_move_${roomId}`, () => {
    // Listener callback - broadcast channel setup
  });

  // Sync from DB (for reconnection / tab refresh)
  useEffect(() => {
    if (isMultiplayer && syncedState?.fen && !gameOverResult) {
      try {
        chess.load(syncedState.fen);
        setFen(syncedState.fen);
        if (syncedState.history) setHistory(syncedState.history);
      } catch(e) {}
    }
  }, [syncedState, isMultiplayer]);

  
  useEffect(() => {
     let timer;
     if (!gameOverResult && history.length > 0) {
         timer = setInterval(() => {
             if (chess.turn() === 'w') {
                 setWTime(t => { if(t<=1){ setGameOverResult("Black Wins on Time"); return 0;} return t-1;});
             } else {
                 setBTime(t => { if(t<=1){ setGameOverResult("White Wins on Time"); return 0;} return t-1;});
             }
         }, 1000);
     }
     return () => clearInterval(timer);
  }, [chess.turn(), gameOverResult, history.length]);

  const loadFen = (f) => {
      try {
          chess.load(f);
          setFen(chess.fen());
          setHistory([]);
          setSelectedSq(null);
          setValidMoves([]);
          setGameOverResult(null);
      } catch(e) { alert("Invalid FEN"); }
  };

    // On mount/load, try to load saved FEN from Supabase if present
    useEffect(() => {
        let mounted = true;
        (async () => {
            if (!isMultiplayer || !roomId) return;
            try {
                const { data, error } = await supabase
                    .from('game_state')
                    .select('fen, history')
                    .eq('room_id', roomId)
                    .eq('game', 'chess')
                    .maybeSingle();
                if (mounted && data?.fen) {
                    loadFen(data.fen);
                    if (data.history) setHistory(data.history);
                }
            } catch (e) {
                console.warn('[CHESS] failed to load persisted game state', e);
            }
        })();
        return () => { mounted = false; };
    }, [isMultiplayer, roomId]);

  const getMaterialDiff = () => {
      const b = chess.board(); let wM = 0; let bM = 0;
      const vals = { p:1, n:3, b:3, r:5, q:9, k:0 };
      for(let r=0; r<8; r++){
          for(let c=0; c<8; c++){
              if (b[r][c]) {
                  if (b[r][c].color === 'w') wM += vals[b[r][c].type];
                  else bM += vals[b[r][c].type];
              }
          }
      }
      return wM - bM;
  };

  const evalPerc = 50 + (getMaterialDiff() * 3);

  const makeMove = (moveObj) => {
      try {
          // Multiplayer turn enforcement
          if (isMultiplayer && chess.turn() !== myColor) return;

          const move = chess.move(moveObj);
          if (move) {
              playAudio('wood_thud', sfx);
              const newFen = chess.fen();
              const newHistory = chess.history({ verbose: true });
              setFen(newFen);
              setHistory(newHistory);
              setSelectedSq(null);
              setValidMoves([]);
              
              // Broadcast to partner
              if (isMultiplayer) {
                sendMove({ fen: newFen, sender: userId });
                setSyncedState({ fen: newFen, history: newHistory });
                try {
                    supabase.from('game_state').upsert({
                        room_id: roomId,
                        game: 'chess',
                        fen: newFen,
                        turn: chess.turn(),
                        history: newHistory,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'room_id,game' }).then(({ error }) => { if (error) console.warn('[CHESS] persist error', error); });
                } catch (e) { console.warn('[CHESS] failed to persist game state', e); }
              }
              
              if (chess.isCheckmate()) { playAudio('win', sfx); setGameOverResult(`${chess.turn() === 'w' ? 'Black' : 'White'} Wins by Checkmate!`); setScores(prev => incrementUserScore(prev, userId, 'chess', 1, myName || profile?.name || 'You')); onWin(); }
              else if (chess.isDraw()) { setGameOverResult("Draw"); }
              else if (chess.isStalemate()) { setGameOverResult("Draw by Stalemate"); }
              
              if (config.mode === 'vs_ai' && !chess.isGameOver() && chess.turn() === 'b') {
                  setTimeout(() => {
                      const moves = chess.moves();
                      if(moves.length > 0) {
                          const randMove = moves[Math.floor(Math.random() * moves.length)];
                          chess.move(randMove);
                          setFen(chess.fen()); setHistory(chess.history({ verbose: true }));
                          if (chess.isCheckmate()) setGameOverResult("Black Wins by Checkmate!");
                      }
                  }, 500);
              }
          }
      } catch(e) {}
  };

  const handleSquareClick = (sq) => {
      if (gameOverResult) return;
      // In multiplayer, block interaction on opponent's turn
      if (isMultiplayer && chess.turn() !== myColor) return;
      if (config.mode === 'vs_ai' && chess.turn() === 'b') return;

      if (selectedSq) {
          const move = validMoves.find(m => m.to === sq);
          if (move) {
              let promotion = undefined;
              if (move.flags.includes('p')) promotion = prompt("Promote to (q, r, b, n):", "q") || 'q';
              makeMove({ from: selectedSq, to: sq, promotion });
              return;
          }
      }
      const piece = chess.get(sq);
      if (piece && piece.color === chess.turn()) {
          setSelectedSq(sq);
          setValidMoves(chess.moves({ square: sq, verbose: true }));
      } else {
          setSelectedSq(null);
          setValidMoves([]);
      }
  };

  const handleDragStart = (e, sq) => {
      const piece = chess.get(sq);
      if (!piece || piece.color !== chess.turn()) { e.preventDefault(); return; }
      setSelectedSq(sq);
      setValidMoves(chess.moves({ square: sq, verbose: true }));
      e.dataTransfer.setData("text/plain", sq);
  };
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e, sq) => {
      e.preventDefault();
      const fromSq = e.dataTransfer.getData("text");
      if (fromSq && fromSq !== sq) {
          const move = validMoves.find(m => m.to === sq);
          if (move) {
              let promotion = undefined;
              if (move.flags.includes('p')) promotion = 'q'; // Default to q on drag
              makeMove({ from: fromSq, to: sq, promotion });
          }
      }
  };

  const renderBoard = () => {
      const boardArr = chess.board();
      if (isFlipped) boardArr.reverse().forEach(r => r.reverse());
      
      const files = ['a','b','c','d','e','f','g','h'];
      const ranks = ['8','7','6','5','4','3','2','1'];
      if(isFlipped) { files.reverse(); ranks.reverse(); }

      const lastMove = history.length > 0 ? history[history.length-1] : null;

      return (
          <div className="w-full max-w-[320px] sm:max-w-[420px] aspect-square grid grid-cols-8 grid-rows-8 retro-border border-4 border-[var(--border)] retro-shadow-dark select-none relative">
              {boardArr.map((row, rIdx) => 
                  row.map((piece, cIdx) => {
                      const sq = `${files[cIdx]}${ranks[rIdx]}`;
                      const isDark = (rIdx + cIdx) % 2 !== 0;
                      const isSelected = selectedSq === sq;
                      const isValidTarget = validMoves.some(m => m.to === sq);
                      const isLastMove = lastMove && (lastMove.from === sq || lastMove.to === sq);
                      const inCheck = piece?.type === 'k' && piece?.color === chess.turn() && chess.inCheck();

                      let bgClass = isDark ? 'bg-[#c5a880]' : 'bg-[#f0d9b5]';
                      if (inCheck) bgClass = 'bg-[var(--color-destructive)]';
                      else if (isSelected) bgClass = '!bg-[var(--accent)]';
                      else if (isLastMove) bgClass = 'bg-yellow-300';
                      
                      return (
                          <div key={sq} onClick={() => handleSquareClick(sq)} onDragOver={handleDragOver} onDrop={(e)=>handleDrop(e,sq)} className={`relative flex justify-center items-center ${bgClass} ${isValidTarget?'cursor-pointer':''} transition-colors`}>
                              {isValidTarget && <div className="absolute w-3 h-3 bg-black/20 rounded-full z-0 pointer-events-none"></div>}
                              {piece && (
                                  <div draggable onDragStart={(e)=>handleDragStart(e,sq)} className={`z-10 text-4xl sm:text-5xl cursor-grab active:cursor-grabbing hover:scale-110 transition-transform ${piece.color === 'w' && skin === 'modern' ? 'text-white drop-shadow-md' : 'text-black drop-shadow-sm'}`}>
                                      {PIECE_SKINS[skin][piece.color === 'w' ? piece.type.toUpperCase() : piece.type]}
                                  </div>
                              )}
                          </div>
                      );
                  })
              )}
          </div>
      );
  };

  const fmtTime = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;



  return (
    <>
    <RetroWindow title={isMultiplayer ? "Chess — " + (myName || 'You') + " vs " + (partnerName || 'Partner') : "Chess — vs AI"} className="w-full max-w-5xl h-[calc(100dvh-4rem)] max-h-[850px] flex flex-col" onClose={onBack} confirmOnClose sfx={sfx} noPadding>
      
      <div className="bg-[var(--border)] text-[var(--bg-window)] p-2 flex justify-between items-center font-bold px-4 flex-shrink-0 relative overflow-hidden">
         <div className="w-full h-1 bg-[var(--color-destructive)] absolute bottom-0 left-0"><div className="h-full bg-[var(--color-game)] transition-all" style={{width: `${Math.max(0, Math.min(100, evalPerc))}%`}}></div></div>
         {isMultiplayer ? (
           <span className={`font-black uppercase text-sm px-2 py-0.5 rounded ${chess.turn() === myColor ? 'bg-[var(--color-game)] text-white animate-pulse' : 'bg-gray-500 text-white opacity-70'}`}>
             {chess.turn() === myColor ? '⚡ Your Turn' : '⏳ ' + (partnerName || 'Partner') + "'s Turn"}
           </span>
         ) : (
           <span><Crosshair size={14} className="inline mr-1"/> Eval: {getMaterialDiff() > 0 ? '+'+getMaterialDiff() : getMaterialDiff()}</span>
         )}
         <span><Clock size={14} className="inline mr-1"/> {fmtTime(history.length % 2 === (isFlipped ? 1 : 0) ? bTime : wTime)}</span>
         <button onClick={()=>setShowSettings(!showSettings)} className="bg-white/20 px-2 py-1 rounded hover:bg-white/40 active:translate-y-px"><Settings size={14}/></button>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative">
          
          {showSettings && (
             <div className="absolute right-0 top-0 bottom-0 w-64 bg-[var(--bg-window)] retro-border-l z-50 p-4 overflow-y-auto retro-shadow-dark animate-in slide-in-from-right">
                <h3 className="font-bold border-b border-black/10 pb-2 mb-4">Board Settings</h3>
                <div className="space-y-4 text-sm">
                    <RetroButton variant="white" onClick={() => {setIsFlipped(!isFlipped); playAudio('click',sfx)}} className="w-full py-2"><RotateCcw size={14} className="inline mr-2"/> Flip Board</RetroButton>
                    <RetroButton variant="white" onClick={() => {setSkin(skin==='classic'?'modern':'classic'); playAudio('click',sfx)}} className="w-full py-2"><ImageIcon size={14} className="inline mr-2"/> Switch Skin ({skin})</RetroButton>
                    <div className="pt-2 border-t border-black/10">
                        <label className="font-bold opacity-70 block mb-1">Load FEN String</label>
                        <input type="text" value={fen} onChange={(e)=>setFen(e.target.value)} className="w-full p-2 text-xs retro-border" />
                        <RetroButton variant="accent" onClick={() => loadFen(fen)} className="w-full py-1 mt-1 text-xs">Load Position</RetroButton>
                    </div>
                    <div className="pt-2 border-t border-black/10">
                        <label className="font-bold opacity-70 block mb-1">Load Puzzle</label>
                        <RetroButton variant="white" onClick={() => loadFen(PUZZLES[0])} className="w-full py-1 mt-1 text-xs">Mate in 1</RetroButton>
                        <RetroButton variant="white" onClick={() => loadFen(PUZZLES[1])} className="w-full py-1 mt-1 text-xs">Ruy Lopez Opening</RetroButton>
                    </div>
                    <div className="pt-4 border-t border-black/10 text-xs opacity-70">Hint: Try dragging pieces!</div>
                </div>
             </div>
          )}

          <div className="flex-1 flex flex-col items-center justify-center p-4 bg-[#f8f9fa] relative">
              <div className="w-full max-w-[320px] sm:max-w-[420px] flex justify-between mb-2">
                 <div className="font-bold text-sm bg-black text-white px-3 py-1 rounded shadow-md">{isFlipped?'White':'Black'} {fmtTime(isFlipped?wTime:bTime)}</div>
              </div>
              
              {renderBoard()}
              
              <div className="w-full max-w-[320px] sm:max-w-[420px] flex justify-between mt-2">
                 <div className="font-bold text-sm bg-white border border-black/20 px-3 py-1 rounded shadow-md">{isFlipped?'Black':'White'} {fmtTime(isFlipped?bTime:wTime)}</div>
              </div>
          </div>

          <div className="w-full md:w-64 bg-[var(--bg-main)] retro-border-l md:h-full overflow-hidden flex flex-col shrink-0">
             <div className="p-2 font-bold opacity-70 border-b border-black/10 text-sm flex justify-between items-center bg-[var(--bg-window)]">
                 Notation History
                 <button onClick={() => navigator.clipboard.writeText(chess.pgn())} title="Copy PGN"><ClipboardCopy size={14}/></button>
             </div>
             <div className="flex-1 overflow-y-auto p-2 font-mono text-xs sm:text-sm bg-white">
                 {history.reduce((acc, mv, i) => {
                     if (i % 2 === 0) acc.push([mv.san]);
                     else acc[acc.length-1].push(mv.san);
                     return acc;
                 }, []).map((pair, i) => (
                     <div key={i} className={`flex gap-4 p-1 ${i%2===0?'bg-gray-50':''} hover:bg-[var(--accent)] transition-colors`}>
                         <span className="opacity-50 w-6">{i+1}.</span>
                         <span className="w-12 font-bold">{pair[0]}</span>
                         <span className="w-12 font-bold">{pair[1] || ''}</span>
                     </div>
                 ))}
                 {history.length === 0 && <div className="text-center opacity-50 p-4">Make a move to start...</div>}
             </div>
             <div className="p-3 bg-[var(--bg-window)] retro-border-t shrink-0">
                 <RetroButton variant="secondary" onClick={() => {if(window.confirm('Resign?')) setGameOverResult(`${chess.turn()==='w'?'Black':'White'} Wins by Resignation`)}} className="w-full py-2 flex items-center justify-center gap-2 text-sm"><Flag size={14}/> Resign</RetroButton>
             </div>
          </div>

      </div>
    </RetroWindow>

    {gameOverResult && (
      <ShareOutcomeOverlay
        isSolo={(typeof config !== "undefined" && config?.mode === "solo") || (typeof mode !== "undefined" && mode === "solo") || (typeof gameMode !== "undefined" && gameMode === "solo") || (typeof config !== "undefined" && config?.mode === "practice")}
        partnerNickname={(typeof config !== "undefined" && config?.mode === "vs_ai") || (typeof mode !== "undefined" && mode === "vs_ai") || (typeof gameMode !== "undefined" && gameMode === "vs_ai") ? "AI" : undefined}
        gameName="Chess"
        stats={{ Result: gameOverResult, "Moves Played": history.length, "Mode": config.mode==='vs_ai'?'VS AI':'Local 1v1' }}
        onClose={() => { loadFen(INITIAL_FEN); setGameOverResult(null); onBack();}}
        onRematch={() => { loadFen(INITIAL_FEN); setGameOverResult(null); }}
        onShareToChat={onShareToChat}
        onSaveToScrapbook={onSaveToScrapbook}
        sfx={sfx}
      />
    )}
    </>
  );
}
