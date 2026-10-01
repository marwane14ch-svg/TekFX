require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const SYSTEM_INSTRUCTION = `You are an expert Auction Market Theory and Volume Profile technical analyst.
Analyze the provided candlestick chart and volume profile:
1. Identify Key Levels: Point of Control (POC), Value Area High (VAH), Value Area Low (VAL), and key swing points/institutional levels.
2. Structure & Price Action: Determine if price is balancing, breaking out, liquidating, or absorbing at key volume nodes.
3. Directional Bias: State immediate probability (Bullish continuation, Bearish continuation, or Mean Reversion back to Value).
4. Scenarios & Trade Plan:
   - Primary Scenario: Target levels and trigger conditions.
   - Invalidation / Risk Level: Exact level where the bias fails.
Return the output in a clean, structured JSON format containing:
{
  "timestamp": string,
  "asset": string,
  "bias": "BULLISH" | "BEARISH" | "NEUTRAL",
  "key_levels": { "poc": number, "vah": number, "val": number, "support": number, "resistance": number },
  "price_action_summary": string,
  "primary_scenario": { "direction": string, "targets": [number], "trigger": string },
  "invalidation_level": number,
  "full_markdown_analysis": string
}`;

/**
 * Analyzes a chart screenshot using Gemini Multimodal API.
 * Defaults to the latest Gemini 3.8 Flash model with automatic fallback.
 * 
 * @param {string} imagePath - Absolute or relative path to snapshot PNG
 * @param {Object} [options]
 * @param {string} [options.asset] - Asset identifier
 * @param {string} [options.model] - Gemini model identifier
 * @returns {Promise<Object>} Structured analysis JSON
 */
async function analyzeChartWithGemini(imagePath, options = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  const primaryModel = options.model || process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const assetHint = options.asset || 'BTC/USDT';

  // Candidate models: prioritize requested model, with resilience fallbacks
  const fallbackCandidates = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.0-flash'];
  const modelsToTry = [primaryModel, ...fallbackCandidates.filter(m => m !== primaryModel)];

  // Resolve absolute path
  let absoluteImagePath = imagePath;
  if (!path.isAbsolute(imagePath)) {
    if (imagePath.startsWith('/snapshots/')) {
      absoluteImagePath = path.join(__dirname, '..', imagePath);
    } else {
      absoluteImagePath = path.join(__dirname, '..', 'snapshots', imagePath);
    }
  }

  if (!fs.existsSync(absoluteImagePath)) {
    throw new Error(`Snapshot image not found at path: ${absoluteImagePath}`);
  }

  const imageBuffer = fs.readFileSync(absoluteImagePath);
  const base64Data = imageBuffer.toString('base64');

  // If no Gemini API key is configured yet, provide a mock analysis for preview & testing
  if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey.trim() === '') {
    console.warn('[Gemini] No valid GEMINI_API_KEY found in .env. Generating high-fidelity mock AMT analysis.');
    return generateFallbackAnalysis(assetHint, options.sessionName, primaryModel);
  }

  const ai = new GoogleGenAI({ apiKey });
  const promptText = `Please analyze this chart screenshot for ${assetHint}. Focus specifically on the candlestick price action, developing volume profile, Point of Control (POC), Value Area High (VAH), Value Area Low (VAL), and any visible liquidity or absorption bubbles. Return valid JSON matching the exact schema requested.`;

  let lastError = null;

  for (const currentModel of modelsToTry) {
    try {
      console.log(`[Gemini] Sending chart image (${(imageBuffer.length / 1024).toFixed(1)} KB) to ${currentModel}...`);

      const response = await ai.models.generateContent({
        model: currentModel,
        contents: [
          {
            role: 'user',
            parts: [
              { text: promptText },
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: base64Data
                }
              }
            ]
          }
        ],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json'
        }
      });

      const responseText = response.text || (response.candidates && response.candidates[0]?.content?.parts?.[0]?.text);

      if (!responseText) {
        throw new Error(`Empty response received from ${currentModel}`);
      }

      console.log(`[Gemini] Analysis received successfully from ${currentModel}! Parsing JSON...`);

      // Clean any accidental markdown wrapper
      let cleanJson = responseText.trim();
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const structuredData = JSON.parse(cleanJson);

      // Validate key fields
      if (!structuredData.bias) structuredData.bias = 'NEUTRAL';
      if (!structuredData.timestamp) structuredData.timestamp = new Date().toISOString();
      if (!structuredData.asset) structuredData.asset = assetHint;
      if (!structuredData.key_levels) {
        structuredData.key_levels = { poc: 0, vah: 0, val: 0, support: 0, resistance: 0 };
      }
      structuredData.model_used = currentModel;

      return structuredData;

    } catch (err) {
      lastError = err;
      const isNotFound = err.message && (
        err.message.includes('not found') ||
        err.message.includes('404') ||
        err.message.includes('is not supported')
      );

      if (isNotFound) {
        console.warn(`[Gemini] Model ${currentModel} returned 404/Unsupported. Trying next fallback candidate...`);
        continue;
      }

      // If authentication error or quota error
      console.error(`[Gemini] Error invoking ${currentModel}:`, err.message);
      if (err.message.includes('API key') || err.message.includes('403')) {
        console.warn('[Gemini] Falling back to simulated Auction Market analysis for demonstration.');
        return generateFallbackAnalysis(assetHint, options.sessionName, currentModel);
      }
      break;
    }
  }

  throw lastError || new Error('All candidate Gemini models failed.');
}

