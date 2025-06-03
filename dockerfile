# Use an official Node.js runtime as the base image
FROM node:18

# Set working directory
WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy rest of the source code
COPY . .

# Let Docker know the app will listen on port 3000 (Render detects this)
EXPOSE 8080

# Use the environment variable PORT (required by Render)
ENV PORT=8080

# Start your Node.js server
CMD ["npm", "start"]
