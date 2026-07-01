import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './utils';

test('Feed scroll to profile click, message, and register DM on first send', async ({ page }) => {
  // 1. Log in in test mode
  await loginAsTestUser(page, 'testuser_feed_dm_nav');
  
  // 2. Wait for the feed/dashboard to load
  await expect(page.locator('input[placeholder="Search feed posts or users..."]')).toBeVisible({ timeout: 10000 });
  
  // 3. Find a user profile link (e.g. yardbot or alice or retrogamer)
  // Let's look for a post by yardbot or retrogamer or click on the active friends widget
  // The active friends list in the right rail contains 'crayoncat' and 'retrogamer'
  const retrogamerFriend = page.locator('text=retrogamer').first();
  await expect(retrogamerFriend).toBeVisible();
  await retrogamerFriend.click();
  
  // 4. Verify Profile Modal opens
  const profileWindow = page.locator('text=user_profile.sys');
  await expect(profileWindow).toBeVisible();
  
  // 5. Click the 'Message' button in the profile modal
  const messageButton = page.locator('text=Message').first();
  await expect(messageButton).toBeVisible();
  await messageButton.click();
  
  // 6. Verify redirection to Chat page
  await expect(page).toHaveURL(/.*\/chat/);
  
  // 7. Verify RetroGamer DM is active
  await expect(page.locator('text=RetroGamer').first()).toBeVisible();
  
  // 8. Verify RetroGamer is NOT yet registered in the sidebar (only Partner should be there initially)
  const sidebar = page.locator('.flex-1.overflow-y-auto.p-2.flex.flex-col.gap-1');
  await expect(sidebar.locator('text=RetroGamer')).not.toBeVisible();
  
  // 9. Send a message to RetroGamer
  const chatInput = page.locator('div[contenteditable="true"]').first();
  await chatInput.focus();
  await chatInput.fill('hello RetroGamer!');
  await page.keyboard.press('Enter');
  
  // 10. Verify message was sent and RetroGamer now appears in the sidebar list (registered)
  await expect(sidebar.locator('text=RetroGamer')).toBeVisible({ timeout: 5000 });
  
  // 11. Verify bot typing indicator and response appears
  await expect(page.locator('text=hello RetroGamer!')).toBeVisible();
  await expect(page.locator('text=RetroGamer').nth(1)).toBeVisible();
});
