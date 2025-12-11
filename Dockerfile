# Use Node.js 20 on Debian Bullseye Slim (better for Puppeteer dependencies)
FROM node:20-bullseye-slim

# Install system dependencies for Puppeteer/Chromium
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    libnss3 \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libgbm-dev \
    chromium \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROME_PATH=/usr/bin/chromium

# Install Netlify CLI globally
RUN npm install -g netlify-cli

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json first (for better caching)
COPY package*.json ./

# Install project dependencies
RUN npm ci

# Copy the rest of the application code
COPY . .

# Expose the port used by netlify dev (default 8888)
EXPOSE 8888

# Command to run the application
# We use "--address 0.0.0.0" to make it accessible from outside the container
CMD ["netlify", "dev", "--port", "8888", "--target-port", "3000"]
