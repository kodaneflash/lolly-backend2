FROM node:18

# Set working directory
WORKDIR /app

# Install system dependencies including ffmpeg
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

# Create res directory if it doesn't exist
RUN mkdir -p bin/res

# Ensure audios directory exists
RUN mkdir -p audios && chmod 777 audios

# Expose the port the app runs on
ENV PORT=8080
EXPOSE 8080

# Run the application
CMD ["node", "index.js"]
