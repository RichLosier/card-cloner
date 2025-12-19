"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X, RotateCcw, Check, Flashlight, FlashlightOff } from "lucide-react";

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  // Card aspect ratio (standard business card: 3.5" x 2" = 1.75)
  const CARD_RATIO = 1.75;

  const startCamera = useCallback(async () => {
    try {
      // Stop existing stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err) {
      console.error("Camera error:", err);
      setError("Impossible d'accéder à la caméra. Vérifiez les permissions.");
    }
  }, [facingMode, stream]);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Restart camera when facing mode changes
  useEffect(() => {
    if (stream) {
      startCamera();
    }
  }, [facingMode]);

  const toggleFlash = async () => {
    if (!stream) return;
    
    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities() as any;
    
    if (capabilities.torch) {
      try {
        await track.applyConstraints({
          advanced: [{ torch: !isFlashOn } as any]
        });
        setIsFlashOn(!isFlashOn);
      } catch (err) {
        console.error("Flash error:", err);
      }
    }
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === "environment" ? "user" : "environment");
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the video frame
    ctx.drawImage(video, 0, 0);

    // Get the image data
    const imageData = canvas.toDataURL("image/jpeg", 0.95);
    setCapturedImage(imageData);
  };

  const retakePhoto = () => {
    setCapturedImage(null);
  };

  const confirmPhoto = () => {
    if (capturedImage) {
      onCapture(capturedImage);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {error ? (
        <div className="flex flex-col items-center justify-center h-full text-white p-8">
          <Camera className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-center text-lg mb-4">{error}</p>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-white/20 rounded-xl"
          >
            Fermer
          </button>
        </div>
      ) : capturedImage ? (
        // Preview captured image
        <div className="relative h-full">
          <img
            src={capturedImage}
            alt="Captured"
            className="w-full h-full object-contain"
          />
          
          {/* Card frame overlay on preview */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div 
              className="border-4 border-green-500 rounded-lg shadow-2xl"
              style={{
                width: "85%",
                maxWidth: "500px",
                aspectRatio: CARD_RATIO.toString(),
              }}
            >
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-green-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                ✓ Photo capturée
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center justify-center gap-8">
              <button
                onClick={retakePhoto}
                className="flex flex-col items-center gap-2 text-white"
              >
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                  <RotateCcw className="w-6 h-6" />
                </div>
                <span className="text-sm">Reprendre</span>
              </button>
              
              <button
                onClick={confirmPhoto}
                className="flex flex-col items-center gap-2 text-white"
              >
                <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/50">
                  <Check className="w-10 h-10" />
                </div>
                <span className="text-sm font-medium">Confirmer</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        // Camera viewfinder
        <div className="relative h-full">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {/* Card frame overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Dark overlay with cutout */}
            <div className="absolute inset-0 bg-black/50" />
            
            {/* Card frame */}
            <div 
              className="relative border-4 border-white rounded-lg shadow-2xl bg-transparent z-10"
              style={{
                width: "85%",
                maxWidth: "500px",
                aspectRatio: CARD_RATIO.toString(),
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
              }}
            >
              {/* Corner markers */}
              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />
            </div>

            {/* Instructions */}
            <div className="absolute top-20 left-0 right-0 text-center text-white z-20">
              <p className="text-lg font-medium drop-shadow-lg">
                Alignez votre carte dans le cadre
              </p>
              <p className="text-sm opacity-80 mt-1">
                Assurez-vous que la carte est bien éclairée
              </p>
            </div>
          </div>

          {/* Top controls */}
          <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-30">
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="flex gap-3">
              <button
                onClick={toggleFlash}
                className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white"
              >
                {isFlashOn ? <Flashlight className="w-5 h-5" /> : <FlashlightOff className="w-5 h-5" />}
              </button>
              <button
                onClick={switchCamera}
                className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Capture button */}
          <div className="absolute bottom-0 left-0 right-0 p-8 flex justify-center z-30">
            <button
              onClick={capturePhoto}
              className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-2xl active:scale-95 transition-transform"
            >
              <div className="w-16 h-16 rounded-full border-4 border-gray-300" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

