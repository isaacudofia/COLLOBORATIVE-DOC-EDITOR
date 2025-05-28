# Use Node.js LTS version
FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Install dependencies first (for better caching)
COPY package*.json ./
RUN npm ci --only=production

# Copy prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy app source
COPY . .

# Set environment to production
ENV NODE_ENV=production

# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Expose the port the app runs on
EXPOSE 4000

# Start the application
CMD ["node", "server.js"]
