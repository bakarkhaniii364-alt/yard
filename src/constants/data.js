export const INITIAL_CHAT = [];

export const PICTIONARY_CATEGORIES = {
  Animals: ['CAT', 'DOG', 'ELEPHANT', 'FISH', 'BIRD', 'SNAKE', 'RABBIT', 'MOUSE', 'KANGAROO', 'DOLPHIN'],
  General: ['CUP', 'HOUSE', 'CAR', 'CLOCK', 'COMPUTER', 'KEYBOARD', 'CHAIR', 'PHONE', 'MOUNTAIN', 'BICYCLE', 'PYRAMID', 'ASTRONAUT'],
  Movies: ['TITANIC', 'AVATAR', 'SPIDERMAN', 'BATMAN', 'SUPERMAN', 'INCEPTION', 'MATRIX', 'JAWS', 'SHREK', 'ROCKY'],
  Food: ['PIZZA', 'BURGER', 'SUSHI', 'TACO', 'APPLE', 'BANANA', 'ICE CREAM', 'CHOCOLATE', 'PANCAKE', 'SPAGHETTI']
};

export const WORDS_FALLBACK = { easy: ["LOVE", "CUTE", "HUGS"], medium: ["SWEET", "HEART", "SMILE"], hard: ["CARING", "LOVING", "GENTLE"] };
export const MEMORY_EMOJIS = { easy: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼'], medium: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐯','🦁'], hard: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐯','🦁','🐮','🐷'] };
export const INITIAL_CHESS_BOARD = [ 'bR','bN','bB','bQ','bK','bB','bN','bR', 'bP','bP','bP','bP','bP','bP','bP','bP', ...Array(32).fill(null), 'wP','wP','wP','wP','wP','wP','wP','wP', 'wR','wN','wB','wQ','wK','wB','wN','wR' ];
export const CHESS_PIECE_MAP = { 'wK': '♔', 'wQ': '♕', 'wR': '♖', 'wB': '♗', 'wN': '♘', 'wP': '♙', 'bK': '♚', 'bQ': '♛', 'bR': '♜', 'bB': '♝', 'bN': '♞', 'bP': '♟' };
