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
        bucket: str = "card-images"
    ) -> Optional[str]:
        """
        Upload a file to Supabase Storage.
        
        Returns:
            Public URL of the uploaded file
        """
        if not self.client:
            return None
        
        try:
            filename = os.path.basename(file_path)
            with open(file_path, "rb") as f:
                self.client.storage.from_(bucket).upload(
                    filename,
                    f.read(),
                    {"content-type": "image/png"}
                )
            
            url = self.client.storage.from_(bucket).get_public_url(filename)
            return url
        except Exception as e:
            print(f"Upload error: {e}")
            return None


# SQL pour créer la table dans Supabase
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

-- Activer RLS (Row Level Security)
ALTER TABLE card_projects ENABLE ROW LEVEL SECURITY;

-- Politique d'accès (ajuster selon vos besoins)
CREATE POLICY "Allow all access" ON card_projects FOR ALL USING (true);
"""

