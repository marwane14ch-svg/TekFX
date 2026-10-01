// Financial Analysis Dashboard Client Logic

let state = {
  currentAnalysis: null,
  allAnalyses: [],
  nextRunTime: null,
  isAnalyzing: false
};

// DOM Elements
const utcClockEl = document.getElementById('utcClock');
const currentSessionEl = document.getElementById('currentSessionDisplay');
const countdownEl = document.getElementById('nextRunCountdown');
const btnTriggerManual = document.getElementById('btnTriggerManual');
const noticeBanner = document.getElementById('noticeBanner');

// Metrics Elements
const metricBiasValue = document.getElementById('metricBiasValue');
const metricBiasSub = document.getElementById('metricBiasSub');
const metricPoc = document.getElementById('metricPoc');
const metricVah = document.getElementById('metricVah');
const metricVal = document.getElementById('metricVal');
const metricInvalidation = document.getElementById('metricInvalidation');

// Main Panel Elements
const chartImage = document.getElementById('chartImage');
const snapshotAssetTag = document.getElementById('snapshotAssetTag');
const snapshotSessionTag = document.getElementById('snapshotSessionTag');
const snapshotTimeTag = document.getElementById('snapshotTimeTag');
const analysisPriceAction = document.getElementById('analysisPriceAction');
const scenarioDirection = document.getElementById('scenarioDirection');
const scenarioTrigger = document.getElementById('scenarioTrigger');
const scenarioTargetsList = document.getElementById('scenarioTargetsList');
const invalidationPrice = document.getElementById('invalidationPrice');
const fullMarkdownContent = document.getElementById('fullMarkdownContent');

// Archive & Lightbox
const archiveGrid = document.getElementById('archiveGrid');
const archiveCount = document.getElementById('archiveCount');
const lightboxModal = document.getElementById('lightboxModal');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxBackdrop = document.getElementById('lightboxBackdrop');
const btnCloseLightbox = document.getElementById('btnCloseLightbox');
const btnOpenLightbox = document.getElementById('btnOpenLightbox');

