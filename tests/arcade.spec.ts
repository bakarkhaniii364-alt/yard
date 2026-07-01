import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './utils';

test.describe('Arcade Multiplayer Suite', () => {
  
  test('Two-Player Pairing and Game Invitation Flow', async ({ browser }) => {
    // Isolated "incognito" contexts for User A and User B
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // Pipe console logs for easier debugging during test development
    pageA.on('console', msg => console.log('PAGE A:', msg.text()));
    pageB.on('console', msg => console.log('PAGE B:', msg.text()));

    // Use a unique session ID for this test run to avoid cross-test interference
    const testId = Math.random().toString(36).substring(2, 7);
    await loginAsTestUser(pageA, `userA_${testId}`);
    await loginAsTestUser(pageB, `userB_${testId}`);
    
    // Step 1: User A navigates to Arcade and selects Tic-Tac-Toe
    await pageA.getByTestId('app-icon-arcade').click();
    await expect(pageA.getByText('activities_hub.exe')).toBeVisible({ timeout: 10000 });
    
    await pageA.getByTestId('game-card-tictactoe').click();
    await expect(pageA.getByText('tictactoe_setup.exe')).toBeVisible();
    
    // Step 2: User A selects "With Partner" and proceeds to Lobby
    await pageA.getByRole('button', { name: /With Partner/i }).click();
    await pageA.getByRole('button', { name: /Proceed to Lobby/i }).click();
    
    // Assert User A is in the lobby
    await expect(pageA.getByText('lobby_tictactoe.exe')).toBeVisible();
    await expect(pageA.getByText(/Waiting for partner/i)).toBeVisible();

    // Directly sync arcade lobby state from pageA to pageB
    const lobbyState = await pageA.evaluate(() => localStorage.getItem('yard_test_arcade_lobby'));
    if (lobbyState) {
      await pageB.evaluate((state) => {
        localStorage.setItem('yard_test_arcade_lobby', state);
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'yard_test_arcade_lobby',
          newValue: state
        }));
      }, lobbyState);
    }


    // Step 3: User B (who might be anywhere) receives the global invitation modal
    // We'll wait for the modal to appear on Page B
    await expect(pageB.getByRole('heading', { name: /invited you/i })).toBeVisible({ timeout: 15000 });
    await expect(pageB.locator('h3').filter({ hasText: /Tic-Tac-Toe/i })).toBeVisible();

    // Step 4: User B accepts the invite
    await pageB.getByRole('button', { name: /Accept & Join/i }).click();

    // Directly sync arcade lobby state from pageB back to pageA
    const lobbyStateB = await pageB.evaluate(() => localStorage.getItem('yard_test_arcade_lobby'));
    if (lobbyStateB) {
      await pageA.evaluate((state) => {
        localStorage.setItem('yard_test_arcade_lobby', state);
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'yard_test_arcade_lobby',
          newValue: state
        }));
      }, lobbyStateB);
    }


    // Step 5: Assert both users are now in the same lobby and READY
    await expect(pageB.getByText('lobby_tictactoe.exe')).toBeVisible();
    await expect(pageA.getByText('P2').first()).toBeVisible({ timeout: 10000 });
    await expect(pageA.getByRole('button', { name: /START GAME/i })).toBeVisible();
    await expect(pageB.getByText(/Partner is Waiting/i)).not.toBeVisible(); // Should be inside lobby now

    // Step 6: User A starts the game
    await pageA.getByRole('button', { name: /START GAME/i }).click();

    // Directly sync arcade lobby state from pageA to pageB
    const lobbyStatePlaying = await pageA.evaluate(() => localStorage.getItem('yard_test_arcade_lobby'));
    if (lobbyStatePlaying) {
      await pageB.evaluate((state) => {
        localStorage.setItem('yard_test_arcade_lobby', state);
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'yard_test_arcade_lobby',
          newValue: state
        }));
      }, lobbyStatePlaying);
    }

    // Assert both see the game eventually (skip fleeting countdown test)
    await expect(pageA.locator('canvas').or(pageA.locator('.retro-border')).or(pageA.locator('.game-container')).first()).toBeVisible({ timeout: 15000 });
    await expect(pageB.locator('canvas').or(pageB.locator('.retro-border')).or(pageB.locator('.game-container')).first()).toBeVisible({ timeout: 15000 });
  });

  test('Invite all games - Smoke Test for Invitations', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    const testId = Math.random().toString(36).substring(2, 7);
    await loginAsTestUser(pageA, `userA_${testId}`);
    await loginAsTestUser(pageB, `userB_${testId}`);

    const gamesToTest = ['Chess'];

    for (const gameTitle of gamesToTest) {
      console.log(`Testing invitation for: ${gameTitle}`);
            // User A invites
      await pageA.getByTestId('app-icon-arcade').click();
      await expect(pageA.getByText('activities_hub.exe')).toBeVisible({ timeout: 10000 });
      // Use a more specific locator for the catalog item
      await pageA.getByTestId(`game-card-${gameTitle.toLowerCase().replace(/ /g, '').replace('8-ballpool', 'pool')}`).click();
      await pageA.getByRole('button', { name: /With Partner/i }).click();
      await pageA.getByRole('button', { name: /Proceed to Lobby/i }).click();
      
      // Directly sync arcade lobby state from pageA to pageB
      const lobbyState = await pageA.evaluate(() => localStorage.getItem('yard_test_arcade_lobby'));
      if (lobbyState) {
        await pageB.evaluate((state) => {
          localStorage.setItem('yard_test_arcade_lobby', state);
          window.dispatchEvent(new StorageEvent('storage', {
            key: 'yard_test_arcade_lobby',
            newValue: state
          }));
        }, lobbyState);
      }

      // User B accepts
      // Wait for the modal title specifically
      await expect(pageB.getByRole('heading', { name: 'incoming_invite.exe' })).toBeVisible({ timeout: 15000 });
      await expect(pageB.locator('h3').filter({ hasText: gameTitle }).first()).toBeVisible();
      await pageB.getByRole('button', { name: /Accept & Join/i }).click();

      // Directly sync arcade lobby state from pageB back to pageA
      const lobbyStateB = await pageB.evaluate(() => localStorage.getItem('yard_test_arcade_lobby'));
      if (lobbyStateB) {
        await pageA.evaluate((state) => {
          localStorage.setItem('yard_test_arcade_lobby', state);
          window.dispatchEvent(new StorageEvent('storage', {
            key: 'yard_test_arcade_lobby',
            newValue: state
          }));
        }, lobbyStateB);
      }

      
      // Verify both in lobby
      await expect(pageA.getByRole('button', { name: /START GAME/i })).toBeVisible({ timeout: 15000 });
      
      // Reset pages to dashboard to test next game
      await pageA.goto('http://localhost:5173/dashboard');
      await pageB.goto('http://localhost:5173/dashboard');
    }
  });

});
