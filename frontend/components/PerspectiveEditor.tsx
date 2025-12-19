"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, RotateCcw, Move, ZoomIn, ZoomOut } from "lucide-react";

interface UploadedImage {
  id: string;
  file?: File;
  url: string;
  dimensions: { width: number; height: number };
  source?: "camera" | "file" | "mobile";
}

interface Point {
  x: number;
  y: number;
}

interface PerspectivePoints {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

interface PerspectiveEditorProps {
  image: UploadedImage;
  onConfirm: (points: PerspectivePoints) => void;
  onBack: () => void;
  initialPoints?: PerspectivePoints | null;
  autoDetected?: boolean;
}

export default function PerspectiveEditor({
  image,
  onConfirm,
  onBack,
  initialPoints,
  autoDetected = false,
}: PerspectiveEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [draggingPoint, setDraggingPoint] = useState<keyof PerspectivePoints | null>(null);

  // Initialize points based on image dimensions or initial detection
  const getInitialPoints = useCallback((): PerspectivePoints => {
    // Use auto-detected points if available
    if (initialPoints) {
      return initialPoints;
    }
    
    // Fallback to default padding
    const padding = 0.1;
    const w = image.dimensions.width;
    const h = image.dimensions.height;
    
    return {
      topLeft: { x: w * padding, y: h * padding },
      topRight: { x: w * (1 - padding), y: h * padding },
      bottomRight: { x: w * (1 - padding), y: h * (1 - padding) },
      bottomLeft: { x: w * padding, y: h * (1 - padding) },
    };
  }, [image.dimensions, initialPoints]);

  const [points, setPoints] = useState<PerspectivePoints>(getInitialPoints);

  // Calculate display scale
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
        
        // Calculate scale to fit image
        const scaleX = (rect.width - 100) / image.dimensions.width;
        const scaleY = (rect.height - 100) / image.dimensions.height;
        setScale(Math.min(scaleX, scaleY, 1));
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [image.dimensions]);

  // Convert image coordinates to display coordinates
  const toDisplayCoords = (point: Point): Point => ({
    x: point.x * scale,
    y: point.y * scale,
  });

  // Convert display coordinates to image coordinates
  const toImageCoords = (displayX: number, displayY: number): Point => ({
    x: displayX / scale,
    y: displayY / scale,
  });

  // Handle mouse/touch drag
  const handlePointerDown = (pointKey: keyof PerspectivePoints) => (e: React.PointerEvent) => {
    e.preventDefault();
    setDraggingPoint(pointKey);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingPoint || !containerRef.current) return;

    const imageElement = containerRef.current.querySelector("img");
    if (!imageElement) return;
    
    const imageRect = imageElement.getBoundingClientRect();

    // Calculate position relative to image
    const x = e.clientX - imageRect.left;
    const y = e.clientY - imageRect.top;

    // Clamp to image bounds (in display pixels)
    const displayWidth = image.dimensions.width * scale;
    const displayHeight = image.dimensions.height * scale;
    const clampedX = Math.max(0, Math.min(x, displayWidth));
    const clampedY = Math.max(0, Math.min(y, displayHeight));

    // Convert back to original image coordinates
    const imageX = clampedX / scale;
    const imageY = clampedY / scale;

