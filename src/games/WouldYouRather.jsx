import React, { useState, useEffect } from 'react';
import { RetroWindow, RetroButton, ShareOutcomeOverlay } from '../components/UI.jsx';
import { playAudio } from '../utils/audio.js';
import { useGlobalSync } from '../hooks/useSupabaseSync.js';
import { Heart } from 'lucide-react';

const QUESTIONS = [
  { q: "Would you rather have a picnic on the beach or a candlelit dinner at home?", a: "🏖️ Beach Picnic", b: "🕯️ Dinner at Home" },
  { q: "Would you rather receive a handwritten letter or a surprise gift?", a: "💌 Letter", b: "🎁 Gift" },
  { q: "Would you rather travel the world together or build your dream home?", a: "✈️ Travel", b: "🏡 Dream Home" },
  { q: "Would you rather have breakfast in bed or sunset cocktails?", a: "🥞 Breakfast", b: "🍹 Sunset" },
  { q: "Would you rather stargaze or dance in the rain?", a: "⭐ Stargaze", b: "🌧️ Dance" },
  { q: "Would you rather cook together or order takeout?", a: "👨‍🍳 Cook", b: "📦 Takeout" },
  { q: "Would you rather have matching tattoos or matching outfits?", a: "🎨 Tattoos", b: "👗 Outfits" },
  { q: "Would you rather go on a road trip or a cruise?", a: "🚗 Road Trip", b: "🚢 Cruise" },
  { q: "Would you rather share one dessert or have your own?", a: "🍰 Share", b: "🧁 Own" },
  { q: "Would you rather watch sunrise or sunset?", a: "🌅 Sunrise", b: "🌇 Sunset" },
  { q: "Would you rather have a pet cat or a pet dog together?", a: "🐱 Cat", b: "🐶 Dog" },
  { q: "Would you rather re-live your first date or plan your dream date?", a: "🔄 First Date", b: "💭 Dream Date" },
  { q: "Would you rather slow dance or have a pillow fight?", a: "💃 Slow Dance", b: "🛏️ Pillow Fight" },
  { q: "Would you rather live by the mountains or by the ocean?", a: "⛰️ Mountains", b: "🌊 Ocean" },
  { q: "Would you rather give up coffee or give up sweets?", a: "☕ Coffee", b: "🍬 Sweets" },
];

