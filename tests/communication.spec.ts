import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './utils';

test.describe('Communication E2E Suite', () => {
  
  test('Real-Time Text & Typing', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // Pipe console logs for debugging
    pageA.on('console', msg => console.log('PAGE A:', msg.text()));
    pageB.on('console', msg => console.log('PAGE B:', msg.text()));

    // Step 1: User A and User B are logged in and paired in isolated contexts
    const sessionId = Math.random().toString(36).substring(2, 7);
    await loginAsTestUser(pageA, `userA_${sessionId}`);
    await loginAsTestUser(pageB, `userB_${sessionId}`);
    
    // Both navigate to chat
    await pageA.getByTestId('app-icon-chat').click();
    await pageB.getByTestId('app-icon-chat').click();
    
    // Step 2: User A types in the chat box (do not press send yet)
    await pageA.getByPlaceholder('type a message...').click();
    await pageA.waitForTimeout(1000); // Wait for both to be fully synced
    await pageA.getByPlaceholder('type a message...').pressSequentially('Hello');
    
    // Step 3: Assert that User B's UI displays the "Partner is typing..." indicator
    await expect(pageB.getByText(/is typing/i)).toBeVisible({ timeout: 5000 });
    
    // Step 4: User A sends the message: "Hello from Playwright!"
    const messageText = "Hello from Playwright!";
    await pageA.getByPlaceholder('type a message...').fill(messageText);
    await pageA.keyboard.press('Enter');
    
    // Step 5: Assert that User B receives the exact message bubble
    await expect(pageB.getByText(messageText)).toBeVisible({ timeout: 10000 });
    
    // Step 6: Assert that User A's UI marks the message as "Read" once User B views it
    // In ChatView, messages are marked as read when the component mounts or updates with unread messages
    // We look for "seen" text which appears when status is 'read'
    await pageA.waitForTimeout(2000); 
    await expect(pageA.getByText(/seen/i)).toBeVisible({ timeout: 10000 });
  });

  test('WebRTC Audio/Video Call Flow', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    pageA.on('console', msg => console.log('PAGE A:', msg.text()));
    pageB.on('console', msg => console.log('PAGE B:', msg.text()));

    // Login and pair
    const sessionId = Math.random().toString(36).substring(2, 7);
    await loginAsTestUser(pageA, `userA_${sessionId}`);
    await loginAsTestUser(pageB, `userB_${sessionId}`);
    
    // Both navigate to chat to find the call buttons in the header
    await pageA.getByTestId('app-icon-chat').click();
    await pageB.getByTestId('app-icon-chat').click();
    
    // Step 1: User A clicks the "Voice Call" button in the chat header
    await expect(pageA.getByTitle('Voice Call')).toBeVisible();
    await pageA.getByTitle('Voice Call').click();
    
    // Step 2: Assert that User A's UI enters the "Ringing" state
    // App.jsx: <div className="...">Ringing {partnerName}...</div>
    await expect(pageA.getByText(/Ringing/i)).toBeVisible({ timeout: 5000 });
    
    // Step 3: Assert that User B's UI displays the "Incoming Call" modal
    await expect(pageB.getByText(/Incoming Voice Call/i)).toBeVisible({ timeout: 10000 });
    
    // Step 4: User B clicks the Accept (green phone) button
    await pageB.getByTitle('Accept').click();
    
    // Step 5: Assert that both User A and User B's UIs transition to show the active Call Hub
    // and that the duration timer appears
    await expect(pageA.getByText(/AUDIO CALL/i)).toBeVisible({ timeout: 15000 });
    await expect(pageB.getByText(/AUDIO CALL/i)).toBeVisible({ timeout: 15000 });
    
    // Verify duration timer (e.g., 0:01)
    await expect(pageA.getByText(/0:0[1-9]/)).toBeVisible({ timeout: 10000 });
    await expect(pageB.getByText(/0:0[1-9]/)).toBeVisible({ timeout: 10000 });
    
    // Step 6: User A clicks the "End Call" button
    // The End button has text "End" in the PremiumCallHub
    await pageA.getByRole('button', { name: /End/i }).click();
    
    // Step 7: Assert the Call Hub completely unmounts and disappears for both users
    await expect(pageA.getByText(/AUDIO CALL/i)).not.toBeVisible({ timeout: 5000 });
    await expect(pageB.getByText(/AUDIO CALL/i)).not.toBeVisible({ timeout: 5000 });
  });

});
