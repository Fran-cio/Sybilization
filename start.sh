#!/bin/bash

# Start script for judges - Runs both API server and frontend
# Usage: bash start.sh

set -e  # Exit on error

echo ""
echo "🚀 Starting Sybilization - Aztec Private Voting"
echo "==============================================="
echo ""

# Check if setup has been run
if [ ! -d "api-server/node_modules" ] || [ ! -d "frontend/node_modules" ]; then
    echo "⚠️  Dependencies not installed. Running setup first..."
    echo ""
    bash setup.sh
fi

# Check if contract is compiled
if [ ! -f "contracts/target/private_voting-PrivateVoting.json" ]; then
    echo "⚠️  Contract not compiled. Compiling..."
    cd contracts
    bash ../scripts/compile_contract.sh
    cd ..
fi

echo "🔗 Connected to: Aztec Devnet"
echo "📍 Devnet URL: https://devnet.aztec-labs.com/"
echo ""
echo "🌐 Services starting..."
echo "   • API Server → http://localhost:3001"
echo "   • Frontend   → http://localhost:3000"
echo ""
echo "⏳ Please wait for both services to start..."
echo ""

# Function to kill all background processes on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $(jobs -p) 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM EXIT

# Start API server in background
echo "📡 Starting API server..."
cd api-server
NODE_URL=https://devnet.aztec-labs.com/ npm start &
API_PID=$!
cd ..

# Wait a bit for API to initialize
sleep 3

# Start frontend in background
echo "🎨 Starting frontend..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Services started!"
echo "==================="
echo ""
echo "📱 Open in browser: http://localhost:3000"
echo ""
echo "🎯 Features:"
echo "   • Vote with ZKPassport identity verification"
echo "   • Use mock wallets (Alice, Bob, Charlie)"
echo "   • View live results"
echo "   • Admin panel (bottom-right corner)"
echo ""
echo "📊 Current deployment:"
echo "   Contract: 0x2bbe365ae58181933e2203b150c65b945dda12c541ef4611ab445591b6ed7c06"
echo "   Network:  Aztec Devnet"
echo ""
echo "💡 Tips:"
echo "   • Press Ctrl+C to stop all services"
echo "   • Check logs above for any errors"
echo "   • See README.md for full documentation"
echo ""
echo "⌛ Waiting for services... (Press Ctrl+C to stop)"
echo ""

# Wait for both processes
wait
