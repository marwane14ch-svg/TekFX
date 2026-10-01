const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, '..', 'analysis.db');

let dbInstance = null;

function getDb() {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    initSchema(dbInstance);
  }
  return dbInstance;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      session_name TEXT NOT NULL,
      asset TEXT NOT NULL,
      bias TEXT NOT NULL,
      poc REAL,
      vah REAL,
      val REAL,
      support REAL,
      resistance REAL,
      price_action_summary TEXT,
      primary_scenario TEXT,
      invalidation_level REAL,
      full_markdown_analysis TEXT,
      image_path TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

function saveAnalysis(analysisData) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO analyses (
      timestamp, session_name, asset, bias,
      poc, vah, val, support, resistance,
      price_action_summary, primary_scenario,
      invalidation_level, full_markdown_analysis,
      image_path, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const primaryScenarioStr = typeof analysisData.primary_scenario === 'object'
    ? JSON.stringify(analysisData.primary_scenario)
    : (analysisData.primary_scenario || '{}');

  const keyLevels = analysisData.key_levels || {};

  const info = stmt.run(
    analysisData.timestamp || new Date().toISOString(),
    analysisData.session_name || 'Manual Analysis',
    analysisData.asset || 'BTC/USDT',
    (analysisData.bias || 'NEUTRAL').toUpperCase(),
    Number(keyLevels.poc ?? analysisData.poc ?? 0),
    Number(keyLevels.vah ?? analysisData.vah ?? 0),
    Number(keyLevels.val ?? analysisData.val ?? 0),
    Number(keyLevels.support ?? analysisData.support ?? 0),
    Number(keyLevels.resistance ?? analysisData.resistance ?? 0),
    analysisData.price_action_summary || '',
    primaryScenarioStr,
    Number(analysisData.invalidation_level ?? 0),
    analysisData.full_markdown_analysis || '',
    analysisData.image_path || '',
    new Date().toISOString()
  );

  return getAnalysisById(info.lastInsertRowid);
}

function formatRow(row) {
  if (!row) return null;
  let primaryScenario = {};
  try {
    primaryScenario = JSON.parse(row.primary_scenario || '{}');
  } catch (e) {
    primaryScenario = { raw: row.primary_scenario };
  }

  return {
    id: row.id,
    timestamp: row.timestamp,
    session_name: row.session_name,
    asset: row.asset,
    bias: row.bias,
    key_levels: {
      poc: row.poc,
      vah: row.vah,
      val: row.val,
      support: row.support,
      resistance: row.resistance
    },
    price_action_summary: row.price_action_summary,
    primary_scenario: primaryScenario,
    invalidation_level: row.invalidation_level,
    full_markdown_analysis: row.full_markdown_analysis,
    image_path: row.image_path,
    created_at: row.created_at
  };
}

function getAllAnalyses(limit = 50) {
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM analyses ORDER BY id DESC LIMIT ?`).all(limit);
  return rows.map(formatRow);
}

function getLatestAnalysis() {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM analyses ORDER BY id DESC LIMIT 1`).get();
  return formatRow(row);
}

function getAnalysisById(id) {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM analyses WHERE id = ?`).get(id);
  return formatRow(row);
}

function seedInitialDataIfEmpty() {
  const db = getDb();
  const countRow = db.prepare(`SELECT COUNT(*) as count FROM analyses`).get();
  if (countRow.count === 0) {
    console.log('[Database] Seeding sample historical analyses...');
    saveAnalysis({
      timestamp: '2026-10-01T07:00:00Z',
      session_name: 'London Open',
      asset: 'BTC/USDT (Perp)',
      bias: 'BULLISH',
      key_levels: {
        poc: 64250,
        vah: 65100,
        val: 63800,
        support: 63500,
        resistance: 65800
      },
      price_action_summary: 'Price accepted above developing VAH with aggressive bid absorption at 64,250 POC during early European session. Value migration skewed higher.',
      primary_scenario: {
        direction: 'Bullish Continuation',
        targets: [65100, 65800, 66400],
        trigger: 'Sustained acceptance above 64,500 on 15m volume expansion.'
      },
      invalidation_level: 63800,
      full_markdown_analysis: `### Auction Market Theory Breakdown
- **Value Area:** Developing Value Area High at **$65,100** and Value Area Low at **$63,800**.
- **Point of Control (POC):** High-volume accumulation node confirmed at **$64,250**.
- **Order Flow & Absorption:** Large delta absorption clusters visible in the lower quadrant of the rotation, showing passive institutional limits catching the dips.
- **Expectation:** Responsive buying into London Open creates rotational upside toward prior weekly high liquidity pools.`,
      image_path: '/snapshots/sample_chart_london.png'
    });

    saveAnalysis({
      timestamp: '2026-10-01T12:30:00Z',
      session_name: 'New York Open',
      asset: 'BTC/USDT (Perp)',
      bias: 'BULLISH',
      key_levels: {
        poc: 64800,
        vah: 65450,
        val: 64200,
        support: 64000,
        resistance: 66200
      },
      price_action_summary: 'Breakout from rotational balance. Initial Balance (IB) established between 64,600 and 65,200 with initiative buying continuing into the US cash open.',
      primary_scenario: {
        direction: 'Trend Day Extension',
        targets: [65800, 66500],
        trigger: 'Retest and hold of session POC at 64,800.'
      },
      invalidation_level: 64200,
      full_markdown_analysis: `### Auction Market Theory Breakdown
- **Structure:** Double-distribution profile emerging. Volume concentrated in two distinct nodes, characteristic of an initiative drive.
- **Value Migration:** Value has cleanly shifted up from the London session. Price trading in single prints above $65,000.
- **Risk Assessment:** Any auction back inside the prior session VAH ($64,200) invalidates the momentum scenario and triggers a mean-reversion re-auction down to $63,800.`,
      image_path: '/snapshots/sample_chart_ny.png'
    });
  }
}

module.exports = {
  getDb,
  saveAnalysis,
  getAllAnalyses,
  getLatestAnalysis,
  getAnalysisById,
  seedInitialDataIfEmpty
};