// Clock & Countdown Tickers
function updateClocks() {
  const now = new Date();
  utcClockEl.textContent = now.toUTCString().slice(17, 25);

  if (state.nextRunTime) {
    const diff = new Date(state.nextRunTime).getTime() - now.getTime();
    if (diff > 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      countdownEl.textContent = `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
    } else {
      countdownEl.textContent = 'Session Due Now';
    }
  }
}

// Fetch Status from Server
async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    const json = await res.json();
    if (json.success && json.data) {
      currentSessionEl.textContent = json.data.currentSession || 'Global Session';
      state.nextRunTime = json.data.nextRunTime;

      if (json.data.targetUrl) {
        state.targetUrl = json.data.targetUrl;
        const chartLayoutLink = document.getElementById('chartLayoutLink');
        const headerChartLink = document.getElementById('headerChartLink');
        const headerChartText = document.getElementById('headerChartText');
        const chartUrlDisplay = document.getElementById('chartUrlDisplay');

        if (chartLayoutLink) {
          chartLayoutLink.href = json.data.targetUrl;
          chartLayoutLink.title = `Open live TradingView chart: ${json.data.targetUrl}`;
        }
        if (headerChartLink) {
          headerChartLink.href = json.data.targetUrl;
        }
        const cleanUrl = json.data.targetUrl.replace(/^https?:\/\/(www\.)?tradingview\.com\//i, '');
        if (headerChartText) {
          headerChartText.textContent = cleanUrl ? `TV: ${cleanUrl}` : 'Live Chart';
        }
        if (chartUrlDisplay) {
          chartUrlDisplay.href = json.data.targetUrl;
          chartUrlDisplay.textContent = json.data.targetUrl;
        }
      }

      if (json.data.model) {
        state.model = json.data.model;
        const aiEngineTag = document.getElementById('aiEngineTag');
        const aiPanelTitle = document.getElementById('aiPanelTitle');
        const formatted = json.data.model.replace(/^gemini-/i, 'Gemini ');
        if (aiEngineTag) aiEngineTag.textContent = formatted;
        if (aiPanelTitle) aiPanelTitle.textContent = `Multimodal ${formatted} Analysis`;
      }

      if (!json.data.geminiConfigured) {
        noticeBanner.classList.remove('hidden');
        noticeBanner.innerHTML = `<strong>Notice:</strong> <code>GEMINI_API_KEY</code> is not configured in <code>.env</code>. Running in high-fidelity Auction Market Theory simulation mode. Add your key to activate live Gemini multimodal vision.`;
      } else {
        noticeBanner.classList.add('hidden');
      }
    }
  } catch (err) {
    console.warn('Failed to load status:', err);
  }
}

// Fetch All Analyses
async function fetchAnalyses() {
  try {
    const res = await fetch('/api/analyses');
    const json = await res.json();
    if (json.success && json.data && json.data.length > 0) {
      state.allAnalyses = json.data;
      if (!state.currentAnalysis) {
        state.currentAnalysis = state.allAnalyses[0];
      }
      renderCurrentAnalysis();
      renderArchive();
    }
  } catch (err) {
    console.error('Failed to load analyses:', err);
  }
}

// Render Current Selected Analysis
function renderCurrentAnalysis() {
  const a = state.currentAnalysis;
  if (!a) return;

  // Asset & Session Tags
  snapshotAssetTag.textContent = a.asset || 'BTC/USDT';
  snapshotSessionTag.textContent = a.session_name || 'Session';
  
  const dateObj = new Date(a.timestamp);
  snapshotTimeTag.textContent = isNaN(dateObj.getTime()) ? a.timestamp : dateObj.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  if (a.model_used) {
    const aiEngineTag = document.getElementById('aiEngineTag');
    const aiPanelTitle = document.getElementById('aiPanelTitle');
    const formatted = a.model_used.replace(/^gemini-/i, 'Gemini ');
    if (aiEngineTag) aiEngineTag.textContent = formatted;
    if (aiPanelTitle) aiPanelTitle.textContent = `Multimodal ${formatted} Analysis`;
  }

  // Chart Image
  if (a.image_path) {
    chartImage.src = a.image_path;
    lightboxImage.src = a.image_path;
  }

  // Directional Bias Badge
  const bias = (a.bias || 'NEUTRAL').toUpperCase();
  metricBiasValue.textContent = bias;
  metricBiasValue.className = `badge-bias bias-${bias.toLowerCase()}`;

  if (bias === 'BULLISH') {
    metricBiasSub.textContent = 'Acceptance above value • Buyer initiative';
  } else if (bias === 'BEARISH') {
    metricBiasSub.textContent = 'Liquidation below value • Seller aggression';
  } else {
    metricBiasSub.textContent = 'Balanced bracket • Responsive mean reversion';
  }

  // Key Levels
  const levels = a.key_levels || {};
  metricPoc.textContent = levels.poc ? Number(levels.poc).toLocaleString() : '--';
  metricVah.textContent = levels.vah ? Number(levels.vah).toLocaleString() : '--';
  metricVal.textContent = levels.val ? Number(levels.val).toLocaleString() : '--';
  metricInvalidation.textContent = a.invalidation_level ? Number(a.invalidation_level).toLocaleString() : '--';
  invalidationPrice.textContent = a.invalidation_level ? `$${Number(a.invalidation_level).toLocaleString()}` : 'N/A';

  // Analysis Summary
  analysisPriceAction.textContent = a.price_action_summary || 'No price action summary provided.';

  // Primary Scenario
  const scenario = a.primary_scenario || {};
  scenarioDirection.textContent = scenario.direction || 'Mean Reversion';
  scenarioTrigger.textContent = scenario.trigger || 'Reclaim of session value area.';

  // Scenario Targets
  scenarioTargetsList.innerHTML = '';
  if (Array.isArray(scenario.targets) && scenario.targets.length > 0) {
    scenario.targets.forEach((tgt, idx) => {
      const span = document.createElement('span');
      span.className = 'target-pill';
      span.textContent = `TP${idx + 1}: $${Number(tgt).toLocaleString()}`;
      scenarioTargetsList.appendChild(span);
    });
  } else {
    scenarioTargetsList.textContent = 'Discretionary trail';
  }

  // Full Markdown Analysis
  if (typeof marked !== 'undefined' && a.full_markdown_analysis) {
    fullMarkdownContent.innerHTML = marked.parse(a.full_markdown_analysis);
  } else {
    fullMarkdownContent.textContent = a.full_markdown_analysis || 'No detailed markdown breakdown recorded.';
  }
}

// Render History / Archive Grid
function renderArchive() {
  archiveGrid.innerHTML = '';
  archiveCount.textContent = `(${state.allAnalyses.length} snapshots)`;

  state.allAnalyses.forEach(item => {
    const card = document.createElement('div');
    card.className = `archive-card ${state.currentAnalysis && state.currentAnalysis.id === item.id ? 'active' : ''}`;
    
    const bias = (item.bias || 'NEUTRAL').toUpperCase();
    const dateFormatted = new Date(item.timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    card.innerHTML = `
      <div class="archive-card-thumb-wrap">
        <img src="${item.image_path}" alt="${item.session_name}" class="archive-card-thumb" onerror="this.src='/snapshots/sample_chart_london.png'"/>
        <span class="archive-thumb-badge badge-bias bias-${bias.toLowerCase()}">${bias}</span>
      </div>
      <div class="archive-card-body">
        <div class="archive-card-row">
          <span class="archive-session-title">${item.session_name}</span>
          <span class="archive-time">${dateFormatted}</span>
        </div>
        <div class="archive-levels-pill">
          <span>POC: <strong>$${item.key_levels?.poc?.toLocaleString() || '--'}</strong></span>
          <span>VAH: <strong>$${item.key_levels?.vah?.toLocaleString() || '--'}</strong></span>
          <span>VAL: <strong>$${item.key_levels?.val?.toLocaleString() || '--'}</strong></span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      state.currentAnalysis = item;
      renderCurrentAnalysis();
      renderArchive();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    archiveGrid.appendChild(card);
  });
}

