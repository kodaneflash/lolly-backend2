# Étape 1 : Base Node.js
FROM node:18-slim

# Étape 2 : Installer ffmpeg, curl et unzip
RUN apt-get update && apt-get install -y \
  ffmpeg \
  curl \
  unzip \
  && rm -rf /var/lib/apt/lists/*

# Ensure ffmpeg is in PATH
ENV PATH="/usr/bin:${PATH}"

# Étape 3 : Télécharger et installer Rhubarb Lip Sync
RUN mkdir -p /rhubarb && \
    curl -L https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v1.10.0/rhubarb-1.10.0-linux.zip -o rhubarb.zip && \
    unzip rhubarb.zip -d /rhubarb && \
    mv /rhubarb/rhubarb /usr/local/bin/rhubarb && \
    chmod +x /usr/local/bin/rhubarb

# Étape 4 : Créer un répertoire de travail
WORKDIR /app

# Étape 5 : Copier tous les fichiers dans l’image
COPY . .

# Étape 6 : Installer les dépendances
RUN npm install

# Étape 7 : Définir l’environnement
ENV NODE_ENV=production

# Étape 8 : Exposer le port 3000
EXPOSE 3000

# Étape 9 : Commande pour démarrer le serveur
CMD ["node", "index.js"]
