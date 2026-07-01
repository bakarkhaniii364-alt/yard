import { test, devices } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// CONFIGURATION
const CONFIG = {
    AUTOMATED_CRAWL: true, // Set to false to run the manual step-by-step inspector mode
    START_URL: 'http://localhost:5173',
    TEST_USER: 'userA_screener',
    CLICKS_PER_PAGE: 5,   // Curated limit of interaction clicks per view to be fast but comprehensive
};

// List of all main routes
const PUBLIC_VIEWS = [
    { name: '01_landing', path: '/' },
    { name: '02_signin', path: '/signin' },
    { name: '03_signup', path: '/signup' },
    { name: '04_password_reset', path: '/password-reset' }
];

const PRIVATE_VIEWS = [
    { name: '05_dashboard', path: '/dashboard', explore: true },
    { name: '06_chat', path: '/chat', specialInteract: 'chat' },
    { name: '07_doodle', path: '/doodle', explore: true },
    { name: '08_shared_canvas', path: '/shared-canvas', explore: true },
    { name: '09_capsule', path: '/capsule', explore: true },
    { name: '10_lists', path: '/lists', explore: true },
    { name: '11_calendar', path: '/calendar', explore: true },
    { name: '12_scrapbook', path: '/scrapbook', explore: true },
    { name: '13_pixelart', path: '/pixelart', explore: true },
    { name: '14_notes', path: '/notes', explore: true },
    { name: '15_dreams', path: '/dreams', explore: true },
    { name: '16_daily_q', path: '/daily-q', explore: true },
    { name: '17_resume', path: '/resume' },
    { name: '18_watch', path: '/watch', explore: true },
    { name: '19_space', path: '/space', explore: true },
    { name: '20_settings', path: '/settings', specialInteract: 'settings' },
    { name: '21_legal', path: '/legal' },
    { name: '22_activities', path: '/arcade', specialInteract: 'arcade' }
];

const GAMES = [
    'tictactoe', 'pictionary', 'memory', 'wordle', 'sudoku', 
    'chess', 'quiz', '2048', 'typing', 'wyr', 
    'uno', 'othello', 'pool', 'bluff', 'twentyq'
];

