require('dotenv').config();
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

/**
 * Sends an email notification containing the structured Auction Market Theory breakdown
 * and the embedded TradingView chart snapshot.
 * 
 * @param {Object} analysis - The structured analysis record
 * @param {string} imageFullPath - Absolute filesystem path to the snapshot image
 * @returns {Promise<{sent: boolean, messageId?: string, reason?: string}>}
 */
async function sendAnalysisEmail(analysis, imageFullPath) {
  const recipient = process.env.ALERT_EMAIL_RECIPIENT || 'marwane19ch@gmail.com';
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = Number(process.env.SMTP_PORT) || 465;
  const secure = smtpPort === 465;

  if (!smtpUser || !smtpPass) {
    console.warn(`[Email] SMTP_USER or SMTP_PASS is not configured in .env / Railway variables.`);
    console.warn(`[Email] Notice: Email to ${recipient} was skipped. To activate email delivery, set SMTP_USER and SMTP_PASS (e.g. a Gmail App Password) in your Railway Variables.`);
    return { sent: false, reason: 'missing_credentials' };
  }

  console.log(`[Email] Dispatching analysis notification to ${recipient} via ${smtpHost}...`);

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: secure,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });

  const bias = (analysis.bias || 'NEUTRAL').toUpperCase();
  const biasColor = bias === 'BULLISH' ? '#00c087' : (bias === 'BEARISH' ? '#f6465d' : '#f0b90b');
  const biasBg = bias === 'BULLISH' ? 'rgba(0,192,135,0.15)' : (bias === 'BEARISH' ? 'rgba(246,70,93,0.15)' : 'rgba(240,185,11,0.15)');
  const biasEmoji = bias === 'BULLISH' ? '🟢' : (bias === 'BEARISH' ? '🔴' : '🟡');

  const keyLevels = analysis.key_levels || {};
  const pocStr = keyLevels.poc ? `$${Number(keyLevels.poc).toLocaleString()}` : '--';
  const vahStr = keyLevels.vah ? `$${Number(keyLevels.vah).toLocaleString()}` : '--';
  const valStr = keyLevels.val ? `$${Number(keyLevels.val).toLocaleString()}` : '--';
  const supStr = keyLevels.support ? `$${Number(keyLevels.support).toLocaleString()}` : '--';
  const resStr = keyLevels.resistance ? `$${Number(keyLevels.resistance).toLocaleString()}` : '--';
  const invStr = analysis.invalidation_level ? `$${Number(analysis.invalidation_level).toLocaleString()}` : '--';

  const scenario = analysis.primary_scenario || {};
  const targets = Array.isArray(scenario.targets) ? scenario.targets.map(t => `$${Number(t).toLocaleString()}`).join(', ') : 'Discretionary';

  const chartUrl = process.env.TRADINGVIEW_CHART_URL || 'https://www.tradingview.com/chart/?symbol=BINANCE:BTCUSDT';
  const dateFormatted = new Date(analysis.timestamp || Date.now()).toUTCString();

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Market Analysis: ${analysis.asset}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0b0e14; color: #f0f4fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .container { max-width: 650px; margin: 20px auto; background: #121721; border: 1px solid #232c3d; border-radius: 12px; overflow: hidden; }
    .header { padding: 24px; background: #161c28; border-bottom: 1px solid #232c3d; }
    .title { margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: 0.03em; }
    .subtitle { margin-top: 6px; font-size: 13px; color: #8b9bb4; }
    .body-content { padding: 24px; }
    .badge-bias { display: inline-block; padding: 6px 16px; border-radius: 6px; font-size: 16px; font-weight: 800; color: ${biasColor}; background: ${biasBg}; border: 1px solid ${biasColor}; margin-bottom: 16px; }
    .grid { display: table; width: 100%; border-collapse: separate; border-spacing: 8px; margin: 16px 0; }
    .grid-row { display: table-row; }
    .grid-cell { display: table-cell; background: #18202d; padding: 12px 14px; border-radius: 8px; border: 1px solid #2a3447; width: 33%; }
    .cell-label { font-size: 11px; color: #8b9bb4; font-weight: 600; text-transform: uppercase; margin-bottom: 4px; }
    .cell-value { font-size: 16px; font-weight: 700; color: #ffffff; font-family: monospace; }
    .section { background: #151c27; border: 1px solid #232c3d; border-radius: 8px; padding: 16px; margin: 18px 0; }
    .section-title { font-size: 12px; font-weight: 700; color: #8b9bb4; text-transform: uppercase; margin: 0 0 8px 0; }
    .section-text { font-size: 14px; color: #e2e8f0; line-height: 1.6; margin: 0; }
    .risk-box { background: rgba(246,70,93,0.1); border-left: 4px solid #f6465d; padding: 12px 16px; border-radius: 6px; margin: 16px 0; font-size: 13px; }
    .chart-container { margin: 20px 0; text-align: center; background: #000; border-radius: 8px; overflow: hidden; border: 1px solid #232c3d; }
    .chart-img { width: 100%; max-width: 100%; height: auto; display: block; }
    .btn-action { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; font-size: 13px; margin-top: 12px; }
    .footer { padding: 18px 24px; background: #0e121a; border-top: 1px solid #232c3d; font-size: 11px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">AUCTION MARKET INTEL</h1>
      <div class="subtitle">Session: <strong>${analysis.session_name}</strong> • ${dateFormatted}</div>
    </div>
    
    <div class="body-content">
      <div>
        <span class="badge-bias">${biasEmoji} BIAS: ${bias}</span>
      </div>

      <div class="grid">
        <div class="grid-row">
          <div class="grid-cell">
            <div class="cell-label">Point of Control (POC)</div>
            <div class="cell-value" style="color: #22d3ee;">${pocStr}</div>
          </div>
          <div class="grid-cell">
            <div class="cell-label">Value Area High (VAH)</div>
            <div class="cell-value" style="color: #a78bfa;">${vahStr}</div>
          </div>
          <div class="grid-cell">
            <div class="cell-label">Value Area Low (VAL)</div>
            <div class="cell-value" style="color: #38bdf8;">${valStr}</div>
          </div>
        </div>
        <div class="grid-row">
          <div class="grid-cell">
            <div class="cell-label">Support</div>
            <div class="cell-value">${supStr}</div>
          </div>
          <div class="grid-cell">
            <div class="cell-label">Resistance</div>
            <div class="cell-value">${resStr}</div>
          </div>
          <div class="grid-cell">
            <div class="cell-label">Invalidation / Stop</div>
            <div class="cell-value" style="color: #f6465d;">${invStr}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Structure & Price Action</div>
        <p class="section-text">${analysis.price_action_summary || 'N/A'}</p>
      </div>

      <div class="section" style="border-left: 4px solid #22d3ee;">
        <div class="section-title">Primary Scenario Plan</div>
        <p class="section-text"><strong>Direction:</strong> ${scenario.direction || 'N/A'}</p>
        <p class="section-text"><strong>Trigger:</strong> ${scenario.trigger || 'N/A'}</p>
        <p class="section-text"><strong>Targets:</strong> ${targets}</p>
      </div>

      <div class="risk-box">
        <strong>Invalidation Level: ${invStr}</strong><br>
        Auction acceptance beyond this boundary invalidates the current thesis.
      </div>

      <div class="chart-container">
        <img src="cid:chartSnapshot" alt="TradingView Chart Snapshot" class="chart-img"/>
      </div>

      <center>
        <a href="${chartUrl}" target="_blank" class="btn-action">Open Live TradingView Layout ↗</a>
      </center>
    </div>

    <div class="footer">
      Automated Financial Analysis • Powered by Gemini 3.8 Flash Vision & Playwright<br>
      Recipient: ${recipient}
    </div>
  </div>
</body>
</html>
  `;

  const mailOptions = {
    from: `"Auction Market Intel" <${smtpUser}>`,
    to: recipient,
    subject: `[${bias}] ${analysis.session_name || 'Market Open'}: ${analysis.asset || 'BTC/USDT'} Analysis ${biasEmoji}`,
    html: htmlContent,
    attachments: fs.existsSync(imageFullPath) ? [
      {
        filename: path.basename(imageFullPath),
        path: imageFullPath,
        cid: 'chartSnapshot'
      }
    ] : []
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] Notification successfully sent to ${recipient}! Message ID: ${info.messageId}`);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Email] Delivery error to ${recipient}:`, err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = {
  sendAnalysisEmail
};
