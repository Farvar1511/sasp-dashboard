import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

export default function Login({ navigate }: { navigate: (path: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/");
    } catch (err) {
      setError("Invalid email or password.");
    }
  };

  return (
    <div className="login-container">
      {/* SASP Logo */}
      <div className="flex justify-center mb-6">
        <img
          src="https://i.gyazo.com/1e84a251bf8ec475f4849db73766eea7.png"
          alt="SASP Logo"
          className="h-16"
        />
      </div>

      <div className="login-form">
        <h2 className="text-3xl font-bold text-center text-[#f3c700] mb-6">
          State Police Dashboard
        </h2>
        <p className="text-center text-gray-400 mb-4">
          Please log in to access your dashboard.
        </p>
        {error && <p className="text-red-500 text-center mb-4">{error}</p>}
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            className="input"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            className="input"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="button-primary w-full">
            Log In
          </button>
        </form>
        <a
          href="/forgot-password"
          className="text-sm text-[#f3c700] hover:underline block text-center mt-4"
        >
          Forgot your password?
        </a>
      </div>
    </div>
  );
}
