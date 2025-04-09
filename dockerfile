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

# Working directory
WORKDIR /app

# ✅ Copy Rhubarb resources
COPY bin/res/ /usr/local/bin/res/

# Copy project files
COPY . .

# Install dependencies
RUN yarn install --frozen-lockfile

# Expose port
EXPOSE 8080

# Start the server
CMD ["node", "index.js"]