    setPoints((prev) => ({
      ...prev,
      [draggingPoint]: { x: imageX, y: imageY },
    }));
  };

  const handlePointerUp = () => {
    setDraggingPoint(null);
  };

  const handleReset = () => {
    setPoints(getInitialPoints());
  };

  const handleZoom = (delta: number) => {
    setScale((prev) => Math.max(0.3, Math.min(2, prev + delta)));
  };

  // Generate SVG path for the selection polygon (using original image coordinates)
  const getPolygonPath = () => {
    const tl = points.topLeft;
    const tr = points.topRight;
    const br = points.bottomRight;
    const bl = points.bottomLeft;
    
    return `M ${tl.x} ${tl.y} L ${tr.x} ${tr.y} L ${br.x} ${br.y} L ${bl.x} ${bl.y} Z`;
  };

  const pointLabels: Record<keyof PerspectivePoints, string> = {
    topLeft: "TL",
    topRight: "TR",
    bottomRight: "BR",
    bottomLeft: "BL",
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 text-surface-600 hover:text-surface-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Retour</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleZoom(-0.1)}
            className="p-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
            title="Zoom out"
          >
            <ZoomOut className="w-5 h-5 text-surface-600" />
          </button>
          <span className="px-3 py-1 bg-surface-100 rounded-lg text-sm font-mono">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => handleZoom(0.1)}
            className="p-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
            title="Zoom in"
          >
            <ZoomIn className="w-5 h-5 text-surface-600" />
          </button>
        </div>
      </div>

      {/* Instructions */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-xl p-4 mb-6 border ${
          autoDetected 
            ? "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200" 
            : "bg-gradient-to-r from-primary-50 to-indigo-50 border-primary-200"
        }`}
      >
        <div className="flex items-start gap-3">
          <Move className={`w-5 h-5 mt-0.5 ${autoDetected ? "text-green-600" : "text-primary-600"}`} />
          <div>
            {autoDetected ? (
              <>
                <h3 className="font-medium text-green-900 flex items-center gap-2">
                  ✨ Carte détectée automatiquement!
                </h3>
                <p className="text-sm text-green-700">
                  Les coins ont été pré-positionnés. Ajustez-les si nécessaire ou confirmez directement.
                </p>
              </>
            ) : (
              <>
                <h3 className="font-medium text-primary-900">Ajustez les coins de la carte</h3>
                <p className="text-sm text-primary-700">
                  Glissez les 4 points pour les aligner précisément avec les coins de votre carte d'affaires.
                  C'est la clé pour une reproduction parfaite!
                </p>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Editor Area */}
      <div
        ref={containerRef}
        className="relative bg-surface-900 rounded-2xl overflow-hidden shadow-2xl"
        style={{ height: "60vh", minHeight: "400px" }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* Checkerboard background */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(45deg, #808080 25%, transparent 25%),
              linear-gradient(-45deg, #808080 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, #808080 75%),
              linear-gradient(-45deg, transparent 75%, #808080 75%)
            `,
            backgroundSize: "20px 20px",
            backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
          }}
        />

        {/* Image container - simplified without nested transforms */}
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div 
            className="relative"
            style={{
              width: image.dimensions.width * scale,
              height: image.dimensions.height * scale,
            }}
          >
            {/* Image */}
            <img
              src={image.url}
              alt="Card to crop"
              className="w-full h-full object-contain"
              draggable={false}
            />

            {/* Overlay SVG - scaled properly */}
            <svg
              className="absolute inset-0 pointer-events-none"
              width="100%"
              height="100%"
              viewBox={`0 0 ${image.dimensions.width} ${image.dimensions.height}`}
              preserveAspectRatio="none"
            >
              {/* Dark overlay outside selection */}
              <defs>
                <mask id="crop-mask">
                  <rect width="100%" height="100%" fill="white" />
                  <path d={getPolygonPath()} fill="black" />
                </mask>
              </defs>
              <rect
                width="100%"
                height="100%"
                fill="rgba(0,0,0,0.5)"
                mask="url(#crop-mask)"
              />

              {/* Selection border */}
              <path
                d={getPolygonPath()}
                fill="none"
                stroke="white"
                strokeWidth={3 / scale}
                strokeDasharray={`${12 / scale} ${6 / scale}`}
              />
              <path
                d={getPolygonPath()}
                fill="none"
                stroke="rgb(99, 102, 241)"
                strokeWidth={3 / scale}
                strokeDashoffset={6 / scale}
                strokeDasharray={`${12 / scale} ${6 / scale}`}
              />
            </svg>

            {/* Corner handles - FIXED SIZE, positioned absolutely */}
            {(Object.keys(points) as Array<keyof PerspectivePoints>).map((key) => {
              const displayPoint = toDisplayCoords(points[key]);
              const isActive = draggingPoint === key;

              return (
                <div
                  key={key}
                  className="absolute z-20"
                  style={{
                    left: displayPoint.x - 20,
                    top: displayPoint.y - 20,
                  }}
                  onPointerDown={handlePointerDown(key)}
                >
                  {/* Large invisible touch area */}
                  <div className="w-10 h-10 cursor-move flex items-center justify-center">
                    {/* Visible handle */}
                    <div
                      className={`
                        w-8 h-8 rounded-full border-3 border-white shadow-xl
                        flex items-center justify-center text-xs font-bold text-white
                        transition-all duration-150
                        ${isActive 
                          ? "bg-green-500 scale-125 border-green-200" 
                          : "bg-primary-500 hover:bg-primary-400 hover:scale-110"
                        }
                      `}
                      style={{
                        boxShadow: isActive 
                          ? '0 0 20px rgba(34, 197, 94, 0.6), 0 4px 12px rgba(0,0,0,0.3)'
                          : '0 4px 12px rgba(0,0,0,0.4), 0 0 0 2px rgba(99, 102, 241, 0.3)'
                      }}
                    >
                      {pointLabels[key]}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2 text-surface-600 hover:text-surface-800 border border-surface-300 rounded-xl hover:bg-surface-100 transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Réinitialiser</span>
        </button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onConfirm(points)}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white font-medium rounded-xl shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 transition-all"
        >
          <Check className="w-5 h-5" />
          <span>Confirmer et Générer</span>
        </motion.button>
      </div>

      {/* Coordinates display (debug) */}
      <div className="mt-4 grid grid-cols-4 gap-2 text-xs font-mono text-surface-500">
        {(Object.keys(points) as Array<keyof PerspectivePoints>).map((key) => (
          <div key={key} className="p-2 bg-surface-100 rounded-lg">
            <span className="font-semibold">{pointLabels[key]}:</span>{" "}
            ({Math.round(points[key].x)}, {Math.round(points[key].y)})
          </div>
        ))}
      </div>
    </div>
  );
}

