require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { analyzeChartWithGemini } = require('./execution/gemini_analyzer');

async function runTest() {
  console.log('=== [Test] Starting Gemini Multimodal Analysis Pipeline Test ===');

  // Find a snapshot in snapshots/
  const snapshotsDir = path.join(__dirname, 'snapshots');
  const files = fs.readdirSync(snapshotsDir).filter(f => f.endsWith('.png'));

  if (files.length === 0) {
    console.error('No snapshot found in snapshots directory! Run npm run test:capture first.');
    process.exit(1);
  }

  const testFile = files[files.length - 1];
  console.log(`Using snapshot: ${testFile}`);

  try {
    const analysis = await analyzeChartWithGemini(path.join(snapshotsDir, testFile), {
      asset: 'BTC/USDT',
      sessionName: 'Verification Test Session'
    });

    console.log('\n✓ Analysis successfully produced:');
    console.log(JSON.stringify(analysis, null, 2));

    if (analysis.bias && analysis.key_levels && analysis.primary_scenario) {
      console.log('\n✓ Verification PASSED: Analysis conforms to the required JSON schema.');
    } else {
      console.warn('\n⚠ Analysis missing some expected fields.');
    }
  } catch (error) {
    console.error('\n✗ Test failed:', error);
    process.exit(1);
  }
}

runTest();
