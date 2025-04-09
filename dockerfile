# Étape 1 : Image de base avec Node.js 18
FROM node@sha256:39095e997ff4399e1b07c147ccb432f47bd9e67c639d5fdf41af4a796c50ecf7


# Étape 2 : Installation des dépendances système
RUN apt-get update && apt-get install -y \
  ffmpeg \
  curl \
  unzip \
  gnupg \
  wget \
  && curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - \
  && echo "deb https://dl.yarnpkg.com/debian stable main" > /etc/apt/sources.list.d/yarn.list \
  && apt-get update && apt-get install -y yarn \
  && rm -rf /var/lib/apt/lists/*

# Étape 3 : PATH propre
ENV PATH="/usr/bin:/usr/local/bin:${PATH}"

# Étape 4 : Vérification des outils
RUN ffmpeg -version && yarn --version

# Étape 5 : Installer Rhubarb Lip Sync v1.14.0
RUN mkdir -p /rhubarb && \
    wget https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v1.14.0/Rhubarb-Lip-Sync-1.14.0-Linux.zip -O rhubarb.zip && \
    unzip rhubarb.zip -d /rhubarb && \
    mv /rhubarb/Rhubarb-Lip-Sync-1.14.0-Linux/rhubarb /usr/local/bin/rhubarb && \
    chmod +x /usr/local/bin/rhubarb && \
    rm -rf rhubarb.zip /rhubarb

# Étape 6 : Copier les fichiers `res` nécessaires à Rhubarb
# ✅ Vérifie que le dossier local `bin/res` existe et contient `sphinx/`
COPY bin/res /usr/local/bin/res

# Étape 7 : Définir le dossier de travail
WORKDIR /app

# Étape 8 : Copier le projet
COPY . .

# Étape 9 : Installer les dépendances Node.js
RUN yarn install --frozen-lockfile

# Étape 10 : Définir la variable d'environnement
ENV NODE_ENV=production

# Étape 11 : Exposer le port
EXPOSE 8080

# Étape 12 : Commande de démarrage
CMD ["node", "index.js"]
