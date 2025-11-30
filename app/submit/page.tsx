"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  User,
  Phone,
  MapPin,
  Mail,
  FileArchive,
  ImageIcon,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type UserProfile = {
  id: string;
  email: string | null;
};

export default function SubmitPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  // Form fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState("");
  const [hobby, setHobby] = useState("");

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);

  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [isPending, startTransition] = useTransition();

  // Realtime
  const [evaluation, setEvaluation] = useState<any>(null);

  //IMAGE COMPRESSION
  const compressImage = async (file: File): Promise<File> => {
    const maxSize = 1024 * 1024;
    const maxDim = 1080;

    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        if (!e.target?.result) reject("Cannot read image");
        img.src = e.target?.result as string;
      };

      img.onload = () => {
        let { width, height } = img;

        if (width > height && width > maxDim) {
          height = (height * maxDim) / width;
          width = maxDim;
        } else if (height > width && height > maxDim) {
          width = (width * maxDim) / height;
          height = maxDim;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) reject("Canvas unsupported");

        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.9;

        const compress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) return reject("Blob failed");
              if (blob.size <= maxSize || quality <= 0.4) {
                resolve(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
              } else {
                quality -= 0.1;
                compress();
              }
            },
            "image/jpeg",
            quality
          );
        };

        compress();
      };

      reader.onerror = () => reject("FileReader error");
      reader.readAsDataURL(file);
    });
  };

  //LOAD USER + SUBMISSION + REALTIME
  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return router.replace("/login");

      const profileId = data.user.id;

      // Check role
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", profileId)
        .single();

      if (!profile || profile.role !== "developer") {
        return router.replace("/login");
      }

      setUser({ id: profileId, email: data.user.email });
      setEmail(data.user.email || "");
      setLoadingUser(false);

      // Load submission to get submission_id
      const { data: sub } = await supabase
        .from("submissions")
        .select("id")
        .eq("user_id", profileId)
        .single();

      if (sub) {
        setSubmissionId(sub.id);
        loadEvaluation(sub.id);
        subscribeToRealtime(sub.id);
      }
    };

    loadUser();
  }, []);

  //  LOAD EVALUATION 
  const loadEvaluation = async (subId: string) => {
    const { data } = await supabase
      .from("evaluations")
      .select("*")
      .eq("submission_id", subId)
      .single();

    if (data) setEvaluation(data);
  };

  // REALTIME LISTENER
  const subscribeToRealtime = (subId: string) => {
    supabase
      .channel("eval-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "evaluations",
          filter: `submission_id=eq.${subId}`,
        },
        (payload) => {
          setEvaluation(payload.new);
        }
      )
      .subscribe();
  };

  //SUBMIT FORM 
