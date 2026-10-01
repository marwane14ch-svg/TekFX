require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { captureTradingViewChart } = require('./execution/capture_chart');

async function runTest() {
  console.log('=== [Test] Starting Headless TradingView Snapshot Verification ===');
  console.log('Target Chart URL:', process.env.TRADINGVIEW_CHART_URL || 'https://www.tradingview.com/chart/?symbol=BINANCE:BTCUSDT');

  try {
    const startTime = Date.now();
    const result = await captureTradingViewChart({
      sessionName: 'TestVerification'
    });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n✓ Snapshot captured in ${elapsed}s!`);
    console.log(`- File: ${result.filename}`);
    console.log(`- Path: ${result.fullPath}`);
    console.log(`- Web Path: ${result.imagePath}`);
    console.log(`- Detected Asset: ${result.asset}`);

    const stats = fs.statSync(result.fullPath);
    console.log(`- File Size: ${(stats.size / 1024).toFixed(1)} KB`);

    if (stats.size > 20000) {
      console.log('✓ Verification PASSED: Snapshot file is healthy and high-resolution.');
    } else {
      console.warn('⚠ Warning: Snapshot size is smaller than expected, check page loading.');
    }
  } catch (error) {
    console.error('✗ Verification FAILED:', error.message);
    process.exit(1);
  }
}

runTest();
