# Dockerfile for deploying the Node server (dist/index.js) to Cloud Run or other container platforms
FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package files and install only production deps
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copy built server bundle
COPY dist ./dist

# Expose port (Cloud Run uses PORT env var)
ENV PORT 8080
EXPOSE 8080

# Start the server
CMD ["node", "dist/index.js"]
