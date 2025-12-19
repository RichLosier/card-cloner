"""Main FastAPI application for Business Card Cloner."""
import os
import io
import uuid
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from PIL import Image

from app.config import get_settings
from app.services.image_processor import ImageProcessor
from app.services.ai_orchestrator import AIOrchestrator
from app.services.storage_service import StorageService

settings = get_settings()

app = FastAPI(
    title="Business Card Cloner API",
    description="API pour cloner numériquement des cartes d'affaires",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create directories
os.makedirs("uploads", exist_ok=True)
os.makedirs("outputs", exist_ok=True)
os.makedirs("temp", exist_ok=True)

# Mobile session storage (use Redis in production)
mobile_sessions: dict[str, dict] = {}

# Mount static files
app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")

# Initialize services
image_processor = ImageProcessor()
storage_service = StorageService()


class PerspectivePoints(BaseModel):
    """4 corner points for perspective correction."""
    top_left: tuple[float, float]
    top_right: tuple[float, float]
    bottom_right: tuple[float, float]
    bottom_left: tuple[float, float]


class GenerateCardRequest(BaseModel):
    """Request model for card generation."""
    image_id: str
    logo_id: Optional[str] = None
    perspective_points: Optional[PerspectivePoints] = None


class JobStatus(BaseModel):
    """Job status response."""
    job_id: str
    status: str  # pending, processing, extracting, generating, correcting, completed, failed
    progress: int  # 0-100
    current_step: str
    result_url: Optional[str] = None
    error: Optional[str] = None


# In-memory job storage (use Redis/DB in production)
jobs: dict[str, JobStatus] = {}


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "Business Card Cloner API"}


@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    """Upload an image for processing."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Generate unique ID
    image_id = str(uuid.uuid4())
    
    # Save file
    file_extension = file.filename.split(".")[-1] if file.filename else "jpg"
    file_path = f"uploads/{image_id}.{file_extension}"
    
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Get image dimensions
    dimensions = image_processor.get_dimensions(file_path)
    
    return {
        "image_id": image_id,
        "file_path": file_path,
        "dimensions": dimensions,
        "message": "Image uploaded successfully"
    }


@app.post("/upload-logo")
async def upload_logo(file: UploadFile = File(...)):
    """Upload a logo image for card generation."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Generate unique ID
    logo_id = str(uuid.uuid4())
    
    # Save file
    file_extension = file.filename.split(".")[-1] if file.filename else "png"
    file_path = f"uploads/{logo_id}.{file_extension}"
    
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    
    return {
        "logo_id": logo_id,
        "file_path": file_path,
        "message": "Logo uploaded successfully"
    }


@app.post("/upload-cards")
async def upload_cards(
    front_card: UploadFile = File(...),
    first_name: str = Form(...),
    last_name: str = Form(...),
    email: str = Form(""),
    back_card: Optional[UploadFile] = File(None),
):
    """
    Upload card files (front + optional back) and save to Supabase Storage.
    Files are organized by: Nom_Prénom/timestamp/
    
    Args:
        front_card: Front side of the business card (required)
        first_name: User's first name (required)
        last_name: User's last name (required)
        email: User's email (optional)
        back_card: Back side of the business card (optional)
    
    Returns:
        Upload result with Supabase URLs
    """
    # Validate front card
    if not front_card.content_type.startswith("image/") and front_card.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Front card must be an image or PDF")
    
    # Generate unique IDs
    front_id = str(uuid.uuid4())
    
    # Save front card locally first
    front_ext = front_card.filename.split(".")[-1] if front_card.filename else "jpg"
    front_path = f"uploads/{front_id}.{front_ext}"
    
    front_content = await front_card.read()
    with open(front_path, "wb") as f:
        f.write(front_content)
    
    # Save back card if provided
    back_path = None
    if back_card and back_card.filename:
        back_id = str(uuid.uuid4())
        back_ext = back_card.filename.split(".")[-1] if back_card.filename else "jpg"
        back_path = f"uploads/{back_id}.{back_ext}"
        
        back_content = await back_card.read()
        with open(back_path, "wb") as f:
            f.write(back_content)
    
    # Upload to Supabase Storage
    result = await storage_service.upload_card_files(
        first_name=first_name,
        last_name=last_name,
        email=email,
        front_card_path=front_path,
        back_card_path=back_path
    )
    
    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("error", "Upload failed"))
    
    return {
        "status": "success",
        "message": f"Files uploaded for {first_name} {last_name}",
        "folder": result.get("folder"),
        "files": result.get("files"),
        "front_id": front_id  # For subsequent processing
    }


