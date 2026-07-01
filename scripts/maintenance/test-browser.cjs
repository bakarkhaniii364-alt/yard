const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

    await page.goto('http://localhost:5173/', { waitUntil: 'load' });
    await page.evaluate(() => {
        window.localStorage.setItem('current_view', JSON.stringify('dashboard'));
    });
    
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
    
    await new Promise(r => setTimeout(r, 2000));
    await browser.close();
})();
