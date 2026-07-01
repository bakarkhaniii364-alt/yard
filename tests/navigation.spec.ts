import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './utils';

test('Dashboard to Chat navigation and unmounting', async ({ page }) => {
  const sessionId = Math.random().toString(36).substring(2, 7);
  await loginAsTestUser(page, `userA_${sessionId}`);
  
  // 2. Open Chat
  await page.getByRole('button', { name: /chat/i }).click();
  const chatWindow = page.locator('.glass-window').filter({ has: page.getByPlaceholder('type a message...') });
  await expect(chatWindow).toBeVisible();
  
  // 3. Close Chat using the aria-label
  await page.getByLabel('Close').first().click();
  
  // 4. Verify unmounted (not just hidden)
  await expect(chatWindow).not.toBeAttached();
});

test('Activities Hub to Pictionary and back', async ({ page }) => {
  const sessionId = Math.random().toString(36).substring(2, 7);
  await loginAsTestUser(page, `userA_${sessionId}`);
  
  // Open Games (Arcade)
  await page.getByRole('button', { name: /arcade/i }).click();
  await expect(page.getByText('activities_hub.exe')).toBeVisible();
  
  // Select Memory Match (which has Solo mode)
  await page.getByText('Memory Match', { exact: true }).click();
  
  // Handle Setup Window
  await expect(page.getByText('memory_setup.exe')).toBeVisible();
  await page.getByRole('button', { name: /Solo/i }).first().click();
  await page.getByRole('button', { name: /Start Game/i }).click();
  
  // Verify Game Window (using flexible locator)
  await expect(page.locator('.glass-window').filter({ hasText: /memory/i }).first()).toBeVisible();
  
  // Close Memory Match
  await page.locator('.glass-window').filter({ hasText: /memory/i }).getByLabel('Close').click();
  
  // Handle Confirmation Dialog
  await expect(page.getByText(/Progress may be lost/i)).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Confirm' }).click();
  
  // Wait for React state to propagate and unmount
  await page.waitForTimeout(500);
  
  // Verify back in Hub (wait for unmount of specific window)
  await expect(page.locator('.glass-window').filter({ hasText: /^memory\.exe$/i })).toHaveCount(0, { timeout: 5000 });
  await expect(page.getByText('memory_setup.exe')).toBeVisible();
});
