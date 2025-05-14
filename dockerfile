FROM node:18

# Set working directory
WORKDIR /app

# Install system dependencies including ffmpeg
# Note: We're installing system ffmpeg as a backup even though we use ffmpeg-static
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy project files
COPY . .

# Set file permissions for executables
RUN chmod +x bin/Rhubarb-Lip-Sync-1.14.0-Linux/rhubarb

# Create directories if they don't exist
RUN mkdir -p bin/res
RUN mkdir -p audios && chmod 777 audios

# Add a command to verify ffmpeg installation
RUN ffmpeg -version
RUN echo "FFMPEG binary from package: $(node -e "console.log(require('ffmpeg-static'))")"

# Expose the port the app runs on
ENV PORT=8080
EXPOSE 8080

# Run the application
CMD ["node", "index.js"]
