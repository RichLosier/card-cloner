"""Image processing service using OpenCV."""
import cv2
import numpy as np
from PIL import Image
from sklearn.cluster import KMeans
from typing import List, Tuple, Optional
import os

from app.config import get_settings

settings = get_settings()


class ImageProcessor:
    """Service for image processing operations."""
    
    def __init__(self):
        self.card_width = settings.card_width
        self.card_height = settings.card_height
    
    def get_dimensions(self, image_path: str) -> dict:
        """Get image dimensions."""
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Cannot read image: {image_path}")
        height, width = img.shape[:2]
        return {"width": width, "height": height}
    
    def correct_perspective(
        self,
        image_path: str,
        points: List[Tuple[float, float]],
        output_path: Optional[str] = None
    ) -> str:
        """
        Apply perspective correction to extract the card.
        
        Args:
            image_path: Path to the input image
            points: List of 4 corner points [top_left, top_right, bottom_right, bottom_left]
            output_path: Optional output path (generated if not provided)
        
        Returns:
            Path to the corrected image
        """
        # Read image
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Cannot read image: {image_path}")
        
        # Convert points to numpy array
        src_points = np.float32(points)
        
        # Destination points (perfect rectangle)
        dst_points = np.float32([
            [0, 0],
            [self.card_width, 0],
            [self.card_width, self.card_height],
            [0, self.card_height]
        ])
        
        # Calculate perspective transform matrix
        matrix = cv2.getPerspectiveTransform(src_points, dst_points)
        
        # Apply transformation
        corrected = cv2.warpPerspective(
            img, matrix, (self.card_width, self.card_height)
        )
        
        # Generate output path if not provided
        if output_path is None:
            base_name = os.path.splitext(os.path.basename(image_path))[0]
            output_path = f"temp/{base_name}_corrected.png"
        
        # Save corrected image
        cv2.imwrite(output_path, corrected)
        
        return output_path
    
    def auto_detect_corners(self, image_path: str) -> Optional[List[Tuple[float, float]]]:
        """
        Automatically detect card corners using multiple detection methods.
        
        Returns:
            List of 4 corner points or None if detection fails
        """
        img = cv2.imread(image_path)
        if img is None:
            return None
        
        height, width = img.shape[:2]
        
        # Try multiple detection methods
        corners = None
        
        # Method 1: Edge detection with Canny
        corners = self._detect_with_canny(img)
        
        # Method 2: If Canny fails, try adaptive threshold (better for white cards)
        if corners is None:
            corners = self._detect_with_adaptive_threshold(img)
        
        # Method 3: Color-based detection (white card on dark background)
        if corners is None:
            corners = self._detect_white_card(img)
        
        # Fallback: return image bounds with padding
        if corners is None:
            padding = 0.1
            corners = [
                (width * padding, height * padding),
                (width * (1 - padding), height * padding),
                (width * (1 - padding), height * (1 - padding)),
                (width * padding, height * (1 - padding))
            ]
        
        return corners
    
    def _detect_with_canny(self, img: np.ndarray) -> Optional[List[Tuple[float, float]]]:
        """Detect card using Canny edge detection."""
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blurred, 30, 100)
        
        # Dilate to close gaps
        kernel = np.ones((3, 3), np.uint8)
        edges = cv2.dilate(edges, kernel, iterations=2)
        
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        return self._find_card_contour(contours, img.shape)
    
    def _detect_with_adaptive_threshold(self, img: np.ndarray) -> Optional[List[Tuple[float, float]]]:
        """Detect card using adaptive thresholding."""
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (11, 11), 0)
        
        # Adaptive threshold
        thresh = cv2.adaptiveThreshold(
            blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 11, 2
        )
        
        # Clean up
        kernel = np.ones((5, 5), np.uint8)
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
        
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        return self._find_card_contour(contours, img.shape)
    
    def _detect_white_card(self, img: np.ndarray) -> Optional[List[Tuple[float, float]]]:
        """Detect white/light colored card on dark background."""
        # Convert to HSV
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        
        # Threshold for light colors (white/cream)
        lower_white = np.array([0, 0, 150])
        upper_white = np.array([180, 50, 255])
        mask = cv2.inRange(hsv, lower_white, upper_white)
        
        # Clean up mask
        kernel = np.ones((7, 7), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        return self._find_card_contour(contours, img.shape)
    
    def _find_card_contour(self, contours, img_shape) -> Optional[List[Tuple[float, float]]]:
        """Find the best card-shaped contour."""
        if not contours:
            return None
        
        height, width = img_shape[:2]
        img_area = width * height
        
        # Filter contours by area (card should be at least 5% and at most 95% of image)
        valid_contours = [
            c for c in contours 
            if 0.05 * img_area < cv2.contourArea(c) < 0.95 * img_area
        ]
        
        if not valid_contours:
            return None
        
        # Sort by area (largest first)
        valid_contours = sorted(valid_contours, key=cv2.contourArea, reverse=True)
        
        for contour in valid_contours:
            # Try different epsilon values
            for epsilon_factor in [0.02, 0.03, 0.04, 0.05]:
                epsilon = epsilon_factor * cv2.arcLength(contour, True)
                approx = cv2.approxPolyDP(contour, epsilon, True)
                
                if len(approx) == 4:
                    # Check if it's roughly rectangular (aspect ratio check)
                    points = approx.reshape(4, 2)
                    sorted_points = self._sort_corners(points.tolist())
                    
                    # Calculate aspect ratio
                    tl, tr, br, bl = sorted_points
                    width1 = np.sqrt((tr[0] - tl[0])**2 + (tr[1] - tl[1])**2)
                    height1 = np.sqrt((bl[0] - tl[0])**2 + (bl[1] - tl[1])**2)
                    
                    if height1 > 0:
                        aspect = width1 / height1
                        # Business card aspect ratio is typically 1.5 to 2.0
                        if 1.2 < aspect < 2.5 or 0.4 < aspect < 0.85:
                            return sorted_points
        
        return None
    
    def _sort_corners(self, points: List[List[float]]) -> List[Tuple[float, float]]:
        """Sort corner points in order: TL, TR, BR, BL."""
        points = np.array(points)
        
        # Sum of coordinates: smallest = top-left, largest = bottom-right
        s = points.sum(axis=1)
        tl = points[np.argmin(s)]
        br = points[np.argmax(s)]
        
        # Difference of coordinates: smallest = top-right, largest = bottom-left
        diff = np.diff(points, axis=1).flatten()
        tr = points[np.argmin(diff)]
        bl = points[np.argmax(diff)]
        
        return [
            tuple(tl.tolist()),
            tuple(tr.tolist()),
            tuple(br.tolist()),
            tuple(bl.tolist())
        ]
    
    def extract_colors(
        self,
        image_path: str,
        n_colors: int = 5
    ) -> List[dict]:
        """
        Extract dominant colors from the image using K-Means clustering.
        
        Returns:
            List of color dictionaries with hex codes and percentages
        """
        # Read image
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Cannot read image: {image_path}")
        
        # Convert BGR to RGB
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Reshape to list of pixels
        pixels = img_rgb.reshape(-1, 3)
        
        # Apply K-Means clustering
        kmeans = KMeans(n_clusters=n_colors, random_state=42, n_init=10)
        kmeans.fit(pixels)
        
        # Get cluster centers (colors) and labels
        colors = kmeans.cluster_centers_.astype(int)
        labels = kmeans.labels_
        
        # Calculate percentage of each color
        total_pixels = len(labels)
        color_counts = np.bincount(labels)
        percentages = color_counts / total_pixels * 100
        
        # Sort by percentage (most dominant first)
        sorted_indices = np.argsort(percentages)[::-1]
        
        result = []
        for idx in sorted_indices:
            r, g, b = colors[idx]
            hex_code = f"#{r:02x}{g:02x}{b:02x}"
            result.append({
                "hex": hex_code,
                "rgb": {"r": int(r), "g": int(g), "b": int(b)},
                "percentage": round(float(percentages[idx]), 2)
            })
        
        return result
    
    def enhance_image(self, image_path: str, output_path: Optional[str] = None) -> str:
        """
        Enhance image quality (contrast, sharpness).
        
        Returns:
            Path to enhanced image
        """
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Cannot read image: {image_path}")
        
        # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        
        enhanced_lab = cv2.merge([l, a, b])
        enhanced = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)
        
        # Apply sharpening
        kernel = np.array([[-1, -1, -1],
                          [-1, 9, -1],
                          [-1, -1, -1]])
        sharpened = cv2.filter2D(enhanced, -1, kernel)
        
        # Generate output path if not provided
        if output_path is None:
            base_name = os.path.splitext(os.path.basename(image_path))[0]
            output_path = f"temp/{base_name}_enhanced.png"
        
        cv2.imwrite(output_path, sharpened)
        
        return output_path
    
    def extract_logo_region(
        self,
        image_path: str,
        bbox: Tuple[int, int, int, int],
        output_path: Optional[str] = None
    ) -> str:
        """
        Extract a region from the image (for logo isolation).
        
        Args:
            image_path: Path to the image
            bbox: Bounding box (x, y, width, height)
            output_path: Optional output path
        
        Returns:
            Path to the extracted region
        """
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Cannot read image: {image_path}")
        
        x, y, w, h = bbox
        region = img[y:y+h, x:x+w]
        
        if output_path is None:
            base_name = os.path.splitext(os.path.basename(image_path))[0]
            output_path = f"temp/{base_name}_logo.png"
        
        cv2.imwrite(output_path, region)
        
        return output_path
    
    def compare_images(
        self,
        image1_path: str,
        image2_path: str,
        output_diff_path: Optional[str] = None
    ) -> dict:
        """
        Compare two images and generate a diff map.
        
        Returns:
            Dictionary with similarity score and diff image path
        """
        img1 = cv2.imread(image1_path)
        img2 = cv2.imread(image2_path)
        
        if img1 is None or img2 is None:
            raise ValueError("Cannot read one or both images")
        
        # Resize to same dimensions if needed
        if img1.shape != img2.shape:
            img2 = cv2.resize(img2, (img1.shape[1], img1.shape[0]))
        
        # Calculate absolute difference
        diff = cv2.absdiff(img1, img2)
        
        # Convert to grayscale for analysis
        gray_diff = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)
        
        # Calculate similarity score
        total_pixels = gray_diff.size
        different_pixels = np.count_nonzero(gray_diff > 30)  # Threshold
        similarity = 100 - (different_pixels / total_pixels * 100)
        
        # Create visual diff (red overlay)
        diff_visual = np.zeros_like(img1)
        mask = gray_diff > 30
        diff_visual[mask] = [0, 0, 255]  # Red for differences
        
        # Blend with original
        blended = cv2.addWeighted(img1, 0.5, diff_visual, 0.5, 0)
        
        if output_diff_path is None:
            output_diff_path = "temp/diff_map.png"
        
        cv2.imwrite(output_diff_path, blended)
        
        return {
            "similarity": round(similarity, 2),
            "different_pixels": int(different_pixels),
            "diff_map_path": output_diff_path
        }

