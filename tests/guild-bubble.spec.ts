import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './utils';

test.describe('Guild and Bubble Creation Flow', () => {

  test('Create a server and a bubble, and invite people', async ({ page }) => {
    // Enable console logs for debugging
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    const sessionId = Math.random().toString(36).substring(2, 7);
    await loginAsTestUser(page, `test_owner_${sessionId}`);

    // Navigate to Chat
    await page.getByTestId('app-icon-chat').click();
    
    // Wait for the chat to load
    await page.waitForTimeout(2000);

    // 1. Create a server
    console.log("Looking for Create Server button...");
    const createServerBtn = page.locator('div.group').filter({ hasText: 'Create a Guild' }).locator('button').first();
    await expect(createServerBtn).toBeVisible({ timeout: 5000 });
    await createServerBtn.click();

    // Fill in server details
    await expect(page.getByText('create_guild.exe')).toBeVisible();
    await page.getByPlaceholder('e.g. My Cozy Corner').fill('Test Server ' + sessionId);
    await page.getByRole('button', { name: 'Create Guild' }).click();

    // Verify server creation (by checking the header, which is an exact string match)
    const serverHeader = page.getByText('Test Server ' + sessionId, { exact: true }).last();
    await expect(serverHeader).toBeVisible({ timeout: 5000 });
    console.log("Server created successfully!");
    
    // 3. Create a Bubble
    console.log("Looking for Create Bubble button...");
    const createBubbleBtn = page.getByTitle('Create Bubble');
    await expect(createBubbleBtn).toBeVisible({ timeout: 5000 });
    await createBubbleBtn.click();

    // Fill in bubble details
    await expect(page.getByText('create_bubble.exe')).toBeVisible();
    await page.getByPlaceholder('e.g. The Arcade Team').fill('Test Bubble ' + sessionId);
    await page.getByPlaceholder('e.g. Chatting about highscores').fill('Bubble description');
    
    // Select members
    const checkboxes = await page.locator('input[type="checkbox"]').elementHandles();
    if (checkboxes.length > 0) {
      await checkboxes[0].check();
    }

    await page.getByRole('button', { name: 'Create Bubble' }).click();

    // Verify bubble creation
    const bubbleHeader = page.getByText('Test Bubble ' + sessionId, { exact: true }).last();
    await expect(bubbleHeader).toBeVisible({ timeout: 5000 });
    console.log("Bubble created successfully!");

  });
});
