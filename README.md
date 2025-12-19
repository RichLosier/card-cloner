# 🃏 Card Cloner - Plateforme de Clonage Numérique de Cartes d'Affaires

Une application web intelligente qui transforme n'importe quelle photo de carte d'affaires en code HTML/CSS pixel-perfect grâce à l'IA.

![Card Cloner](https://via.placeholder.com/800x400?text=Card+Cloner+Demo)

## ✨ Fonctionnalités

- **Upload intelligent** : Glissez-déposez votre photo de carte
- **Correction de perspective manuelle** : Alignez les 4 coins pour une extraction parfaite
- **Extraction automatique** : GPT-4 Vision analyse le contenu et la structure
- **Génération de code** : Claude 3.5 Sonnet produit du HTML/CSS pixel-perfect
- **Boucle de correction automatique** : Comparaison visuelle et ajustements automatiques
- **Export facile** : Téléchargez le fichier HTML ou copiez le code

## 🛠️ Stack Technologique

### Backend (Python)
- **FastAPI** - API REST haute performance
- **OpenCV** - Traitement d'image (perspective, couleurs)
- **LangGraph** - Orchestration des agents IA
- **GPT-4 Vision** - Extraction des données
- **Claude 3.5 Sonnet** - Génération de code
- **Playwright** - Capture d'écran du rendu
- **Supabase** - Stockage persistant

### Frontend (Next.js)
- **React 18** - Interface utilisateur réactive
- **Tailwind CSS** - Design moderne et personnalisable
- **Framer Motion** - Animations fluides
- **react-dropzone** - Upload par glisser-déposer

## 🚀 Installation Rapide

### Prérequis
- Node.js 18+
- Python 3.11+
- Docker & Docker Compose (optionnel)

### Option 1: Développement Local

#### Backend
```bash
cd backend

# Créer l'environnement virtuel
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Installer les dépendances
pip install -r requirements.txt

# Installer les navigateurs Playwright
playwright install chromium

# Configurer les variables d'environnement
cp env.template .env
# Éditer .env avec vos clés API

# Lancer le serveur
uvicorn app.main:app --reload --port 8000
```

#### Frontend
```bash
cd frontend

# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev
```

L'application est accessible sur http://localhost:3000

### Option 2: Docker

```bash
# Créer le fichier .env à la racine
cat > .env << EOF
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
EOF

# Lancer les services
docker-compose up -d

# Voir les logs
docker-compose logs -f
```

## 🔑 Configuration des APIs

### Clés API Requises

| Service | Variable | Description |
|---------|----------|-------------|
| OpenAI | `OPENAI_API_KEY` | Pour GPT-4 Vision (extraction & critique) |
| Anthropic | `ANTHROPIC_API_KEY` | Pour Claude 3.5 Sonnet (génération de code) |
| Supabase | `SUPABASE_URL`, `SUPABASE_KEY` | Stockage persistant (optionnel) |
| Vectorizer.ai | `VECTORIZER_API_KEY` | Vectorisation de logos (optionnel) |

### Configuration Supabase (Optionnel)

Si vous utilisez Supabase, créez la table avec ce SQL:

```sql
CREATE TABLE IF NOT EXISTS card_projects (
    id BIGSERIAL PRIMARY KEY,
    job_id UUID UNIQUE NOT NULL,
    original_image TEXT,
    generated_html TEXT,
    colors JSONB,
    metadata JSONB,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_card_projects_job_id ON card_projects(job_id);
```

## 📁 Structure du Projet

```
AI card creator/
├── backend/
│   ├── app/
│   │   ├── main.py              # Point d'entrée FastAPI
│   │   ├── config.py            # Configuration
│   │   └── services/
│   │       ├── image_processor.py    # OpenCV (perspective, couleurs)
│   │       ├── ai_orchestrator.py    # LangGraph (agents IA)
│   │       ├── storage_service.py    # Supabase
│   │       └── vectorizer_service.py # Vectorisation logo
│   ├── requirements.txt
│   ├── Dockerfile
│   └── env.template
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── ImageUploader.tsx
│   │   ├── PerspectiveEditor.tsx
│   │   └── GenerationDashboard.tsx
│   ├── package.json
│   └── Dockerfile
│
├── docker-compose.yml
├── nginx.conf
└── README.md
```

## 🔄 Workflow de Génération

1. **Upload** → L'utilisateur glisse sa photo
2. **Perspective** → L'utilisateur aligne les 4 coins
3. **Traitement Image** → OpenCV redresse et extrait les couleurs
4. **Agent Extracteur** → GPT-4 Vision analyse structure et contenu
5. **Agent Codeur** → Claude génère le HTML/CSS
6. **Screenshot** → Playwright capture le rendu
7. **Agent Critique** → GPT-4 compare original vs rendu
8. **Boucle** → Si différences > 2%, retour à l'étape 5 (max 3 itérations)
9. **Export** → Code HTML final prêt à télécharger

## 📐 Spécifications Techniques

### Dimensions de Sortie
- **Largeur**: 1120px (fixe)
- **Hauteur**: 640px (fixe)
- **Ratio**: 1.75:1
- **Format**: HTML autonome avec CSS intégré
- **Responsive**: Oui (via JavaScript de mise à l'échelle)

### Template HTML de Sortie
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    #scaler { /* Conteneur responsive */ }
    #business-card {
      width: 1120px;
      height: 640px;
      /* CSS généré par l'IA */
    }
  </style>
</head>
<body>
  <div id="scaler">
    <div id="business-card">
      <!-- Contenu généré -->
    </div>
  </div>
  <script>/* Mise à l'échelle automatique */</script>
</body>
</html>
```

## 🐛 Dépannage

### Erreur: "Cannot read image"
- Vérifiez que l'image est dans un format supporté (JPG, PNG, WebP)
- Assurez-vous que le fichier n'est pas corrompu

### Erreur: "API key not configured"
- Vérifiez que les variables d'environnement sont définies
- Redémarrez le backend après modification du fichier `.env`

### Erreur: "Playwright browser not found"
```bash
cd backend
playwright install chromium
playwright install-deps chromium
```

### Le frontend ne se connecte pas au backend
- Vérifiez que le backend tourne sur le port 8000
- Vérifiez la configuration CORS dans `config.py`

## 💰 Coûts Estimés

| Opération | Coût approximatif |
|-----------|-------------------|
| GPT-4 Vision (extraction) | ~$0.02/image |
| Claude 3.5 (génération) | ~$0.01/génération |
| GPT-4 Vision (critique) | ~$0.03/comparaison |
| **Total par carte** | **~$0.06-0.15** |

## 📄 Licence

MIT License - Libre d'utilisation et modification.

## 🤝 Contribution

Les contributions sont les bienvenues! Ouvrez une issue ou une PR.

---

Développé avec ❤️ et beaucoup de ☕

