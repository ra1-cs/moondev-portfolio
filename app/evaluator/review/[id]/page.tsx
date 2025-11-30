"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Loader2,
  User,
  Phone,
  MapPin,
  Mail,
  FileArchive,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id: submissionId } = use(params);

  const [loading, setLoading] = useState(true);
  const [evaluator, setEvaluator] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [decision, setDecision] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");


  // PROTECT ROUTE — Only evaluator allowed
  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        router.replace("/login");
        return;
      }

      const uid = data.user.id;

      // check evaluator role
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", uid)
        .single();

      if (!profile || profile.role !== "evaluator") {
        router.replace("/login");
        return;
      }

      setEvaluator(uid);
      loadSubmission();
    };

    loadUser();
  }, []);


  // LOAD SUBMISSION DATA
  const loadSubmission = async () => {
    const { data } = await supabase
      .from("submissions")
      .select("*")
      .eq("id", submissionId)
      .single();

    if (data) setSubmission(data);

    // Load existing evaluation
    const { data: existingEval } = await supabase
      .from("evaluations")
      .select("*")
      .eq("submission_id", submissionId)
      .single();

    if (existingEval) {
      setDecision(existingEval.decision || "");
      setFeedback(existingEval.feedback || "");
    }

    setLoading(false);
  };
  // SAVE EVALUATION + SEND EMAIL

  const handleDecision = async (state: "accepted" | "rejected") => {
    setSaving(true);

    // Save evaluation in DB
    const { error } = await supabase.from("evaluations").upsert({
      submission_id: submissionId,
      evaluator_id: evaluator,
      decision: state,
      feedback,
    });

    if (error) {
      console.error(error);
      setSaveMessage("❌ Error saving decision");
      setSaving(false);
      return;
    }

    // Update UI state
    setSaveMessage("✅ Decision saved!");
    setDecision(state);

    // SEND EMAIL using Supabase Edge Function
    try {
      await fetch(
        
        "https://ipxetiyqxraiybjmageq.supabase.co/functions/v1/send-email",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            to: submission.email,
            subject:
              state === "accepted"
                ? "🎉 Welcome to MoonDev!"
                : "MoonDev Application Result",
            message:
              state === "accepted"
                ? `Congratulations ${submission.full_name}! 🎉\n\nYou have been accepted to MoonDev.\n\nEvaluator feedback: ${feedback}`
                : `Hello ${submission.full_name},\n\nThank you for your application.\nUnfortunately, you were not selected.\n\nEvaluator feedback: ${feedback}`,
          }),
        }
      );
    } catch (err) {
      console.error("Email error:", err);
    }

    setSaving(false);
  };


  if (loading || !submission) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-black">
        <Loader2 size={40} className="text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-black p-6 flex justify-center">
      <div className="w-full max-w-3xl bg-white/5 backdrop-blur-xl shadow-2xl rounded-2xl p-8 border border-white/10">

        <h1 className="text-3xl font-bold text-white mb-6">
          Review Submission
        </h1>

        {/* IMAGE */}
        <img
          src={submission.profile_image_url}
          alt="avatar"
          className="w-40 h-40 rounded-xl object-cover border border-white/10 mb-6"
        />

        {/* INFO GRID */}
        <div className="grid md:grid-cols-2 gap-5 mb-8">
          <InfoItem icon={<User />} label="Full Name" value={submission.full_name} />
          <InfoItem icon={<Phone />} label="Phone" value={submission.phone} />
          <InfoItem icon={<MapPin />} label="Location" value={submission.location} />
          <InfoItem icon={<Mail />} label="Email" value={submission.email} />
        </div>

        {/* Hobby */}
        <div className="mb-6">
          <p className="text-gray-300 mb-2 font-medium">What they love doing 💡</p>
          <div className="p-4 bg-black/40 border border-white/10 rounded-xl text-gray-200">
            {submission.hobby}
          </div>
        </div>

        {/* DOWNLOAD ZIP */}
        <a
          href={submission.source_code_url}
          target="_blank"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl shadow mb-8 w-fit transition"
        >
          <FileArchive size={20} />
          Download Source Code
        </a>

        {/* FEEDBACK */}
        <div className="mb-4">
          <label className="text-gray-300">Evaluator Feedback</label>
          <textarea
            rows={4}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="w-full mt-2 bg-black/30 text-white p-3 rounded-xl border border-white/10 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        {/* DECISION BUTTONS */}
        <div className="flex gap-4 mt-4">
          <button
            onClick={() => handleDecision("accepted")}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl transition"
          >
            <CheckCircle2 />
            Welcome to the Team
          </button>

          <button
            onClick={() => handleDecision("rejected")}
            className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl transition"
          >
            <XCircle />
            We Are Sorry
          </button>
        </div>

        {saveMessage && (
          <p className="text-gray-300 mt-4">{saveMessage}</p>
        )}
      </div>
    </div>
  );
}

// COMPONENT FOR INFO ROWS
function InfoItem({ icon, label, value }: any) {
  return (
    <div className="bg-black/30 border border-white/10 rounded-xl p-4">
      <p className="text-gray-400 text-sm mb-1">{label}</p>
      <div className="flex items-center gap-2 text-white">
        {icon}
        <span>{value}</span>
      </div>
    </div>
  );
}
