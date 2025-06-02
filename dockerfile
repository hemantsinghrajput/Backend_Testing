# Use an official Node.js runtime as the base image
FROM node:18

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (if exists) to install dependencies
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port your Express app listens on (default 3000, adjust if different)
EXPOSE 3000

# Command to start the application
CMD ["npm", "start"]