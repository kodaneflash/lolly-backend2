# Étape 1 : Image de base avec Node.js 18
FROM node@sha256:39095e997ff4399e1b07c147ccb432f47bd9e67c639d5fdf41af4a796c50ecf7


# Étape 2 : Dépendances système (séparées pour éviter les timeouts)
RUN apt-get update && apt-get install -y curl gnupg
RUN apt-get install -y dash ffmpeg unzip wget

# Étape 3 : Yarn (séparé aussi)
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - && \
    echo "deb https://dl.yarnpkg.com/debian stable main" > /etc/apt/sources.list.d/yarn.list && \
    apt-get update && apt-get install -y yarn

# Étape 4 : Rhubarb Lip Sync
RUN mkdir -p /rhubarb && \
    curl -L https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v1.10.0/rhubarb-1.10.0-linux.zip -o rhubarb.zip && \
    unzip rhubarb.zip -d /rhubarb && \
    mv /rhubarb/rhubarb /usr/local/bin/rhubarb && \
    chmod +x /usr/local/bin/rhubarb && \
    rm -rf rhubarb.zip /rhubarb

# Étape 5 : Copie des fichiers ressources pour Rhubarb
COPY bin/res/ /usr/local/bin/res/

# Étape 6 : Répertoire de travail
WORKDIR /app

# Étape 7 : Copier tout le projet
COPY . .

# Étape 8 : Dépendances Node.js
RUN yarn install --frozen-lockfile

# Étape 9 : Exposer port
EXPOSE 8080

# Étape 10 : Commande de démarrage
CMD ["node", "index.js"]
