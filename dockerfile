# Base image
FROM node:18-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
  ffmpeg \
  curl \
  unzip \
  gnupg \
  && curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - \
  && echo "deb https://dl.yarnpkg.com/debian stable main" > /etc/apt/sources.list.d/yarn.list \
  && apt-get update && apt-get install -y yarn \
  && rm -rf /var/lib/apt/lists/*

# Install Rhubarb Lip Sync
RUN mkdir -p /rhubarb && \
    curl -L https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v1.10.0/rhubarb-1.10.0-linux.zip -o rhubarb.zip && \
    unzip rhubarb.zip -d /rhubarb && \
    mv /rhubarb/rhubarb /usr/local/bin/rhubarb && \
    chmod +x /usr/local/bin/rhubarb

# Set working directory
WORKDIR /app

# ✅ Copy Rhubarb resources (must exist!)
COPY bin/res/ /usr/local/bin/res/

# Copy app source
COPY . .

# Install dependencies
RUN yarn install --frozen-lockfile

# Set environment
ENV NODE_ENV=production

# Expose backend port
EXPOSE 8080

# Run app
CMD ["node", "index.js"]
