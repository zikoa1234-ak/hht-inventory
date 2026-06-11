FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

# Copy application code
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Expose the port
EXPOSE 3001

# Set working directory to backend so server.js finds routes/ and ../frontend/
WORKDIR /app/backend

# Start the server
CMD ["node", "server.js"]