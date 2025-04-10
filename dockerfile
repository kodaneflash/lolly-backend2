FROM node:18-slim

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ffmpeg \
        curl \
        unzip \
        wget \
        gnupg \
        ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | gpg --dearmor | tee /usr/share/keyrings/yarn.gpg > /dev/null && \
    echo "deb [signed-by=/usr/share/keyrings/yarn.gpg] https://dl.yarnpkg.com/debian stable main" > /etc/apt/sources.list.d/yarn.list && \
    apt-get update && \
    apt-get install -y yarn && \
    rm -rf /var/lib/apt/lists/*

# Installer Rhubarb Lip Sync
RUN curl -L https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v1.10.0/rhubarb-linux -o /usr/local/bin/rhubarb && \
    chmod +x /usr/local/bin/rhubarb

#COPY bin/res/ /usr/local/bin/res/
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .

EXPOSE 8080

CMD ["node", "index.js"]
