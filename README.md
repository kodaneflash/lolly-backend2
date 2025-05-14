# R3F Virtual Girlfriend Backend

Express.js backend service for R3F Virtual Girlfriend application, featuring OpenAI API, ElevenLabs API, Rhubarb Lip Sync, and Azure Speech Services integration.

## Features

- Text generation with OpenAI
- Text-to-speech conversion with ElevenLabs and Azure
- Lip sync generation with Rhubarb
- RAG (Retrieval Augmented Generation) capabilities
- Docker containerization

## Prerequisites

- Node.js 18+
- Docker
- Heroku CLI (for Heroku deployment)
- API keys for OpenAI, ElevenLabs, and optionally Azure

## Local Development

1. Clone the repository
2. Create a `.env` file based on `env.example`
3. Install dependencies:
   ```
   npm install
   ```
4. Start the development server:
   ```
   npm run dev
   ```

## Docker Deployment

### Local Docker Testing

```bash
# Build the Docker image
docker build -t r3f-backend .

# Run the container
docker run -p 3000:3000 --env-file .env r3f-backend
```

## Heroku Deployment

### Method 1: Using Git

1. Make sure you have the Heroku CLI installed and are logged in
2. Update the app name in `deploy_heroku.sh`
3. Run the deployment script:
   ```
   chmod +x deploy_heroku.sh
   ./deploy_heroku.sh
   ```

### Method 2: Manual Deployment

1. Install the Heroku CLI and login:
   ```
   curl https://cli-assets.heroku.com/install.sh | sh
   heroku login
   ```

2. Create a Heroku app and set it to use containers:
   ```
   heroku create your-app-name
   heroku stack:set container -a your-app-name
   ```

3. Configure environment variables:
   ```
   heroku config:set OPENAI_API_KEY=your_key -a your-app-name
   heroku config:set ELEVENLABS_API_KEY=your_key -a your-app-name
   heroku config:set ELEVENLABS_VOICE_ID=your_voice_id -a your-app-name
   # Add all other required environment variables
   ```

4. Deploy to Heroku:
   ```
   git push heroku main
   ```

## Environment Variables

See `env.example` for all required environment variables.

## Important Notes for Heroku Deployment

1. Heroku uses an ephemeral filesystem - any files written to disk will be lost on dyno restart. Consider using AWS S3 or similar for persistent storage of audio files.

2. The free tier has limitations that may affect the app's performance. Consider using a paid dyno for production use.

3. Heroku's default timeout is 30 seconds. For long-running operations, consider implementing a job queue or using worker dynos.

4. Make sure CORS is configured correctly for your frontend domain.

## Deploying to Railway with Docker

To deploy this project to Railway using Docker:

1. Make sure you have the Railway CLI installed:
   ```
   npm install -g @railway/cli
   ```

2. Login to Railway:
   ```
   railway login
   ```

3. Initialize your project (if not already done):
   ```
   railway init
   ```

4. Link your project to an existing Railway project:
   ```
   railway link
   ```

5. Deploy using the Dockerfile:
   ```
   railway up
   ```

6. Important: In Railway dashboard, make sure you:
   - Set the deployment to use the Dockerfile option
   - Set all required environment variables (.env)
   - Enable building the project using Docker

This deployment method ensures that ffmpeg and other dependencies are correctly installed and available to the application at runtime.

## Troubleshooting

If you encounter the "spawn ffmpeg ENOENT" error:
1. Make sure your deployment is using Docker, not the buildpack
2. Verify that ffmpeg-static is properly imported and used in your code
3. Check Railway logs for any missing dependencies or permission issues

## License

Proprietary - All rights reserved.
