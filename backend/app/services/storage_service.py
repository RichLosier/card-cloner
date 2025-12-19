"""Storage service for Supabase integration."""
import os
import base64
from datetime import datetime
from typing import Optional, List
import httpx

from app.config import get_settings

settings = get_settings()


class StorageService:
    """Service for storing and retrieving data from Supabase."""
    
    def __init__(self):
        self.url = settings.supabase_url
        self.key = settings.supabase_key
        self.client = None
        
        if self.url and self.key:
            self._init_client()
    
    def _init_client(self):
        """Initialize Supabase client."""
        try:
            from supabase import create_client
            self.client = create_client(self.url, self.key)
        except Exception as e:
            print(f"Warning: Could not initialize Supabase client: {e}")
            self.client = None
    
    async def save_card_project(
        self,
        job_id: str,
        original_image_path: str,
        generated_html: str,
        colors: List[dict],
        metadata: Optional[dict] = None
    ) -> dict:
        """
        Save a card project to the database.
        
        Args:
            job_id: Unique job identifier
            original_image_path: Path to the original image
            generated_html: The generated HTML code
            colors: Extracted color palette
            metadata: Additional metadata
        
        Returns:
            Saved record data
        """
        if not self.client:
            return {"status": "skipped", "reason": "Supabase not configured"}
        
        # Read and encode image
        with open(original_image_path, "rb") as f:
            image_data = base64.b64encode(f.read()).decode("utf-8")
        
        record = {
            "job_id": job_id,
            "original_image": image_data,
            "generated_html": generated_html,
            "colors": colors,
            "metadata": metadata or {},
            "created_at": datetime.utcnow().isoformat(),
            "version": 1
        }
        
        try:
            result = self.client.table("card_projects").insert(record).execute()
            return {"status": "saved", "data": result.data}
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    async def get_card_project(self, job_id: str) -> Optional[dict]:
        """Retrieve a card project by job ID."""
        if not self.client:
            return None
        
        try:
            result = self.client.table("card_projects")\
                .select("*")\
                .eq("job_id", job_id)\
                .single()\
                .execute()
            return result.data
        except Exception:
            return None
    
    async def update_card_html(
        self,
        job_id: str,
        new_html: str,
        version: int
    ) -> dict:
        """Update the HTML of a card project."""
        if not self.client:
            return {"status": "skipped", "reason": "Supabase not configured"}
        
        try:
            result = self.client.table("card_projects")\
                .update({
                    "generated_html": new_html,
                    "version": version,
                    "updated_at": datetime.utcnow().isoformat()
                })\
                .eq("job_id", job_id)\
                .execute()
            return {"status": "updated", "data": result.data}
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    async def list_projects(
        self,
        limit: int = 20,
        offset: int = 0
    ) -> List[dict]:
        """List all card projects."""
        if not self.client:
            return []
        
        try:
            result = self.client.table("card_projects")\
                .select("job_id, created_at, metadata")\
                .order("created_at", desc=True)\
                .range(offset, offset + limit - 1)\
                .execute()
            return result.data
        except Exception:
            return []
    
    async def upload_to_storage(
        self,
        file_path: str,
        bucket: str = "card-images",
        folder_path: str = ""
    ) -> Optional[str]:
        """
        Upload a file to Supabase Storage.
        
        Args:
            file_path: Local path to the file
            bucket: Storage bucket name
            folder_path: Folder path in storage (e.g., "Dupont_Jean")
        
        Returns:
            Public URL of the uploaded file
        """
        if not self.client:
            return None
        
        try:
            filename = os.path.basename(file_path)
            
            # Build full storage path with folder
            storage_path = f"{folder_path}/{filename}" if folder_path else filename
            
            # Determine content type
            ext = filename.split(".")[-1].lower()
            content_types = {
                "jpg": "image/jpeg",
                "jpeg": "image/jpeg",
                "png": "image/png",
                "svg": "image/svg+xml",
                "pdf": "application/pdf",
                "webp": "image/webp"
            }
            content_type = content_types.get(ext, "application/octet-stream")
            
            with open(file_path, "rb") as f:
                self.client.storage.from_(bucket).upload(
                    storage_path,
                    f.read(),
                    {"content-type": content_type}
                )
            
            url = self.client.storage.from_(bucket).get_public_url(storage_path)
            return url
        except Exception as e:
            print(f"Upload error: {e}")
            return None
    
    async def upload_card_files(
        self,
        first_name: str,
        last_name: str,
        email: str,
        front_card_path: str,
        back_card_path: Optional[str] = None,
        logo_path: Optional[str] = None
    ) -> dict:
        """
        Upload card files to Supabase Storage organized by name.
        
        Folder structure: Nom_Prénom/
            - recto.jpg
            - verso.jpg (optional)
            - logo.png (optional)
        
        Args:
            first_name: User's first name
            last_name: User's last name
            email: User's email
            front_card_path: Path to front card image
            back_card_path: Optional path to back card image
            logo_path: Optional path to logo
        
        Returns:
            dict with URLs and status
        """
        if not self.client:
            return {"status": "skipped", "reason": "Supabase not configured"}
        
        # Create folder name (sanitized)
        folder_name = self._sanitize_folder_name(f"{last_name}_{first_name}")
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        folder_path = f"{folder_name}/{timestamp}"
        
        result = {
            "folder": folder_path,
            "files": {},
            "status": "success"
        }
        
        try:
            # Upload front card
            front_ext = front_card_path.split(".")[-1]
            front_storage_path = f"{folder_path}/recto.{front_ext}"
            
            with open(front_card_path, "rb") as f:
                self.client.storage.from_("card-images").upload(
                    front_storage_path,
                    f.read(),
                    {"content-type": f"image/{front_ext}"}
                )
            
            result["files"]["front"] = self.client.storage.from_("card-images").get_public_url(front_storage_path)
            
            # Upload back card if provided
            if back_card_path and os.path.exists(back_card_path):
                back_ext = back_card_path.split(".")[-1]
                back_storage_path = f"{folder_path}/verso.{back_ext}"
                
                with open(back_card_path, "rb") as f:
                    self.client.storage.from_("card-images").upload(
                        back_storage_path,
                        f.read(),
                        {"content-type": f"image/{back_ext}"}
                    )
                
                result["files"]["back"] = self.client.storage.from_("card-images").get_public_url(back_storage_path)
            
            # Upload logo if provided
            if logo_path and os.path.exists(logo_path):
                logo_ext = logo_path.split(".")[-1]
                logo_storage_path = f"{folder_path}/logo.{logo_ext}"
                
                with open(logo_path, "rb") as f:
                    self.client.storage.from_("card-images").upload(
                        logo_storage_path,
                        f.read(),
                        {"content-type": f"image/{logo_ext}"}
                    )
                
                result["files"]["logo"] = self.client.storage.from_("card-images").get_public_url(logo_storage_path)
            
            # Save to database
            await self._save_upload_record(
                folder_path=folder_path,
                first_name=first_name,
                last_name=last_name,
                email=email,
                files=result["files"]
            )
            
            return result
            
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    def _sanitize_folder_name(self, name: str) -> str:
        """Sanitize folder name to be filesystem-safe."""
        import re
        # Remove accents and special characters
        name = name.strip()
        # Replace spaces with underscores
        name = name.replace(" ", "_")
        # Remove any characters that aren't alphanumeric, underscore, or hyphen
        name = re.sub(r'[^a-zA-Z0-9_\-àâäéèêëïîôùûüÿçœæÀÂÄÉÈÊËÏÎÔÙÛÜŸÇŒÆ]', '', name)
        return name or "Unknown"
    
    async def _save_upload_record(
        self,
        folder_path: str,
        first_name: str,
        last_name: str,
        email: str,
        files: dict
    ) -> dict:
        """Save an upload record to the database."""
        if not self.client:
            return {"status": "skipped"}
        
        record = {
            "folder_path": folder_path,
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "front_url": files.get("front"),
            "back_url": files.get("back"),
            "logo_url": files.get("logo"),
            "status": "pending",
            "created_at": datetime.utcnow().isoformat()
        }
        
        try:
            result = self.client.table("card_uploads").insert(record).execute()
            return {"status": "saved", "data": result.data}
        except Exception as e:
            print(f"Database save error: {e}")
            return {"status": "error", "error": str(e)}


