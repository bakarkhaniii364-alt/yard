import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './utils';

test('Full WebRTC Audio Call Flow', async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  // Logging for debugging
  pageA.on('console', msg => console.log('PAGE A:', msg.text()));
  pageB.on('console', msg => console.log('PAGE B:', msg.text()));
  
  // Login both users
  const sessionId = Math.random().toString(36).substring(2, 7);
  await loginAsTestUser(pageA, `userA_${sessionId}`);
  await loginAsTestUser(pageB, `userB_${sessionId}`);
  
  // Both navigate to chat to find the call buttons
  await pageA.getByTestId('app-icon-chat').click();
  await pageB.getByTestId('app-icon-chat').click();
  
  // --- STEP 1: USER A INITIATES CALL ---
  // Ensure the header actions are visible
  await expect(pageA.getByTitle('Voice Call')).toBeVisible();
  await pageA.getByTitle('Voice Call').click();
  
  // --- STEP 2: USER B SEES INCOMING CALL ---
  // The incoming call modal should appear
  await expect(pageB.getByText(/Incoming Voice Call/i)).toBeVisible({ timeout: 10000 });
  await expect(pageB.getByRole('heading', { name: 'User A', exact: true })).toBeVisible();
  
  // --- STEP 3: USER B ACCEPTS CALL ---
  // Click the green accept button (it's a button with Phone icon)
  // Based on App.jsx: <button onClick={acceptCall} ...><Phone size={28}/></button>
  // It has a shadow-lg and rounded-full but no accessible text. Let's use the icon or button position.
  // Actually, let's look for the Phone icon within the accept button.
  await pageB.getByTitle('Accept').click();
  
  // --- STEP 4: VERIFY CALL HUB ON BOTH SIDES ---
  // Both should show "AUDIO CALL" hub
  await expect(pageA.getByText(/AUDIO CALL/i)).toBeVisible({ timeout: 10000 });
  await expect(pageB.getByText(/AUDIO CALL/i)).toBeVisible({ timeout: 10000 });
  
  // Verify timer is running (starts at 0:00 or 00:00)
  await expect(pageA.getByText(/0:0[1-9]/)).toBeVisible({ timeout: 5000 });
  await expect(pageB.getByText(/0:0[1-9]/)).toBeVisible({ timeout: 5000 });
  
  // --- STEP 5: USER A ENDS CALL ---
  // End button has PhoneOff icon and text "End"
  await pageA.getByRole('button', { name: /End/i }).click();
  
  // --- STEP 6: VERIFY HUB CLOSES ---
  await expect(pageA.getByText(/AUDIO CALL/i)).not.toBeVisible();
  await expect(pageB.getByText(/AUDIO CALL/i)).not.toBeVisible();
});