const handleSubmit = (e: FormEvent) => {
  e.preventDefault();
  if (!user) return;

  setFormError("");
  setFormSuccess("");

  if (!avatarFile) return setFormError("Profile picture is required");
  if (!zipFile) return setFormError("Source code ZIP file is required");
  if (!zipFile.name.endsWith(".zip"))
    return setFormError("File must be .zip");

  startTransition(async () => {
    try {
      const compressedAvatar = await compressImage(avatarFile);

      const avatarPath = `${user.id}-${Date.now()}.jpg`;
      const { error: avatarError } = await supabase.storage
        .from("avatars")
        .upload(avatarPath, compressedAvatar, {
          contentType: "image/jpeg",
        });

      if (avatarError) return setFormError("Image upload failed");

      const { data: avatarUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(avatarPath);

      const avatarUrl = avatarUrlData.publicUrl;

      const zipPath = `${user.id}-${Date.now()}.zip`;
      const { error: zipError } = await supabase.storage
        .from("source-code")
        .upload(zipPath, zipFile, {
          contentType: "application/zip",
        });

      if (zipError) return setFormError("ZIP upload failed");

      const { data: zipUrlData } = supabase.storage
        .from("source-code")
        .getPublicUrl(zipPath);

      const zipUrl = zipUrlData.publicUrl;

      //INSERT + RETURN THE ID
      const { data: inserted, error: subError } = await supabase
        .from("submissions")
        .insert({
          user_id: user.id,
          full_name: fullName,
          phone,
          location,
          email,
          hobby,
          profile_image_url: avatarUrl,
          source_code_url: zipUrl,
        })
        .select()
        .single();

      if (subError) return setFormError("Failed to save submission");

      //NOW WE HAVE THE REAL SUBMISSION ID
      setSubmissionId(inserted.id);

      //START REALTIME LISTENING NOW THAT WE HAVE THE ID
      subscribeToRealtime(inserted.id);

      setFormSuccess("Submission saved successfully 🎉");
    } catch (err) {
      setFormError("Unexpected error");
    }
  });
};


  //LOADING SCREEN
  if (loadingUser) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-black">
        <Loader2 size={40} className="text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex justify-center items-center bg-gradient-to-br from-black via-slate-900 to-black p-4">
      <motion.div
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-3xl bg-white/5 p-8 rounded-2xl shadow-xl border border-white/10"
      >
        <h1 className="text-3xl font-bold text-white mb-2">
          Developer Submission
        </h1>

        {/* ERRORS */}
        {formError && (
          <div className="text-red-400 mb-4 flex items-center gap-2">
            <AlertCircle /> {formError}
          </div>
        )}

        {formSuccess && (
          <div className="text-emerald-400 mb-4 flex items-center gap-2">
            <CheckCircle2 /> {formSuccess}
          </div>
        )}

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* NAME + PHONE */}
          <div className="grid md:grid-cols-2 gap-4">
            <InputField
              icon={<User />}
              value={fullName}
              setValue={setFullName}
              placeholder="Full Name"
            />
            <InputField
              icon={<Phone />}
              value={phone}
              setValue={setPhone}
              placeholder="Phone Number"
            />
          </div>

          {/* LOCATION + EMAIL */}
          <div className="grid md:grid-cols-2 gap-4">
            <InputField
              icon={<MapPin />}
              value={location}
              setValue={setLocation}
              placeholder="Location"
            />
            <InputField
              icon={<Mail />}
              value={email}
              setValue={setEmail}
              placeholder="Email Address"
            />
          </div>

          {/* HOBBY */}
          <div>
            <label className="text-gray-300 mb-1 text-sm">
              Your hobby (not coding)
            </label>
            <textarea
              required
              rows={3}
              value={hobby}
              onChange={(e) => setHobby(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white"
            />
          </div>

          {/* UPLOADS */}
          <div className="grid md:grid-cols-2 gap-4">
            <FileUpload
              label="Profile Picture (max 1MB)"
              icon={<ImageIcon className="text-blue-400" />}
              accept="image/*"
              onFileSelect={setAvatarFile}
              file={avatarFile}
            />
            <FileUpload
              label="Source Code ZIP"
              icon={<FileArchive className="text-blue-400" />}
              accept=".zip"
              onFileSelect={setZipFile}
              file={zipFile}
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
          >
            {isPending ? "Submitting…" : "Submit"}
          </button>
        </form>

        {/* STATUS BOX */}
        <div className="mt-10 p-6 bg-white/5 rounded-xl border border-white/10">
          <h2 className="text-xl text-white font-bold mb-3">Application Status</h2>

          {!evaluation ? (
            <p className="text-gray-400">⏳ Waiting for evaluator review…</p>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-300">Decision:</p>
              <p
                className={`text-lg font-semibold ${
                  evaluation.decision === "accepted"
                    ? "text-emerald-400"
                    : evaluation.decision === "rejected"
                    ? "text-red-400"
                    : "text-gray-300"
                }`}
              >
                {evaluation.decision === "accepted"
                  ? "🎉 Accepted — Welcome!"
                  : evaluation.decision === "rejected"
                  ? "❌ Rejected"
                  : "⏳ Pending"}
              </p>

              <p className="text-gray-300">Evaluator Feedback:</p>
              <div className="bg-black/30 p-4 rounded-xl text-gray-200 border border-white/10">
                {evaluation.feedback || "No feedback yet."}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ---------------- COMPONENTS ----------------
function InputField({ icon, value, setValue, placeholder }: any) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-3 text-gray-400">{icon}</span>
      <input
        type="text"
        required
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-black/30 border border-white/10 rounded-xl pl-10 pr-3 py-3 text-white"
      />
    </div>
  );
}

function FileUpload({ label, icon, accept, onFileSelect, file }: any) {
  return (
    <label className="bg-black/30 border border-dashed border-white/15 rounded-xl p-4 cursor-pointer flex flex-col gap-2">
      <span className="text-gray-300 text-sm flex items-center gap-2">
        {icon} {label}
      </span>
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFileSelect(f);
        }}
      />
      {file && (
        <span className="text-xs text-emerald-300 break-all">
          Selected: {file.name}
        </span>
      )}
    </label>
  );
}
