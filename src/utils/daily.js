import { DAILY_WORDS_4, DAILY_WORDS_5, DAILY_WORDS_6, DAILY_QUESTIONS } from '../constants/dailyData.js';

export function getDailySeed() {
    // Fixed epoch: Jan 1, 2024 (UTC)
    const epoch = Date.UTC(2024, 0, 1);
    const now = Date.now();
    return Math.floor((now - epoch) / (1000 * 60 * 60 * 24));
}

export function getDailyWord(difficulty) {
    const seed = getDailySeed();
    if (difficulty === 'easy') {
        return DAILY_WORDS_4[seed % DAILY_WORDS_4.length];
    } else if (difficulty === 'medium') {
        return DAILY_WORDS_5[seed % DAILY_WORDS_5.length];
    } else {
        return DAILY_WORDS_6[seed % DAILY_WORDS_6.length];
    }
}

export function getDailyQuizQuestions(category) {
    const seed = getDailySeed();
    const questions = DAILY_QUESTIONS[category] || DAILY_QUESTIONS['random'];
    const count = 5;
    
    // We want a sequence of 5 questions that doesn't overlap immediately
    const totalQ = questions.length;
    const startIndex = (seed * count) % totalQ;
    
    let result = [];
    for (let i = 0; i < count; i++) {
        result.push(questions[(startIndex + i) % totalQ]);
    }
    return result;
}
