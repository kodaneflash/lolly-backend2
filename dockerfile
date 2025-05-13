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

# Install Rhubarb Lip Sync
RUN curl -L https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v1.14.0/rhubarb-linux -o /usr/local/bin/rhubarb && \
    chmod +x /usr/local/bin/rhubarb

# Create resources directory
RUN mkdir -p /usr/local/bin/res/

# Copy package files first for better caching
COPY package.json yarn.lock ./
RUN yarn install

# Copy the application content
COPY . .

# Copy the acoustic model files to the expected location
RUN cp -r bin/res/* /usr/local/bin/res/

EXPOSE 3000

CMD ["node", "index.js"]
