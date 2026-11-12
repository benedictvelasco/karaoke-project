FROM node:20-bookworm-slim

# Install python3, ffmpeg, and ca-certificates required by yt-dlp on Linux
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    ffmpeg \
    ca-certificates \
    curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package manifests and install dependencies (downloads Linux yt-dlp binary)
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source
COPY . .

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server.js"]
