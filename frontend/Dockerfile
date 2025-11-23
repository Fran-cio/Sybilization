FROM node:20-alpine

WORKDIR /app

COPY package.json ./

# Install dependencies (including devDependencies for build)
# We use npm install to ensure lockfile is generated/updated if needed
RUN npm install

COPY . .

# Skip build step to avoid Turbopack/Webpack errors with Aztec SDK
# RUN npm run build

# Expose port
EXPOSE 3000

# Start the app in dev mode
ENV HOSTNAME "0.0.0.0"
CMD ["npm", "run", "dev"]
