const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

/**
 * Launch Chromium with automatic platform detection and self-healing
 * if the browser binary is missing on cloud containers (e.g. Railway, Docker).
 */
async function launchBrowser() {
  const isLinux = process.platform === 'linux';
  const launchOptions = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-infobars',
      '--window-position=0,0',
      '--ignore-certificate-errors',
      '--disable-blink-features=AutomationControlled'
    ]
  };

  // On Windows/Mac local environments, try system Chrome/Edge first for instant launch
  if (!isLinux) {
    try {
      return await chromium.launch({ ...launchOptions, channel: 'chrome' });
    } catch (e1) {
      try {
        return await chromium.launch({ ...launchOptions, channel: 'msedge' });
      } catch (e2) {}
    }
  }

  // On Linux (Railway, Docker) or fallback, launch Playwright's Chromium
  try {
    return await chromium.launch(launchOptions);
  } catch (launchErr) {
    const errMsg = launchErr.message || '';
    if (
      errMsg.includes("Executable doesn't exist") ||
      errMsg.includes("playwright install") ||
      errMsg.includes("Please run the following command")
    ) {
      console.warn('[Capture] Playwright Chromium binary missing in container cache.');
      console.log('[Capture] Self-annealing: Automatically running npx playwright install chromium...');
      try {
        try {
          execSync('npx playwright install --with-deps chromium', { stdio: 'inherit' });
        } catch (depErr) {
          execSync('npx playwright install chromium', { stdio: 'inherit' });
        }
        console.log('[Capture] Playwright Chromium installed successfully. Retrying browser launch...');
        return await chromium.launch(launchOptions);
      } catch (installErr) {
        console.error('[Capture] Self-healing browser installation failed:', installErr.message);
        throw launchErr;
      }
    }
    throw launchErr;
  }
}

/**
 * Captures a high-resolution TradingView chart snapshot with custom indicators,
 * dark theme applied, and clutter/sidebars hidden.
 * 
 * @param {Object} options
 * @param {string} [options.url] - TradingView chart URL
 * @param {string} [options.sessionName] - Name of market session
 * @param {string} [options.outputDir] - Directory to save snapshots
 * @param {number} [options.width=1920] - Viewport width
 * @param {number} [options.height=1080] - Viewport height
 * @returns {Promise<{imagePath: string, filename: string, timestamp: string, asset: string}>}
 */
async function captureTradingViewChart(options = {}) {
  const chartUrl = options.url || process.env.TRADINGVIEW_CHART_URL || 'https://www.tradingview.com/chart/?symbol=BINANCE:BTCUSDT';
  const sessionName = options.sessionName || 'Manual';
  const outputDir = options.outputDir || path.join(__dirname, '..', 'snapshots');
  const width = options.width || 1920;
  const height = options.height || 1080;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeSession = sessionName.toLowerCase().replace(/[^a-z0-9_-]/gi, '_');
  const filename = `snapshot_${safeSession}_${timestamp}.png`;
  const fullOutputPath = path.join(outputDir, filename);

  console.log(`[Capture] Launching browser to capture: ${chartUrl}`);
  
  let browser = await launchBrowser();

  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2, // High-resolution 2x retina snapshot
    colorScheme: 'dark',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });

  // Pre-seed dark theme in localStorage for TradingView
  await context.addInitScript(() => {
    try {
      localStorage.setItem('theme', 'dark');
      localStorage.setItem('tradingview.current_theme.name', 'dark');
      localStorage.setItem('tv_theme', 'dark');
    } catch (e) {}
  });

  const page = await context.newPage();

  try {
    // Append dark theme param if not already present
    let targetUrl = chartUrl;
    if (!targetUrl.includes('theme=')) {
      targetUrl += (targetUrl.includes('?') ? '&' : '?') + 'theme=dark';
    }

    console.log(`[Capture] Navigating to ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });

    // Handle common consent dialogs / popups
    try {
      await page.waitForTimeout(1500);
      const consentButtons = [
        '#onetrust-accept-btn-handler',
        'button[data-name="accept-cookies"]',
        'button:has-text("Accept all")',
        'button:has-text("Accept All Cookies")',
        'button[aria-label="Close"]',
        'div[data-role="toast-container"] button'
      ];
      for (const btnSelector of consentButtons) {
        const btn = await page.$(btnSelector);
        if (btn) {
          await btn.click().catch(() => {});
        }
      }
    } catch (e) {
      // Non-critical if consent dialog is absent
    }

    // Wait for the chart canvas to mount and stabilize
    console.log('[Capture] Waiting for chart canvas and indicator layers to render...');
    try {
      await page.waitForSelector('canvas', { timeout: 12000 });
    } catch (e) {
      console.warn('[Capture] Warning: Canvas selector wait completed or timed out, continuing capture.');
    }

    // Give indicator layers (Volume Profile, POC, VAH/VAL, Absorption Bubbles) time to calculate and draw
    await page.waitForTimeout(4500);

    // Inject CSS to ensure dark theme, hide clutter, headers, toolbars, and expand the pure chart
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.id = 'antigravity-chart-cleaner';
      style.innerHTML = `
        /* Enforce dark background */
        html, body {
          background-color: #131722 !important;
          color: #d1d4dc !important;
        }
        /* Hide sidebars, banners, top bar, and extraneous toolbars */
        header,
        div[data-name="header-toolbar"],
        div[data-name="drawing-toolbar"],
        div[data-name="right-toolbar"],
        div[data-role="toast-container"],
        div[class*="widgetbar-pages"],
        div[class*="layout__area--top"],
        div[class*="layout__area--left"],
        div[class*="layout__area--right"],
        div[class*="banner"],
        div[class*="promo"],
        div[id*="onetrust"],
        #overlap-manager-root,
        .tv-dialog__overlay {
          display: none !important;
          visibility: hidden !important;
        }
        /* Maximize chart area */
        .chart-container, .chart-gui-wrapper, .layout__area--center {
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          position: absolute !important;
        }
      `;
      document.head.appendChild(style);
    });

    // Wait a brief moment for styles to reflow
    await page.waitForTimeout(1500);

    // Extract asset name if visible in page title or header
    let asset = 'BTC/USDT';
    try {
      const title = await page.title();
      const match = title.match(/^([A-Z0-9_:\.\-]+)/i);
      if (match && match[1]) {
        asset = match[1];
      }
    } catch (e) {}

    console.log(`[Capture] Saving snapshot to ${fullOutputPath}...`);
    await page.screenshot({
      path: fullOutputPath,
      fullPage: false,
      type: 'png'
    });

    console.log(`[Capture] Snapshot captured successfully: ${filename}`);

    return {
      imagePath: `/snapshots/${filename}`,
      fullPath: fullOutputPath,
      filename,
      timestamp: new Date().toISOString(),
      asset
    };

  } catch (err) {
    console.error('[Capture] Error during chart capture:', err);
    throw err;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

module.exports = {
  captureTradingViewChart
};
