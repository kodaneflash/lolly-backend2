# Étape 1 : Image de base avec Node.js 18
FROM node:18-slim

# Étape 2 : Installer ffmpeg, curl, unzip et yarn
RUN apt-get update && apt-get install -y \
  ffmpeg \
  curl \
  unzip \
  gnupg \
  && curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - \
  && echo "deb https://dl.yarnpkg.com/debian stable main" > /etc/apt/sources.list.d/yarn.list \
  && apt-get update && apt-get install -y yarn \
  && rm -rf /var/lib/apt/lists/*

# Étape 3 : Ajouter ffmpeg et yarn au PATH
ENV PATH="/usr/bin:${PATH}"

# Étape 4 : Vérification des versions
RUN ffmpeg -version && yarn --version

# Étape 5 : Télécharger et installer Rhubarb Lip Sync
RUN mkdir -p /rhubarb && \
    curl -L https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v1.10.0/rhubarb-1.10.0-linux.zip -o rhubarb.zip && \
    unzip rhubarb.zip -d /rhubarb && \
    mv /rhubarb/rhubarb /usr/local/bin/rhubarb && \
    chmod +x /usr/local/bin/rhubarb

# Étape 6 : Répertoire de travail
WORKDIR /app

# Étape 7 : Copier les fichiers
COPY . .

# Étape 8 : Installer les dépendances
RUN yarn install --frozen-lockfile

# Étape 9 : Définir l'environnement
ENV NODE_ENV=production

# Étape 10 : Exposer le port
EXPOSE 3000

# Étape 11 : Commande de démarrage
CMD ["node", "index.js"]
