import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import { backgroundImages } from "../data/images";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate(); // Initialize useNavigate
  const [bgUrl, setBgUrl] = useState("");

  useEffect(() => {
    const lastBg = sessionStorage.getItem("loginBg");
    if (lastBg) {
      setBgUrl(lastBg);
    } else {
      const randomIndex = Math.floor(Math.random() * backgroundImages.length);
      const newBg = backgroundImages[randomIndex];
      setBgUrl(newBg);
      sessionStorage.setItem("loginBg", newBg);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Login successful!");
      navigate("/"); // Redirect to home page on success
    } catch (error: any) {
      console.error("Login failed:", error);
      // Display specific error messages if available
      let errorMessage = "Login failed. Please check your credentials.";
      if (error.code) {
        switch (error.code) {
          case "auth/user-not-found":
          case "auth/wrong-password":
          case "auth/invalid-credential": // Catch generic invalid credential error
            errorMessage = "Invalid email or password.";
            break;
          case "auth/invalid-email":
            errorMessage = "Invalid email format.";
            break;
          case "auth/too-many-requests":
            errorMessage = "Too many login attempts. Please try again later.";
            break;
          // Add other specific Firebase Auth error codes as needed
        }
      }
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center"
      style={{ backgroundImage: `url(${bgUrl})` }}
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
