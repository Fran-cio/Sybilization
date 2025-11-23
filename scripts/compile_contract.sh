#!/bin/bash

# Script para compilar el contrato Noir siguiendo la documentación de Aztec
# https://docs.aztec.network/devnet/developers/getting_started/compiling

set -e

echo "🔨 Compilando contrato PrivateVoting..."
echo ""

# Ir al directorio de contratos
cd contracts

# Verificar que aztec esté instalado
if ! command -v aztec &> /dev/null; then
    echo "❌ Aztec CLI no está instalado"
    echo "Instala Aztec CLI con:"
    echo "bash -i <(curl -s https://install.aztec.network)"
    exit 1
fi

# Verificar versión
CURRENT_VERSION=$(aztec --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+-devnet\.[0-9]+' || echo "unknown")
EXPECTED_VERSION="3.0.0-devnet.5"

echo "📦 Versión actual de Aztec: $CURRENT_VERSION"
echo "📦 Versión esperada: $EXPECTED_VERSION"

if [ "$CURRENT_VERSION" != "$EXPECTED_VERSION" ]; then
    echo "⚠️  La versión no coincide. Actualizando..."
    aztec-up $EXPECTED_VERSION
fi

echo ""
echo "🔧 Compilando con aztec-nargo..."

# Compilar el contrato
aztec-nargo compile

echo ""
echo "⚙️  Post-procesando contrato para Aztec VM..."

# Post-procesar para transpilar bytecode público
aztec-postprocess-contract

echo ""
echo "📝 Generando interfaces TypeScript..."

# Generar interfaces TypeScript
aztec codegen ./target -o ./target

echo ""
echo "✅ Compilación completada!"
echo ""
echo "📄 Artifact generado:"
ls -lh target/*.json

echo ""
echo "💡 Para deployment:"
echo "   Local:  node ../scripts/deploy_contract.js"
echo "   Devnet: NODE_URL=https://devnet.aztec-labs.com/ node ../scripts/deploy_devnet.js"