export function WouldYouRather({ config, onBack, sfx, onShareToChat, profile, userId, partnerId, isHost, roomId, partnerName }) {
  const isMultiplayer = !!(roomId && partnerId);

  // Shared state: current question index + both answers (null until chosen)
  const [syncState, setSyncState] = useGlobalSync(`wyr_${roomId}`, null);
  const [myChoice, setMyChoice] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [matchCount, setMatchCount] = useState(0);

  // Initialize
  useEffect(() => {
    if (isMultiplayer && isHost && !syncState) {
      setSyncState({
        idx: 0,
        answers: { [userId]: null, [partnerId]: null },
        matches: 0,
        total: QUESTIONS.length
      });
    }
  }, [isMultiplayer, isHost, syncState, userId, partnerId]);

  // Reset my local choice on question change
  useEffect(() => {
    setMyChoice(null);
    setShowResult(false);
  }, [syncState?.idx]);

  // Detect both answered
  useEffect(() => {
    if (!syncState) return;
    const myA = syncState.answers?.[userId];
    const theirA = syncState.answers?.[partnerId];
    if (myA && theirA) setShowResult(true);
  }, [syncState?.answers, userId, partnerId]);

  if (!isMultiplayer) {
    // Minimal solo mode
    const [idx, setIdx] = useState(0);
    const [myAnswers, setMyAnswers] = useState([]);
    const [theirAnswers] = useState(() => QUESTIONS.map(() => Math.random() > 0.5 ? 'a' : 'b'));
    const [solo_showResult, setSoloShowResult] = useState(false);
    const current = QUESTIONS[idx];
    const myAnswer = myAnswers[idx];
    const matchPct = myAnswers.length > 0 ? Math.round((myAnswers.filter((a, i) => a === theirAnswers[i]).length / myAnswers.length) * 100) : 0;


    const answer = (choice) => { playAudio('click', sfx); const next = [...myAnswers, choice]; setMyAnswers(next); setSoloShowResult(true); };
    const next = () => { playAudio('click', sfx); setSoloShowResult(false); if (idx + 1 >= QUESTIONS.length) { setShowOverlay(true); return; } setIdx(idx + 1); };
    return (
      <>
      <RetroWindow title="would_you_rather.exe" className="w-full max-w-xl h-[calc(100dvh-4rem)] max-h-[700px]" onClose={onBack} confirmOnClose sfx={sfx} noPadding>
        <div className="bg-border text-window p-2 px-4 flex justify-between font-bold text-sm"><span>Q {idx + 1}/{QUESTIONS.length}</span><span className="flex items-center gap-1"><Heart size={14}/> {matchPct}% match</span></div>
        <div className="w-full h-2 bg-main"><div className="h-full bg-primary transition-all" style={{ width: `${((idx + 1) / QUESTIONS.length) * 100}%` }}></div></div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
          <h2 className="text-lg sm:text-xl font-bold text-center leading-relaxed">{current.q}</h2>
          {!solo_showResult ? (
            <div className="flex flex-col gap-3 w-full">
              <RetroButton onClick={() => answer('a')} className="py-4 text-base w-full">{current.a}</RetroButton>
              <RetroButton variant="secondary" onClick={() => answer('b')} className="py-4 text-base w-full">{current.b}</RetroButton>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 w-full animate-in fade-in duration-300">
              <div className={`text-2xl font-bold ${myAnswer === theirAnswers[idx] ? 'text-primary' : 'text-secondary'}`}>{myAnswer === theirAnswers[idx] ? '💕 Match!' : '🌶️ Different!'}</div>
              <p className="text-sm opacity-60">Partner chose: {theirAnswers[idx] === 'a' ? current.a : current.b}</p>
              <RetroButton onClick={next} className="px-8 py-3">{idx + 1 >= QUESTIONS.length ? 'See Results' : 'Next →'}</RetroButton>
            </div>
          )}
        </div>
      </RetroWindow>
      {showOverlay && <ShareOutcomeOverlay isSolo gameName="Would You Rather" stats={{ Questions: QUESTIONS.length, 'Match %': `${matchPct}%` }} onClose={onBack} onShareToChat={onShareToChat} sfx={sfx} />}
      </>
    );
  }

  // --- Multiplayer mode ---

  if (!syncState) {
    return (
      <div className="flex flex-col items-center justify-center p-8 h-full">
        <Heart size={48} className="text-[#ffb6b9] animate-pulse mb-4"/>
        <div className="font-black text-xl uppercase animate-pulse">Loading game...</div>
      </div>
    );
  }

  const { idx, answers, matches, total } = syncState;
  const current = QUESTIONS[idx];
  const myAnswer = answers?.[userId];
  const theirAnswer = answers?.[partnerId];
  const bothAnswered = !!(myAnswer && theirAnswer);
  const isMatch = bothAnswered && myAnswer === theirAnswer;
  const progress = ((idx) / total) * 100;

  const choose = (choice) => {
    if (myAnswer || myChoice) return;
    playAudio('click', sfx);
    setMyChoice(choice);
    setSyncState({
      ...syncState,
      answers: { ...answers, [userId]: choice }
    });
  };

  const next = () => {
    playAudio('click', sfx);
    const newMatches = (matches || 0) + (isMatch ? 1 : 0);
    const newIdx = idx + 1;
    if (newIdx >= total) {
      setSyncState({ ...syncState, answers: { [userId]: null, [partnerId]: null }, matches: newMatches, idx: newIdx, phase: 'done' });
      setShowOverlay(true);
    } else {
      setSyncState({ ...syncState, idx: newIdx, answers: { [userId]: null, [partnerId]: null }, matches: newMatches });
    }
  };



  return (
    <>
    <RetroWindow title="wyr_live.exe" className="w-full max-w-xl h-[calc(100dvh-4rem)] max-h-[700px]" onClose={onBack} confirmOnClose sfx={sfx} noPadding>
      <div className="bg-border text-window p-2 px-4 flex justify-between font-bold text-sm">
        <span>Q {idx + 1}/{total}</span>
        <span className="flex items-center gap-1"><Heart size={14}/> {syncState.matches || 0} matches</span>
      </div>
      <div className="w-full h-2 bg-main"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }}></div></div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        <h2 className="text-lg sm:text-xl font-bold text-center leading-relaxed">{current?.q}</h2>

        {!showResult ? (
          <div className="flex flex-col gap-3 w-full">
            <RetroButton
              onClick={() => choose('a')}
              disabled={!!myAnswer}
              className={`py-4 text-base w-full ${myAnswer === 'a' ? 'ring-4 ring-primary' : ''}`}
            >
              {current?.a}
            </RetroButton>
            <RetroButton
              variant="secondary"
              onClick={() => choose('b')}
              disabled={!!myAnswer}
              className={`py-4 text-base w-full ${myAnswer === 'b' ? 'ring-4 ring-secondary' : ''}`}
            >
              {current?.b}
            </RetroButton>

            <div className="flex justify-between text-xs font-bold opacity-60 px-2">
              <span className={myAnswer ? 'text-green-600' : ''}>You: {myAnswer ? '✓ Chosen' : '⏳ Choose...'}</span>
              <span className={theirAnswer ? 'text-green-600' : ''}>Partner: {theirAnswer ? '✓ Chosen' : '⏳ Waiting...'}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 w-full animate-in fade-in duration-300">
            <div className={`text-3xl font-bold ${isMatch ? 'text-primary' : 'text-secondary'}`}>
              {isMatch ? '💕 Match!' : '🌶️ Different!'}
            </div>
            <div className="flex gap-4 w-full justify-center">
              <div className="flex-1 bg-window retro-border p-3 text-center relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full">You</div>
                <div className="mt-3 font-bold">{myAnswer === 'a' ? current?.a : current?.b}</div>
              </div>
              <div className="flex-1 bg-window retro-border p-3 text-center relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-secondary text-white text-xs font-bold px-2 py-0.5 rounded-full">Partner</div>
                <div className="mt-3 font-bold">{theirAnswer === 'a' ? current?.a : current?.b}</div>
              </div>
            </div>
            {isHost ? (
              <RetroButton onClick={next} className="px-8 py-3">
                {idx + 1 >= total ? 'See Results' : 'Next →'}
              </RetroButton>
            ) : (
              <div className="text-sm opacity-60 font-bold animate-pulse">Waiting for next question...</div>
            )}
          </div>
        )}
      </div>
    </RetroWindow>
    {(showOverlay || syncState?.phase === 'done') && (() => {
      const finalMatches = syncState.matches || 0;
      const pct = Math.round((finalMatches / total) * 100);
      return (
        <ShareOutcomeOverlay
          gameName="Would You Rather"
          stats={{ Questions: total, Matches: finalMatches, 'Match %': `${pct}%`, Verdict: pct > 70 ? '💕 Perfect Match!' : pct > 40 ? '💛 Good Match' : '🌶️ Opposites Attract!' }}
          onClose={() => { setSyncState(null); onBack(); }}
          onRematch={() => { setSyncState(null); setShowOverlay(false); }}
          onShareToChat={onShareToChat}
          sfx={sfx}
        />
      );
    })()}
    </>
  );
}
