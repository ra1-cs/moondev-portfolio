"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, Eye, Mail, User, Calendar } from "lucide-react";

type Submission = {
  id: string;
  full_name: string;
  email: string;
  profile_image_url: string | null;
  created_at: string;
};

export default function EvaluatorDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadEvaluator = async () => {
      // 1) check auth
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.replace("/login");
        return;
      }

      const userId = data.user.id;

      // 2) check role
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (profileError || !profile || profile.role !== "evaluator") {
        router.replace("/login");
        return;
      }

      // 3) load submissions
      const { data: subs, error: subsError } = await supabase
        .from("submissions")
        .select("*")
        .order("created_at", { ascending: false });

      if (subsError) {
        console.error(subsError);
        setError("Failed to load submissions");
        setLoading(false);
        return;
      }

      setSubmissions((subs || []) as Submission[]);
      setLoading(false);
    };

    loadEvaluator();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-slate-900 to-black">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-black p-6 md:p-8">
      <h1 className="text-3xl font-bold text-white mb-2">
        Evaluator Dashboard
      </h1>
      <p className="text-gray-400 mb-6 text-sm">
        Click on a card to review a developer submission.
      </p>

      {error && <p className="text-red-400 mb-4 text-sm">{error}</p>}

      {submissions.length === 0 ? (
        <p className="text-gray-400 text-sm">No submissions yet.</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {submissions.map((sub) => (
            <motion.div
              key={sub.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl hover:border-blue-500/40 transition cursor-pointer"
              onClick={() => router.push(`/evaluator/review/${sub.id}`)}
            >
              {sub.profile_image_url && (
                <img
                  src={sub.profile_image_url}
                  className="w-full h-40 object-cover rounded-xl mb-4 border border-white/10"
                  alt="Developer avatar"
                />
              )}

              <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                <User size={18} className="text-blue-400" /> {sub.full_name}
              </h2>

              <p className="text-gray-400 flex items-center gap-2 text-sm">
                <Mail size={16} /> {sub.email}
              </p>

              <p className="text-gray-500 text-xs flex items-center gap-2 mt-2">
                <Calendar size={14} />{" "}
                {new Date(sub.created_at).toLocaleString()}
              </p>

              <button className="mt-4 w-full py-2 text-center bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center gap-2 transition">
                <Eye size={18} /> Review
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
