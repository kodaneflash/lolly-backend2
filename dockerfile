# Base Debian slim pour stabilité + support APT
FROM node:18-slim

# Dépendances système
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl \
    gnupg \
    dash \
    ffmpeg \
    unzip \
    wget \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Installer Yarn
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | gpg --dearmor -o /usr/share/keyrings/yarnkey.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/yarnkey.gpg] https://dl.yarnpkg.com/debian stable main" > /etc/apt/sources.list.d/yarn.list && \
    apt-get update && \
    apt-get install -y yarn && \
    rm -rf /var/lib/apt/lists/*

# Installer Rhubarb Lip Sync
RUN mkdir -p /rhubarb && \
    curl -L https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v1.10.0/rhubarb-1.10.0-linux.zip -o rhubarb.zip && \
    unzip rhubarb.zip -d /rhubarb && \
    mv /rhubarb/rhubarb /usr/local/bin/rhubarb && \
    chmod +x /usr/local/bin/rhubarb && \
    rm -rf rhubarb.zip /rhubarb

# Copier les fichiers binaires nécessaires
COPY bin/res/ /usr/local/bin/res/

# Répertoire de travail
WORKDIR /app

# Copier seulement les fichiers package.json pour cache des deps
COPY package.json yarn.lock ./

# Installer dépendances
RUN yarn install --frozen-lockfile

# Copier le reste de l'app
COPY . .

# Port exposé
EXPOSE 8080

# Commande de démarrage
CMD ["node", "index.js"]
