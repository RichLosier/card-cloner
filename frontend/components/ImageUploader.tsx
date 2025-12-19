"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Image as ImageIcon, AlertCircle, Loader2 } from "lucide-react";

interface UploadedImage {
  id: string;
  file?: File;
  url: string;
  dimensions: { width: number; height: number };
  source?: "camera" | "file" | "mobile";
}

interface ImageUploaderProps {
  onImageUploaded: (image: UploadedImage) => void;
}

export default function ImageUploader({ onImageUploaded }: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

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

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Upload failed");
        }

        const data = await response.json();

        // Get image dimensions
        const img = new Image();
        img.onload = () => {
          onImageUploaded({
            id: data.image_id,
            file,
            url: previewUrl,
            dimensions: { width: img.width, height: img.height },
          });
        };
        img.src = previewUrl;
      } catch (err) {
        setError("L'upload a échoué. Vérifiez que le backend est en cours d'exécution.");
        setPreview(null);
      } finally {
        setIsUploading(false);
      }
    },
    [onImageUploaded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png", ".webp"],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  return (
    <div className="max-w-3xl mx-auto">
      {/* Upload Zone */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div
          {...getRootProps()}
          className={`
            relative overflow-hidden rounded-3xl border-2 border-dashed p-12
            transition-all duration-300 cursor-pointer
            ${isDragActive
              ? "border-primary-500 bg-primary-50"
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
                className="flex flex-col items-center"
              >
                <Loader2 className="w-16 h-16 text-primary-500 animate-spin mb-4" />
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
                className="flex flex-col items-center"
              >
                <div className="relative w-full max-w-md aspect-[16/9] rounded-xl overflow-hidden shadow-lg mb-4">
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-sm text-surface-500">
                  Cliquez ou glissez une autre image pour changer
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center"
              >
                {/* Animated icon */}
                <motion.div
                  animate={{
                    y: isDragActive ? -10 : 0,
                  }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="relative mb-6"
                >
                  <div className="absolute inset-0 bg-primary-500/20 blur-2xl rounded-full" />
                  <div className="relative w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center shadow-xl">
                    {isDragActive ? (
                      <ImageIcon className="w-10 h-10 text-white" />
                    ) : (
                      <Upload className="w-10 h-10 text-white" />
                    )}
                  </div>
                </motion.div>

                {/* Text */}
                <h3 className="text-xl font-semibold text-surface-800 mb-2">
                  {isDragActive
                    ? "Déposez l'image ici!"
                    : "Glissez votre carte d'affaires"}
                </h3>
                <p className="text-surface-500 text-center max-w-sm">
                  ou cliquez pour sélectionner une image
                  <br />
                  <span className="text-sm">
                    JPG, PNG, WebP • Max 10MB
                  </span>
                </p>

                {/* Example formats */}
                <div className="flex gap-3 mt-6">
                  {["JPG", "PNG", "WEBP"].map((format) => (
                    <span
                      key={format}
                      className="px-3 py-1 bg-surface-100 rounded-lg text-xs font-medium text-surface-500"
                    >
                      {format}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Decorative elements */}
          <div className="absolute top-4 right-4 w-20 h-20 bg-primary-500/5 rounded-full blur-2xl" />
          <div className="absolute bottom-4 left-4 w-32 h-32 bg-primary-400/5 rounded-full blur-3xl" />
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
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 font-medium">Erreur d'upload</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tips */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {[
          {
            icon: "📸",
            title: "Photo bien éclairée",
            desc: "Évitez les ombres et reflets",
          },
          {
            icon: "🎯",
            title: "Carte visible entière",
            desc: "Incluez les 4 coins",
          },
          {
            icon: "✨",
            title: "Haute résolution",
            desc: "Plus c'est net, mieux c'est",
          },
        ].map((tip, index) => (
          <motion.div
            key={tip.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + index * 0.1 }}
            className="p-4 bg-white/60 backdrop-blur-sm rounded-xl border border-surface-200"
          >
            <span className="text-2xl mb-2 block">{tip.icon}</span>
            <h4 className="font-medium text-surface-800">{tip.title}</h4>
            <p className="text-sm text-surface-500">{tip.desc}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

