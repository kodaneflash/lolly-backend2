#!/bin/bash

# CONFIG
KEY="r3f-key.pem"
USER="ubuntu"
HOST="13.38.71.221"
REMOTE_DIR="~/r3f-backend"

echo "🚀 Déploiement en cours vers $USER@$HOST..."

# Envoyer les fichiers .js / .json / .env etc.
scp -i $KEY -r ./* $USER@$HOST:$REMOTE_DIR

# Redémarrer le serveur avec PM2
ssh -i $KEY $USER@$HOST "cd $REMOTE_DIR && pm2 restart r3f-backend"

echo "✅ Déploiement terminé."
