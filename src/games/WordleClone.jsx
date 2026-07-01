import React, { useState, useEffect } from 'react';
import { RetroWindow, RetroButton, ShareOutcomeOverlay, Confetti, ScoreboardCountdown } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { fetchDynamicWord, getScore, isValidWord } from '../utils/helpers.js';
import { getDailyWord } from '../utils/daily.js';
import { incrementUserScore } from '../utils/userDataHelpers.js';
import { WORDS_FALLBACK } from '../constants/data.js';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { Lightbulb, Flag, Activity } from 'lucide-react';

const KEYBOARD = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['ENTER','Z','X','C','V','B','N','M','DEL']
];

export function WordleClone({ config, setScores, onBack, sfx, onWin, onShareToChat, onSaveToScrapbook, profile, myName, userId, partnerName }) {
  const [targetWord, setTargetWord] = useState(""); 
  const wordLen = config.customWord ? config.customWord.length : (config.diff === 'easy' ? 4 : config.diff === 'medium' ? 5 : 6);
  const maxGuesses = 6;
  
  const [boardState, setBoardState] = useState(Array(maxGuesses).fill("")); 
  const [currentGuess, setCurrentGuess] = useState(""); 
  const [gameStatus, setGameStatus] = useState("playing"); // playing, won, lost, surrendered
  const [turn, setTurn] = useState(1);
  const [animatingRow, setAnimatingRow] = useState(-1);
  const [shakingRow, setShakingRow] = useState(-1);
  const [keyColors, setKeyColors] = useState({});
  const [hintUsed, setHintUsed] = useState(false);
  const [perfectWin, setPerfectWin] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [mastermindPhase, setMastermindPhase] = useState(config.mode === 'competitive' ? 'SETUP' : 'PLAYING');
  const [customTarget, setCustomTarget] = useState('');

  const [stats, setStats] = useLocalStorage('wordle_stats', { played: 0, won: 0, streak: 0, maxStreak: 0, guessDistribution: [0,0,0,0,0,0] });

  useEffect(() => { 
      let isMounted = true; 
      if (config.mode === 'competitive') return; // Handled by setup phase
      if (config.category === 'custom' && config.customWord) {
            setTargetWord(config.customWord.toUpperCase());
        } else {
            // Use deterministic daily word first
            const dailyWord = getDailyWord(config.diff);
            const used = JSON.parse(localStorage.getItem('wordle_used_words') || '[]');
            if (used.includes(dailyWord)) {
                // Fallback to dynamic fetch if already used
                fetchDynamicWord(wordLen, WORDS_FALLBACK[config.diff] || WORDS_FALLBACK.easy).then(w => { if (isMounted) setTargetWord(w.toUpperCase()) });
            } else {
                setTargetWord(dailyWord);
                localStorage.setItem('wordle_used_words', JSON.stringify([...used, dailyWord]));
            }
        }
      return () => { isMounted = false; }; 
  }, [config.category, config.diff, config.customWord, wordLen, config.mode]);

  const handleSetMastermindWord = () => {
      if (customTarget.length === wordLen) {
          setTargetWord(customTarget.toUpperCase());
          setMastermindPhase('PLAYING');
          playAudio('click', sfx);
      }
  };

  const updateStats = (won, attempts) => {
      setStats(prev => {
          const newStats = { ...prev, played: prev.played + 1 };
          if (won) {
              newStats.won += 1;
              newStats.streak += 1;
              if (newStats.streak > newStats.maxStreak) newStats.maxStreak = newStats.streak;
              newStats.guessDistribution[attempts - 1] += 1;
          } else {
              newStats.streak = 0;
          }
          return newStats;
      });
  };

  const handleKeyPress = async (key) => {
      if (gameStatus !== "playing" || animatingRow !== -1) return;
      
      const emptyIndex = boardState.findIndex(g => g === "");
      if (emptyIndex === -1) return;

      if (key === 'ENTER') {
           if (currentGuess.length !== wordLen) {
                setShakingRow(emptyIndex);
                playAudio('click', sfx);
                setTimeout(() => setShakingRow(-1), 600);
                return;
            }
            // Validate guess against dictionary before proceeding
            const valid = await isValidWord(currentGuess);
            if (!valid) {
                setShakingRow(emptyIndex);
                alert('Not in word list');
                playAudio('click', sfx);
                setTimeout(() => setShakingRow(-1), 600);
                return;
            }
            playAudio('click', sfx); 
           const newBoard = [...boardState]; 
           newBoard[emptyIndex] = currentGuess; 
           setBoardState(newBoard); 
           
           setAnimatingRow(emptyIndex);
           setTimeout(() => {
               const newKeyColors = { ...keyColors };
               const currentLetters = currentGuess.split('');
               const targetLetters = targetWord.split('');

               // Calculate detailed exact occurrences to prevent extra yellows
               const tCounts = {};
               targetLetters.forEach(c => tCounts[c] = (tCounts[c] || 0) + 1);
               const states = Array(wordLen).fill('absent');
               for(let i=0; i<wordLen; i++) {
                   if(currentLetters[i] === targetLetters[i]) {
                       states[i] = 'correct';
                       tCounts[currentLetters[i]]--;
                   }
               }
               for(let i=0; i<wordLen; i++) {
                   if(states[i] !== 'correct' && tCounts[currentLetters[i]] > 0) {
                       states[i] = 'present';
                       tCounts[currentLetters[i]]--;
                   }
               }

               // Update keyboard colors (strict green > yellow logic)
               currentLetters.forEach((char, j) => {
                   if (states[j] === 'correct') newKeyColors[char] = 'correct';
                   else if (states[j] === 'present' && newKeyColors[char] !== 'correct') newKeyColors[char] = 'present';
                   else if (!newKeyColors[char]) newKeyColors[char] = 'absent';
               });
               setKeyColors(newKeyColors);

               if (currentGuess === targetWord) { 
                   setGameStatus("won"); 
                   setScores(prev => incrementUserScore(prev, userId, 'wordle', 1, myName || profile?.name || 'You')); 
                   updateStats(true, emptyIndex + 1);
                   if (emptyIndex < 2) setPerfectWin(true);
                   setTimeout(() => { playAudio('win', sfx); onWin(); setShowStats(true); }, 1000); 
               } else if (emptyIndex === maxGuesses - 1) { 
                   setGameStatus("lost"); 
                   updateStats(false, 6);
                   setTimeout(() => setShowStats(true), 1500);
               } else { 
                   if (config.mode === 'competitive') setTurn(turn === 1 ? 2 : 1); 
               }
               setCurrentGuess("");
               setAnimatingRow(-1);
           }, wordLen * 150 + 200);

      } else if (key === 'DEL' || key === 'BACKSPACE') {
           setCurrentGuess(p => p.slice(0, -1));
      } else if (/^[A-Za-z]$/.test(key) && currentGuess.length < wordLen) {
           setCurrentGuess(p => (p + key).toUpperCase());
      }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      let key = e.key.toUpperCase();
      if (key === 'BACKSPACE') key = 'DEL';
      if (key === 'ENTER' || key === 'DEL' || /^[A-Z]$/.test(key)) handleKeyPress(key);
    }; 
    window.addEventListener('keydown', handleKeyDown); 
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentGuess, gameStatus, animatingRow, boardState, targetWord, wordLen, config.mode, turn, keyColors]);

  const generateEmojiBox = () => {
      return boardState.filter(g => g !== "").map(guess => {
          const targetCounts = {};
          targetWord.split('').forEach(c => { targetCounts[c] = (targetCounts[c] || 0) + 1; });
          const statuses = Array(wordLen).fill('⬛');
          const gArr = guess.split('');
          for (let k = 0; k < wordLen; k++) {
              if (gArr[k] === targetWord[k]) { statuses[k] = '🟩'; targetCounts[gArr[k]]--; }
          }
          for (let k = 0; k < wordLen; k++) {
              if (statuses[k] !== '🟩' && targetCounts[gArr[k]] > 0) { statuses[k] = '🟨'; targetCounts[gArr[k]]--; }
          }
          return statuses.join('');
      });
  };

  const useHint = () => {
      if (gameStatus !== "playing" || hintUsed || !targetWord) return;
      playAudio('click', sfx);
      setHintUsed(true);
      const firstMissing = targetWord.split('').find((char, i) => currentGuess[i] !== char && !boardState.some(g => g[i] === char));
      if (firstMissing) alert(`Hint: The word contains the letter ${firstMissing}`);
  };

  const handleSurrender = () => {
      if (window.confirm("Give up?")) {
         playAudio('click', sfx);
         setGameStatus("surrendered");
         updateStats(false, 6);
         setTimeout(() => setShowStats(true), 1000);
      }
  };



  const currentRowIndex = boardState.findIndex(g => g === "");

  return (
    <>
    <RetroWindow title={`retro_word_${config.mode}.exe`} className="w-full max-w-md h-[calc(100dvh-4rem)] max-h-[850px] flex flex-col" onClose={onBack} confirmOnClose sfx={sfx} noPadding>
      {perfectWin && <Confetti active={true} />}
      {showCountdown && <ScoreboardCountdown onComplete={() => setShowCountdown(false)} sfx={sfx} />}
      
      <div className="bg-border text-window p-2 flex justify-between items-center font-bold px-4 flex-shrink-0">
          <span>{config.category === 'custom' ? `Custom Match` : `Level: ${config.diff}`}</span>
          <span className="flex gap-2">
              <button disabled={hintUsed} onClick={useHint} className="bg-white text-black px-2 py-px rounded retro-border disabled:opacity-50"><Lightbulb size={12} className="inline"/> Hint</button>
              <button onClick={handleSurrender} className="bg-white text-red-600 px-2 py-px rounded retro-border"><Flag size={12} className="inline"/> Surrender</button>
          </span>
      </div>

      {mastermindPhase === 'SETUP' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-pattern-grid">
              <div className="w-16 h-16 bg-primary border-2 border-border flex items-center justify-center text-primary-text mb-6 shadow-[0_0_20px_rgba(0,0,0,0.2)]">
                  <Activity size={32} />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-widest mb-4">Mastermind Mode</h2>
              <p className="font-bold text-xs opacity-60 uppercase mb-8 leading-relaxed">Enter a secret {wordLen}-letter word<br/>for your partner to guess!</p>
              
              <input 
                type="password" 
                autoComplete="off"
                maxLength={wordLen} 
                value={customTarget} 
                onChange={(e) => setCustomTarget(e.target.value.replace(/[^A-Za-z]/g, ''))}
                placeholder="*****"
                className="w-full max-w-[200px] text-center font-black text-4xl tracking-[0.5em] p-4 border-2 border-border shadow-inner uppercase mb-6 bg-window text-main-text focus:outline-none focus:ring-4 focus:ring-primary/20"
              />
              
              <RetroButton onClick={handleSetMastermindWord} disabled={customTarget.length !== wordLen} className="px-12 py-4 text-base">
                  SET SECRET WORD
              </RetroButton>
          </div>
      ) : (
          <div className="flex flex-col items-center flex-1 overflow-y-auto py-6">
        
        {config.mode === 'competitive' && gameStatus === "playing" && ( 
            <div className={`mb-6 font-bold text-sm px-6 py-2 shadow-sm border-2 border-border transition-colors duration-300 ${turn === 1 ? 'bg-primary text-primary-text' : 'bg-secondary text-secondary-text'}`}>Player {turn}'s Guess</div> 
        )}
        {config.mode === 'coop' && <div className="mb-4 opacity-50 font-bold uppercase tracking-widest text-xs"><Activity size={12} className="inline mr-1"/> Co-op Mode</div>}

        <div className="grid grid-rows-6 gap-2 w-3/4 max-w-[300px]">
          {boardState.map((guess, i) => {
            const isCurrentRow = currentRowIndex === i && animatingRow === -1; 
            const wordToDisplay = isCurrentRow ? currentGuess.padEnd(wordLen, " ") : guess.padEnd(wordLen, " ");
            const isAnimating = animatingRow === i;

            // Compute exact tile states for rendering
            const targetCounts = {};
            targetWord.split('').forEach(c => targetCounts[c] = (targetCounts[c]||0)+1);
            const statuses = Array(wordLen).fill('absent');
            if (guess !== "" && !isAnimating) {
                const gArr = guess.split('');
                for(let k=0; k<wordLen; k++) if(gArr[k]===targetWord[k]) { statuses[k]='correct'; targetCounts[gArr[k]]--; }
                for(let k=0; k<wordLen; k++) if(statuses[k]!=='correct' && targetCounts[gArr[k]]>0) { statuses[k]='present'; targetCounts[gArr[k]]--; }
            }

            return ( 
            <div key={i} className={`grid gap-1 sm:gap-2 ${shakingRow === i ? 'animate-shake' : ''}`} style={{ gridTemplateColumns: `repeat(${wordLen}, minmax(0, 1fr))` }}>
                {wordToDisplay.split('').map((char, j) => { 
                    let bgColor = "bg-window"; 
                    let textColor = "text-main-text";
                    let state = "empty";
                    
                    if (guess !== "" && !isAnimating) { 
                        if (statuses[j] === 'correct') { bgColor = "bg-[#719f5a]"; textColor = "text-white"; state="correct"; }
                        else if (statuses[j] === 'present') { bgColor = "bg-[#d8b04a]"; textColor = "text-white"; state="present"; }
                        else { bgColor = "bg-[#787c7e]"; textColor = "text-white"; state="absent"; }
                    }

                    return (
                        <div key={j} className={`relative w-full pb-[100%] border-2 border-border font-bold text-2xl sm:text-3xl ${isCurrentRow && char !== ' ' ? 'shadow-[0_0_10px_var(--primary)] scale-105' : ''}`} style={{ perspective: '1000px' }}>
                            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 transform preserve-3d ${isAnimating ? 'animate-flip' : ''}`} style={{ animationDelay: isAnimating ? `${j * 150}ms` : '0ms' }}>
                                 <div className={`w-full h-full flex items-center justify-center ${bgColor} ${textColor} ${state!=='empty' ? 'border-none' : ''}`}>
                                    {char}
                                 </div>
                            </div>
                        </div>
                    ); 
                })}
            </div> 
            );
          })}
        </div>

        {gameStatus !== 'playing' && !showStats && (
            <div className="mt-8">
                <RetroButton onClick={()=>setShowStats(true)} className="px-8 py-3">View Result</RetroButton>
            </div>
        )}
      </div>
      )}

      {gameStatus === "playing" && (
         <div className="bg-border p-3 pb-8 border-t-2 border-border">
             <div className="flex flex-col gap-2 max-w-[400px] mx-auto w-full">
                 {KEYBOARD.map((row, i) => (
                     <div key={i} className="flex justify-center gap-1 sm:gap-2">
                         {row.map(key => {
                             let keyClass = "bg-gray-200 text-black";
                             if (keyColors[key] === 'correct') keyClass = "bg-[#719f5a] text-white border-transparent";
                             else if (keyColors[key] === 'present') keyClass = "bg-[#d8b04a] text-white border-transparent";
                             else if (keyColors[key] === 'absent') keyClass = "bg-[#787c7e] text-white border-transparent opacity-50";

                             const isSpecial = key === 'ENTER' || key === 'DEL';
                             return (
                                 <button key={key} onClick={() => handleKeyPress(key)} className={`h-12 sm:h-14 w-10 sm:w-11 retro-border font-bold rounded flex items-center justify-center text-sm sm:text-base active:scale-95 transition-transform ${isSpecial ? 'col-span-1.5 sm:col-span-1.5 text-xs' : ''} ${keyClass}`}>
                                     {key}
                                 </button>
                             )
                         })}
                     </div>
                 ))}
             </div>
         </div>
      )}

    </RetroWindow>

    {showStats && (() => {
      const outcomeStats = {
          Result: gameStatus === 'surrendered' ? `Word was ${targetWord}` : gameStatus === 'won' ? `Guessed in ${boardState.findIndex(g=>g==="")}` : `Word was ${targetWord}`,
          Score: gameStatus === 'surrendered' ? 'X/6 (quit)' : gameStatus === 'won' ? `${boardState.findIndex(g=>g==="")}/6` : 'X/6',
          "Win Rate": `${stats.played === 0 ? 0 : Math.round((stats.won/stats.played)*100)}%`,
          "Current Streak": stats.streak,
          "Max Streak": stats.maxStreak
      };
      const emojiLines = generateEmojiBox();
      const customNode = (
          <div className="flex flex-col gap-[2px] items-center bg-gray-50/50 p-4 rounded shadow-inner border border-black/10">
              {emojiLines.map((line, i) => <div key={i} className="text-2xl sm:text-3xl tracking-widest">{line}</div>)}
          </div>
      );

      return (
        <ShareOutcomeOverlay
          isSolo={(typeof config !== "undefined" && config?.mode === "solo") || (typeof mode !== "undefined" && mode === "solo") || (typeof gameMode !== "undefined" && gameMode === "solo") || (typeof config !== "undefined" && config?.mode === "practice")}
          partnerNickname={(typeof config !== "undefined" && config?.mode === "vs_ai") || (typeof mode !== "undefined" && mode === "vs_ai") || (typeof gameMode !== "undefined" && gameMode === "vs_ai") ? "AI" : undefined}
          gameName={`Retro Word (${config.mode})`}
          stats={outcomeStats}
          customElement={customNode}
          onClose={() => { setShowStats(false); onBack(); }}
          onRematch={() => {
            setBoardState(Array(maxGuesses).fill(""));
            setCurrentGuess("");
            setGameStatus("playing");
            setTurn(1);
            setAnimatingRow(-1);
            setShakingRow(-1);
            setKeyColors({});
            setHintUsed(false);
            setPerfectWin(false);
            setShowStats(false);
            if (config.category === 'custom' && config.customWord) {
                setTargetWord(config.customWord.toUpperCase());
            } else {
                fetchDynamicWord(wordLen, WORDS_FALLBACK[config.diff] || WORDS_FALLBACK.easy).then(w => { setTargetWord(w.toUpperCase()) }); 
            }
          }}
          onShareToChat={(msg) => onShareToChat(msg + "\n\n" + emojiLines.join('\n'))}
          onSaveToScrapbook={onSaveToScrapbook}
          sfx={sfx}
        />
      );
    })()}
    </>
  );
}
