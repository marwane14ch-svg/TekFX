const cron = require('node-cron');
const { captureTradingViewChart } = require('./capture_chart');
const { analyzeChartWithGemini } = require('./gemini_analyzer');
const { saveAnalysis } = require('./db');
const { sendAnalysisToDiscord } = require('./discord_notifier');
const { fetchGoldMacroNews } = require('./news_fetcher');

// Defined market sessions in UTC
const SCHEDULED_SESSIONS = [
  { name: 'London Open', cronTime: '0 7 * * *', hour: 7, minute: 0 },
  { name: 'New York Open', cronTime: '30 12 * * *', hour: 12, minute: 30 },
  { name: 'London Fix / US Midday', cronTime: '0 17 * * *', hour: 17, minute: 0 }
];

let isRunning = false;
let lastRunResult = null;
let lastError = null;

/**
 * Calculates current market session and next scheduled session with countdown.
 */
function getSchedulerStatus() {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const currentMinutesUtc = utcHour * 60 + utcMinute;

  // Determine current active market session
  let currentSession = 'Asian Session (Pre-London)';
  if (currentMinutesUtc >= 7 * 60 && currentMinutesUtc < 12 * 60 + 30) {
    currentSession = 'London Session (Active)';
  } else if (currentMinutesUtc >= 12 * 60 + 30 && currentMinutesUtc < 17 * 60) {
    currentSession = 'New York Session / US Open (Active)';
  } else if (currentMinutesUtc >= 17 * 60 && currentMinutesUtc < 21 * 60) {
    currentSession = 'London Fix / US Afternoon (Active)';
  } else if (currentMinutesUtc >= 21 * 60 || currentMinutesUtc < 7 * 60) {
    currentSession = 'Asian Session / Globex (Active)';
  }

  // Find next scheduled run
  const scheduledRuns = SCHEDULED_SESSIONS.map(session => {
    const nextDate = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      session.hour,
      session.minute,
      0,
      0
    ));
    if (nextDate.getTime() <= now.getTime()) {
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    }
    return {
      sessionName: session.name,
      targetTime: nextDate.toISOString(),
      diffMs: nextDate.getTime() - now.getTime()
    };
  });

  scheduledRuns.sort((a, b) => a.diffMs - b.diffMs);
  const nextRun = scheduledRuns[0];

  return {
    utcTime: now.toISOString(),
    currentSession,
    nextSession: nextRun.sessionName,
    nextRunTime: nextRun.targetTime,
    countdownMs: nextRun.diffMs,
    isPipelineBusy: isRunning,
    lastRunResult,
    lastError
  };
}

/**
 * Executes the complete pipeline: Capture -> Gemini Multimodal Analysis -> Database Save
 */
async function runAnalysisPipeline(options = {}) {
  if (isRunning) {
    throw new Error('Analysis pipeline is already in progress.');
  }

  isRunning = true;
  lastError = null;
  const sessionName = options.sessionName || 'Manual On-Demand';
  console.log(`\n======================================================`);
  console.log(`[Pipeline] Triggered session: ${sessionName}`);
  console.log(`[Pipeline] Time: ${new Date().toISOString()}`);

  try {
    // Step 1: Capture chart snapshot
    console.log('[Pipeline] Step 1/4: Capturing TradingView chart snapshot...');
    const snapshot = await captureTradingViewChart({
      sessionName,
      url: process.env.TRADINGVIEW_CHART_URL
    });

    // Step 2: Fetch Macro & Gold News Headlines
    console.log('[Pipeline] Step 2/4: Fetching live macroeconomic and Gold (XAU/USD) news...');
    let newsItems = [];
    try {
      newsItems = await fetchGoldMacroNews();
    } catch (newsErr) {
      console.warn('[Pipeline] News fetch warning:', newsErr.message);
    }

    // Step 3: Gemini Multimodal + Macro News Analysis
    console.log('[Pipeline] Step 3/4: Executing Gemini Multimodal & Macro analysis...');
    const analysisJson = await analyzeChartWithGemini(snapshot.fullPath, {
      asset: snapshot.asset,
      sessionName,
      newsItems
    });

    // Step 4: Persist into Database
    console.log('[Pipeline] Step 4/4: Storing structured analysis in database...');
    const savedRecord = saveAnalysis({
      ...analysisJson,
      session_name: sessionName,
      image_path: snapshot.imagePath
    });

    // Step 5: Dispatch to Discord Webhook
    console.log('[Pipeline] Dispatching analysis to Discord webhook...');
    try {
      await sendAnalysisToDiscord(savedRecord, snapshot.fullPath);
    } catch (discordErr) {
      console.warn('[Pipeline] Discord notification encountered an issue, but analysis is preserved:', discordErr.message);
    }

    console.log(`[Pipeline] Completed successfully! Saved analysis #${savedRecord.id}`);
    console.log(`======================================================\n`);

    lastRunResult = {
      id: savedRecord.id,
      timestamp: savedRecord.timestamp,
      sessionName: savedRecord.session_name,
      bias: savedRecord.bias
    };

    return savedRecord;

  } catch (error) {
    console.error('[Pipeline] Pipeline execution failed:', error);
    lastError = error.message;
    throw error;
  } finally {
    isRunning = false;
  }
}

/**
 * Initializes the node-cron schedules for the 3 market session opens.
 */
function initializeScheduler() {
  console.log('[Scheduler] Registering 3 Daily Session Cron Jobs (UTC):');

  // 1. 07:00 UTC - London Open
  cron.schedule('0 7 * * *', async () => {
    console.log('[Cron] 07:00 UTC Triggered: London Open');
    try {
      await runAnalysisPipeline({ sessionName: 'London Open' });
    } catch (e) {
      console.error('[Cron] London Open job failed:', e.message);
    }
  }, { timezone: 'UTC' });
  console.log(' - 07:00 UTC: London Open (0 7 * * *)');

  // 2. 12:30 UTC - New York Pre-market / Open
  cron.schedule('30 12 * * *', async () => {
    console.log('[Cron] 12:30 UTC Triggered: New York Open');
    try {
      await runAnalysisPipeline({ sessionName: 'New York Open' });
    } catch (e) {
      console.error('[Cron] New York Open job failed:', e.message);
    }
  }, { timezone: 'UTC' });
  console.log(' - 12:30 UTC: New York Pre-market / Open (30 12 * * *)');

  // 3. 17:00 UTC - London Fix / US Midday
  cron.schedule('0 17 * * *', async () => {
    console.log('[Cron] 17:00 UTC Triggered: London Fix / US Midday');
    try {
      await runAnalysisPipeline({ sessionName: 'London Fix / US Midday' });
    } catch (e) {
      console.error('[Cron] London Fix job failed:', e.message);
    }
  }, { timezone: 'UTC' });
  console.log(' - 17:00 UTC: London Fix / US Midday (0 17 * * *)');
}

module.exports = {
  initializeScheduler,
  runAnalysisPipeline,
  getSchedulerStatus,
  SCHEDULED_SESSIONS
};
