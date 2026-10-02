const https = require('https');

/**
 * Fetches recent breaking macroeconomic news headlines impacting Gold (XAU/USD),
 * the Federal Reserve, US Dollar (DXY), Treasury yields, and inflation.
 * 
 * @returns {Promise<Array<{title: string, source: string, link: string}>>}
 */
async function fetchGoldMacroNews() {
  const query = encodeURIComponent('XAUUSD OR "Gold price" OR "Gold prices" OR "Federal Reserve" OR "US Dollar" OR CPI OR inflation when:2d');
  const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.warn('[News] News fetch timed out, falling back to default macro baseline.');
      resolve(getDefaultMacroHeadlines());
    }, 6000);

    const req = https.get(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        clearTimeout(timeout);
        try {
          const items = [];
          const itemRegex = /<item>[\s\S]*?<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<source[^>]*>(.*?)<\/source>[\s\S]*?<\/item>/gi;
          let match;

          while ((match = itemRegex.exec(data)) !== null && items.length < 8) {
            let title = match[1] || '';
            const link = match[2] || '';
            const source = match[3] || 'Financial News';

            // Decode HTML entities
            title = title
              .replace(/&amp;/g, '&')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .trim();

            if (title && !title.toLowerCase().startsWith('google news')) {
              items.push({ title, source, link });
            }
          }

          if (items.length > 0) {
            console.log(`[News] Successfully retrieved ${items.length} breaking macro/Gold news items.`);
            resolve(items);
          } else {
            resolve(getDefaultMacroHeadlines());
          }
        } catch (parseErr) {
          console.warn('[News] Error parsing news RSS:', parseErr.message);
          resolve(getDefaultMacroHeadlines());
        }
      });
    });

    req.on('error', (err) => {
      clearTimeout(timeout);
      console.warn('[News] Request error fetching news:', err.message);
      resolve(getDefaultMacroHeadlines());
    });
  });
}

/**
 * Baseline macroeconomic drivers for Gold (XAU/USD) when live feed is inaccessible.
 */
function getDefaultMacroHeadlines() {
  return [
    {
      title: 'Federal Reserve Interest Rate Expectations and FOMC Stance on Core Inflation',
      source: 'Macroeconomic Desk',
      link: 'https://www.federalreserve.gov'
    },
    {
      title: 'US Dollar Index (DXY) & 10-Year Treasury Yields Fluctuation Impact on Non-Yielding Bullion',
      source: 'Global Markets',
      link: 'https://www.bloomberg.com'
    },
    {
      title: 'Global Central Bank Gold Reserve Accumulation & Geopolitical Safe-Haven Inflows',
      source: 'World Gold Council',
      link: 'https://www.gold.org'
    },
    {
      title: 'US Labor Data (Non-Farm Payrolls / Jobless Claims) & PCE Inflation Pressure',
      source: 'Economic Calendar',
      link: 'https://www.forexfactory.com'
    }
  ];
}

module.exports = {
  fetchGoldMacroNews,
  getDefaultMacroHeadlines
};
