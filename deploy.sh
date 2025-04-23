#!/bin/bash

KEY="r3f-vm_key.pem"
USER="ubuntu"
HOST="172.189.56.91"
REMOTE_DIR="~/r3f-backend"

echo "🚀 Déploiement en cours vers $USER@$HOST..."

# Créer le dossier s'il n'existe pas
ssh -i $KEY $USER@$HOST "mkdir -p $REMOTE_DIR"

# Envoyer les fichiers
scp -i $KEY -r ./* $USER@$HOST:$REMOTE_DIR

# Lancer ou redémarrer l'application
ssh -i $KEY $USER@$HOST "cd $REMOTE_DIR && pm2 restart r3f-backend || pm2 start index.js --name r3f-backend"

echo "✅ Déploiement terminé."
