"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Upload, FileText, Smartphone, QrCode, Loader2, Check, X, RotateCw } from "lucide-react";
import CameraCapture from "./CameraCapture";
import QRCode from "qrcode";

interface UploadedImage {
  id: string;
  file?: File;
  url: string;
  dimensions: { width: number; height: number };
  source: "camera" | "file" | "mobile";
  side?: "front" | "back";
}

interface SmartUploaderProps {
  onImageUploaded: (image: UploadedImage) => void;
}

// Compress image client-side for faster upload
async function compressImage(file: File, maxWidth = 1920, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      
      // Scale down if too large
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Compression failed"));
          }
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export default function SmartUploader({ onImageUploaded }: SmartUploaderProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedSide, setSelectedSide] = useState<"front" | "back">("front");
  const [captureForSide, setCaptureForSide] = useState<"front" | "back">("front");

  // Detect if user is on mobile
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor;
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      setIsMobile(isMobileDevice || window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Generate QR code for mobile capture
  const generateQRSession = async () => {
    const newSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(newSessionId);
    
    // Generate mobile capture URL
    const mobileUrl = `${window.location.origin}/capture/${newSessionId}`;
    
    try {
      const qrDataUrl = await QRCode.toDataURL(mobileUrl, {
        width: 300,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" }
      });
      setQrCodeUrl(qrDataUrl);
      setShowQRModal(true);
      
      // Start polling for mobile upload
      pollForMobileUpload(newSessionId);
    } catch (err) {
      console.error("QR generation error:", err);
      setError("Erreur lors de la génération du QR code");
    }
  };

  // Poll for mobile upload completion
  const pollForMobileUpload = async (sid: string) => {
    let attempts = 0;
    const maxAttempts = 180; // 3 minutes
    
    const poll = async () => {
      if (attempts >= maxAttempts || !showQRModal) return;
      
      try {
        const response = await fetch(`/api/session/${sid}`);
        if (response.ok) {
          const data = await response.json();
          if (data.status === "completed" && data.image_id) {
            setShowQRModal(false);
            // Fetch the uploaded image details
            const imageResponse = await fetch(`/api/image/${data.image_id}`);
            if (imageResponse.ok) {
              const imageData = await imageResponse.json();
              onImageUploaded({
                id: data.image_id,
                url: imageData.url,
                dimensions: imageData.dimensions,
                source: "mobile"
              });
            }
            return;
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
      
      attempts++;
      setTimeout(poll, 1000);
    };
    
    poll();
  };

  // Handle camera capture with compression
  const handleCameraCapture = async (imageData: string) => {
    setShowCamera(false);
    setIsUploading(true);
    setUploadPercent(0);
    setUploadProgress("Optimisation de l'image...");

    try {
      // Convert base64 to blob
      const response = await fetch(imageData);
      const blob = await response.blob();
      const file = new File([blob], "capture.jpg", { type: "image/jpeg" });

      setUploadPercent(10);
      
      // Compress the image
      const compressed = await compressImage(file, 1920, 0.85);
      setUploadPercent(30);

      // Upload to backend
      const formData = new FormData();
      formData.append("file", compressed, "capture.jpg");

      setUploadProgress("Upload en cours...");
      setUploadPercent(40);
      
      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) throw new Error("Upload failed");

      const data = await uploadResponse.json();
      setUploadPercent(90);
      setUploadProgress("Finalisation...");

      // Get image dimensions
      const img = new Image();
      img.onload = () => {
        setUploadPercent(100);
        onImageUploaded({
          id: data.image_id,
          file,
          url: imageData,
          dimensions: { width: img.width, height: img.height },
          source: "camera",
          side: captureForSide
        });
      };
      img.src = imageData;
    } catch (err) {
      console.error("Camera upload error:", err);
      setError("Erreur lors de l'upload. Veuillez réessayer.");
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      setUploadPercent(0);
    }
  };

  // Handle file upload with compression
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsUploading(true);
    setUploadPercent(0);

    const isPDF = file.type === "application/pdf";
    
    try {
      let uploadFile: File | Blob = file;
      
      // Compress images client-side for faster upload
      if (!isPDF && file.type.startsWith("image/")) {
        setUploadProgress("Optimisation de l'image...");
        setUploadPercent(10);
        
        const originalSize = file.size / 1024 / 1024; // MB
        console.log(`Original size: ${originalSize.toFixed(2)} MB`);
        
        const compressed = await compressImage(file, 1920, 0.85);
        const compressedSize = compressed.size / 1024 / 1024;
        console.log(`Compressed size: ${compressedSize.toFixed(2)} MB`);
        
        uploadFile = compressed;
        setUploadPercent(30);
      }
      
      setUploadProgress(isPDF ? "Extraction du PDF..." : "Upload en cours...");
      setUploadPercent(40);

      const formData = new FormData();
      formData.append("file", uploadFile, isPDF ? file.name : "image.jpg");

      // Use XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();
      
      const uploadPromise = new Promise<any>((resolve, reject) => {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const percent = Math.round(40 + (e.loaded / e.total) * 50);
            setUploadPercent(percent);
          }
        });
        
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              reject(new Error("Invalid response"));
            }
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        });
        
        xhr.addEventListener("error", () => reject(new Error("Network error")));
        xhr.addEventListener("timeout", () => reject(new Error("Timeout")));
        
        xhr.timeout = 60000; // 60 second timeout
        xhr.open("POST", isPDF ? "/api/upload-pdf" : "/api/upload");
        xhr.send(formData);
      });
      
      const data = await uploadPromise;
      setUploadPercent(95);
      setUploadProgress("Finalisation...");

      if (isPDF) {
        onImageUploaded({
          id: data.image_id,
          url: `/api/image/${data.image_id}`,
          dimensions: data.dimensions,
          source: "file",
          side: selectedSide
        });
      } else {
        const previewUrl = URL.createObjectURL(uploadFile);
        const img = new Image();
        img.onload = () => {
          setUploadPercent(100);
          onImageUploaded({
            id: data.image_id,
            file: file,
            url: previewUrl,
            dimensions: { width: img.width, height: img.height },
            source: "file",
            side: selectedSide
          });
        };
        img.src = previewUrl;
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError("Erreur lors de l'upload. Veuillez réessayer.");
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      setUploadPercent(0);
    }
  };

  // Close QR modal
  const closeQRModal = () => {
    setShowQRModal(false);
    setQrCodeUrl(null);
    setSessionId(null);
  };

  return (
    <>
      {/* Camera capture overlay */}
      <AnimatePresence>
        {showCamera && (
          <CameraCapture
            onCapture={handleCameraCapture}
            onClose={() => setShowCamera(false)}
          />
        )}
      </AnimatePresence>

      {/* QR Code modal for desktop */}
      <AnimatePresence>
        {showQRModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={closeQRModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-surface-800">
                  📱 Scannez avec votre téléphone
                </h3>
                <button onClick={closeQRModal} className="text-surface-400 hover:text-surface-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {qrCodeUrl && (
                <div className="flex flex-col items-center">
                  <div className="bg-white p-4 rounded-2xl shadow-inner border-2 border-surface-100">
                    <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64" />
                  </div>
                  
                  <div className="mt-6 text-center">
                    <div className="flex items-center justify-center gap-2 text-primary-600 mb-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm font-medium">En attente de la photo...</span>
                    </div>
                    <p className="text-surface-500 text-sm">
                      Scannez le QR code et prenez une photo de votre carte
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main upload interface */}
      <div className="max-w-4xl mx-auto">
        {/* Side selection (Front/Back) */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-surface-700 mb-3">
            Quel côté de la carte ?
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => { setSelectedSide("front"); setCaptureForSide("front"); }}
              className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                selectedSide === "front"
                  ? "border-primary-500 bg-primary-50 text-primary-700"
                  : "border-surface-200 bg-white text-surface-600 hover:border-surface-300"
              }`}
            >
              <span className="text-xl">🎴</span>
              <span className="font-medium">Recto (avant)</span>
            </button>
            <button
              onClick={() => { setSelectedSide("back"); setCaptureForSide("back"); }}
              className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                selectedSide === "back"
                  ? "border-primary-500 bg-primary-50 text-primary-700"
                  : "border-surface-200 bg-white text-surface-600 hover:border-surface-300"
              }`}
            >
              <RotateCw className="w-5 h-5" />
              <span className="font-medium">Verso (arrière)</span>
            </button>
          </div>
        </div>

        {/* Loading state with progress bar */}
        {isUploading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-8 p-6 bg-primary-50 border border-primary-200 rounded-2xl"
          >
            <div className="flex items-center gap-4 mb-4">
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
              <div className="flex-1">
                <p className="font-medium text-primary-900">{uploadProgress}</p>
                <p className="text-sm text-primary-600">{uploadPercent}% - Veuillez patienter...</p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-primary-200 rounded-full h-2 overflow-hidden">
              <motion.div
                className="h-full bg-primary-600 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${uploadPercent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </motion.div>
        )}

        {/* Error state */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3"
            >
              <X className="w-5 h-5 text-red-500" />
              <p className="text-red-700">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Two options */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Option 1: Take a photo */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="group"
          >
            <button
              onClick={() => isMobile ? setShowCamera(true) : generateQRSession()}
              disabled={isUploading}
              className="w-full h-full p-8 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-3xl text-white text-left transition-all hover:shadow-2xl hover:shadow-primary-500/30 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Camera className="w-8 h-8" />
                </div>
                {isMobile ? (
                  <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium">
                    📱 Mobile
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium flex items-center gap-1">
                    <QrCode className="w-3 h-3" /> QR Code
                  </span>
                )}
              </div>

              <h3 className="text-2xl font-bold mb-2">
                Prendre une photo
              </h3>
              <p className="text-white/80 text-sm leading-relaxed">
                {isMobile
                  ? "Utilisez la caméra avec un guide de cadrage pour une photo parfaite."
                  : "Scannez un QR code avec votre téléphone pour prendre la photo."
                }
              </p>

              <div className="mt-6 flex items-center gap-2 text-white/60 text-xs">
                <Check className="w-4 h-4" />
                <span>Cadrage guidé automatique</span>
              </div>
            </button>
          </motion.div>

          {/* Option 2: Upload a file */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="group"
          >
            <label
              className={`block w-full h-full p-8 bg-white border-2 border-dashed border-surface-300 rounded-3xl text-left transition-all hover:border-primary-400 hover:shadow-xl hover:scale-[1.02] cursor-pointer ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="hidden"
              />

              <div className="flex items-start justify-between mb-6">
                <div className="w-16 h-16 bg-surface-100 rounded-2xl flex items-center justify-center group-hover:bg-primary-100 transition-colors">
                  <Upload className="w-8 h-8 text-surface-500 group-hover:text-primary-600 transition-colors" />
                </div>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-surface-100 rounded-full text-xs font-medium text-surface-600">
                    JPG
                  </span>
                  <span className="px-3 py-1 bg-surface-100 rounded-full text-xs font-medium text-surface-600">
                    PNG
                  </span>
                  <span className="px-3 py-1 bg-green-100 rounded-full text-xs font-medium text-green-700">
                    PDF
                  </span>
                </div>
              </div>

              <h3 className="text-2xl font-bold text-surface-800 mb-2">
                Téléverser un fichier
              </h3>
              <p className="text-surface-500 text-sm leading-relaxed">
                Importez une image ou le PDF original de votre carte pour une qualité optimale.
              </p>

              <div className="mt-6 flex items-center gap-2 text-surface-400 text-xs">
                <FileText className="w-4 h-4" />
                <span>PDF recommandé pour qualité vectorielle</span>
              </div>
            </label>
          </motion.div>
        </div>

        {/* Tips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-10 grid sm:grid-cols-3 gap-4"
        >
          {[
            { emoji: "💡", title: "Bonne lumière", desc: "Évitez les ombres et reflets" },
            { emoji: "📐", title: "Carte à plat", desc: "Posez-la sur une surface plane" },
            { emoji: "🎯", title: "4 coins visibles", desc: "Incluez toute la carte" },
          ].map((tip, i) => (
            <div
              key={tip.title}
              className="p-4 bg-surface-50 rounded-xl border border-surface-100"
            >
              <span className="text-2xl">{tip.emoji}</span>
              <h4 className="font-medium text-surface-800 mt-2">{tip.title}</h4>
              <p className="text-sm text-surface-500">{tip.desc}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </>
  );
}

