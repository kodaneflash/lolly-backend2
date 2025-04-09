# Base image with Node.js 18
FROM node:18-slim

# Install ffmpeg, curl, unzip, and yarn
RUN apt-get update && apt-get install -y \
  ffmpeg \
  curl \
  unzip \
  gnupg \
  && curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - \
  && echo "deb https://dl.yarnpkg.com/debian stable main" > /etc/apt/sources.list.d/yarn.list \
  && apt-get update && apt-get install -y yarn \
  && rm -rf /var/lib/apt/lists/*

# Add ffmpeg and yarn to PATH
ENV PATH="/usr/bin:${PATH}"

# Verify ffmpeg and yarn installation
RUN ffmpeg -version && yarn --version

# Install Rhubarb Lip Sync
RUN mkdir -p /rhubarb && \
    curl -L https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v1.10.0/rhubarb-1.10.0-linux.zip -o rhubarb.zip && \
    unzip rhubarb.zip -d /rhubarb && \
    mv /rhubarb/rhubarb /usr/local/bin/rhubarb && \
    chmod +x /usr/local/bin/rhubarb

# Set working directory
WORKDIR /app

# Copy all files into the container
COPY . .

# Install dependencies
RUN yarn install --frozen-lockfile

# Set environment to production
ENV NODE_ENV=production

# Expose port 8080
EXPOSE 8080

# Start the application
CMD ["node", "index.js"]
