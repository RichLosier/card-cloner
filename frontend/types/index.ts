/**
 * Uploaded image data
 */
export interface UploadedImage {
  id: string;
  file?: File;
  url: string;
  dimensions: {
    width: number;
    height: number;
  };
  source?: "camera" | "file" | "mobile";
}

/**
 * 2D Point
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Perspective correction points (4 corners)
 */
export interface PerspectivePoints {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

/**
 * Job status from backend
 */
export interface JobStatus {
  job_id: string;
  status: "pending" | "processing" | "extracting" | "generating" | "correcting" | "completed" | "failed";
  progress: number;
  current_step: string;
  result_url?: string;
  error?: string;
}

/**
 * Extracted color from image
 */
export interface ExtractedColor {
  hex: string;
  rgb: {
    r: number;
    g: number;
    b: number;
  };
  percentage: number;
}

/**
 * Upload response from backend
 */
export interface UploadResponse {
  image_id: string;
  file_path: string;
  dimensions: {
    width: number;
    height: number;
  };
  message: string;
}

/**
 * Generation start response
 */
export interface GenerateResponse {
  job_id: string;
  message: string;
}

/**
 * Application step
 */
export type AppStep = "upload" | "crop" | "generate" | "complete";

