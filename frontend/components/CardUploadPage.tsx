"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  Upload,
  ArrowRight,
  Sparkles,
  CreditCard,
  Image as ImageIcon,
  X,
  Loader2,
  User,
} from "lucide-react";
import StarfieldBackground from "./StarfieldBackground";

interface FileUpload {
  file: File | null;
  preview: string | null;
  uploading: boolean;
  uploaded: boolean;
}

interface UserInfo {
  firstName: string;
  lastName: string;
  email: string;
}

interface CardUploadPageProps {
  onComplete?: (frontImage: File, backImage: File | null, userInfo: UserInfo) => void;
}

export default function CardUploadPage({ onComplete }: CardUploadPageProps) {
  const [frontCard, setFrontCard] = useState<FileUpload>({
    file: null,
    preview: null,
    uploading: false,
    uploaded: false,
  });
  const [backCard, setBackCard] = useState<FileUpload>({
    file: null,
    preview: null,
    uploading: false,
    uploaded: false,
  });
  const [userInfo, setUserInfo] = useState<UserInfo>({
    firstName: "",
    lastName: "",
    email: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback(
    (
      e: React.ChangeEvent<HTMLInputElement>,
      setter: React.Dispatch<React.SetStateAction<FileUpload>>
    ) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setter({
            file,
            preview: reader.result as string,
            uploading: false,
            uploaded: false,
          });
        };
        reader.readAsDataURL(file);
      }
    },
    []
  );

  const removeFile = useCallback(
    (setter: React.Dispatch<React.SetStateAction<FileUpload>>) => {
      setter({
        file: null,
        preview: null,
        uploading: false,
        uploaded: false,
      });
    },
    []
  );

  const handleSubmit = async () => {
    if (!frontCard.file || !userInfo.firstName || !userInfo.lastName) {
      setError("Veuillez remplir tous les champs obligatoires");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Create FormData for upload
      const formData = new FormData();
      formData.append("front_card", frontCard.file);
      if (backCard.file) {
        formData.append("back_card", backCard.file);
      }
      formData.append("first_name", userInfo.firstName);
      formData.append("last_name", userInfo.lastName);
      formData.append("email", userInfo.email);

      const response = await fetch("/api/upload-cards", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Erreur lors de l'upload");
      }

      setSubmitted(true);

      if (onComplete) {
        onComplete(frontCard.file, backCard.file, userInfo);
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  const UploadZone = ({
    title,
    subtitle,
    fileState,
    setFileState,
    inputId,
    required = false,
  }: {
    title: string;
    subtitle: string;
    fileState: FileUpload;
    setFileState: React.Dispatch<React.SetStateAction<FileUpload>>;
    inputId: string;
    required?: boolean;
  }) => (
    <div className="relative">
      <input
        type="file"
        id={inputId}
        accept="image/*,.pdf"
        onChange={(e) => handleFileSelect(e, setFileState)}
        className="hidden"
      />

      {fileState.preview ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative group"
        >
          <div className="relative rounded-2xl overflow-hidden border-2 border-cyan-500/50 bg-gray-900/50">
            <img
              src={fileState.preview}
              alt={title}
              className="w-full h-48 object-cover"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button
                onClick={() => removeFile(setFileState)}
                className="bg-red-500 hover:bg-red-600 text-white p-3 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-green-400">
            <CheckCircle size={18} />
            <span className="text-sm font-medium truncate max-w-[200px]">
              {fileState.file?.name}
            </span>
          </div>
        </motion.div>
      ) : (
        <label htmlFor={inputId} className="block cursor-pointer group">
          <div className="relative rounded-2xl border-2 border-dashed border-gray-600 hover:border-cyan-500/50 bg-gray-900/30 hover:bg-gray-900/50 transition-all duration-300 p-8">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <CreditCard className="text-cyan-400" size={32} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">
                {title}
                {required && <span className="text-red-400 ml-1">*</span>}
              </h3>
              <p className="text-gray-400 text-sm mb-4">{subtitle}</p>
              <div className="flex items-center gap-2 text-cyan-400 font-medium">
                <Upload size={18} />
                <span>Cliquez ou glissez votre fichier</span>
              </div>
              <p className="text-gray-500 text-xs mt-2">
                PNG, JPG ou PDF (max 10MB)
              </p>
            </div>
          </div>
        </label>
      )}
    </div>
  );

  if (submitted) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden flex items-center justify-center">
        <StarfieldBackground />

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 max-w-2xl mx-auto px-4 text-center"
        >
          <div className="mb-8">
            <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce-slow">
              <CheckCircle className="text-white" size={48} />
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-white mb-4">
              C'est tout bon!
            </h1>
            <p className="text-xl text-gray-400">
              Nous avons bien reçu votre carte d'affaires. Notre équipe va créer
              votre carte virtuelle et vous contacter sous 24-48h.
            </p>
          </div>

          <div className="bg-gray-900/50 backdrop-blur-sm rounded-3xl p-8 border border-gray-800 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">
              Prochaines étapes
            </h2>
            <div className="space-y-4 text-left">
              {[
                "Nous recréons fidèlement votre carte en version digitale",
                "Vous recevrez un email avec le lien vers votre carte",
                "Vous pourrez modifier et personnaliser votre carte à tout moment",
              ].map((step, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">
                      {index + 1}
                    </span>
                  </div>
                  <span className="text-gray-300">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      <StarfieldBackground />

      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[120px] animate-float-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px] animate-float-medium" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 bg-green-500/10 text-green-400 px-4 py-2 rounded-full mb-6 border border-green-500/20">
            <CheckCircle size={18} />
            <span className="font-semibold">Paiement confirmé!</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-6 leading-tight">
            Merci pour votre
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500">
              confiance!
            </span>
          </h1>

          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Pour créer votre carte virtuelle, nous avons besoin d'une photo de
            votre carte d'affaires actuelle (recto et verso).
          </p>
        </motion.div>

        {/* User Info Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-900/50 backdrop-blur-sm rounded-3xl p-8 border border-gray-800 mb-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-xl flex items-center justify-center">
              <User className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Vos informations</h2>
              <p className="text-gray-400 text-sm">
                Pour organiser votre dossier
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Prénom <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={userInfo.firstName}
                onChange={(e) =>
                  setUserInfo({ ...userInfo, firstName: e.target.value })
                }
                className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                placeholder="Jean"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nom de famille <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={userInfo.lastName}
                onChange={(e) =>
                  setUserInfo({ ...userInfo, lastName: e.target.value })
                }
                className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                placeholder="Dupont"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={userInfo.email}
                onChange={(e) =>
                  setUserInfo({ ...userInfo, email: e.target.value })
                }
                className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                placeholder="jean.dupont@email.com"
              />
            </div>
          </div>
        </motion.div>

        {/* Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-900/50 backdrop-blur-sm rounded-3xl p-8 border border-gray-800 mb-8"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-xl flex items-center justify-center">
              <ImageIcon className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                Téléchargez votre carte
              </h2>
              <p className="text-gray-400 text-sm">
                Nous la reproduirons fidèlement en version digitale
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <UploadZone
              title="Recto de la carte"
              subtitle="Face avant de votre carte d'affaires"
              fileState={frontCard}
              setFileState={setFrontCard}
              inputId="front-card"
              required
            />
            <UploadZone
              title="Verso de la carte"
              subtitle="Face arrière de votre carte d'affaires"
              fileState={backCard}
              setFileState={setBackCard}
              inputId="back-card"
            />
          </div>

          {/* Error message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3"
              >
                <X className="text-red-400" size={20} />
                <p className="text-red-300">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={handleSubmit}
            disabled={
              !frontCard.file ||
              !userInfo.firstName ||
              !userInfo.lastName ||
              submitting
            }
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-2 ${
              frontCard.file && userInfo.firstName && userInfo.lastName && !submitting
                ? "bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 text-white hover:shadow-[0_0_30px_rgba(34,211,238,0.5)] hover:scale-[1.02]"
                : "bg-gray-800 text-gray-400 cursor-not-allowed"
            }`}
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Envoi en cours...
              </>
            ) : (
              <>
                <Sparkles size={20} />
                Envoyer et créer ma carte
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </motion.div>

        {/* Info Box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-r from-cyan-950/50 to-purple-950/50 rounded-2xl p-6 border border-gray-800"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Sparkles className="text-cyan-400" size={20} />
            </div>
            <div>
              <h3 className="text-white font-bold mb-2">
                Pourquoi avons-nous besoin de votre carte?
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Notre équipe va recréer fidèlement votre carte d'affaires en
                version digitale interactive. Vous pourrez ensuite la modifier,
                ajouter des liens vers vos réseaux sociaux, et partager votre
                carte instantanément via QR code ou lien personnalisé.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

