import { chromium } from 'playwright';

// ============================================================================
// YARD - GEMINI AGENT E2E TEST RUNNER
// ============================================================================
// This script allows an AI agent to execute a basic health check on the
// Yard application and report the results.
// ============================================================================

async function runAgentTest() {
  console.log('🤖 Agent initialized. Booting headless browser...');
  
  // Launch Chromium
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    // Give the agent a clean slate
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  const targetUrl = 'http://localhost:5173'; // Assuming default Vite port

  const results = {
    url: targetUrl,
    timestamp: new Date().toISOString(),
    tests: [],
    overallStatus: 'FAIL'
  };

  try {
    console.log(`🌐 Navigating to ${targetUrl}...`);
    const response = await page.goto(targetUrl, { waitUntil: 'networkidle' });
    
    // Test 1: Page Load
    if (response.ok()) {
      results.tests.push({ name: 'Page Load', status: 'PASS', details: `Status ${response.status()}` });
      console.log('✅ Page loaded successfully.');
    } else {
      throw new Error(`Failed to load page. Status: ${response.status()}`);
    }

    // Test 2: Check for Critical UI Elements (Landing Page)
    console.log('🔍 Scanning for critical UI elements...');
    const hasLogo = await page.locator('img[alt="Yard Logo"]').isVisible();
    const hasEnterButton = await page.getByRole('button', { name: 'enter yard' }).isVisible();

    if (hasLogo && hasEnterButton) {
      results.tests.push({ name: 'UI Elements Rendered', status: 'PASS', details: 'Logo and primary button found.' });
      console.log('✅ Critical UI elements found.');
    } else {
      results.tests.push({ name: 'UI Elements Rendered', status: 'FAIL', details: 'Missing logo or primary button.' });
      console.log('❌ Missing critical UI elements.');
    }

    // Test 3: Navigate to Sign-In
    console.log('🖱️ Simulating user navigation to Sign-In...');
    await page.getByRole('button', { name: 'enter yard' }).click();
    await page.waitForLoadState('networkidle');
    
    const hasSignInForm = await page.getByPlaceholder('you@love.com').isVisible();
    if (hasSignInForm) {
      results.tests.push({ name: 'Navigation to Sign-In', status: 'PASS', details: 'Sign-in form rendered.' });
      console.log('✅ Navigated to Sign-In successfully.');
    } else {
      results.tests.push({ name: 'Navigation to Sign-In', status: 'FAIL', details: 'Sign-in form not found.' });
      console.log('❌ Failed to navigate to Sign-In.');
    }

    // Determine overall status
    const allPassed = results.tests.every(t => t.status === 'PASS');
    results.overallStatus = allPassed ? 'PASS' : 'FAIL';

  } catch (error) {
    console.error('💥 Critical test failure:', error.message);
    results.tests.push({ name: 'Execution', status: 'FAIL', details: error.message });
  } finally {
    console.log('🛑 Shutting down browser...');
    await browser.close();
  }

  // Format the output for the Agent to read easily
  console.log('\n=======================================');
  console.log('AGENT TEST REPORT');
  console.log('=======================================');
  console.log(JSON.stringify(results, null, 2));
  
  // Exit with correct code so Antigravity knows if it failed
  if (results.overallStatus === 'FAIL') {
      process.exit(1);
  } else {
      process.exit(0);
  }
}

// Execute the test
runAgentTest();
