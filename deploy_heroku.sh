#!/bin/bash

# Replace with your Heroku app name
HEROKU_APP_NAME="r3f-virtual-gf-backend"

echo "🚀 Deploying to Heroku ($HEROKU_APP_NAME)..."

# Ensure rhubarb is executable
echo "🔧 Setting binary permissions..."
chmod +x bin/rhubarb
chmod +x bin/Rhubarb-Lip-Sync-1.14.0-Linux/rhubarb

# Install Heroku CLI if not already installed
if ! command -v heroku &> /dev/null; then
    echo "🔧 Installing Heroku CLI..."
    curl https://cli-assets.heroku.com/install.sh | sh
fi

# Login to Heroku
echo "🔐 Logging in to Heroku..."
heroku login

# Create the Heroku app if it doesn't exist
if ! heroku apps:info --app $HEROKU_APP_NAME &> /dev/null; then
    echo "🏗️ Creating Heroku app: $HEROKU_APP_NAME..."
    heroku create $HEROKU_APP_NAME
fi

# Set the stack to container
echo "🔧 Setting stack to container..."
heroku stack:set container --app $HEROKU_APP_NAME

# Configure environment variables from .env file
if [ -f .env ]; then
    echo "⚙️ Setting environment variables from .env..."
    while IFS='=' read -r key value || [[ -n "$key" ]]; do
        # Skip comments and empty lines
        [[ $key =~ ^#.*$ ]] || [[ -z "$key" ]] && continue
        # Remove quotes from value if present
        value=$(echo $value | sed -e 's/^"//' -e 's/"$//')
        echo "Setting $key"
        heroku config:set "$key=$value" --app $HEROKU_APP_NAME
    done < .env
fi

# Verify critical environment variables
echo "🔍 Checking for required environment variables..."
required_vars=("ELEVEN_LABS_API_KEY" "ELEVEN_LABS_VOICE_ID" "OPENAI_API_KEY" "WEAVIATE_API_KEY" "WEAVIATE_URL")
for var in "${required_vars[@]}"; do
    value=$(heroku config:get "$var" --app $HEROKU_APP_NAME 2>/dev/null)
    if [ -z "$value" ]; then
        echo "⚠️ Warning: $var is not set. Please set it manually with:"
        echo "heroku config:set $var=YOUR_VALUE --app $HEROKU_APP_NAME"
    else
        echo "✅ $var is configured"
    fi
done

# Push to Heroku
echo "📤 Pushing to Heroku..."
git push heroku main

echo "✅ Deployment to Heroku complete!"
echo "🔄 View logs with: heroku logs --tail --app $HEROKU_APP_NAME" 