import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { images } from "../data/images"; // Import the images array

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string>("");

  useEffect(() => {
    if (user) {
      navigate("/");
    } else {
      const randomIndex = Math.floor(Math.random() * images.length);
      setBackgroundImageUrl(images[randomIndex]);
    }
  }, [user, navigate]);

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
      await signInWithEmailAndPassword(auth, email, password);
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
    return null;
  }

  if (!backgroundImageUrl) {
    return null;
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center"
      style={{ backgroundImage: `url('${backgroundImageUrl}')` }}
    >
      <div className="bg-black/75 p-8 rounded-lg shadow-xl w-full max-w-md space-y-6">
        <div className="text-center">
          <img
            src="https://i.gyazo.com/1e84a251bf8ec475f4849db73766eea7.png"
            alt="SASP Logo"
            className="w-40 h-auto mx-auto mb-4"
          />
          <h2 className="text-2xl font-bold text-yellow-400">
            SASP Portal Login
          </h2>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-300"
            >
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input mt-1 w-full"
              placeholder="trooper@sasp.gov"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-300"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input mt-1 w-full"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full button-primary disabled:opacity-50"
            >
              {loading ? "Logging In..." : "Log In"}
            </button>
          </div>
        </form>
      </div>
      <style>{`
        .input {
          background-color: #1f2937;
          color: white;
          border: 1px solid #4b5563;
          border-radius: 0.375rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          line-height: 1.25rem;
        }
        .input:focus {
          outline: none;
          border-color: #f3c700;
          box-shadow: 0 0 0 2px rgba(243, 199, 0, 0.5);
        }
      `}</style>
    </div>
  );
};

export default Login;
