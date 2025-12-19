#!/bin/bash
# Script d'installation complète

set -e

echo "🃏 Card Cloner - Installation"
echo "=============================="

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier Python
echo ""
echo "Vérification des prérequis..."

if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
    echo -e "${GREEN}✓${NC} Python $PYTHON_VERSION"
else
    echo -e "${RED}✗${NC} Python 3 non trouvé. Veuillez l'installer."
    exit 1
fi

# Vérifier Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} Node.js $NODE_VERSION"
else
    echo -e "${RED}✗${NC} Node.js non trouvé. Veuillez l'installer."
    exit 1
fi

# Vérifier npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓${NC} npm $NPM_VERSION"
else
    echo -e "${RED}✗${NC} npm non trouvé."
    exit 1
fi

# Créer les répertoires
echo ""
echo "Création des répertoires..."
mkdir -p backend/uploads backend/outputs backend/temp

# Installer le backend
echo ""
echo "Installation du backend Python..."
cd backend

if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Installer Playwright
echo ""
echo "Installation de Playwright (navigateur headless)..."
playwright install chromium
playwright install-deps chromium 2>/dev/null || true

cd ..

# Installer le frontend
echo ""
echo "Installation du frontend Next.js..."
cd frontend
npm install
cd ..

# Créer le fichier .env si nécessaire
if [ ! -f "backend/.env" ]; then
    echo ""
    echo "Configuration des variables d'environnement..."
    cp backend/env.template backend/.env
    echo -e "${YELLOW}⚠️  Veuillez éditer backend/.env avec vos clés API${NC}"
fi

echo ""
echo -e "${GREEN}✅ Installation terminée!${NC}"
echo ""
echo "Prochaines étapes:"
echo "1. Éditez backend/.env avec vos clés API (OpenAI, Anthropic)"
echo "2. Lancez: ./scripts/start-dev.sh"
echo ""
echo "Ou avec Docker:"
echo "1. Créez .env à la racine avec vos clés"
echo "2. Lancez: docker-compose up -d"

