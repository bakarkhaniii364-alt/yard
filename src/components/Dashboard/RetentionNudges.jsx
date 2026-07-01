import React from 'react';
import { MessageSquare, Sparkles, Flame } from 'lucide-react';
import { RetroButton } from '../UI.jsx';

const todayKey = () => new Date().toLocaleDateString('en-CA');

/**
 * Gentle prompts that bring couples back — daily question, unread chat, streak pride.
 */
export function RetentionNudges({
  streakCount = 0,
  unreadChatCount = 0,
  dailyAnswers = {},
  userId,
  partnerName = 'your partner',
  onOpenChat,
  onOpenDailyQuestion,
  excludeDaily = false,
}) {
  const today = todayKey();
  const myDailyDone = !!dailyAnswers?.[today]?.[userId];
  const nudges = [];

  if (streakCount >= 3) {
    nudges.push({
      id: 'streak',
      icon: <Flame size={16} className="text-orange-500" />,
      text: `${streakCount}-day streak — keep showing up for ${partnerName}.`,
      action: null,
    });
  }

  if (!myDailyDone && !excludeDaily) {
    nudges.push({
      id: 'daily',
      icon: <Sparkles size={16} className="text-primary" />,
      text: "Today's couple question is waiting — answer together.",
      action: { label: 'Answer', onClick: onOpenDailyQuestion },
    });
  }

  if (unreadChatCount > 0) {
    nudges.push({
      id: 'chat',
      icon: <MessageSquare size={16} className="text-primary" />,
      text:
        unreadChatCount === 1
          ? `${partnerName} sent you a message.`
          : `${unreadChatCount} messages from ${partnerName}.`,
      action: { label: 'Open chat', onClick: onOpenChat },
    });
  }

  if (nudges.length === 0) return null;

  return (
    <section
      className="mb-4 space-y-2"
      aria-label="Suggestions for you"
    >
      {nudges.map((n) => (
        <div
          key={n.id}
          className="flex flex-wrap items-center justify-between gap-2 p-3 retro-border bg-accent/15 text-sm"
        >
          <div className="flex items-center gap-2 font-bold min-w-0">
            {n.icon}
            <span className="truncate">{n.text}</span>
          </div>
          {n.action && (
            <RetroButton
              type="button"
              className="text-[10px] py-1 px-3 shrink-0"
              onClick={n.action.onClick}
            >
              {n.action.label}
            </RetroButton>
          )}
        </div>
      ))}
    </section>
  );
}

/**
 * Shown when someone returns after 24h+ away.
 */
export function WelcomeBackBanner({ partnerName = 'your partner', daysAway = 1, onDismiss }) {
  return (
    <div
      className="mb-4 p-4 retro-border bg-primary/10 flex flex-wrap items-center justify-between gap-3"
      role="status"
      aria-live="polite"
    >
      <p className="font-bold text-sm">
        Welcome back! {partnerName} missed you
        {daysAway > 1 ? ` (${daysAway} days)` : ''}.
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="text-[10px] font-black uppercase opacity-60 hover:opacity-100"
        aria-label="Dismiss welcome message"
      >
        Dismiss
      </button>
    </div>
  );
}

export function recordVisit() {
  try {
    const now = Date.now();
    const prev = Number(localStorage.getItem('yard_last_visit_ts') || 0);
    localStorage.setItem('yard_last_visit_ts', String(now));
    return prev;
  } catch {
    return 0;
  }
}

export function getDaysSinceLastVisit(prevTs) {
  if (!prevTs) return 0;
  return Math.floor((Date.now() - prevTs) / (1000 * 60 * 60 * 24));
}
