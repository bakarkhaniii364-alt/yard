import React, { useState, useEffect } from 'react';
import { RetroWindow, RetroButton, ShareOutcomeOverlay } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { useGlobalSync } from '../hooks/useSupabaseSync.js';
import { Trophy, LineChart, Sparkles } from 'lucide-react';
import { getDailyQuizQuestions } from '../utils/daily.js';

export function YardQuiz({ onBack, sfx, onWin, onShareToChat, onSaveToScrapbook, userId, partnerId, isHost, roomId, config, partnerName }) {
  const isMultiplayer = !!(roomId && partnerId);
  const opponentName = partnerName || 'Friend';
  
  // Persistent shared state: questions, index, both answers, scores
  const [syncState, setSyncState] = useGlobalSync(`quiz_${roomId}`, null);
  // Transient: my local answer before committing
  const [localAnswer, setLocalAnswer] = useState('');
  const [committed, setCommitted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  // Initialize game (host picks questions)
  useEffect(() => {
    if (isMultiplayer && isHost && !syncState) {
      const category = config?.category || 'random';
      const pool = getDailyQuizQuestions(category);
      setSyncState({
        questions: pool,
        idx: 0,
        answers: { [userId]: null, [partnerId]: null },
        scores: { [userId]: 0, [partnerId]: 0 },
        phase: 'answering', // answering | reveal | done
        wager: config?.wager || 'Loser buys coffee!'
      });
    }
  }, [isMultiplayer, isHost, syncState, userId, partnerId, roomId]);

  // Reset local state on question change
  useEffect(() => {
    setLocalAnswer('');
    setCommitted(false);
    setShowResult(false);
  }, [syncState?.idx]);

  // Show result when both answered
  useEffect(() => {
    if (!syncState || syncState.phase !== 'answering') return;
    const myA = syncState.answers[userId];
    const theirA = syncState.answers[partnerId];
    if (myA && theirA) {
      setShowResult(true);
    }
  }, [syncState?.answers, userId, partnerId]);

  // Non-multiplayer fallback (shouldn't happen but safety)
  const [localIdx, setLocalIdx] = useState(0);
  const [myAnswers, setMyAnswers] = useState([]);
  const [theirAnswers] = useState(() => getDailyQuizQuestions('random').map(() => Math.random() > 0.5 ? 'A' : 'B'));

  if (!isMultiplayer) {
    // Solo/local mode
    const questions = getDailyQuizQuestions(config?.category || 'random');
    const current = questions[localIdx];
    const myAnswer = myAnswers[localIdx];
    const matchCount = myAnswers.filter((a, i) => a === theirAnswers[i]).length;

    const answerLocal = (choice) => {
      playAudio('click', sfx);
      const next = [...myAnswers, choice];
      setMyAnswers(next);
      if (next.length >= questions.length) { setShowOverlay(true); }
      else setLocalIdx(i => i + 1);
    };
    return (
      <>
      <RetroWindow title="quiz.exe" className="w-full max-w-xl h-[calc(100dvh-4rem)] max-h-[700px]" onClose={onBack} confirmOnClose sfx={sfx} noPadding>
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
          <div className="text-xs font-black uppercase opacity-50">{localIdx + 1} / {questions.length}</div>
          <h2 className="text-xl font-bold text-center">{current}</h2>
          <div className="flex flex-col gap-3 w-full">
            <RetroButton onClick={() => answerLocal('A')} className="py-4 text-base w-full">A</RetroButton>
            <RetroButton variant="secondary" onClick={() => answerLocal('B')} className="py-4 text-base w-full">B</RetroButton>
          </div>
        </div>
      </RetroWindow>
      {showOverlay && <ShareOutcomeOverlay isSolo gameName="Yard Quiz" stats={{ Questions: questions.length, Matches: matchCount, 'Match %': `${Math.round((matchCount/myAnswers.length)*100)}%` }} onClose={onBack} onShareToChat={onShareToChat} sfx={sfx} />}
      </>
    );
  }

  // --- Multiplayer Mode ---

  if (!syncState) {
    return (
      <div className="flex flex-col items-center justify-center p-8 h-full">
        <Trophy size={48} className="text-primary animate-pulse mb-4"/>
        <div className="font-black text-xl uppercase animate-pulse">Setting up quiz...</div>
      </div>
    );
  }

  const { questions, idx, answers, scores, phase, wager } = syncState;
  const current = questions?.[idx];
  const myAnswer = answers?.[userId];
  const theirAnswer = answers?.[partnerId];
  const bothAnswered = !!(myAnswer && theirAnswer);
  const isMatch = bothAnswered && myAnswer?.toLowerCase().trim() === theirAnswer?.toLowerCase().trim();
  const matchCount = Object.keys(scores || {}).length > 0 ? (scores[userId] || 0) : 0;

  const commitAnswer = () => {
    if (!localAnswer.trim() || committed) return;
    playAudio('click', sfx);
    setCommitted(true);
    setSyncState({
      ...syncState,
      answers: { ...answers, [userId]: localAnswer.trim() }
    });
  };

  const nextQuestion = () => {
    playAudio('click', sfx);
    const newIdx = idx + 1;
    const newScores = { ...scores };
    if (isMatch) {
      newScores[userId] = (newScores[userId] || 0) + 1;
      newScores[partnerId] = (newScores[partnerId] || 0) + 1;
    }
    if (newIdx >= questions.length) {
      setSyncState({ ...syncState, answers: { [userId]: null, [partnerId]: null }, scores: newScores, phase: 'done' });
      setShowOverlay(true);
    } else {
      setSyncState({ ...syncState, idx: newIdx, answers: { [userId]: null, [partnerId]: null }, scores: newScores, phase: 'answering' });
    }
  };

  const progress = questions ? ((idx) / questions.length) * 100 : 0;

  return (
    <>
    <RetroWindow title="quiz_live.exe" className="w-full max-w-xl h-[calc(100dvh-4rem)] max-h-[700px]" onClose={onBack} confirmOnClose sfx={sfx} noPadding>
      <div className="bg-border text-window p-2 px-4 flex justify-between font-bold text-sm">
        <span>Q {idx + 1}/{questions?.length || 5}</span>
        <span className="flex items-center gap-1"><Sparkles size={14}/> {wager}</span>
      </div>
      <div className="w-full h-2 bg-main"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }}></div></div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        <h2 className="text-lg sm:text-xl font-bold text-center leading-relaxed">{current}</h2>

        {!showResult ? (
          <div className="w-full flex flex-col gap-3">
            <input
              type="text"
              value={localAnswer}
              onChange={e => setLocalAnswer(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && commitAnswer()}
              disabled={committed}
              placeholder="Type your answer..."
              className="w-full p-4 retro-border text-center font-bold text-lg focus:outline-none focus:ring-2"
              autoFocus
            />
            <RetroButton
              variant="primary"
              onClick={commitAnswer}
              disabled={committed || !localAnswer.trim()}
              className={`w-full py-3 text-lg ${committed ? 'opacity-50' : ''}`}
            >
              {committed ? (theirAnswer ? 'Both answered! ✓' : `Waiting for ${opponentName}...`) : 'Lock Answer'}
            </RetroButton>

            {/* Status indicators */}
            <div className="flex justify-between text-xs font-bold opacity-60 px-2">
              <span className={myAnswer ? 'text-green-600' : ''}>You: {myAnswer ? '✓ Locked' : '✎ Typing...'}</span>
              <span className={theirAnswer ? 'text-green-600' : ''}>{opponentName}: {theirAnswer ? '✓ Locked' : '⏳ Waiting...'}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 w-full animate-in fade-in duration-300">
            <div className={`text-3xl font-bold ${isMatch ? 'text-primary' : 'text-secondary'}`}>
              {isMatch ? 'Match!' : 'Different!'}
            </div>

            <div className="flex gap-4 w-full justify-center">
              <div className="flex-1 bg-window retro-border p-4 text-center relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-2 py-1 uppercase rounded-none">You</div>
                <div className="mt-4 text-lg font-bold text-primary-hover">{myAnswer}</div>
              </div>
              <div className="flex-1 bg-window retro-border p-4 text-center relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-secondary text-white text-xs font-bold px-2 py-1 uppercase rounded-none">{opponentName}</div>
                <div className="mt-4 text-lg font-bold text-secondary">{theirAnswer}</div>
              </div>
            </div>

            {/* Only host advances — prevents race condition */}
            {isHost ? (
              <RetroButton onClick={nextQuestion} className="px-8 py-3">
                {idx + 1 >= (questions?.length || 5) ? 'See Results' : 'Next →'}
              </RetroButton>
            ) : (
              <div className="text-sm opacity-60 font-bold animate-pulse">Waiting for next question...</div>
            )}
          </div>
        )}
      </div>
    </RetroWindow>
    {(showOverlay || phase === 'done') && (() => {
      const totalMatch = scores[userId] || 0;
      const pct = questions?.length > 0 ? Math.round((totalMatch / questions.length) * 100) : 0;
      return (
        <ShareOutcomeOverlay
          gameName="Yard Quiz"
          stats={{ Category: config?.category || 'random', 'Final Score': `${totalMatch} / ${questions?.length}`, 'Match %': `${pct}%`, Verdict: pct > 70 ? 'Perfect Match!' : pct > 40 ? 'Good Match' : 'Opposites Attract!' }}
          onClose={() => { setSyncState(null); onBack(); }}
          onRematch={() => { setSyncState(null); setShowOverlay(false); }}
          onShareToChat={onShareToChat}
          onSaveToScrapbook={onSaveToScrapbook}
          sfx={sfx}
        />
      );
    })()}
    </>
  );
}
