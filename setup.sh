#!/bin/bash

# Setup script for judges - Prepares the entire project
# Usage: bash setup.sh

set -e  # Exit on error

echo ""
echo "🏗️  Setting up Sybilization - Aztec Private Voting"
echo "=================================================="
echo ""

# Check Node.js version
echo "📦 Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js 18+ required. Current version: $(node -v)"
    exit 1
fi
echo "✅ Node.js $(node -v) detected"
echo ""

# Check Aztec CLI
echo "🔍 Checking Aztec CLI..."
if ! command -v aztec &> /dev/null; then
    echo "❌ Aztec CLI not found. Installing..."
    echo "   Run: bash -i <(curl -s install.aztec.network)"
    exit 1
fi
AZTEC_VERSION=$(aztec --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+-?[a-z0-9.]*' | head -1)
echo "✅ Aztec CLI $AZTEC_VERSION detected"
echo ""

# Compile contracts
echo "🔨 Step 1/4: Compiling Noir contracts..."
echo "----------------------------------------"
cd contracts
if [ ! -f "../scripts/compile_contract.sh" ]; then
    echo "❌ Compile script not found"
    exit 1
fi
bash ../scripts/compile_contract.sh
echo "✅ Contracts compiled successfully"
echo ""

# Install root dependencies
echo "📦 Step 2/4: Installing root dependencies..."
echo "--------------------------------------------"
cd ..
npm install
echo "✅ Root dependencies installed"
echo ""

# Install API server dependencies
echo "🔧 Step 3/4: Installing API server dependencies..."
echo "--------------------------------------------------"
cd api-server
npm install
cd ..
echo "✅ API server dependencies installed"
echo ""

# Install frontend dependencies
echo "🎨 Step 4/4: Installing frontend dependencies..."
echo "------------------------------------------------"
cd frontend
npm install
cd ..
echo "✅ Frontend dependencies installed"
echo ""

# Create .env files if they don't exist
echo "⚙️  Configuring environment..."
if [ ! -f "api-server/.env" ]; then
    cp api-server/.env.example api-server/.env 2>/dev/null || echo "NODE_URL=https://devnet.aztec-labs.com/" > api-server/.env
    echo "✅ Created api-server/.env"
fi

if [ ! -f "frontend/.env.local" ]; then
    echo "NEXT_PUBLIC_API_URL=http://localhost:3001" > frontend/.env.local
    echo "✅ Created frontend/.env.local"
fi
echo ""

# Summary
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "📋 Next steps:"
echo "   1. Run the application:"
echo "      bash start.sh"
echo ""
echo "   2. Or run services separately:"
echo "      Terminal 1: cd api-server && npm start"
echo "      Terminal 2: cd frontend && npm run dev"
echo ""
echo "   3. Open http://localhost:3000 in your browser"
echo ""
echo "📚 For more information, see README.md"
echo ""
