import { test, expect } from '@playwright/test';

test('Landing page renders and navigates to sign-in', async ({ page }) => {
  await page.goto('/');
  
  // Verify Landing Page
  await expect(page.getByAltText('Yard Logo')).toBeVisible();
  await expect(page.getByText('enter yard')).toBeVisible();
  
  // Navigate to Sign-In
  await page.getByRole('button', { name: 'enter yard' }).click();
  
  // Verify Auth View
  await expect(page.getByText('welcome back.exe')).toBeVisible();
  await expect(page.getByPlaceholder('you@love.com')).toBeVisible();
});

test('Multi-user pairing flow simulation', async ({ browser }) => {
  // This test requires a real Supabase backend or a mocked one.
  // We'll simulate the UI steps for now.
  
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  
  await pageA.goto('/signin');
  await pageB.goto('/signin');
  
  // Verify both on login
  await expect(pageA.getByPlaceholder('you@love.com')).toBeVisible();
  await expect(pageB.getByPlaceholder('you@love.com')).toBeVisible();
});
