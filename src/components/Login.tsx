import React, { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getRandomBackgroundImage } from "../utils/backgroundImage";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { user, login } = useAuth();
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string>("");

  useEffect(() => {
    if (!user) {
      setBackgroundImageUrl(getRandomBackgroundImage());
    }
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!email || !password) {
      setError("Please enter both email and password.");
      setLoading(false);
      return;
    }

    try {
      await login(email, password);
    } catch (err) {
      console.error("Login error:", err);
      if (err instanceof Error) {
        switch ((err as any).code) {
          case "auth/user-not-found":
          case "auth/wrong-password":
          case "auth/invalid-credential":
            setError("Invalid email or password.");
            break;
          case "auth/invalid-email":
            setError("Invalid email format.");
            break;
          default:
            setError("Failed to log in. Please try again.");
        }
      } else {
        setError("An unknown error occurred during login.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    return <Navigate to="/home" replace />;
  }

  if (!backgroundImageUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        Loading...
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center"
      style={{ backgroundImage: `url('${backgroundImageUrl}')` }}
    >
      <div className="bg-black bg-opacity-80 p-10 rounded-lg shadow-xl max-w-md w-full border border-[#f3c700]">
        <img
          src="/SASPLOGO2.png"
          alt="SASP Logo"
          className="w-24 h-24 mx-auto mb-6"
        />
        <h2 className="text-3xl font-bold text-center text-[#f3c700] mb-8">
          SASP Dashboard Login
        </h2>
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-white/80"
            >
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 bg-black/50 border border-[#f3c700] rounded-md text-white shadow-sm focus:outline-none focus:ring-[#f3c700] focus:border-[#f3c700] sm:text-sm"
              placeholder="your.email@sasp.gov"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-white/80"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 bg-black/50 border border-[#f3c700] rounded-md text-white shadow-sm focus:outline-none focus:ring-[#f3c700] focus:border-[#f3c700] sm:text-sm"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <p className="text-sm text-red-500 bg-red-900/50 border border-red-700 p-2 rounded">
              {error}
            </p>
          )}
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-black bg-[#f3c700] hover:bg-yellow-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#f3c700] disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out"
            >
              {loading ? "Signing In..." : "Sign In"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