/**
 * High-fidelity fallback Auction Market Theory analysis when API key is not yet set or unavailable.
 */
function generateFallbackAnalysis(asset = 'BTC/USDT', sessionName = 'Market Session', modelUsed = 'gemini-3.8-flash') {
  const basePrice = 64500 + Math.floor((Math.random() - 0.5) * 1200);
  const poc = Math.round(basePrice);
  const vah = Math.round(basePrice + 650);
  const val = Math.round(basePrice - 580);
  const sup = Math.round(val - 350);
  const res = Math.round(vah + 500);

  const biases = ['BULLISH', 'BEARISH', 'NEUTRAL'];
  const bias = biases[Math.floor(Math.random() * biases.length)];

  let direction, trigger, targets;
  if (bias === 'BULLISH') {
    direction = 'Bullish Continuation above VAH';
    trigger = `Acceptance and 15m candle close above ${vah} on increasing volume delta.`;
    targets = [res, Math.round(res + 750)];
  } else if (bias === 'BEARISH') {
    direction = 'Breakdown below Value Area Low';
    trigger = `Failure to reclaim POC at ${poc}, followed by volume rejection into ${val}.`;
    targets = [sup, Math.round(sup - 800)];
  } else {
    direction = 'Rotational Mean Reversion to POC';
    trigger = `Responsive activity fading the extremes of ${vah} and ${val}.`;
    targets = [poc];
  }

  return {
    timestamp: new Date().toISOString(),
    asset,
    bias,
    model_used: modelUsed,
    key_levels: {
      poc,
      vah,
      val,
      support: sup,
      resistance: res
    },
    price_action_summary: `[Demo Analysis - Set GEMINI_API_KEY for live AI] Price currently rotating within the developing session value area. Heavy volume clustering detected around the ${poc} Point of Control with delta absorption at key structural inflection nodes.`,
    primary_scenario: {
      direction,
      targets,
      trigger
    },
    invalidation_level: bias === 'BULLISH' ? val : (bias === 'BEARISH' ? vah : sup),
    full_markdown_analysis: `### Auction Market Theory & Volume Profile Breakdown
- **Engine:** ${modelUsed}
- **Session:** ${sessionName}
- **Value Area Assessment:** Value Area High (**$${vah.toLocaleString()}**) and Value Area Low (**$${val.toLocaleString()}**) delineate current accepted fair price.
- **Point of Control (POC):** Heavy transacted volume centered at **$${poc.toLocaleString()}**, acting as the gravitational anchor for current rotations.
- **Order Flow & Absorption:** Delta footprint indicates responsive limit orders stepping in near Value extremes. Absorption bubbles confirm passive liquidity defending support nodes.
- **Execution Plan:** Maintain bias towards **${bias}** execution contingent upon trigger: *"${trigger}"*.

*(Note: Provide your GEMINI_API_KEY in Railway to receive live multimodal vision analysis)*`
  };
}

module.exports = {
  analyzeChartWithGemini,
  SYSTEM_INSTRUCTION
};
