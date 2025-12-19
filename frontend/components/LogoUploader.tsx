"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Image as ImageIcon, AlertCircle, Loader2, Check, X } from "lucide-react";

interface LogoUploaderProps {
  onLogoUploaded: (logoId: string | null, logoUrl: string | null) => void;
  onSkip: () => void;
  onBack: () => void;
}

export default function LogoUploader({ onLogoUploaded, onSkip, onBack }: LogoUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [logoId, setLogoId] = useState<string | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setError(null);
      setIsUploading(true);

      // Create preview
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);

      try {
        // Upload to backend
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/upload-logo", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Upload failed");
        }

        const data = await response.json();
        setLogoId(data.logo_id);
      } catch (err) {
        setError("L'upload du logo a échoué.");
        setPreview(null);
      } finally {
        setIsUploading(false);
      }
    },
    []
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png", ".webp", ".svg"],
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024, // 5MB
  });

  const handleContinue = () => {
    onLogoUploaded(logoId, preview);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h2 className="text-2xl font-bold text-surface-800 mb-2">
          📷 Upload du Logo (Optionnel)
        </h2>
        <p className="text-surface-600">
          Pour un résultat optimal, uploadez le logo de l'entreprise en haute qualité.
          <br />
          <span className="text-sm text-surface-500">
            Si vous n'avez pas le logo, nous essaierons de le recréer approximativement.
          </span>
        </p>
      </motion.div>

      {/* Upload Zone */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div
          {...getRootProps()}
          className={`
            relative overflow-hidden rounded-2xl border-2 border-dashed p-8
            transition-all duration-300 cursor-pointer
            ${isDragActive
              ? "border-primary-500 bg-primary-50"
              : preview
              ? "border-green-400 bg-green-50/50"
              : "border-surface-300 bg-white/50 hover:border-primary-400 hover:bg-primary-50/50"
            }
          `}
        >
          <input {...getInputProps()} />

          <AnimatePresence mode="wait">
            {isUploading ? (
              <motion.div
                key="uploading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center py-8"
              >
                <Loader2 className="w-12 h-12 text-primary-500 animate-spin mb-4" />
                <p className="text-lg font-medium text-surface-600">
                  Upload en cours...
                </p>
              </motion.div>
            ) : preview ? (
              <motion.div
                key="preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center py-4"
              >
                <div className="relative w-40 h-40 bg-white rounded-xl overflow-hidden shadow-lg mb-4 flex items-center justify-center p-4">
                  <img
                    src={preview}
                    alt="Logo Preview"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <div className="flex items-center gap-2 text-green-600">
                  <Check className="w-5 h-5" />
                  <span className="font-medium">Logo uploadé!</span>
                </div>
                <p className="text-sm text-surface-500 mt-2">
                  Cliquez pour changer
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center py-8"
              >
                <motion.div
                  animate={{ y: isDragActive ? -5 : 0 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg mb-4"
                >
                  <ImageIcon className="w-8 h-8 text-white" />
                </motion.div>

                <h3 className="text-lg font-semibold text-surface-800 mb-2">
                  {isDragActive ? "Déposez le logo!" : "Glissez le logo de l'entreprise"}
                </h3>
                <p className="text-surface-500 text-sm text-center">
                  PNG ou SVG transparent recommandé
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-600 text-sm">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4"
      >
        <button
          onClick={onBack}
          className="px-6 py-3 text-surface-600 hover:text-surface-800 transition-colors"
        >
          ← Retour
        </button>

        <button
          onClick={onSkip}
          className="px-6 py-3 border border-surface-300 rounded-xl text-surface-600 hover:bg-surface-50 transition-colors"
        >
          Passer cette étape
        </button>

        {preview && (
          <button
            onClick={handleContinue}
            className="px-8 py-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white font-medium rounded-xl shadow-lg shadow-primary-500/25 hover:shadow-xl transition-all"
          >
            Continuer avec ce logo →
          </button>
        )}
      </motion.div>
    </div>
  );
}