# SQL pour créer les tables dans Supabase
SUPABASE_SCHEMA = """
-- Créer la table card_projects
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

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_card_projects_job_id ON card_projects(job_id);
CREATE INDEX IF NOT EXISTS idx_card_projects_created_at ON card_projects(created_at DESC);

-- Créer la table card_uploads (pour les uploads organisés par nom)
CREATE TABLE IF NOT EXISTS card_uploads (
    id BIGSERIAL PRIMARY KEY,
    folder_path TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    front_url TEXT,
    back_url TEXT,
    logo_url TEXT,
    status TEXT DEFAULT 'pending',
    job_id UUID,
    generated_html TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Index pour card_uploads
CREATE INDEX IF NOT EXISTS idx_card_uploads_name ON card_uploads(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_card_uploads_created_at ON card_uploads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_card_uploads_status ON card_uploads(status);

-- Activer RLS (Row Level Security)
ALTER TABLE card_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_uploads ENABLE ROW LEVEL SECURITY;

-- Politique d'accès (ajuster selon vos besoins)
CREATE POLICY "Allow all access" ON card_projects FOR ALL USING (true);
CREATE POLICY "Allow all access" ON card_uploads FOR ALL USING (true);

-- Créer le bucket de stockage (exécuter dans Supabase dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('card-images', 'card-images', true);
"""

