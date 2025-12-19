"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CardUploadPage from "@/components/CardUploadPage";
import PerspectiveEditor from "@/components/PerspectiveEditor";
import LogoUploader from "@/components/LogoUploader";
import GenerationDashboard from "@/components/GenerationDashboard";

type Step = "upload" | "logo" | "crop" | "generate" | "complete";

interface UploadedImage {
  id: string;
  file?: File;
  url: string;
  dimensions: { width: number; height: number };
  source?: "camera" | "file" | "mobile";
  side?: "front" | "back";
}

interface UploadedLogo {
  id: string | null;
  url: string | null;
}

interface PerspectivePoints {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
}

interface UserInfo {
  firstName: string;
  lastName: string;
  email: string;
}

export default function Home() {
  const [currentStep, setCurrentStep] = useState<Step>("upload");
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
  const [backImage, setBackImage] = useState<UploadedImage | null>(null);
  const [uploadedLogo, setUploadedLogo] = useState<UploadedLogo | null>(null);
  const [perspectivePoints, setPerspectivePoints] = useState<PerspectivePoints | null>(null);
  const [autoDetectedPoints, setAutoDetectedPoints] = useState<PerspectivePoints | null>(null);
  const [autoDetected, setAutoDetected] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  const handleUploadComplete = async (
    frontImage: File,
    backImageFile: File | null,
    info: UserInfo
  ) => {
    setUserInfo(info);

    // Upload front image
    const formData = new FormData();
    formData.append("file", frontImage);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        
        // Create preview URL
        const previewUrl = URL.createObjectURL(frontImage);
        const img = new Image();
        img.onload = () => {
          setUploadedImage({
            id: data.image_id,
            file: frontImage,
            url: previewUrl,
            dimensions: { width: img.width, height: img.height },
            source: "file",
            side: "front",
          });
        };
        img.src = previewUrl;

        // Handle back image if provided
        if (backImageFile) {
          const backFormData = new FormData();
          backFormData.append("file", backImageFile);

          const backResponse = await fetch("/api/upload", {
            method: "POST",
            body: backFormData,
          });

          if (backResponse.ok) {
            const backData = await backResponse.json();
            const backPreviewUrl = URL.createObjectURL(backImageFile);
            const backImg = new Image();
            backImg.onload = () => {
              setBackImage({
                id: backData.image_id,
                file: backImageFile,
                url: backPreviewUrl,
                dimensions: { width: backImg.width, height: backImg.height },
                source: "file",
                side: "back",
              });
            };
            backImg.src = backPreviewUrl;
          }
        }

        // Auto-detect corners for front image
        try {
          const detectResponse = await fetch(`/api/detect-corners/${data.image_id}`);
          if (detectResponse.ok) {
            const detectData = await detectResponse.json();
            const corners = detectData.corners;
            setAutoDetectedPoints({
              topLeft: { x: corners.top_left[0], y: corners.top_left[1] },
              topRight: { x: corners.top_right[0], y: corners.top_right[1] },
              bottomRight: { x: corners.bottom_right[0], y: corners.bottom_right[1] },
              bottomLeft: { x: corners.bottom_left[0], y: corners.bottom_left[1] },
            });
            setAutoDetected(detectData.detected);
          }
        } catch (error) {
          console.log("Auto-detection failed, using defaults");
        }

        setCurrentStep("logo");
      }
    } catch (error) {
      console.error("Upload failed:", error);
    }
  };

  const handleLogoUploaded = (logoId: string | null, logoUrl: string | null) => {
    setUploadedLogo({ id: logoId, url: logoUrl });
    setCurrentStep("crop");
  };

  const handleLogoSkip = () => {
    setUploadedLogo(null);
    setCurrentStep("crop");
  };

  const handlePerspectiveConfirmed = async (points: PerspectivePoints) => {
    setPerspectivePoints(points);
    setCurrentStep("generate");

    // Start generation
    try {
      const response = await fetch("/api/generate-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_id: uploadedImage?.id,
          back_image_id: backImage?.id || null,
          logo_id: uploadedLogo?.id || null,
          user_info: userInfo,
          perspective_points: {
            top_left: [points.topLeft.x, points.topLeft.y],
            top_right: [points.topRight.x, points.topRight.y],
            bottom_right: [points.bottomRight.x, points.bottomRight.y],
            bottom_left: [points.bottomLeft.x, points.bottomLeft.y],
          },
        }),
      });

      const data = await response.json();
      setJobId(data.job_id);
    } catch (error) {
      console.error("Failed to start generation:", error);
    }
  };

  const handleGenerationComplete = () => {
    setCurrentStep("complete");
  };

  const handleReset = () => {
    setCurrentStep("upload");
    setUploadedImage(null);
    setBackImage(null);
    setUploadedLogo(null);
    setPerspectivePoints(null);
    setAutoDetectedPoints(null);
    setAutoDetected(false);
    setJobId(null);
    setUserInfo(null);
  };

  return (
    <div className="min-h-screen">
      <AnimatePresence mode="wait">
        {currentStep === "upload" && (
          <motion.div
            key="upload"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <CardUploadPage onComplete={handleUploadComplete} />
          </motion.div>
        )}

        {currentStep === "logo" && uploadedImage && (
          <motion.div
            key="logo"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen bg-black py-12 px-4"
          >
            <div className="max-w-4xl mx-auto">
              <LogoUploader
                onLogoUploaded={handleLogoUploaded}
                onSkip={handleLogoSkip}
                onBack={() => setCurrentStep("upload")}
              />
            </div>
          </motion.div>
        )}

        {currentStep === "crop" && uploadedImage && (
          <motion.div
            key="crop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen bg-black py-12 px-4"
          >
            <div className="max-w-6xl mx-auto">
              <PerspectiveEditor
                image={uploadedImage}
                onConfirm={handlePerspectiveConfirmed}
                initialPoints={autoDetectedPoints || undefined}
                autoDetected={autoDetected}
              />
            </div>
          </motion.div>
        )}

        {currentStep === "generate" && uploadedImage && jobId && (
          <motion.div
            key="generate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen bg-black py-12 px-4"
          >
            <div className="max-w-6xl mx-auto">
              <GenerationDashboard
                originalImage={uploadedImage}
                jobId={jobId}
                onComplete={handleGenerationComplete}
                onReset={handleReset}
              />
            </div>
          </motion.div>
        )}

        {currentStep === "complete" && (
          <motion.div
            key="complete"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen bg-black flex items-center justify-center py-12 px-4"
          >
            <div className="text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg
                  className="w-12 h-12 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="text-4xl font-bold text-white mb-4">
                Carte générée avec succès!
              </h1>
              <p className="text-gray-400 mb-8">
                Votre carte d'affaires digitale est prête.
              </p>
              <button
                onClick={handleReset}
                className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-[0_0_30px_rgba(34,211,238,0.5)] transition-all"
              >
                Créer une nouvelle carte
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
