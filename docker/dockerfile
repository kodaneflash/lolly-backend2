# 1. Base image
FROM node:18-slim

# 2. Install system dependencies
RUN apt-get update && apt-get install -y \
  curl \
  gnupg \
  dash \
  ffmpeg \
  unzip \
  wget \
  && curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - \
  && echo "deb https://dl.yarnpkg.com/debian stable main" > /etc/apt/sources.list.d/yarn.list \
  && apt-get update && apt-get install -y yarn \
  && rm -rf /var/lib/apt/lists/*

# 3. Set path manually (just in case)
ENV PATH="/usr/bin:/usr/local/bin:${PATH}"

# 4. Check binaries
RUN ffmpeg -version && yarn --version

# 5. Install Rhubarb binary
RUN mkdir -p /rhubarb && \
    wget https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v1.14.0/Rhubarb-Lip-Sync-1.14.0-Linux.zip -O rhubarb.zip && \
    unzip rhubarb.zip -d /rhubarb && \
    mv /rhubarb/Rhubarb-Lip-Sync-1.14.0-Linux/rhubarb /usr/local/bin/rhubarb && \
    chmod +x /usr/local/bin/rhubarb && \
    rm -rf rhubarb.zip /rhubarb

# ✅ 6. Copy Rhubarb res (sphinx) files if they exist
COPY bin/res /usr/local/bin/res

# 7. Working directory
WORKDIR /app

# 8. Audio folder (optional but avoids runtime issues)
RUN mkdir -p /app/audios

# 9. Copy the app
COPY . .

# 10. Install dependencies
RUN yarn install --frozen-lockfile

# 11. Port exposure
EXPOSE 3000

# 12. Start app
CMD ["node", "index.js"]