@app.get("/detect-corners/{image_id}")
async def detect_corners(image_id: str):
    """Automatically detect card corners in an uploaded image."""
    # Find image
    image_path = None
    for ext in ["jpg", "jpeg", "png", "webp"]:
        path = f"uploads/{image_id}.{ext}"
        if os.path.exists(path):
            image_path = path
            break
    
    if not image_path:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Get image dimensions
    dimensions = image_processor.get_dimensions(image_path)
    
    # Auto-detect corners
    corners = image_processor.auto_detect_corners(image_path)
    
    if corners:
        return {
            "detected": True,
            "corners": {
                "top_left": list(corners[0]),
                "top_right": list(corners[1]),
                "bottom_right": list(corners[2]),
                "bottom_left": list(corners[3])
            },
            "dimensions": dimensions,
            "message": "Card corners detected automatically"
        }
    else:
        # Return default corners (10% padding)
        w, h = dimensions["width"], dimensions["height"]
        padding = 0.1
        return {
            "detected": False,
            "corners": {
                "top_left": [w * padding, h * padding],
                "top_right": [w * (1 - padding), h * padding],
                "bottom_right": [w * (1 - padding), h * (1 - padding)],
                "bottom_left": [w * padding, h * (1 - padding)]
            },
            "dimensions": dimensions,
            "message": "Could not auto-detect, using default corners"
        }


@app.post("/generate-card")
async def generate_card(
    request: GenerateCardRequest,
    background_tasks: BackgroundTasks
):
    """Start the card generation process."""
    # Check if image exists
    image_path = None
    for ext in ["jpg", "jpeg", "png", "webp"]:
        path = f"uploads/{request.image_id}.{ext}"
        if os.path.exists(path):
            image_path = path
            break
    
    if not image_path:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Create job
    job_id = str(uuid.uuid4())
    jobs[job_id] = JobStatus(
        job_id=job_id,
        status="pending",
        progress=0,
        current_step="Initialisation..."
    )
    
    # Find logo path if provided
    logo_path = None
    if request.logo_id:
        for ext in ["jpg", "jpeg", "png", "webp", "svg"]:
            path = f"uploads/{request.logo_id}.{ext}"
            if os.path.exists(path):
                logo_path = path
                break

    # Start background processing
    background_tasks.add_task(
        process_card_generation,
        job_id,
        image_path,
        request.perspective_points,
        logo_path
    )
    
    return {"job_id": job_id, "message": "Generation started"}


