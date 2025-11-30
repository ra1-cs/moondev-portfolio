"use client";

import { useState, useTransition } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleLogin = (e: any) => {
    e.preventDefault();
    setError("");

    startTransition(async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) return setError("Invalid credentials");

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (profile.role === "developer") router.push("/submit");
      else if (profile.role === "evaluator") router.push("/evaluator");
    });
  };

  return (
    <div className="min-h-screen flex justify-center items-center bg-gradient-to-br from-black via-slate-900 to-black relative overflow-hidden">

      {/* Subtle ambient glow */}
      <div className="absolute w-[600px] h-[600px] bg-blue-500/20 blur-[180px] rounded-full -top-40 -left-40"></div>
      <div className="absolute w-[500px] h-[500px] bg-blue-600/10 blur-[160px] rounded-full bottom-0 right-0"></div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative w-full max-w-md px-8 py-10 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl"
      >
        <h1 className="text-center text-3xl font-bold text-white mb-2 tracking-wide">
          Sign In
        </h1>
        <p className="text-center text-gray-400 mb-8 text-sm">
          Please enter your account details
        </p>

        {error && (
          <p className="text-red-400 text-sm text-center mb-4">{error}</p>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
        
          {/* EMAIL */}
          <div className="relative">
            <Mail className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              type="email"
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Email"
              className="w-full bg-black/30 border border-white/10 text-white placeholder-gray-400 rounded-xl px-10 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition"
            />
          </div>

          {/* PASSWORD */}
          <div className="relative">
            <Lock className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              type={showPass ? "text" : "password"}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Password"
              className="w-full bg-black/30 border border-white/10 text-white placeholder-gray-400 rounded-xl px-10 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition"
            />
            <button
              type="button"
              onClick={() => setShowPass((prev) => !prev)}
              className="absolute right-3 top-3 text-gray-400 hover:text-white transition"
            >
              {showPass ? <EyeOff /> : <Eye />}
            </button>
          </div>

          {/* LOGIN BUTTON */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 transition text-white font-semibold rounded-xl shadow-lg"
          >
            {isPending ? "Authenticating..." : "Login"}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
