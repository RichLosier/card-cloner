#!/bin/bash
# Script de démarrage rapide pour le développement

set -e

echo "🃏 Card Cloner - Démarrage du développement"
echo "============================================"

# Vérifier si nous sommes à la racine du projet
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Erreur: Exécutez ce script depuis la racine du projet"
    exit 1
fi

# Créer les répertoires nécessaires
echo "📁 Création des répertoires..."
mkdir -p backend/uploads backend/outputs backend/temp

# Vérifier le fichier .env
if [ ! -f "backend/.env" ]; then
    echo "⚠️  Fichier .env non trouvé, création depuis le template..."
    if [ -f "backend/env.template" ]; then
        cp backend/env.template backend/.env
        echo "📝 Veuillez éditer backend/.env avec vos clés API"
    fi
fi

# Fonction pour démarrer le backend
start_backend() {
    echo ""
    echo "🐍 Démarrage du backend Python..."
    cd backend
    
    # Créer venv si nécessaire
    if [ ! -d "venv" ]; then
        echo "  Création de l'environnement virtuel..."
        python3 -m venv venv
    fi
    
    # Activer et installer
    source venv/bin/activate
    echo "  Installation des dépendances..."
    pip install -q -r requirements.txt
    
    # Lancer en arrière-plan
    echo "  Lancement sur http://localhost:8000"
    uvicorn app.main:app --reload --port 8000 &
    BACKEND_PID=$!
    cd ..
}

# Fonction pour démarrer le frontend
start_frontend() {
    echo ""
    echo "⚛️  Démarrage du frontend Next.js..."
    cd frontend
    
    # Installer si nécessaire
    if [ ! -d "node_modules" ]; then
        echo "  Installation des dépendances npm..."
        npm install
    fi
    
    # Lancer en arrière-plan
    echo "  Lancement sur http://localhost:3000"
    npm run dev &
    FRONTEND_PID=$!
    cd ..
}

# Démarrer les services
start_backend
start_frontend

# Attendre un peu pour le démarrage
sleep 3

echo ""
echo "✅ Services démarrés!"
echo ""
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend:  http://localhost:8000"
echo "📚 API Docs: http://localhost:8000/docs"
echo ""
echo "Appuyez sur Ctrl+C pour arrêter tous les services"

# Attendre l'interruption
wait