@app.get("/job/{job_id}")
async def get_job_status(job_id: str):
    """Get the status of a generation job."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]


@app.get("/jobs")
async def list_jobs():
    """List all jobs."""
    return list(jobs.values())


@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    """Upload a PDF and extract first page as image."""
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    try:
        # Try to use pdf2image
        from pdf2image import convert_from_bytes
        
        content = await file.read()
        
        # Convert first page to image at high DPI for quality
        images = convert_from_bytes(content, first_page=1, last_page=1, dpi=300)
        
        if not images:
            raise HTTPException(status_code=400, detail="Could not extract images from PDF")
        
        image = images[0]
        
        # Generate unique ID
        image_id = str(uuid.uuid4())
        file_path = f"uploads/{image_id}.png"
        
        # Save as PNG for quality
        image.save(file_path, "PNG")
        
        return {
            "image_id": image_id,
            "file_path": file_path,
            "dimensions": {"width": image.width, "height": image.height},
            "message": "PDF converted successfully"
        }
    except ImportError:
        # Fallback: try PyMuPDF
        try:
            import fitz  # PyMuPDF
            
            content = await file.read()
            doc = fitz.open(stream=content, filetype="pdf")
            
            if doc.page_count == 0:
                raise HTTPException(status_code=400, detail="PDF has no pages")
            
            page = doc[0]
            mat = fitz.Matrix(3, 3)  # 3x zoom for high quality
            pix = page.get_pixmap(matrix=mat)
            
            image_id = str(uuid.uuid4())
            file_path = f"uploads/{image_id}.png"
            pix.save(file_path)
            
            doc.close()
            
            return {
                "image_id": image_id,
                "file_path": file_path,
                "dimensions": {"width": pix.width, "height": pix.height},
                "message": "PDF converted successfully"
            }
        except ImportError:
            raise HTTPException(
                status_code=500, 
                detail="PDF processing not available. Please install pdf2image or PyMuPDF."
            )


@app.post("/upload-mobile")
async def upload_mobile(
    file: UploadFile = File(...),
    session_id: str = Form(...)
):
    """Upload image from mobile device with session tracking."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Generate unique ID
    image_id = str(uuid.uuid4())
    file_extension = file.filename.split(".")[-1] if file.filename else "jpg"
    file_path = f"uploads/{image_id}.{file_extension}"
    
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Get dimensions
    dimensions = image_processor.get_dimensions(file_path)
    
    # Update session
    mobile_sessions[session_id] = {
        "status": "completed",
        "image_id": image_id,
        "file_path": file_path,
        "dimensions": dimensions,
        "timestamp": datetime.now().isoformat()
    }
    
    return {
        "image_id": image_id,
        "file_path": file_path,
        "dimensions": dimensions,
        "message": "Mobile upload successful"
    }


@app.get("/session/{session_id}")
async def get_session(session_id: str):
    """Check status of a mobile upload session."""
    if session_id not in mobile_sessions:
        return {"status": "pending"}
    return mobile_sessions[session_id]


@app.get("/image/{image_id}")
async def get_image(image_id: str):
    """Get image file and metadata."""
    # Find image
    image_path = None
    for ext in ["jpg", "jpeg", "png", "webp"]:
        path = f"uploads/{image_id}.{ext}"
        if os.path.exists(path):
            image_path = path
            break
    
    if not image_path:
        raise HTTPException(status_code=404, detail="Image not found")
    
    dimensions = image_processor.get_dimensions(image_path)
    
    return {
        "image_id": image_id,
        "url": f"/uploads/{image_id}{os.path.splitext(image_path)[1]}",
        "dimensions": dimensions
    }


@app.get("/uploads/{filename}")
async def serve_upload(filename: str):
    """Serve uploaded files."""
    file_path = f"uploads/{filename}"
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)


async def process_card_generation(
    job_id: str,
    image_path: str,
    perspective_points: Optional[PerspectivePoints],
    logo_path: Optional[str] = None
):
    """Background task for card generation."""
    try:
        orchestrator = AIOrchestrator(
            job_id=job_id,
            jobs_dict=jobs,
            image_processor=image_processor
        )
        
        # Update status
        jobs[job_id].status = "processing"
        jobs[job_id].current_step = "Traitement de l'image..."
        jobs[job_id].progress = 10
        
        # Process perspective correction
        if perspective_points:
            points = [
                perspective_points.top_left,
                perspective_points.top_right,
                perspective_points.bottom_right,
                perspective_points.bottom_left
            ]
            corrected_path = image_processor.correct_perspective(image_path, points)
        else:
            corrected_path = image_path
        
        jobs[job_id].progress = 20
        jobs[job_id].current_step = "Extraction des couleurs..."
        
        # Extract colors
        colors = image_processor.extract_colors(corrected_path)
        
        jobs[job_id].progress = 30
        
        # Run AI orchestration
        result = await orchestrator.run(corrected_path, colors, logo_path)
        
        # Save result
        output_path = f"outputs/{job_id}.html"
        with open(output_path, "w") as f:
            f.write(result["html"])
        
        jobs[job_id].status = "completed"
        jobs[job_id].progress = 100
        jobs[job_id].current_step = "Terminé!"
        jobs[job_id].result_url = f"/outputs/{job_id}.html"
        
    except Exception as e:
        jobs[job_id].status = "failed"
        jobs[job_id].error = str(e)
        jobs[job_id].current_step = f"Erreur: {str(e)}"


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

