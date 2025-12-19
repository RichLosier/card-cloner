"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  Copy,
  ExternalLink,
  Sparkles,
  Eye,
  Code,
} from "lucide-react";

interface UploadedImage {
  id: string;
  file?: File;
  url: string;
  dimensions: { width: number; height: number };
  source?: "camera" | "file" | "mobile";
}

interface JobStatus {
  job_id: string;
  status: string;
  progress: number;
  current_step: string;
  result_url?: string;
  error?: string;
}

interface GenerationDashboardProps {
  jobId: string | null;
  originalImage: UploadedImage | null;
  onComplete: () => void;
  onReset: () => void;
}

const progressSteps = [
  { key: "processing", label: "Traitement de l'image", icon: "🖼️" },
  { key: "extracting", label: "Extraction des données", icon: "🔍" },
  { key: "generating", label: "Génération du HTML/CSS", icon: "⚡" },
  { key: "correcting", label: "Correction automatique", icon: "🔄" },
  { key: "completed", label: "Terminé!", icon: "✨" },
];

export default function GenerationDashboard({
  jobId,
  originalImage,
  onComplete,
  onReset,
}: GenerationDashboardProps) {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);

  // Poll for job status
  useEffect(() => {
    if (!jobId) return;

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/job/${jobId}`);
        if (response.ok) {
          const data: JobStatus = await response.json();
          setJobStatus(data);

          if (data.status === "completed") {
            onComplete();
            // Fetch the generated HTML
            if (data.result_url) {
              // result_url is like "/outputs/xxx.html", proxy goes to backend
              const htmlResponse = await fetch(data.result_url);
              if (htmlResponse.ok) {
                const html = await htmlResponse.text();
                setHtmlContent(html);
              }
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch job status:", error);
      }
    };

    // Initial fetch
    pollStatus();

    // Poll every 1 second until complete
    const interval = setInterval(() => {
      if (jobStatus?.status !== "completed" && jobStatus?.status !== "failed") {
        pollStatus();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [jobId, jobStatus?.status, onComplete]);

  const handleCopyCode = async () => {
    if (htmlContent) {
      await navigator.clipboard.writeText(htmlContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (htmlContent) {
      const blob = new Blob([htmlContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `business-card-${jobId}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const isComplete = jobStatus?.status === "completed";
  const isFailed = jobStatus?.status === "failed";
  const isProcessing = !isComplete && !isFailed;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Progress Bar */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="bg-white rounded-2xl shadow-lg p-6">
          {/* Status Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {isProcessing && (
                <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
              )}
              {isComplete && (
                <CheckCircle className="w-6 h-6 text-green-500" />
              )}
              {isFailed && <XCircle className="w-6 h-6 text-red-500" />}

              <div>
                <h3 className="font-semibold text-surface-800">
                  {isComplete
                    ? "Génération terminée!"
                    : isFailed
                    ? "Erreur de génération"
                    : "Génération en cours..."}
                </h3>
                <p className="text-sm text-surface-500">
                  {jobStatus?.current_step || "Initialisation..."}
                </p>
              </div>
            </div>

            <span className="text-2xl font-bold text-primary-600">
              {jobStatus?.progress || 0}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="h-3 bg-surface-100 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                isComplete
                  ? "bg-green-500"
                  : isFailed
                  ? "bg-red-500"
                  : "bg-gradient-to-r from-primary-500 to-indigo-500 progress-bar-animated"
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${jobStatus?.progress || 0}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Step indicators */}
          <div className="flex justify-between mt-4">
            {progressSteps.map((step, index) => {
              const stepProgress = (index + 1) * 20;
              const isActive = (jobStatus?.progress || 0) >= stepProgress;
              const isCurrent =
                (jobStatus?.progress || 0) >= stepProgress - 20 &&
                (jobStatus?.progress || 0) < stepProgress;

              return (
                <div
                  key={step.key}
                  className={`flex flex-col items-center ${
                    isActive
                      ? "text-primary-600"
                      : isCurrent
                      ? "text-primary-400"
                      : "text-surface-400"
                  }`}
                >
                  <span className="text-xl mb-1">{step.icon}</span>
                  <span className="text-xs text-center hidden sm:block">
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Original Image */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-lg overflow-hidden"
        >
          <div className="p-4 border-b border-surface-200 flex items-center justify-between">
            <h3 className="font-medium text-surface-800 flex items-center gap-2">
              <span className="w-3 h-3 bg-blue-500 rounded-full" />
              Original
            </h3>
          </div>

          <div className="p-4 bg-surface-50">
            <div className="aspect-[1120/640] bg-surface-200 rounded-lg overflow-hidden flex items-center justify-center">
              {originalImage ? (
                <img
                  src={originalImage.url}
                  alt="Original card"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <span className="text-surface-400">Image originale</span>
              )}
            </div>
          </div>
        </motion.div>

        {/* Right: Generated Result */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-lg overflow-hidden"
        >
          <div className="p-4 border-b border-surface-200 flex items-center justify-between">
            <h3 className="font-medium text-surface-800 flex items-center gap-2">
              <span className="w-3 h-3 bg-green-500 rounded-full" />
              Résultat (1120×640px)
            </h3>

            {isComplete && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode("preview")}
                  className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 transition-colors ${
                    viewMode === "preview"
                      ? "bg-primary-100 text-primary-700"
                      : "text-surface-500 hover:bg-surface-100"
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  <span>Preview</span>
                </button>
                <button
                  onClick={() => setViewMode("code")}
                  className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 transition-colors ${
                    viewMode === "code"
                      ? "bg-primary-100 text-primary-700"
                      : "text-surface-500 hover:bg-surface-100"
                  }`}
                >
                  <Code className="w-4 h-4" />
                  <span>Code</span>
                </button>
              </div>
            )}
          </div>

          <div className="p-4 bg-surface-50">
            <div className="aspect-[1120/640] bg-white rounded-lg overflow-hidden shadow-inner">
              <AnimatePresence mode="wait">
                {isProcessing && (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-surface-50 to-surface-100"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <Sparkles className="w-12 h-12 text-primary-400" />
                    </motion.div>
                    <p className="mt-4 text-surface-500 text-sm">
                      {jobStatus?.current_step || "Préparation..."}
                    </p>
                  </motion.div>
                )}

                {isComplete && viewMode === "preview" && htmlContent && (
                  <motion.iframe
                    key="preview"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    srcDoc={htmlContent}
                    className="w-full h-full border-0"
                    title="Card Preview"
                    sandbox="allow-scripts"
                  />
                )}

                {isComplete && viewMode === "code" && htmlContent && (
                  <motion.div
                    key="code"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-full h-full overflow-auto bg-surface-900 p-4"
                  >
                    <pre className="text-xs text-surface-300 font-mono whitespace-pre-wrap">
                      {htmlContent}
                    </pre>
                  </motion.div>
                )}

                {isFailed && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-full h-full flex flex-col items-center justify-center bg-red-50"
                  >
                    <XCircle className="w-12 h-12 text-red-400" />
                    <p className="mt-4 text-red-600 font-medium">
                      Erreur de génération
                    </p>
                    <p className="text-red-500 text-sm mt-1">
                      {jobStatus?.error || "Une erreur s'est produite"}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-6 flex flex-wrap items-center justify-center gap-4"
      >
        {isComplete && (
          <>
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-surface-300 rounded-xl hover:bg-surface-50 transition-colors"
            >
              {copied ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4 text-surface-500" />
              )}
              <span>{copied ? "Copié!" : "Copier le code"}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-surface-300 rounded-xl hover:bg-surface-50 transition-colors"
            >
              <Download className="w-4 h-4 text-surface-500" />
              <span>Télécharger HTML</span>
            </button>

            {jobStatus?.result_url && (
              <a
                href={jobStatus.result_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-white border border-surface-300 rounded-xl hover:bg-surface-50 transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-surface-500" />
                <span>Ouvrir dans un nouvel onglet</span>
              </a>
            )}
          </>
        )}

        <button
          onClick={onReset}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white font-medium rounded-xl shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Nouvelle carte</span>
        </button>
      </motion.div>

      {/* Stats (for completed jobs) */}
      {isComplete && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4"
        >
          {[
            { label: "Dimensions", value: "1120 × 640px" },
            { label: "Format", value: "HTML/CSS" },
            { label: "Responsive", value: "Oui" },
            { label: "Temps", value: "~15s" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="p-4 bg-white/60 backdrop-blur-sm rounded-xl border border-surface-200 text-center"
            >
              <p className="text-xs text-surface-500 uppercase tracking-wider">
                {stat.label}
              </p>
              <p className="text-lg font-semibold text-surface-800 mt-1">
                {stat.value}
              </p>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

