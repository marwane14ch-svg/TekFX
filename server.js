require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { seedInitialDataIfEmpty, getAllAnalyses, getLatestAnalysis, getAnalysisById } = require('./execution/db');
const { initializeScheduler, runAnalysisPipeline, getSchedulerStatus } = require('./execution/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// Serve captured snapshot images
const snapshotsDir = path.join(__dirname, 'snapshots');
if (!fs.existsSync(snapshotsDir)) {
  fs.mkdirSync(snapshotsDir, { recursive: true });
}
app.use('/snapshots', express.static(snapshotsDir));

// API: System Status & Next Cron Countdown
app.get('/api/status', (req, res) => {
  try {
    const status = getSchedulerStatus();
    res.json({
      success: true,
      data: {
        ...status,
        geminiConfigured: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here'),
        targetUrl: process.env.TRADINGVIEW_CHART_URL || 'https://www.tradingview.com/chart/?symbol=BINANCE:BTCUSDT',
        model: process.env.GEMINI_MODEL || 'gemini-3.8-flash'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: List all past analyses (Archive / History)
app.get('/api/analyses', (req, res) => {
  try {
    const analyses = getAllAnalyses(100);
    res.json({ success: true, data: analyses });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Get latest analysis
app.get('/api/analyses/latest', (req, res) => {
  try {
    const latest = getLatestAnalysis();
    if (!latest) {
      return res.status(404).json({ success: false, error: 'No analyses found' });
    }
    res.json({ success: true, data: latest });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Get specific analysis by ID
app.get('/api/analyses/:id', (req, res) => {
  try {
    const analysis = getAnalysisById(req.params.id);
    if (!analysis) {
      return res.status(404).json({ success: false, error: 'Analysis not found' });
    }
    res.json({ success: true, data: analysis });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Manual "Run Analysis Now" trigger
app.post('/api/trigger', async (req, res) => {
  try {
    const sessionName = req.body.sessionName || 'Manual On-Demand';
    console.log(`[Server] Manual analysis trigger requested (${sessionName})`);
    const result = await runAnalysisPipeline({ sessionName });
    res.json({
      success: true,
      message: 'Analysis completed successfully',
      data: result
    });
  } catch (err) {
    console.error('[Server] Trigger error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start Server
function start() {
  // Ensure initial database seed
  seedInitialDataIfEmpty();

  // Start background cron jobs for the 3 daily sessions
  initializeScheduler();

  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`  Financial Analysis Dashboard Active!`);
    console.log(`  URL: http://localhost:${PORT}`);
    console.log(`  Snapshots Directory: ${snapshotsDir}`);
    console.log(`  UTC Schedule: 07:00 (London), 12:30 (NY), 17:00 (London Fix)`);
    console.log(`======================================================\n`);
  });
}

start();

module.exports = app;
