const puppeteer = require('puppeteer-core');

(async () => {
    const browser = await puppeteer.launch({
        executablePath: '/snap/bin/chromium'
    });
    const page = await browser.newPage();
    await page.goto('https://accounts.spotify.com/login');

    await page.type('#login-username', 'h4mmer7ime@gmail.com');
    await page.type('#login-password', 'ILAvocado00');
    await page.click('#login-button');
    await page.waitForNavigation();

    const cookies = await page.cookies();
    console.log(cookies.find(crumb => crumb.name == 'sp_dc'));

    await browser.close();
})();
