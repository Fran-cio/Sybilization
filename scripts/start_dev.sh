#!/bin/bash

# Start both frontend and API server in parallel

echo "🚀 Starting ZKPassport Voting System"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Install dependencies if needed
if [ ! -d "api-server/node_modules" ]; then
  echo "${BLUE}📦 Installing API server dependencies...${NC}"
  cd api-server && npm install && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
  echo "${BLUE}📦 Installing frontend dependencies...${NC}"
  cd frontend && npm install && cd ..
fi

echo ""
echo "${GREEN}✓ Dependencies ready${NC}"
echo ""

# Start API server in background
echo "${BLUE}🔧 Starting API server on port 3001...${NC}"
cd api-server
NODE_URL=https://devnet.aztec-labs.com/ npm start &
API_PID=$!
cd ..

# Wait for API server to be ready
sleep 3

# Start frontend dev server
echo "${BLUE}🌐 Starting frontend on port 3000...${NC}"
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "${GREEN}✨ System Ready!${NC}"
echo "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  📡 API Server:  http://localhost:3001"
echo "  🌐 Frontend:    http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Wait for user to stop
trap "kill $API_PID $FRONTEND_PID; exit" INT TERM

wait
