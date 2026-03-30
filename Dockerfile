# ── Stage 1: Build Frontend ──────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Production Backend ───────────────────────────────────────
FROM node:20-slim
WORKDIR /app

# Install Puppeteer dependencies for Headless Chromium
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    libxkbcommon0 \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use the pre-installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false

# Install Backend Dependencies
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install

# Copy App Source
COPY backend/ ./
COPY --from=frontend-builder /app/frontend/dist ../frontend/dist

# Expose backend port
EXPOSE 3001

CMD ["node", "index.js"]
