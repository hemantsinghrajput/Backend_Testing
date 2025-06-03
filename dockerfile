# Base image
FROM node:18-alpine

# Working directory
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy rest of the app
COPY . .

# Build TypeScript
RUN npm run build

# Expose the default port used by Cloud Run
EXPOSE 8080

# Start app
CMD ["node", "dist/server.js"]
