"""AI Orchestrator using LangGraph for card generation."""
import os
import base64
import asyncio
from typing import TypedDict, List, Optional, Annotated
from dataclasses import dataclass

from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END
import json

from app.config import get_settings

settings = get_settings()


class CardState(TypedDict):
    """State for the card generation graph."""
    image_path: str
    colors: List[dict]
    extracted_data: Optional[dict]
    logo_svg: Optional[str]
    logo_path: Optional[str]  # Path to uploaded logo image
    generated_html: Optional[str]
    screenshot_path: Optional[str]
    diff_result: Optional[dict]
    corrections: List[str]
    iteration: int
    status: str
    error: Optional[str]


class AIOrchestrator:
    """Orchestrates the AI agents for card generation."""
    
    def __init__(
        self,
        job_id: str,
        jobs_dict: dict,
        image_processor
    ):
        self.job_id = job_id
        self.jobs = jobs_dict
        self.image_processor = image_processor
        self.max_iterations = settings.max_correction_loops
        
        # Initialize LLM clients with timeout
        self.vision_llm = ChatOpenAI(
            model="gpt-4o",
            api_key=settings.openai_api_key,
            max_tokens=4096,
            timeout=60  # 60 second timeout
        )
        
        self.coder_llm = ChatAnthropic(
            model="claude-sonnet-4-20250514",
            api_key=settings.anthropic_api_key,
            max_tokens=8192,
            timeout=120  # 2 minute timeout for code generation
        )
        
        self.critic_llm = ChatOpenAI(
            model="gpt-4o",
            api_key=settings.openai_api_key,
            max_tokens=2048,
            timeout=60
        )
    
    def _update_status(self, step: str, progress: int):
        """Update job status."""
        if self.job_id in self.jobs:
            self.jobs[self.job_id].current_step = step
            self.jobs[self.job_id].progress = progress
    
    def _encode_image(self, image_path: str) -> str:
        """Encode image to base64."""
        with open(image_path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")
    
    async def _extract_card_data(self, state: CardState) -> CardState:
        """
        Agent 1: L'Extracteur - Extract data from card image using GPT-4 Vision.
        """
        self._update_status("Analyse de la carte avec IA Vision...", 35)
        
        image_b64 = self._encode_image(state["image_path"])
        
        extraction_prompt = """Tu es un expert en analyse de cartes de visite. MESURE PRÉCISÉMENT tous les éléments.

EXTRAIT les données en JSON. Sois TRÈS PRÉCIS sur les positions (en pourcentage de la largeur/hauteur totale).

Retourne ce JSON:
{
    "layout": {
        "type": "two_columns|single_column|centered",
        "left_column_width_percent": 40,
        "has_vertical_separator": true,
        "vertical_separator_position_percent": 40,
        "vertical_separator_color": "#cccccc"
    },
    "left_section": {
        "logo_width_percent": 25,
        "logo_vertical_position": "center",
        "has_company_name_below_logo": true,
        "has_website_at_bottom": true
    },
    "right_section": {
        "header_code": "FL",
        "header_subtitle": "Faculty of Letters",
        "has_horizontal_line_after_header": true
    },
    "content": {
        "company_name": "",
        "company_name_style": "bold uppercase serif",
        "person_name": "",
        "person_name_style": "italic serif large",
        "title": "",
        "secondary_title": "",
        "phone": "",
        "cell_phone": "",
        "email": "",
        "website": "",
        "website_color": "#5DADE2"
    },
    "typography": {
        "primary_font": "Times New Roman, serif",
        "secondary_font": "Arial, sans-serif",
        "name_font_size": "36px",
        "title_font_size": "24px",
        "contact_font_size": "18px"
    },
    "colors": {
        "background": "#ffffff",
        "primary_text": "#333333",
        "secondary_text": "#666666",
        "accent": "#5DADE2"
    }
}

MESURE visuellement chaque élément. Les pourcentages doivent être précis."""

        response = await self.vision_llm.ainvoke([
            SystemMessage(content=extraction_prompt),
            HumanMessage(content=[
                {"type": "text", "text": "Analyse cette carte de visite et extrait toutes les données:"},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{image_b64}"}
                }
            ])
        ])
        
        # Parse JSON from response
        try:
            content = response.content
            # Extract JSON from markdown if present
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            
            extracted_data = json.loads(content.strip())
            state["extracted_data"] = extracted_data
            state["status"] = "extracted"
        except json.JSONDecodeError as e:
            state["error"] = f"Failed to parse extraction: {e}"
            state["status"] = "failed"
        
        return state
    
    async def _generate_html(self, state: CardState) -> CardState:
        """
        Agent 3: Le Codeur - Generate HTML/CSS using Claude with image.
        """
        self._update_status("Génération du code HTML/CSS...", 50)
        
        data = state["extracted_data"]
        image_b64 = self._encode_image(state["image_path"])
        
        # Prepare logo instruction
        logo_instruction = ""
        logo_b64_data = ""
        if state.get("logo_path") and os.path.exists(state["logo_path"]):
            logo_b64 = self._encode_image(state["logo_path"])
            # Detect image type - IMPORTANT: SVG needs svg+xml
            logo_ext = state["logo_path"].split(".")[-1].lower()
            if logo_ext == "png":
                mime_type = "image/png"
            elif logo_ext in ["jpg", "jpeg"]:
                mime_type = "image/jpeg"
            elif logo_ext == "svg":
                mime_type = "image/svg+xml"
            elif logo_ext == "webp":
                mime_type = "image/webp"
            elif logo_ext == "gif":
                mime_type = "image/gif"
            else:
                mime_type = "image/png"  # Default to PNG
            
            logo_b64_data = f"data:{mime_type};base64,{logo_b64}"
            logo_instruction = f"""
LOGO FOURNI PAR L'UTILISATEUR - TRÈS IMPORTANT:
⚠️ TU DOIS ABSOLUMENT utiliser cette balise img EXACTE pour le logo (ne modifie RIEN):

<img src="{logo_b64_data}" alt="Logo" style="width: 150px; height: auto;" />

NE GÉNÈRE PAS de logo toi-même. COPIE-COLLE cette balise img dans ton HTML.
Positionne le logo EXACTEMENT comme sur l'image originale (généralement en haut à gauche)."""
        
        generation_prompt = f"""Tu es un moteur de rendu HTML/CSS. Tu dois CLONER EXACTEMENT la carte de visite dans l'image.

ANALYSE L'IMAGE ET REPRODUIS-LA AU PIXEL PRÈS.

DONNÉES EXTRAITES:
{json.dumps(data, indent=2, ensure_ascii=False)}
{logo_instruction}

⚠️ RÈGLES CRITIQUES - RESPECTE CHAQUE DÉTAIL:

1. DIMENSIONS FIXES: width: 1120px; height: 640px; overflow: hidden;

2. MESURE VISUELLEMENT les proportions:
   - Si le logo occupe ~35% de la largeur à gauche, utilise width: 35%
   - Si la ligne verticale est à 40% de la gauche, positionne-la à left: 40%
   - Mesure les marges en pourcentage ou pixels

3. REPRODUIS LA STRUCTURE EXACTE de l'image:
   - Position et taille EXACTE du logo
   - Ligne(s) de séparation (verticale/horizontale) - couleur, épaisseur, position
   - Espacement IDENTIQUE entre chaque élément
   - Alignement du texte (gauche/centre/droite) comme sur l'original

4. POLICES - Observe l'image:
   - Texte en ITALIQUE serif = font-style: italic; font-family: 'Times New Roman', Georgia, serif;
   - Texte GRAS = font-weight: bold;
   - Texte léger/gris = color: #666 ou #888;
   - Reproduis les TAILLES de police proportionnellement

5. COULEURS - Extrais les couleurs EXACTES:
   - Bleu clair pour liens/website = #5DADE2 ou similaire
   - Gris pour texte secondaire = #666666
   - Noir pour texte principal = #333333
   - Vert pour éléments de logo si applicable

6. ÉLÉMENTS À INCLURE (si présents sur l'image):
   - Logo (utilise la balise img fournie si disponible)
   - Nom de l'entreprise/université
   - Nom de la personne
   - Titre/fonction
   - Téléphone, email, site web
   - Toute ligne décorative ou séparatrice

CODE HTML STRICT:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    #scaler {{
      width: 100%; height: 100vh;
      display: flex; justify-content: center; align-items: center;
      background: #f0f0f0;
    }}
    #business-card {{
      width: 1120px; height: 640px;
      background: #ffffff;
      position: relative;
      box-shadow: 0 8px 32px rgba(0,0,0,0.12);
      display: flex;
      overflow: hidden;
    }}
    /* AJOUTE TON CSS ICI - UTILISE position: absolute OU flexbox */
  </style>
</head>
<body>
  <div id="scaler">
    <div id="business-card">
      <!-- CLONE EXACT DU LAYOUT -->
    </div>
  </div>
  <script>
    function resize() {{
      const card = document.getElementById('business-card');
      const container = document.getElementById('scaler');
      const scale = Math.min(container.clientWidth / 1120, container.clientHeight / 640);
      card.style.transform = `scale(${{Math.max(0.3, scale - 0.02)}})`;
      card.style.transformOrigin = 'center center';
    }}
    window.onresize = resize;
    resize();
  </script>
</body>
</html>
```

RETOURNE UNIQUEMENT LE HTML. AUCUNE EXPLICATION."""

        # Detect actual image type
        image_ext = state["image_path"].split(".")[-1].lower()
        if image_ext in ["jpg", "jpeg"]:
            media_type = "image/jpeg"
        elif image_ext == "png":
            media_type = "image/png"
        elif image_ext == "webp":
            media_type = "image/webp"
        elif image_ext == "gif":
            media_type = "image/gif"
        else:
            media_type = "image/jpeg"  # Default

        response = await self.coder_llm.ainvoke([
            HumanMessage(content=[
                {"type": "text", "text": generation_prompt},
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_b64}}
            ])
        ])
        
        html_content = response.content
        
        # Clean up if wrapped in markdown
        if "```html" in html_content:
            html_content = html_content.split("```html")[1].split("```")[0]
        elif "```" in html_content:
            html_content = html_content.split("```")[1].split("```")[0]
        
        state["generated_html"] = html_content.strip()
        state["status"] = "generated"
        
        return state
    
    async def _take_screenshot(self, state: CardState) -> CardState:
        """Take a screenshot of the generated HTML using Playwright."""
        self._update_status("Capture du rendu...", 65)
        
        html_content = state["generated_html"]
        
        # Save HTML temporarily
        temp_html_path = f"temp/{self.job_id}_preview.html"
        with open(temp_html_path, "w", encoding="utf-8") as f:
            f.write(html_content)
        
        try:
            from playwright.async_api import async_playwright
            
            async with async_playwright() as p:
                browser = await p.chromium.launch()
                page = await browser.new_page(
                    viewport={"width": 1200, "height": 720}
                )
                
                await page.goto(f"file://{os.path.abspath(temp_html_path)}")
                await page.wait_for_timeout(500)  # Wait for render
                
                screenshot_path = f"temp/{self.job_id}_screenshot.png"
                await page.screenshot(path=screenshot_path)
                await browser.close()
                
                state["screenshot_path"] = screenshot_path
                state["status"] = "screenshot_taken"
                
        except Exception as e:
            # If Playwright fails, skip comparison
            state["status"] = "screenshot_failed"
            state["error"] = f"Screenshot failed: {e}"
        
        return state
    
    async def _compare_images(self, state: CardState) -> CardState:
        """Compare the generated screenshot with the original."""
        self._update_status("Comparaison visuelle...", 75)
        
        if state.get("screenshot_path") and os.path.exists(state["screenshot_path"]):
            try:
                diff_result = self.image_processor.compare_images(
                    state["image_path"],
                    state["screenshot_path"],
                    f"temp/{self.job_id}_diff.png"
                )
                state["diff_result"] = diff_result
                state["status"] = "compared"
            except Exception as e:
                state["status"] = "comparison_failed"
                state["error"] = f"Comparison failed: {e}"
        
        return state
    
    async def _critique_result(self, state: CardState) -> CardState:
        """
        Agent Critique: Analyze differences and provide corrections.
        """
        self._update_status("Analyse critique du résultat...", 80)
        
        if not state.get("diff_result"):
            state["status"] = "critique_skipped"
            return state
        
        similarity = state["diff_result"]["similarity"]
        
        # If similarity is high enough, we're done
        if similarity >= 98:
            state["status"] = "approved"
            state["corrections"] = []
            return state
        
        # Otherwise, analyze and suggest corrections
        original_b64 = self._encode_image(state["image_path"])
        screenshot_b64 = self._encode_image(state["screenshot_path"])
        diff_b64 = self._encode_image(state["diff_result"]["diff_map_path"])
        
        critique_prompt = f"""Tu es un expert en comparaison visuelle. Tu reçois 3 images:
1. L'original (la carte de visite cible)
2. Le rendu actuel (notre génération)
3. La carte de différences (pixels rouges = erreurs)

Score de similarité actuel: {similarity:.1f}%

ANALYSE les différences et liste les corrections CSS PRÉCISES à appliquer.
Format de réponse:
- Si le résultat est acceptable (>95% similaire et pas d'erreurs majeures): réponds exactement "OK"
- Sinon, liste les corrections sous forme:
  * "Déplacer [élément] de Xpx vers [direction]"
  * "Changer la taille de [élément] à Xpx"
  * "Modifier la couleur de [élément] de #XXX à #YYY"
  * "Ajuster l'espacement entre [X] et [Y] à Xpx"

Sois TRÈS spécifique avec les valeurs en pixels."""

        response = await self.critic_llm.ainvoke([
            SystemMessage(content=critique_prompt),
            HumanMessage(content=[
                {"type": "text", "text": "Image 1 - ORIGINALE:"},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{original_b64}"}},
                {"type": "text", "text": "Image 2 - RENDU ACTUEL:"},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{screenshot_b64}"}},
                {"type": "text", "text": "Image 3 - CARTE DE DIFFÉRENCES (rouge = erreurs):"},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{diff_b64}"}}
            ])
        ])
        
        content = response.content.strip()
        
        if content.upper() == "OK" or similarity >= 95:
            state["status"] = "approved"
            state["corrections"] = []
        else:
            # Parse corrections
            corrections = [
                line.strip().lstrip("*- ")
                for line in content.split("\n")
                if line.strip() and not line.startswith("#")
            ]
            state["corrections"] = corrections
            state["status"] = "needs_correction"
        
        return state
    
    async def run(self, image_path: str, colors: List[dict], logo_path: Optional[str] = None) -> dict:
        """Run the simplified generation pipeline without complex graph."""
        import logging
        logging.basicConfig(level=logging.INFO)
        logger = logging.getLogger(__name__)
        
        try:
            logger.info(f"Starting generation for {image_path}, logo: {logo_path}")
            # Step 1: Extract card data
            self._update_status("Analyse de la carte...", 30)
            state: CardState = {
                "image_path": image_path,
                "colors": colors,
                "extracted_data": None,
                "logo_svg": None,
                "logo_path": logo_path,  # Add logo path to state
                "generated_html": None,
                "screenshot_path": None,
                "diff_result": None,
                "corrections": [],
                "iteration": 0,
                "status": "starting",
                "error": None
            }
            
            logger.info("Calling GPT-4 Vision for extraction...")
            state = await self._extract_card_data(state)
            logger.info(f"Extraction done. Status: {state.get('status')}")
            
            if state.get("status") == "failed":
                raise Exception(state.get("error", "Extraction failed"))
            
            # Step 2: Generate HTML (only ONE iteration for speed)
            logger.info("Calling Claude for HTML generation...")
            state["iteration"] = 1
            self._update_status("Génération HTML...", 60)
            
            state = await self._generate_html(state)
            logger.info(f"Generation done. HTML length: {len(state.get('generated_html', ''))}")
            
            self._update_status("Terminé!", 100)
            
            return {
                "html": state.get("generated_html", ""),
                "colors": colors,
                "extracted_data": state.get("extracted_data"),
                "iterations": state.get("iteration", 1),
                "final_similarity": None,
                "status": "completed"
            }
            
        except Exception as e:
            self._update_status(f"Erreur: {str(e)}", 0)
            raise

