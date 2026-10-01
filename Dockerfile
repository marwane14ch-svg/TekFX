# Official Playwright image with Chromium and all Linux dependencies pre-installed
FROM mcr.microsoft.com/playwright:v1.50.1-noble

WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install dependencies cleanly
RUN npm ci --omit=dev

# Copy app code
COPY . .

# Ensure snapshots folder exists
RUN mkdir -p snapshots

# Default port (Railway dynamically sets PORT)
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server.js"]
