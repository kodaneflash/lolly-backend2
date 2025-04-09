# Étape 1 : Utiliser une image Node.js basée sur Debian
FROM node:18-slim

# Étape 2 : Installer les dépendances système
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        gnupg \
        dash \
        ffmpeg \
        unzip \
        wget && \
    rm -rf /var/lib/apt/lists/*

# Étape 3 : Installer Yarn
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - && \
    echo "deb https://dl.yarnpkg.com/debian stable main" > /etc/apt/sources.list.d/yarn.list && \
    apt-get update && \
    apt-get install -y yarn && \
    rm -rf /var/lib/apt/lists/*

# Étape 4 : Installer Rhubarb Lip Sync
RUN mkdir -p /rhubarb && \
    curl -L https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v1.10.0/rhubarb-1.10.0-linux.zip -o rhubarb.zip && \
    unzip rhubarb.zip -d /rhubarb && \
    mv /rhubarb/rhubarb /usr/local/bin/rhubarb && \
    chmod +x /usr/local/bin/rhubarb && \
    rm -rf rhubarb.zip /rhubarb

# Étape 5 : Copier les fichiers ressources
COPY bin/res/ /usr/local/bin/res/

# Étape 6 : Définir le répertoire de travail
WORKDIR /app

# Étape 7 : Copier le projet
COPY . .

# Étape 8 : Installer les dépendances Node.js
RUN yarn install --frozen-lockfile

# Étape 9 : Exposer le port
EXPOSE 8080

# Étape 10 : Démarrer l'application
CMD ["node", "index.js"]
