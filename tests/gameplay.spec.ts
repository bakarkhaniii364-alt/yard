import { test, expect, Page } from '@playwright/test';
import { loginAsTestUser } from './utils';

test.describe('Arcade Gameplay Synchronization Suite', () => {

  test('Pictionary: Full Draw and Guess Cycle', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    const testId = Math.random().toString(36).substring(2, 7);
    await loginAsTestUser(pageA, `userA_${testId}`);
    await loginAsTestUser(pageB, `userB_${testId}`);
    
    // Ensure dashboard is ready
    await expect(pageA.getByTestId('app-icon-arcade')).toBeVisible({ timeout: 30000 });
    await pageA.waitForTimeout(3000);

    // Step 1: User A invites User B to Pictionary
    console.log("User A opening games catalog...");
    await pageA.getByTestId('app-icon-arcade').click().catch(() => pageA.goto(`http://localhost:5173/arcade?test_mode=true&user=userA_${testId}`));
    
    console.log("Waiting for Hub to load...");
    await expect(pageA.getByText(/activities_hub\.exe/i)).toBeVisible({ timeout: 20000 });
    
    console.log("User A selecting Pictionary...");
    await pageA.locator('button').filter({ hasText: /Pictionary/i }).first().click();
    
    console.log("User A configuring multiplayer...");
    await expect(pageA.getByRole('button', { name: /With Partner/i })).toBeVisible({ timeout: 15000 });
    await pageA.getByRole('button', { name: /With Partner/i }).click();
    
    await expect(pageA.getByRole('button', { name: /Proceed to Lobby/i })).toBeVisible({ timeout: 10000 });
    await pageA.getByRole('button', { name: /Proceed to Lobby/i }).click();
    
    // Step 2: User B accepts
    console.log("Waiting for User B to receive invite...");
    await expect(pageB.getByRole('heading', { name: /invited you/i })).toBeVisible({ timeout: 40000 });
    
    // Look for Accept button in the Global Invite Modal
    const acceptBtn = pageB.getByRole('button', { name: /Accept & Join/i });
    if (await acceptBtn.isVisible()) {
        await acceptBtn.click();
    } else {
        // Try clicking the game directly if invite missed
        await pageB.goto(`http://localhost:5173/arcade/pictionary?test_mode=true&user=userB_${testId}`);
    }
    
    // User B joins lobby
    console.log("User B joining lobby...");
    const joinBtn = pageB.getByRole('button', { name: /Join/i }).first();
    await expect(joinBtn).toBeVisible({ timeout: 20000 });
    await joinBtn.click();
    
    // Step 3: User A starts the game
    console.log("User A starting game...");
    const startGameBtn = pageA.getByRole('button', { name: /START GAME/i });
    await expect(startGameBtn).toBeVisible({ timeout: 30000 });
    await startGameBtn.click();
    
    // Step 4: User A starts the round
    console.log("User A starting round...");
    const startRoundBtn = pageA.getByRole('button', { name: /Start Round/i });
    await expect(startRoundBtn).toBeVisible({ timeout: 30000 });
    await startRoundBtn.click();
    
    // Step 5: User A draws on the canvas
    console.log("User A drawing...");
    const canvas = pageA.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 20000 });
    const box = await canvas.boundingBox();
    if (box) {
        await pageA.mouse.move(box.x + box.width / 4, box.y + box.height / 4);
        await pageA.mouse.down();
        await pageA.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
        await pageA.mouse.up();
    }
    
    // Step 6: User A hands over to guesser
    console.log("User A extracting secret word...");
    await pageA.waitForTimeout(3000);
    const wordContainer = pageA.locator('div.text-2xl.font-black.tracking-widest').first();
    await expect(wordContainer).toBeVisible({ timeout: 15000 });
    const word = (await wordContainer.innerText()).trim();
    console.log(`The secret word is: ${word}`);
    
    await pageA.getByRole('button', { name: /Hand to Guesser/i }).click();
    
    // Step 7: User B guesses
    console.log("User B guessing...");
    await expect(pageB.getByPlaceholder(/Type your guess here/i)).toBeVisible({ timeout: 25000 });
    await pageB.getByPlaceholder(/Type your guess here/i).fill(word);
    await pageB.keyboard.press('Enter');
    
    // Step 8: Verify Victory
    await expect(pageA.getByText(/Victory!|Outcome|Result/i)).toBeVisible({ timeout: 30000 });
    await expect(pageB.getByText(/Victory!|Outcome|Result/i)).toBeVisible({ timeout: 30000 });
    console.log("Pictionary cycle completed successfully.");
  });

  test('Uno: Card Playing Synchronization', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    const testId = Math.random().toString(36).substring(2, 7);
    await loginAsTestUser(pageA, `userA_${testId}`);
    await loginAsTestUser(pageB, `userB_${testId}`);
    
    // Ensure dashboard is ready
    await expect(pageA.getByTestId('app-icon-arcade')).toBeVisible({ timeout: 30000 });
    await pageA.waitForTimeout(3000);

    // Step 1: User A invites User B to Uno
    console.log("User A opening games catalog...");
    await pageA.getByTestId('app-icon-arcade').click().catch(() => pageA.goto(`http://localhost:5173/arcade?test_mode=true&user=userA_${testId}`));

    console.log("Waiting for Hub to load...");
    await expect(pageA.getByText(/activities_hub\.exe/i)).toBeVisible({ timeout: 20000 });

    console.log("User A selecting Uno...");
    await pageA.locator('button').filter({ hasText: /Uno/i }).first().click();
    
    console.log("User A configuring multiplayer...");
    await expect(pageA.getByRole('button', { name: /With Partner/i })).toBeVisible({ timeout: 15000 });
    await pageA.getByRole('button', { name: /With Partner/i }).click();
    
    await expect(pageA.getByRole('button', { name: /Proceed to Lobby/i })).toBeVisible({ timeout: 10000 });
    await pageA.getByRole('button', { name: /Proceed to Lobby/i }).click();
    
    // Step 2: User B accepts
    console.log("Waiting for User B to receive invite...");
    await expect(pageB.getByRole('heading', { name: /invited you/i })).toBeVisible({ timeout: 40000 });
    
    const acceptBtn = pageB.getByRole('button', { name: /Accept & Join/i });
    if (await acceptBtn.isVisible()) {
        await acceptBtn.click();
    } else {
        await pageB.goto(`http://localhost:5173/arcade/uno?test_mode=true&user=userB_${testId}`);
    }
    
    // User B joins lobby
    console.log("User B joining lobby...");
    const joinBtn = pageB.getByRole('button', { name: /Join/i }).first();
    await expect(joinBtn).toBeVisible({ timeout: 20000 });
    await joinBtn.click();
    
    // Step 3: User A starts the game
    console.log("User A starting game...");
    const startGameBtn = pageA.getByRole('button', { name: /START GAME/i });
    await expect(startGameBtn).toBeVisible({ timeout: 30000 });
    await startGameBtn.click();
    
    // Step 4: Wait for game initialization
    console.log("Waiting for Uno to initialize...");
    await expect(pageA.getByText(/Your Turn|Partner's Turn/i)).toBeVisible({ timeout: 60000 });
    
    // Step 5: Perform 3 turns
    for (let i = 0; i < 3; i++) {
        await pageA.waitForTimeout(5000); // Wait for state sync and animations
        
        const isTurnA = await pageA.getByText(/Your Turn/i).isVisible();
        const activePage = isTurnA ? pageA : pageB;
        const inactivePage = isTurnA ? pageB : pageA;
        const userName = isTurnA ? "User A" : "User B";
        
        console.log(`Turn ${i+1}: It is ${userName}'s turn.`);
        
        // Find a playable card
        const playableCards = activePage.locator('div.group').filter({ hasNot: activePage.locator('.opacity-70') });
        
        if (await playableCards.count() > 0) {
            await playableCards.first().click();
            console.log(`${userName} played a card.`);
        } else {
            console.log(`${userName} has no playable cards, drawing...`);
            const drawBtn = activePage.locator('button, div').filter({ hasText: /^DRAW$/i }).first();
            await drawBtn.click();
        }
        
        // Wait for turn to switch
        await expect(inactivePage.getByText(/Your Turn/i)).toBeVisible({ timeout: 40000 });
    }
    console.log("Uno synchronization verified.");
  });

});
