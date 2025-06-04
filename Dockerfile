# Use official Node.js LTS image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build TypeScript code (assumes you have "build" script)
RUN npm run build

# Cloud Run expects the app to listen on port 8080
EXPOSE 8080

# Ensure the PORT env is used by your app
ENV PORT=8080

# Start the compiled Node.js app
CMD ["npm", "start"]
