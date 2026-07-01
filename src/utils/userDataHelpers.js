/**
 * User-specific data structure for personalized tracking
 * Each user has their own scores, streaks, achievements
 */

export const initializeUserScores = (userId) => ({
  [userId]: {
    tictactoe: 0,
    pictionary: 0,
    memory: 0,
    wordle: 0,
    sudoku: 0,
    chess: 0,
    typing: 0,
    couples_quiz: 0,
  }
});

export const initializeUserStreaks = (userId) => ({
  [userId]: {
    lastActiveDate: null,
    currentStreak: 0,
    longestStreak: 0,
  }
});

export const getScoreForUser = (scores, userId, game) => {
  return scores?.[userId]?.[game] || 0;
};

export const getTotalScoreForUser = (scores, userId) => {
  if (!scores?.[userId]) return 0;
  return Object.values(scores[userId]).reduce((sum, val) => sum + (val || 0), 0);
};

export const incrementUserScore = (scores, userId, game, amount = 1, playerName = 'Player') => {
  if (!userId || !game) return scores;
  
  // Strict Validation: ensure score is numeric and non-negative
  const validatedAmount = Number.isNaN(Number(amount)) ? 0 : Math.max(0, Number(amount));
  if (validatedAmount === 0) return scores;

  const currentScore = (scores?.[userId]?.[game] || 0);
  const newScore = currentScore + validatedAmount;
  
  try {
      submitHighscore(game, 'arcade', newScore, playerName, userId);
  } catch(e) {}

  return {
    ...scores,
    [userId]: {
      ...(scores?.[userId] || {}),
      [game]: newScore,
    }
  };
};

export const getStreakForUser = (streaks, userId) => {
  return streaks?.[userId] || { lastActiveDate: null, currentStreak: 0, longestStreak: 0 };
};

export const updateUserStreak = (streaks, userId, today) => {
  if (!userId) return streaks;
  const userStreak = getStreakForUser(streaks, userId);
  
  // Use YYYY-MM-DD for consistent UTC comparisons
  const todayDateStr = new Date(today).toISOString().split('T')[0];
  const lastActiveStr = userStreak.lastActiveDate ? new Date(userStreak.lastActiveDate).toISOString().split('T')[0] : null;

  if (todayDateStr === lastActiveStr) return streaks; // Already updated today

  let newStreak = userStreak.currentStreak;
  
  if (lastActiveStr) {
    const lastActive = new Date(lastActiveStr);
    const current = new Date(todayDateStr);
    const diffDays = Math.round((current - lastActive) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      newStreak += 1;
    } else if (diffDays > 1) {
      newStreak = 1;
    }
  } else {
    newStreak = 1;
  }
  
  return {
    ...streaks,
    [userId]: {
      ...userStreak,
      lastActiveDate: todayDateStr,
      currentStreak: newStreak,
      longestStreak: Math.max(userStreak.longestStreak || 0, newStreak),
    }
  };
};

/**
 * Check if both users were active today (for joint streak)
 */
export const getBothUsersActive = (streaks, userId, partnerId) => {
  const userStreak = getStreakForUser(streaks, userId);
  const partnerStreak = getStreakForUser(streaks, partnerId);
  
  const today = new Date().toDateString();
  const userActive = userStreak.lastActiveDate === today;
  const partnerActive = partnerStreak.lastActiveDate === today;
  
  return { userActive, partnerActive, bothActive: userActive && partnerActive };
};

export const submitHighscore = async (gameId, mode, score, playerName, userId, roomId = null) => {
  let resolvedRoomId = roomId;
  try {
    const { supabase } = await import('../lib/supabase.js');
    if (!resolvedRoomId) {
      const { data: room } = await supabase.rpc('get_my_room');
      resolvedRoomId = room?.id;
    }
    if (!resolvedRoomId) return;

    const localObj = {
      id: `local-${Date.now()}-${Math.random()}`,
      room_id: resolvedRoomId,
      user_id: userId,
      player_name: playerName || 'Player',
      game_id: gameId,
      mode: mode,
      score: score,
      created_at: new Date().toISOString(),
    };
    try {
      const cached = JSON.parse(localStorage.getItem('yard_local_highscores') || '[]');
      cached.push(localObj);
      localStorage.setItem('yard_local_highscores', JSON.stringify(cached.slice(-500)));
    } catch {
      /* ignore */
    }

    await supabase.from('highscores').insert([{
      room_id: resolvedRoomId,
      user_id: userId,
      player_name: playerName || 'Player',
      game_id: gameId,
      mode: mode,
      score: score,
    }]);
  } catch (e) {
    console.error('Failed to submit highscore', e);
  }
};
