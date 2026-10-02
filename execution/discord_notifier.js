const fs = require('fs');
const path = require('path');

/**
 * Sends a rich Auction Market Theory analysis with the captured chart snapshot to Discord.
 * 
 * @param {Object} analysis - The structured analysis object
 * @param {string} snapshotFullPath - Absolute path to the captured screenshot PNG
 * @returns {Promise<boolean>}
 */
async function sendAnalysisToDiscord(analysis, snapshotFullPath) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl || webhookUrl.includes('your_discord_webhook')) {
    console.warn('[Discord] No DISCORD_WEBHOOK_URL configured in environment variables. Skipping notification.');
    return false;
  }

  try {
    const bias = (analysis.bias || 'NEUTRAL').toUpperCase();
    
    // Discord Embed Colors
    let embedColor = 0xf0b90b; // Yellow / Neutral
    let biasEmoji = '⚖️';
    if (bias === 'BULLISH') {
      embedColor = 0x00c087; // Emerald Green
      biasEmoji = '🟢';
    } else if (bias === 'BEARISH') {
      embedColor = 0xf6465d; // Rose Red
      biasEmoji = '🔴';
    }

    const keyLevels = analysis.key_levels || {};
    const scenario = analysis.primary_scenario || {};
    const targetsStr = Array.isArray(scenario.targets) && scenario.targets.length > 0
      ? scenario.targets.map((t, idx) => `TP${idx + 1}: **$${Number(t).toLocaleString()}**`).join(' | ')
      : 'Discretionary trail';

    const chartUrl = process.env.TRADINGVIEW_CHART_URL || 'https://www.tradingview.com/chart/FeQoOntU/';

    const fields = [
      {
        name: '🎯 Point of Control (POC)',
        value: `**$${Number(keyLevels.poc || 0).toLocaleString()}**`,
        inline: true
      },
      {
        name: '📏 Value Area (VAH / VAL)',
        value: `**$${Number(keyLevels.vah || 0).toLocaleString()}** / **$${Number(keyLevels.val || 0).toLocaleString()}**`,
        inline: true
      },
      {
        name: '🛑 Invalidation Level',
        value: `**$${Number(analysis.invalidation_level || 0).toLocaleString()}**`,
        inline: true
      },
      {
        name: '📌 Market Structure & Price Action',
        value: analysis.price_action_summary || 'Price action evaluating value boundaries.',
        inline: false
      },
      {
        name: '🚀 Primary Trade Plan',
        value: `• **Direction:** ${scenario.direction || 'Mean Reversion'}\n• **Trigger:** ${scenario.trigger || 'Reclaim of value area.'}\n• **Targets:** ${targetsStr}`,
        inline: false
      }
    ];

    // Append Macroeconomic & News Catalysts section
    const newsMacro = analysis.news_macro_analysis || {};
    if (newsMacro.macro_summary || newsMacro.gold_catalysts) {
      let macroText = '';
      if (newsMacro.sentiment) {
        macroText += `• **Macro Bias:** **${newsMacro.sentiment}**\n`;
      }
      if (Array.isArray(newsMacro.gold_catalysts) && newsMacro.gold_catalysts.length > 0) {
        macroText += `• **Key Catalysts:** ${newsMacro.gold_catalysts.slice(0, 4).join(' • ')}\n`;
      }
      if (newsMacro.dxy_yield_impact) {
        macroText += `• **DXY & Yields:** ${newsMacro.dxy_yield_impact}\n`;
      }
      if (newsMacro.macro_summary) {
        macroText += `• **Assessment:** ${newsMacro.macro_summary}\n`;
      }
      if (Array.isArray(newsMacro.high_impact_risk_factors) && newsMacro.high_impact_risk_factors.length > 0) {
        macroText += `• **High-Impact Risk Events:** ${newsMacro.high_impact_risk_factors.slice(0, 3).join(', ')}`;
      }

      if (macroText.length > 1020) macroText = macroText.slice(0, 1015) + '...';

      fields.splice(4, 0, {
        name: '🌍 Macro & News Catalysts (XAU/USD)',
        value: macroText,
        inline: false
      });
    }

    // Append full markdown summary if available (truncated safely to Discord 1024 char limit)
    if (analysis.full_markdown_analysis) {
      let notes = analysis.full_markdown_analysis.replace(/###/g, '**').replace(/##/g, '**');
      if (notes.length > 1000) {
        notes = notes.slice(0, 995) + '...';
      }
      fields.push({
        name: '📋 Auction Market Theory Notes',
        value: notes,
        inline: false
      });
    }

    const embed = {
      title: `${biasEmoji} [${bias}] ${analysis.asset || 'BTC/USDT'} — ${analysis.session_name || 'Market Session'}`,
      url: chartUrl,
      color: embedColor,
      description: `New automated market session analysis completed by **${analysis.model_used || 'Gemini 3.8 Flash'}**.\n[🔗 Open Live TradingView Chart Layout](${chartUrl})`,
      fields,
      footer: {
        text: `Engine: ${analysis.model_used || 'Gemini 3.8 Flash'} • Auction Market Intel AI`
      },
      timestamp: analysis.timestamp || new Date().toISOString()
    };

    // Prepare multipart payload if image exists
    const formData = new FormData();

    if (snapshotFullPath && fs.existsSync(snapshotFullPath)) {
      const fileBuffer = fs.readFileSync(snapshotFullPath);
      const blob = new Blob([fileBuffer], { type: 'image/png' });
      formData.append('files[0]', blob, 'chart_snapshot.png');
      embed.image = { url: 'attachment://chart_snapshot.png' };
    }

    formData.append('payload_json', JSON.stringify({
      username: 'Auction Market Intel AI',
      avatar_url: 'https://cdn-icons-png.flaticon.com/512/3313/3313936.png',
      embeds: [embed]
    }));

    console.log(`[Discord] Dispatching analysis notification to webhook...`);
    const response = await fetch(webhookUrl, {
      method: 'POST',
      body: formData
    });

    if (response.ok || response.status === 204) {
      console.log(`[Discord] Notification sent successfully! (Status: ${response.status})`);
      return true;
    } else {
      const errText = await response.text();
      console.error(`[Discord] Webhook returned error ${response.status}: ${errText}`);
      return false;
    }

  } catch (error) {
    console.error('[Discord] Failed to send webhook notification:', error.message);
    return false;
  }
}

module.exports = {
  sendAnalysisToDiscord
};
