# Financial Analysis Web Dashboard

Self-contained automated financial chart analysis dashboard powered by Playwright and Google Gemini 2.5 Multimodal vision.

## Quick Start

1. Navigate to this directory:
   ```bash
   cd website
   ```

2. Configure environment variables in `.env`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   TRADINGVIEW_CHART_URL=https://www.tradingview.com/chart/?symbol=BINANCE:BTCUSDT
   PORT=3000
   ```

3. Start the dashboard server:
   ```bash
   npm start
   # or
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

## Verification Tests

- **Headless Chart Capture Test:**
  ```bash
  npm run test:capture
  ```
- **Gemini Multimodal Analysis Test:**
  ```bash
  npm run test:analyze
  ```

## Project Structure
- `public/`: Frontend assets (`index.html`, `styles.css`, `app.js`).
- `execution/`: Backend modules (`capture_chart.js`, `gemini_analyzer.js`, `scheduler.js`, `db.js`).
- `snapshots/`: High-resolution chart snapshots captured by Playwright.
- `analysis.db`: SQLite database storing session analyses.
- `server.js`: Express web server and API endpoints.
