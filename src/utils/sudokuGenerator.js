// src/utils/sudokuGenerator.js

/**
 * Validates if a number can be placed at board[r][c]
 */
function isValid(board, r, c, num) {
    for (let i = 0; i < 9; i++) {
        if (board[r][i] === num && i !== c) return false;
        if (board[i][c] === num && i !== r) return false;
    }
    const startR = Math.floor(r / 3) * 3;
    const startC = Math.floor(c / 3) * 3;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (board[startR + i][startC + j] === num && (startR + i !== r || startC + j !== c)) return false;
        }
    }
    return true;
}

/**
 * Solves the board and returns true if solvable.
 * Used for generating a full board.
 */
function solveBoard(board, maxIterations = 5000) {
    let iterations = 0;
    
    function solve(b) {
        iterations++;
        if (iterations > maxIterations) return false;
        
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (b[r][c] === 0) {
                    const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
                    for (let num of nums) {
                        if (isValid(b, r, c, num)) {
                            b[r][c] = num;
                            if (solve(b)) return true;
                            b[r][c] = 0;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    }
    
    return solve(board);
}

/**
 * Counts the number of solutions to ensure uniqueness.
 */
function countSolutions(board, limit = 2, maxIterations = 2000) {
    let count = 0;
    let iterations = 0;
    
    function solve() {
        iterations++;
        if (iterations > maxIterations || count >= limit) return;

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c] === 0) {
                    for (let num = 1; num <= 9; num++) {
                        if (isValid(board, r, c, num)) {
                            board[r][c] = num;
                            solve();
                            board[r][c] = 0;
                            if (count >= limit || iterations > maxIterations) return;
                        }
                    }
                    return;
                }
            }
        }
        count++;
    }
    
    solve();
    return count;
}

/**
 * Generates a uniquely solvable Sudoku board.
 * Returns { puzzle, solution } where both are 2D arrays.
 * 0 represents an empty cell.
 */
export function generateSudoku(difficulty = 'easy') {
    // 1. Create empty board
    const board = Array(9).fill(0).map(() => Array(9).fill(0));
    
    // 2. Fill diagonal 3x3 boxes (independent)
    for (let i = 0; i < 9; i = i + 3) {
        const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
        let idx = 0;
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                board[i + r][i + c] = nums[idx++];
            }
        }
    }
    
    // 3. Solve the rest of the board to get a full valid grid
    solveBoard(board);
    
    // 4. Save the full solution
    const solution = board.map(row => [...row]);
    
    // 5. Remove cells while ensuring unique solution
    const attempts = difficulty === 'easy' ? 35 : difficulty === 'medium' ? 45 : 55;
    
    // Get all coordinates and shuffle them
    const coords = [];
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) coords.push([r, c]);
    }
    coords.sort(() => Math.random() - 0.5);
    
    let removed = 0;
    for (const [r, c] of coords) {
        if (removed >= attempts) break;
        
        const backup = board[r][c];
        board[r][c] = 0;
        
        // Check if removing this cell results in multiple solutions
        // To keep it performant, we only check up to 2 solutions.
        if (countSolutions(board, 2) !== 1) {
            // Revert if it breaks uniqueness
            board[r][c] = backup;
        } else {
            removed++;
        }
    }
    
    return { puzzle: board, solution };
}
