import React, { useState, useEffect, useRef } from 'react';
import { RetroWindow, RetroButton, ShareOutcomeOverlay } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { useGlobalSync } from '../hooks/useSupabaseSync.js';
import { Search, HelpCircle, Check, X, Send, Trophy, Skull } from 'lucide-react';
import { incrementUserScore } from '../utils/userDataHelpers.js';

export function TwentyQuestions({ config, setScores, onBack, sfx, onWin, onShareToChat, profile, myName, userId, partnerId, isHost, roomId, partnerName }) {
  const isMultiplayer = !!(roomId && partnerId);
  const [syncState, setSyncState] = useGlobalSync(`twentyq_${roomId}`, null);
  
  const [localWord, setLocalWord] = useState('');
  const [questionInput, setQuestionInput] = useState('');
  const [showOverlay, setShowOverlay] = useState(false);
  const scrollRef = useRef(null);

  // Initialize state
  useEffect(() => {
    if (isMultiplayer && !syncState) {
      const setter = isHost ? userId : partnerId;
      const guesser = isHost ? partnerId : userId;
      setSyncState({
        phase: 'setup',
        secretWord: '',
        setterId: setter,
        guesserId: guesser,
        questions: [],
        winner: null,
      });
    }
  }, [isMultiplayer, isHost, syncState, userId, partnerId, setSyncState]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [syncState?.questions]);

  // Detect win/loss to show overlay
  useEffect(() => {
    if (syncState?.phase === 'finished' && !showOverlay) {
      setTimeout(() => setShowOverlay(true), 1000);
      if (syncState.winner === userId) {
        playAudio('win', sfx);
        onWin?.();
        if (setScores) setScores(prev => incrementUserScore(prev, userId, 'twentyq', 1, myName || profile?.name || 'You'));
      }
    }
  }, [syncState?.phase, syncState?.winner, userId, showOverlay, sfx, onWin, setScores, myName, profile]);

  if (!isMultiplayer) {
    return (
      <RetroWindow title="20_questions.exe" onClose={onBack} className="w-full max-w-2xl h-[calc(100dvh-4rem)] max-h-[700px]">
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <HelpCircle size={48} className="opacity-50 mb-4" />
          <h2 className="font-black text-xl uppercase mb-2">Multiplayer Only</h2>
          <p className="opacity-70">20 Questions requires a partner to play. Invite them from the arcade menu!</p>
          <RetroButton onClick={onBack} className="mt-8 px-8 py-2">Go Back</RetroButton>
        </div>
      </RetroWindow>
    );
  }

  if (!syncState) {
    return (
      <RetroWindow title="20_questions.exe" onClose={onBack} className="w-full max-w-2xl h-[calc(100dvh-4rem)] max-h-[700px]">
        <div className="flex flex-col items-center justify-center p-8 h-full">
          <Search size={48} className="animate-pulse mb-4 opacity-50"/>
          <div className="font-black text-xl uppercase animate-pulse">Initializing Database...</div>
        </div>
      </RetroWindow>
    );
  }

  const { phase, secretWord, setterId, guesserId, questions, winner } = syncState;
  const isSetter = userId === setterId;
  const isGuesser = userId === guesserId;

  const restart = () => {
    setShowOverlay(false);
    if (isHost) {
      setSyncState({
        phase: 'setup',
        secretWord: '',
        setterId: userId,
        guesserId: partnerId,
        questions: [],
        winner: null,
      });
    } else {
      setSyncState({
        phase: 'setup',
        secretWord: '',
        setterId: userId, // Swap roles!
        guesserId: partnerId,
        questions: [],
        winner: null,
      });
    }
  };

  const handleSetWord = (e) => {
    e.preventDefault();
    if (!localWord.trim()) return;
    playAudio('click', sfx);
    setSyncState({
      ...syncState,
      secretWord: localWord.trim(),
      phase: 'playing',
    });
    setLocalWord('');
  };

  const handleAsk = (e) => {
    e.preventDefault();
    if (!questionInput.trim()) return;
    if (questions.length >= 20 || questions.some(q => q.answer === null)) return; // Wait for answer
    playAudio('click', sfx);
    
    const newQuestions = [...questions, { text: questionInput.trim(), answer: null }];
    setSyncState({
      ...syncState,
      questions: newQuestions
    });
    setQuestionInput('');
  };

  const handleAnswer = (answerIndex, answer) => {
    playAudio('click', sfx);
    const newQuestions = [...questions];
    newQuestions[answerIndex].answer = answer;

    let newPhase = phase;
    let newWinner = winner;

    if (answer === 'correct') {
      newPhase = 'finished';
      newWinner = guesserId;
    } else if (newQuestions.length >= 20) {
      // 20 questions reached and this wasn't correct
      newPhase = 'finished';
      newWinner = setterId;
    }

    setSyncState({
      ...syncState,
      questions: newQuestions,
      phase: newPhase,
      winner: newWinner,
    });
  };



  return (
    <>
    <RetroWindow title="20_questions.exe" className="w-full max-w-2xl h-[calc(100dvh-4rem)] max-h-[700px] flex flex-col" onClose={onBack} confirmOnClose sfx={sfx} noPadding>
      <div className="bg-border text-window p-2 px-4 flex justify-between font-bold text-sm shrink-0">
        <span><HelpCircle size={14} className="inline mr-1"/> Questions: {questions.length} / 20</span>
        <span>Role: {isSetter ? 'Setter' : 'Guesser'}</span>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden bg-main">
        {phase === 'setup' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-300">
            {isSetter ? (
              <form onSubmit={handleSetWord} className="w-full max-w-sm flex flex-col items-center gap-6">
                <Search size={64} className="opacity-80 text-primary mb-2" />
                <div>
                  <h3 className="font-black text-2xl uppercase tracking-widest text-primary mb-2">Think of a word</h3>
                  <p className="text-sm font-bold opacity-70 mb-4">Your partner will try to guess it in 20 questions.</p>
                </div>
                <input
                  type="text"
                  value={localWord}
                  onChange={(e) => setLocalWord(e.target.value)}
                  placeholder="Enter secret word..."
                  className="w-full p-4 border-4 border-double border-border bg-window text-main-text font-black text-xl text-center focus:outline-none focus:border-primary placeholder:opacity-30 uppercase"
                  autoFocus
                  maxLength={30}
                />
                <RetroButton type="submit" variant="primary" className="w-full py-4 text-lg" disabled={!localWord.trim()}>
                  Start Game
                </RetroButton>
              </form>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <Search size={64} className="opacity-50 animate-pulse mb-2" />
                <h3 className="font-black text-xl uppercase tracking-widest opacity-80">Waiting for Partner</h3>
                <p className="text-sm font-bold opacity-60">They are choosing a secret word...</p>
              </div>
            )}
          </div>
        )}

        {phase !== 'setup' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {isSetter && (
              <div className="bg-primary/10 border-b-2 border-border p-3 text-center shrink-0">
                <span className="text-xs font-black uppercase opacity-60 mr-2">Secret Word:</span>
                <span className="font-black text-lg uppercase tracking-widest text-primary">{secretWord}</span>
              </div>
            )}
            
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {questions.map((q, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className={`flex ${isGuesser ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 border-2 border-border font-bold text-sm ${isGuesser ? 'bg-primary text-white' : 'bg-window text-main-text'}`}>
                      <span className="opacity-50 text-[10px] uppercase block mb-1">Q{i + 1}</span>
                      {q.text}
                    </div>
                  </div>
                  
                  {q.answer && (
                    <div className={`flex ${!isGuesser ? 'justify-end' : 'justify-start'}`}>
                      <div className={`px-4 py-2 border-2 border-border font-black uppercase tracking-widest text-sm flex items-center gap-2 ${
                        q.answer === 'yes' ? 'bg-[var(--color-game)] text-white' : 
                        q.answer === 'no' ? 'bg-[var(--color-destructive)] text-white' : 
                        'bg-accent text-white animate-pulse'
                      }`}>
                        {q.answer === 'yes' && <Check size={16} />}
                        {q.answer === 'no' && <X size={16} />}
                        {q.answer === 'correct' && <Trophy size={16} />}
                        {q.answer}
                      </div>
                    </div>
                  )}

                  {!q.answer && isSetter && phase === 'playing' && (
                    <div className="flex justify-end mt-2 animate-in slide-in-from-right-4">
                      <div className="flex gap-2">
                        <RetroButton variant="white" className="!bg-[var(--color-game)] !text-white px-4 py-2 text-xs" onClick={() => handleAnswer(i, 'yes')}><Check size={14} className="inline mr-1"/> Yes</RetroButton>
                        <RetroButton variant="white" className="!bg-[var(--color-destructive)] !text-white px-4 py-2 text-xs" onClick={() => handleAnswer(i, 'no')}><X size={14} className="inline mr-1"/> No</RetroButton>
                        <RetroButton variant="accent" className="px-4 py-2 text-xs" onClick={() => handleAnswer(i, 'correct')}><Trophy size={14} className="inline mr-1"/> Correct Guess</RetroButton>
                      </div>
                    </div>
                  )}
                  
                  {!q.answer && isGuesser && (
                    <div className="flex justify-start opacity-50 mt-1">
                      <span className="text-[10px] font-black uppercase animate-pulse">Waiting for answer...</span>
                    </div>
                  )}
                </div>
              ))}
              
              {phase === 'playing' && isGuesser && (questions.length === 0 || questions[questions.length - 1].answer !== null) && (
                <div className="flex justify-end opacity-50 mt-2">
                  <span className="text-xs font-black uppercase animate-pulse">Your turn to ask...</span>
                </div>
              )}
            </div>

            {phase === 'playing' && isGuesser && (questions.length === 0 || questions[questions.length - 1].answer !== null) && (
              <form onSubmit={handleAsk} className="p-4 bg-window border-t-2 border-border flex gap-2 shrink-0">
                <input
                  type="text"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  placeholder="Ask a yes/no question..."
                  className="flex-1 p-3 border-2 border-border bg-main text-main-text font-bold focus:outline-none focus:border-primary placeholder:opacity-50"
                  autoFocus
                  maxLength={100}
                />
                <RetroButton type="submit" variant="primary" className="px-6" disabled={!questionInput.trim()}>
                  <Send size={18} />
                </RetroButton>
              </form>
            )}
          </div>
        )}
      </div>
    </RetroWindow>

    {showOverlay && (() => {
      const iWon = winner === userId;
      return (
        <ShareOutcomeOverlay
          isSolo={false}
          gameName="20 Questions"
          outcome={iWon ? 'win' : 'loss'}
          stats={{
            'Secret Word': secretWord,
            'Questions Asked': questions.length,
            'Role': isSetter ? 'Setter' : 'Guesser',
            'Result': iWon ? '🏆 You Won!' : '🥈 Partner Won!'
          }}
          onClose={() => { restart(); onBack(); }}
          onRematch={restart}
          onShareToChat={onShareToChat}
          sfx={sfx}
          profile={profile}
        />
      );
    })()}
    </>
  );
}
