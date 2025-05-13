#!/bin/bash

# Replace with your Heroku app name
HEROKU_APP_NAME="your-app-name"

echo "🚀 Deploying to Heroku ($HEROKU_APP_NAME)..."

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

# Push to Heroku
echo "📤 Pushing to Heroku..."
git push heroku main

echo "✅ Deployment to Heroku complete!" 