// Manual Trigger Handler
btnTriggerManual.addEventListener('click', async () => {
  if (state.isAnalyzing) return;

  state.isAnalyzing = true;
  btnTriggerManual.disabled = true;
  const originalHtml = btnTriggerManual.innerHTML;
  btnTriggerManual.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
      <line x1="12" y1="2" x2="12" y2="6"/>
      <line x1="12" y1="18" x2="12" y2="22"/>
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
      <line x1="2" y1="12" x2="6" y2="12"/>
      <line x1="18" y1="12" x2="22" y2="12"/>
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
    </svg>
    <span>Capturing & Analyzing...</span>
  `;

  try {
    const res = await fetch('/api/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionName: 'Manual Trigger' })
    });
    const json = await res.json();
    if (json.success && json.data) {
      state.currentAnalysis = json.data;
      await fetchAnalyses();
    } else {
      alert('Analysis trigger returned error: ' + (json.error || 'Unknown error'));
    }
  } catch (err) {
    alert('Failed to trigger analysis: ' + err.message);
  } finally {
    state.isAnalyzing = false;
    btnTriggerManual.disabled = false;
    btnTriggerManual.innerHTML = originalHtml;
  }
});

// Lightbox Handlers
btnOpenLightbox.addEventListener('click', () => {
  lightboxModal.classList.remove('hidden');
});
chartImage.addEventListener('click', () => {
  lightboxModal.classList.remove('hidden');
});
btnCloseLightbox.addEventListener('click', () => {
  lightboxModal.classList.add('hidden');
});
lightboxBackdrop.addEventListener('click', () => {
  lightboxModal.classList.add('hidden');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !lightboxModal.classList.contains('hidden')) {
    lightboxModal.classList.add('hidden');
  }
});

// Initialize
setInterval(updateClocks, 1000);
updateClocks();
fetchStatus();
fetchAnalyses();
setInterval(fetchStatus, 15000);
