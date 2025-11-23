#!/bin/bash

# Compile Aztec contracts
# This script compiles Noir contracts using aztec-nargo

set -e

echo "🔨 Compiling Noir contracts..."
echo ""

# Check if we're in the contracts directory
if [ -f "Nargo.toml" ]; then
    # We're in contracts/
    PROJECT_DIR="."
elif [ -f "contracts/Nargo.toml" ]; then
    # We're in root
    PROJECT_DIR="contracts"
else
    echo "❌ Error: Cannot find contracts/Nargo.toml"
    exit 1
fi

cd "$PROJECT_DIR"

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf target/
mkdir -p target/

# Compile with aztec-nargo
echo "⚙️  Compiling with aztec-nargo..."
aztec-nargo compile

# Check if compilation was successful
if [ ! -f "target/private_voting-PrivateVoting.json" ]; then
    echo "❌ Compilation failed: artifact not found"
    exit 1
fi

# Post-process the contract (transpile public bytecode)
echo "🔄 Post-processing contract..."
aztec-postprocess-contract target/private_voting-PrivateVoting.json

# Verify post-processing was successful
if ! grep -q '"publicBytecode"' target/private_voting-PrivateVoting.json; then
    echo "⚠️  Warning: Post-processing may have failed (no publicBytecode found)"
fi

# Get artifact size
ARTIFACT_SIZE=$(du -h target/private_voting-PrivateVoting.json | cut -f1)

echo ""
echo "✅ Compilation successful!"
echo "   Artifact: target/private_voting-PrivateVoting.json ($ARTIFACT_SIZE)"
echo ""
