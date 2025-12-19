"""Service for logo vectorization using external APIs."""
import httpx
import base64
import os
from typing import Optional

from app.config import get_settings

settings = get_settings()


class VectorizerService:
    """Service for converting raster logos to SVG vectors."""
    
    def __init__(self):
        self.api_key = settings.vectorizer_api_key
        self.api_url = "https://api.vectorizer.ai/api/v1/vectorize"
    
    async def vectorize_logo(
        self,
        image_path: str,
        output_path: Optional[str] = None
    ) -> dict:
        """
        Convert a raster image (logo) to SVG vector.
        
        Args:
            image_path: Path to the input image
            output_path: Optional path to save the SVG
        
        Returns:
            Dictionary with SVG content and path
        """
        if not self.api_key:
            # Fallback: create a simple placeholder SVG
            return await self._create_placeholder_svg(image_path, output_path)
        
        try:
            # Read and encode image
            with open(image_path, "rb") as f:
                image_data = f.read()
            
            # Call Vectorizer.ai API
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.api_url,
                    auth=(self.api_key, ""),
                    files={"image": ("logo.png", image_data)},
                    data={
                        "mode": "production",
                        "output.file_format": "svg"
                    },
                    timeout=60.0
                )
                
                if response.status_code == 200:
                    svg_content = response.text
                    
                    if output_path is None:
                        base_name = os.path.splitext(os.path.basename(image_path))[0]
                        output_path = f"temp/{base_name}_vector.svg"
                    
                    with open(output_path, "w", encoding="utf-8") as f:
                        f.write(svg_content)
                    
                    return {
                        "status": "success",
                        "svg": svg_content,
                        "path": output_path
                    }
                else:
                    return {
                        "status": "error",
                        "error": f"API returned {response.status_code}: {response.text}"
                    }
                    
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def _create_placeholder_svg(
        self,
        image_path: str,
        output_path: Optional[str] = None
    ) -> dict:
        """
        Create an embedded image SVG as fallback.
        
        This embeds the raster image in an SVG for consistent handling,
        even though it's not a true vector.
        """
        try:
            import cv2
            
            # Read image to get dimensions
            img = cv2.imread(image_path)
            if img is None:
                raise ValueError(f"Cannot read image: {image_path}")
            
            height, width = img.shape[:2]
            
            # Read and encode image
            with open(image_path, "rb") as f:
                image_b64 = base64.b64encode(f.read()).decode("utf-8")
            
            # Get MIME type
            ext = os.path.splitext(image_path)[1].lower()
            mime_type = {
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".webp": "image/webp"
            }.get(ext, "image/png")
            
            # Create SVG with embedded image
            svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" 
     xmlns:xlink="http://www.w3.org/1999/xlink"
     width="{width}" height="{height}" 
     viewBox="0 0 {width} {height}">
  <image x="0" y="0" width="{width}" height="{height}"
         xlink:href="data:{mime_type};base64,{image_b64}"/>
</svg>'''
            
            if output_path is None:
                base_name = os.path.splitext(os.path.basename(image_path))[0]
                output_path = f"temp/{base_name}_embedded.svg"
            
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(svg_content)
            
            return {
                "status": "fallback",
                "svg": svg_content,
                "path": output_path,
                "note": "Using embedded raster (Vectorizer API key not configured)"
            }
            
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def trace_simple_logo(
        self,
        image_path: str,
        output_path: Optional[str] = None
    ) -> dict:
        """
        Simple local vectorization using OpenCV contour detection.
        
        Works best for simple logos with clear shapes.
        Limited compared to ML-based vectorization.
        """
        try:
            import cv2
            import numpy as np
            
            # Read image
            img = cv2.imread(image_path)
            if img is None:
                raise ValueError(f"Cannot read image: {image_path}")
            
            height, width = img.shape[:2]
            
            # Convert to grayscale
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # Threshold
            _, binary = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY_INV)
            
            # Find contours
            contours, _ = cv2.findContours(
                binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
            )
            
            # Build SVG paths
            paths = []
            for contour in contours:
                if cv2.contourArea(contour) < 100:  # Skip tiny contours
                    continue
                
                # Simplify contour
                epsilon = 0.01 * cv2.arcLength(contour, True)
                approx = cv2.approxPolyDP(contour, epsilon, True)
                
                if len(approx) >= 3:
                    # Convert to SVG path
                    points = approx.reshape(-1, 2)
                    d = f"M {points[0][0]} {points[0][1]}"
                    for point in points[1:]:
                        d += f" L {point[0]} {point[1]}"
                    d += " Z"
                    paths.append(f'  <path d="{d}" fill="#000"/>')
            
            svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg"
     width="{width}" height="{height}"
     viewBox="0 0 {width} {height}">
{chr(10).join(paths)}
</svg>'''
            
            if output_path is None:
                base_name = os.path.splitext(os.path.basename(image_path))[0]
                output_path = f"temp/{base_name}_traced.svg"
            
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(svg_content)
            
            return {
                "status": "traced",
                "svg": svg_content,
                "path": output_path,
                "contours_count": len(paths)
            }
            
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }

