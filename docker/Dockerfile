# Use Node.js LTS version
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install timezone data
RUN apk add --no-cache tzdata

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY src/standup-bot/index.js ./src/standup-bot/

# Create a non-root user to run the app
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Start the application
CMD ["node", "src/standup-bot/index.js"]
