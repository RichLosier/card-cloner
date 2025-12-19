"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Wand2, Code, CheckCircle, Image as ImageIcon, Camera } from "lucide-react";
import SmartUploader from "@/components/SmartUploader";
import LogoUploader from "@/components/LogoUploader";
import PerspectiveEditor from "@/components/PerspectiveEditor";
import GenerationDashboard from "@/components/GenerationDashboard";
import Header from "@/components/Header";

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

export default function Home() {
  const [currentStep, setCurrentStep] = useState<Step>("upload");
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
  const [backImage, setBackImage] = useState<UploadedImage | null>(null); // For verso
  const [uploadedLogo, setUploadedLogo] = useState<UploadedLogo | null>(null);
  const [perspectivePoints, setPerspectivePoints] = useState<PerspectivePoints | null>(null);
  const [autoDetectedPoints, setAutoDetectedPoints] = useState<PerspectivePoints | null>(null);
  const [autoDetected, setAutoDetected] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const steps = [
    { id: "upload", label: "Photo/Upload", icon: Camera },
    { id: "logo", label: "Logo", icon: ImageIcon },
    { id: "crop", label: "Recadrage", icon: Wand2 },
    { id: "generate", label: "Génération", icon: Code },
    { id: "complete", label: "Terminé", icon: CheckCircle },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const handleImageUploaded = async (frontImage: UploadedImage, backImageData?: UploadedImage) => {
    setUploadedImage(frontImage);
    
    // Store back image if provided
    if (backImageData) {
      setBackImage(backImageData);
    }
    
    // Auto-detect corners for front image
    try {
      const response = await fetch(`/api/detect-corners/${frontImage.id}`);
      if (response.ok) {
        const data = await response.json();
        const corners = data.corners;
        setAutoDetectedPoints({
          topLeft: { x: corners.top_left[0], y: corners.top_left[1] },
          topRight: { x: corners.top_right[0], y: corners.top_right[1] },
          bottomRight: { x: corners.bottom_right[0], y: corners.bottom_right[1] },
          bottomLeft: { x: corners.bottom_left[0], y: corners.bottom_left[1] },
        });
        setAutoDetected(data.detected);
      }
    } catch (error) {
      console.log("Auto-detection failed, using defaults");
    }
    
    setCurrentStep("logo");
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
          back_image_id: backImage?.id || null, // Send back image if available
          logo_id: uploadedLogo?.id || null,
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
  };

  return (
    <div className="min-h-screen">
      <Header />

      {/* Progress Steps */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-12">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStepIndex;
            const isCompleted = index < currentStepIndex;

            return (
              <div key={step.id} className="flex items-center flex-1">
                <motion.div
                  initial={false}
                  animate={{
                    scale: isActive ? 1.1 : 1,
                    backgroundColor: isCompleted
                      ? "rgb(59, 130, 246)"
                      : isActive
                      ? "rgb(99, 102, 241)"
                      : "rgb(229, 231, 235)",
                  }}
                  className={`
                    w-12 h-12 rounded-full flex items-center justify-center
                    ${isCompleted || isActive ? "text-white" : "text-surface-400"}
                    shadow-lg transition-all
                  `}
                >
                  <Icon className="w-5 h-5" />
                </motion.div>

                <div className="ml-3 hidden sm:block">
                  <p
                    className={`text-sm font-medium ${
                      isActive ? "text-primary-600" : "text-surface-500"
                    }`}
                  >
                    {step.label}
                  </p>
                </div>

                {index < steps.length - 1 && (
                  <div className="flex-1 mx-4">
                    <div className="h-1 bg-surface-200 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: isCompleted ? "100%" : "0%",
                        }}
                        className="h-full bg-primary-500"
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 pb-12">
        <AnimatePresence mode="wait">
          {currentStep === "upload" && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <SmartUploader onImageUploaded={handleImageUploaded} />
            </motion.div>
          )}

          {currentStep === "logo" && (
            <motion.div
              key="logo"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <LogoUploader
                onLogoUploaded={handleLogoUploaded}
                onSkip={handleLogoSkip}
                onBack={() => setCurrentStep("upload")}
              />
            </motion.div>
          )}

          {currentStep === "crop" && uploadedImage && (
            <motion.div
              key="crop"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <PerspectiveEditor
                image={uploadedImage}
                onConfirm={handlePerspectiveConfirmed}
                onBack={() => setCurrentStep("logo")}
                initialPoints={autoDetectedPoints}
                autoDetected={autoDetected}
              />
            </motion.div>
          )}

          {(currentStep === "generate" || currentStep === "complete") && (
            <motion.div
              key="generate"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <GenerationDashboard
                jobId={jobId}
                originalImage={uploadedImage}
                onComplete={handleGenerationComplete}
                onReset={handleReset}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

