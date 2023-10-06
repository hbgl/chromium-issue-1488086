import CDP from 'chrome-remote-interface';
import { spawn } from 'child_process';

const config = {
    /**
     * Specify the path to your chrome executable. Try the chromium win64 builds 
     * 1110986 and 1111034 to see a difference in result.
     */
    chromePath: 'chrome.exe',

    /**
     * Use any free port on your machine. Does not matter which.
     */
    chromeDebuggingPort: 32712,
};

/**
 * @param {number} ms 
 */
async function sleep(ms) {
    await new Promise(res => setTimeout(res, ms));
}

/**
 * @param {boolean} withJs 
 */
async function test(withJs) {
    const url = (withJs
        ? 'data:text/html,<h1>With script</h1><script>(() => {})();</script>'
        : 'data:text/html,<h1>No script</h1>'
    );

    let client = null;
    try {
        const newTab = await CDP.New({
            port: config.chromeDebuggingPort,
        });
        client = await CDP({
            target: newTab,
        });
        
        await Promise.all([
            client.Page.enable(),
        ]);
    
        await client.Page.addScriptToEvaluateOnNewDocument({
            source: `window.foo = document.readyState;`,
        });
        
        // Load page without JS.
        await client.Page.navigate({
            url,
        });
        await sleep(1000);
        const response = await client.Runtime.evaluate({
            expression: 'window.foo',
        });
        const readyState = response.result.value;

        const label = (withJs
            ? 'With JS........'
            : 'Without JS.....'
        );
        console.log(`${label}${readyState}`);
    } finally {
        if (client) {
            await client.close();
        }
    }
}

let chromeProc = null;
try {
    chromeProc = spawn(config.chromePath, [
        '--remote-debugging-port=' + config.chromeDebuggingPort,
        '--headless',
        '--mute-audio',
        '--disable-gpu',
        '--hide-scrollbars',
        '--no-default-browser-check',
        '--no-first-run',
        '--metrics-recording-only',
        '--password-store=basic',
        '--use-mock-keychain',
        '--disable-features=' + ['Translate', 'OptimizationHints', 'MediaRouter', 'InterestFeedContentSuggestions'].join(','),
        '--disable-extensions',
        '--disable-component-extensions-with-background-pages',
        '--disable-background-networking',
        '--disable-component-update',
        '--disable-client-side-phishing-detection',
        '--disable-sync',
        '--disable-default-apps',
        '--disable-domain-reliability',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-background-timer-throttling',
        '--disable-ipc-flooding-protection',
    ]);

    // Wait for chrome to start.
    await sleep(1000);

    await test(false);
    await test(true);

} finally {
    if (chromeProc) {
        chromeProc.kill('SIGTERM');
    }
}