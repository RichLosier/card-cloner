"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Check, RotateCcw, Upload, Loader2, X } from "lucide-react";

const CARD_RATIO = 1.75;

export default function MobileCapturePage({ params }: { params: { sessionId: string } }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  const startCamera = useCallback(async () => {
    try {
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
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (stream) {
      startCamera();
    }
  }, [facingMode]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL("image/jpeg", 0.95);
    setCapturedImage(imageData);
  };

  const retakePhoto = () => {
    setCapturedImage(null);
  };

  const uploadPhoto = async () => {
    if (!capturedImage) return;

    setIsUploading(true);
    setError(null);

    try {
      // Convert base64 to blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      const file = new File([blob], "capture.jpg", { type: "image/jpeg" });

      // Upload with session ID
      const formData = new FormData();
      formData.append("file", file);
      formData.append("session_id", params.sessionId);

      const uploadResponse = await fetch("/api/upload-mobile", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) throw new Error("Upload failed");

      // Stop camera
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      setSuccess(true);
    } catch (err) {
      setError("Erreur lors de l'upload. Veuillez réessayer.");
    } finally {
      setIsUploading(false);
    }
  };

  // Success screen
  if (success) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-green-500 to-emerald-600 flex flex-col items-center justify-center text-white p-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6"
        >
          <Check className="w-12 h-12 text-green-500" />
        </motion.div>
        <h1 className="text-3xl font-bold mb-2">Photo envoyée!</h1>
        <p className="text-center text-white/80">
          Retournez sur votre ordinateur pour continuer.
        </p>
        <p className="text-center text-white/60 text-sm mt-4">
          Vous pouvez fermer cette page.
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black">
      <canvas ref={canvasRef} className="hidden" />

      {error ? (
        <div className="flex flex-col items-center justify-center h-full text-white p-8">
          <Camera className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-center text-lg mb-4">{error}</p>
          <button
            onClick={startCamera}
            className="px-6 py-3 bg-white/20 rounded-xl"
          >
            Réessayer
          </button>
        </div>
      ) : capturedImage ? (
        // Preview
        <div className="relative h-full">
          <img
            src={capturedImage}
            alt="Captured"
            className="w-full h-full object-contain"
          />
          
          {/* Card frame overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div 
              className="border-4 border-green-500 rounded-lg"
              style={{
                width: "85%",
                maxWidth: "500px",
                aspectRatio: CARD_RATIO.toString(),
              }}
            />
          </div>

          {/* Actions */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
            {isUploading ? (
              <div className="flex flex-col items-center text-white">
                <Loader2 className="w-10 h-10 animate-spin mb-2" />
                <p>Envoi en cours...</p>
              </div>
            ) : (
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
                  onClick={uploadPhoto}
                  className="flex flex-col items-center gap-2 text-white"
                >
                  <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/50">
                    <Upload className="w-10 h-10" />
                  </div>
                  <span className="text-sm font-medium">Envoyer</span>
                </button>
              </div>
            )}
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
            <div className="absolute inset-0 bg-black/50" />
            
            <div 
              className="relative border-4 border-white rounded-lg z-10"
              style={{
                width: "85%",
                maxWidth: "500px",
                aspectRatio: CARD_RATIO.toString(),
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
              }}
            >
              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />
            </div>

            <div className="absolute top-16 left-0 right-0 text-center text-white z-20 px-8">
              <p className="text-lg font-medium drop-shadow-lg">
                📸 Alignez la carte dans le cadre
              </p>
            </div>
          </div>

          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-end z-30">
            <button
              onClick={() => setFacingMode(f => f === "environment" ? "user" : "environment")}
              className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
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

