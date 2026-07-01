import { Page } from '@playwright/test';

/**
 * Mocks a logged-in session by setting the necessary localStorage keys.
 * This assumes the app can handle a session-less state if these keys are present,
 * or we might need to actually perform a login.
 * 
 * For real E2E, we should perform a real login.
 */
export async function loginAsTestUser(page: Page, emailOrUser: string) {
  let user = emailOrUser;
  if (emailOrUser.includes('@')) {
    user = emailOrUser.includes('userB') || emailOrUser.includes('B') ? 'userB' : 'userA';
  }
  await page.goto(`/dashboard?test_mode=true&user=${user}`);
  await page.waitForLoadState('load');
}
