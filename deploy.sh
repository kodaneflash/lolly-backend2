#!/bin/bash

KEY="r3f-vm_key.pem"
USER="ubuntu"
HOST="172.189.56.91"
REMOTE_DIR="~/r3f-backend"

echo "🚀 Déploiement en cours vers $USER@$HOST..."

# 1. Créer le dossier sur le serveur si besoin.
ssh -i $KEY $USER@$HOST "mkdir -p $REMOTE_DIR"

# 2. Envoyer tous les fichiers locaux vers le serveur
scp -i $KEY -r ./* $USER@$HOST:$REMOTE_DIR

# 3. Redémarrer proprement avec PM2
ssh -i $KEY $USER@$HOST << EOF
  cd $REMOTE_DIR
  export NVM_DIR="\$HOME/.nvm"
  source "\$NVM_DIR/nvm.sh"
  nvm use 18
  pm2 restart r3f-backend || pm2 start index.js --name r3f-backend
  pm2 save
  pm2 startup systemd -u ubuntu --hp /home/ubuntu
EOF

echo "✅ Déploiement terminé et application relancée avec PM2 !"
