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
      news_macro_analysis TEXT,
      full_markdown_analysis TEXT,
      image_path TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Migration: add news_macro_analysis if not present
  try {
    db.exec(`ALTER TABLE analyses ADD COLUMN news_macro_analysis TEXT;`);
  } catch (e) {
    // Column already exists
  }
}

function saveAnalysis(analysisData) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO analyses (
      timestamp, session_name, asset, bias,
      poc, vah, val, support, resistance,
      price_action_summary, primary_scenario,
      invalidation_level, news_macro_analysis,
      full_markdown_analysis, image_path, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const primaryScenarioStr = typeof analysisData.primary_scenario === 'object'
    ? JSON.stringify(analysisData.primary_scenario)
    : (analysisData.primary_scenario || '{}');

  const newsMacroStr = typeof analysisData.news_macro_analysis === 'object'
    ? JSON.stringify(analysisData.news_macro_analysis)
    : (analysisData.news_macro_analysis || '{}');

  const keyLevels = analysisData.key_levels || {};

  const info = stmt.run(
    analysisData.timestamp || new Date().toISOString(),
    analysisData.session_name || 'Manual Analysis',
    analysisData.asset || 'XAU/USD',
    (analysisData.bias || 'NEUTRAL').toUpperCase(),
    Number(keyLevels.poc ?? analysisData.poc ?? 0),
    Number(keyLevels.vah ?? analysisData.vah ?? 0),
    Number(keyLevels.val ?? analysisData.val ?? 0),
    Number(keyLevels.support ?? analysisData.support ?? 0),
    Number(keyLevels.resistance ?? analysisData.resistance ?? 0),
    analysisData.price_action_summary || '',
    primaryScenarioStr,
    Number(analysisData.invalidation_level ?? 0),
    newsMacroStr,
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

  let newsMacro = {};
  try {
    newsMacro = JSON.parse(row.news_macro_analysis || '{}');
  } catch (e) {
    newsMacro = { macro_summary: row.news_macro_analysis };
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
    news_macro_analysis: newsMacro,
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
      asset: 'XAU/USD (Gold)',
      bias: 'BULLISH',
      key_levels: {
        poc: 2648.50,
        vah: 2662.00,
        val: 2638.20,
        support: 2630.00,
        resistance: 2675.00
      },
      price_action_summary: 'Gold accepted above developing session VAH with heavy bid absorption at $2,648 POC. Buyers defending value against US Dollar pressure.',
      primary_scenario: {
        direction: 'Bullish Continuation',
        targets: [2662.00, 2675.00, 2690.00],
        trigger: 'Acceptance above 2,652.00 during European session volume expansion.'
      },
      invalidation_level: 2638.20,
      news_macro_analysis: {
        sentiment: 'BULLISH',
        gold_catalysts: ['Fed rate cut expectations', 'DXY weakness', 'Middle East geopolitical safe-haven bids', 'Central bank accumulation'],
        dxy_yield_impact: '10-Year US Treasury yields retreating below 4.05% lowers opportunity cost of holding non-yielding bullion; DXY under structural pressure.',
        macro_summary: 'Dovish FOMC rhetoric combined with heightened geopolitical safe-haven flows continues to provide fundamental tailwinds for Gold bullion.',
        high_impact_risk_factors: ['US Core PCE Inflation release', 'Fed Chair Powell press briefing', 'Upcoming Non-Farm Payrolls']
      },
      full_markdown_analysis: `### Auction Market Theory & Macro Breakdown
- **Asset:** XAU/USD (Spot Gold)
- **Value Area:** VAH at **$2,662.00**, VAL at **$2,638.20**.
- **Point of Control (POC):** Primary auction node at **$2,648.50**.
- **Macro Alignment:** Macro catalysts strongly support the technical auction structure. Bullish initiative buying aligning with softening US Dollar index.`,
      image_path: '/snapshots/sample_chart_london.png'
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