test('UI Auto Rater & Screener', async ({ page }) => {
    // Increase test timeout significantly for crawling many views
    test.setTimeout(600000);

    // Auto-dismiss dialogs to prevent browser hangs
    page.on('dialog', async dialog => {
        console.log(`   💬 Dialog popped up: [${dialog.type()}] "${dialog.message()}" - auto-dismissing`);
        await dialog.dismiss().catch(() => {});
    });

    const mobileDevice = devices['Pixel 7'];
    await page.setViewportSize(mobileDevice.viewport);

    const screenshotDir = path.join(process.cwd(), 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir);
    }

    let screenshotCount = 1;

    // Helper to scroll pages fully down and up to paint layouts
    async function autoScroll(pageInstance: any) {
        await pageInstance.evaluate(async () => {
            // Scroll body
            await new Promise<void>((resolve) => {
                let totalHeight = 0;
                const distance = 150;
                const timer = setInterval(() => {
                    const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= scrollHeight || (window.innerHeight + window.scrollY) >= scrollHeight) {
                        clearInterval(timer);
                        window.scrollTo(0, 0);
                        resolve();
                    }
                }, 40);
            });

            // Scroll custom scrollable containers
            const scrollables = Array.from(document.querySelectorAll('*')).filter(el => {
                const style = window.getComputedStyle(el);
                return (style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
            });

            for (const container of scrollables) {
                container.scrollTop = container.scrollHeight;
                await new Promise(r => setTimeout(r, 80));
                container.scrollTop = 0;
            }
        });
        await pageInstance.waitForTimeout(800);
    }

    // Capture screenshot wrapper
    async function snap(name: string, isFullPage: boolean = true) {
        const filePrefix = String(screenshotCount++).padStart(3, '0');
        const filename = `${filePrefix}-${name.replace(/[^a-z0-9_]/gi, '_').toLowerCase()}.png`;
        const filePath = path.join('screenshots', filename);
        console.log(`📸 Snapping: ${filePath}`);
        await page.screenshot({ path: filePath, fullPage: isFullPage });
    }

    // Login helper
    async function login() {
        console.log(`🔐 Logging in as: ${CONFIG.TEST_USER}`);
        await page.goto(`${CONFIG.START_URL}/dashboard?test_mode=true&user=${CONFIG.TEST_USER}`, { waitUntil: 'networkidle' });
        // Wait for bootloader to finish
        await page.waitForSelector('.mesh-bg, #root', { state: 'attached', timeout: 8000 });
        await page.waitForTimeout(2000);
    }

    // Self-healing close modal/backdrop
    async function closeModals() {
        const closeSelectors = [
            'button:has-text("Close")',
            'button:has-text("Cancel")',
            '[aria-label="Close"]',
            '.modal-close',
            '.confirm-dialog button:has-text("No")',
            'button:has-text("Back")',
            'button:has-text("Decline")'
        ];
        for (const sel of closeSelectors) {
            const loc = page.locator(sel).first();
            if (await loc.isVisible().catch(() => false)) {
                // Use a very low timeout to prevent hanging on covered or non-actionable targets
                await loc.click({ timeout: 500 }).catch(() => {});
                await page.waitForTimeout(300);
            }
        }
    }

    // Dynamic explorer loop on the current page
    async function explorePage(viewName: string) {
        console.log(`🔍 Exploring interactive elements on: ${viewName}`);
        let clicks = 0;
        const initialUrl = page.url();

        for (let i = 0; i < CONFIG.CLICKS_PER_PAGE; i++) {
            // Stop if we have navigated away from the initial URL
            if (page.url() !== initialUrl) {
                console.log(`   ℹ️ URL changed from ${initialUrl} to ${page.url()}. Stopping exploration of ${viewName}.`);
                break;
            }

            // Re-fetch clickables to avoid stale element references
            const targets = await page.locator('button, [role="button"], [role="tab"], .hamburger, .menu-toggle, [class*="menu"], [class*="btn"], summary').all();
            
            if (i >= targets.length) break;
            const element = targets[i];

            try {
                if (await element.isVisible() && await element.isEnabled()) {
                    const textRaw = await element.innerText().catch(() => '');
                    const text = textRaw.toLowerCase().trim();

                    // Skip navigation and destructive elements to avoid breaking the crawler
                    if (
                        text.includes('log') || 
                        text.includes('signout') || 
                        text.includes('exit') || 
                        text.includes('delete') || 
                        text.includes('reset') || 
                        text.includes('clear') || 
                        text.includes('leave') || 
                        text.includes('confirm') ||
                        text.includes('back') || 
                        text.includes('close') || 
                        text.includes('cancel') ||
                        text.includes('home')
                    ) {
                        continue;
                    }

                    console.log(`   👉 Clicking [${clicks + 1}/${CONFIG.CLICKS_PER_PAGE}]: "${textRaw.trim() || `Elem ${i}`}"`);
                    await element.scrollIntoViewIfNeeded({ timeout: 500 }).catch(() => {});
                    await element.click({ timeout: 1000, force: true });
                    clicks++;

                    await page.waitForTimeout(600);
                    const safeId = textRaw.trim().substring(0, 15).replace(/[^a-z0-9]/gi, '_').toLowerCase() || `el_${i}`;
                    await snap(`${viewName}_interact_${safeId}`);

                    // Clean up any dialogs or drawer menus that popped up
                    await closeModals();
                }
            } catch (err) {
                // Ignore errors from dynamically unmounted nodes
                continue;
            }
        }
    }

    // MAIN RUN
    if (!CONFIG.AUTOMATED_CRAWL) {
        // Fallback manual pause mode
        console.log(`🚀 Launching browser at: ${CONFIG.START_URL}`);
        await page.goto(CONFIG.START_URL, { waitUntil: 'load' });
        console.log(`\n🛑 PAUSED FOR SETUP:`);
        console.log(`--> 1. Log in to your application.`);
        console.log(`--> 2. MANUALLY click the navigation option or view you want to test.`);
        console.log(`--> 3. Once you are looking at the target screen, click "Resume" (▶) in the Inspector box.`);
        await page.pause();

        console.log(`\n🟢 Commencing manual UI capture...`);
        await autoScroll(page);
        await snap('manual_captured_view');
        console.log(`🎉 Manual capture finished.`);
        return;
    }

    console.log(`🚀 Starting fully automated UI screener...`);

    // 1. PUBLIC VIEWS (Onboarding)
    for (const view of PUBLIC_VIEWS) {
        console.log(`🛣️ Visiting: ${view.path}`);
        await page.goto(`${CONFIG.START_URL}${view.path}`, { waitUntil: 'networkidle' }).catch(() => {});
        await page.waitForTimeout(1000);
        await autoScroll(page);
        await snap(`${view.name}_initial`);
    }

    // Log in for protected routes
    await login();

    // 2. PRIVATE/APP VIEWS
    for (const view of PRIVATE_VIEWS) {
        console.log(`🛣️ Visiting: ${view.path}`);
        await page.goto(`${CONFIG.START_URL}${view.path}?test_mode=true&user=${CONFIG.TEST_USER}`, { waitUntil: 'networkidle' }).catch(() => {});
        await page.waitForTimeout(1500);
        
        await autoScroll(page);
        await snap(`${view.name}_initial`);

        if (view.specialInteract === 'chat') {
            // Interact with Chat
            console.log(`💬 Exploring Chat Details & Tabs...`);
            
            // Send a test message
            const inputField = page.getByPlaceholder('type a message...');
            if (await inputField.isVisible()) {
                await inputField.fill('Hello from Auto UI Rater! 🚀');
                await page.keyboard.press('Enter');
                await page.waitForTimeout(800);
                await snap('06_chat_message_sent');
            }

            // Click chat title to open details drawer/sidebar
            const titleSelector = page.locator('.retro-window-title span, .retro-window-title div').first();
            if (await titleSelector.isVisible()) {
                await titleSelector.click({ timeout: 1000 }).catch(() => {});
                await page.waitForTimeout(800);
                await snap('06_chat_details_sidebar');

                // Click each tab in the details sidebar
                const tabs = [
                    { name: 'calls', label: 'Calls' },
                    { name: 'search', label: 'Search' },
                    { name: 'settings', label: 'Settings' },
                    { name: 'media', label: 'Media' }
                ];
                for (const tab of tabs) {
                    const tabButton = page.locator(`button:has-text("${tab.label}")`).first();
                    if (await tabButton.isVisible()) {
                        await tabButton.click({ timeout: 1000 }).catch(() => {});
                        await page.waitForTimeout(600);
                        await snap(`06_chat_details_tab_${tab.name}`);
                    }
                }

                // Close Details
                await titleSelector.click({ timeout: 1000 }).catch(() => {});
                await page.waitForTimeout(400);
            }
        } else if (view.specialInteract === 'settings') {
            // Explore Control Panel sections ("insides")
            console.log(`⚙️ Exploring Settings categories (insides)...`);
            const categories = ['User Account', 'Security', 'Aesthetics', 'Relationship', 'System & Audio', 'Privacy & Data', 'About Yard'];
            for (const cat of categories) {
                const btn = page.locator(`button:has-text("${cat}")`).first();
                if (await btn.isVisible()) {
                    await btn.click({ timeout: 1000 }).catch(() => {});
                    await page.waitForTimeout(800);
                    await snap(`20_settings_sub_${cat.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`);

                    // Navigate back to settings home
                    const backBreadcrumb = page.locator('span:has-text("Control Panel")').first();
                    if (await backBreadcrumb.isVisible()) {
                        await backBreadcrumb.click({ timeout: 1000 }).catch(() => {});
                        await page.waitForTimeout(600);
                    }
                }
            }
            // Explore generic elements on settings home
            await explorePage(view.name);
        } else if (view.specialInteract === 'arcade') {
            // Explore Arcade Hub layout
            await explorePage(view.name);
        } else if (view.explore) {
            // Explore page layout elements
            await explorePage(view.name);
        }
    }

    // 3. ARCADE GAME SETUP VIEWS (15 Games)
    console.log(`👾 Visiting all Arcade game lobby and setup screens...`);
    for (const gameId of GAMES) {
        const gamePath = `/arcade/${gameId}`;
        console.log(`🕹️ Visiting game: ${gameId}`);
        await page.goto(`${CONFIG.START_URL}${gamePath}?test_mode=true&user=${CONFIG.TEST_USER}`, { waitUntil: 'networkidle' }).catch(() => {});
        await page.waitForTimeout(1500);

        await autoScroll(page);
        await snap(`22_arcade_game_${gameId}_setup`);

        // Click options buttons (difficulty, grid size, game modes) to show dropdown/selections
        const optionsButtons = await page.locator('button.flex-1, button:has-text("Solo"), button:has-text("Practice"), button:has-text("AI"), button:has-text("Partner"), button:has-text("Easy"), button:has-text("Hard")').all();
        let clickedOpts = 0;
        for (const btn of optionsButtons) {
            if (clickedOpts >= 4) break;
            try {
                if (await btn.isVisible() && await btn.isEnabled()) {
                    await btn.click({ timeout: 500 }).catch(() => {});
                    clickedOpts++;
                    await page.waitForTimeout(400);
                    await snap(`22_arcade_game_${gameId}_setup_option_${clickedOpts}`);
                }
            } catch (err) {}
        }
    }

    console.log(`\n🎉 FULL CRAWL COMPLETE! Screenshots stored in /screenshots`);
});