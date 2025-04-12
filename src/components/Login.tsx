import { useEffect, useState } from "react";
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../firebase";
import { images } from "../data/images";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

const schema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function Login() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
  });
  const [background, setBackground] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const randomImage = images[Math.floor(Math.random() * images.length)];
    setBackground(randomImage);
  }, []);

  const onSubmit = async (data: { email: string; password: string }) => {
    setError(null);
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );
      console.log("User logged in:", userCredential.user);
    } catch (error: any) {
      console.error("Login error:", error);
      setError("Invalid email or password.");
    }
  };

  const handleForgotPassword = async () => {
    const emailInput = document.querySelector(
      'input[name="email"]'
    ) as HTMLInputElement;
    const email = emailInput?.value;
    if (!email) return setError("Please enter your email first.");
    try {
      await sendPasswordResetEmail(auth, email);
      alert("📩 Password reset email sent!");
    } catch (err: any) {
      setError("Error sending reset email: " + err.message);
    }
  };

  return (
    <div className="relative h-screen w-screen">
      <div
        className="absolute inset-0 bg-cover bg-center blur-sm opacity-50 z-0"
        style={{ backgroundImage: `url(${background})` }}
      />
      <div className="relative z-10 flex flex-col justify-center items-center h-full">
        <div className="login-form w-full max-w-md p-6 bg-gray-800 rounded-lg shadow-lg">
          <h2>SASP Login</h2>
          {error && <p>{error}</p>}
          <form onSubmit={handleSubmit(onSubmit)}>
            <input
              {...register("email")}
              placeholder="Email"
              className="w-full p-2 rounded-md bg-gray-700 text-yellow-400 border border-yellow-400 mb-2"
            />
            {errors.email && <p>{errors.email.message}</p>}
            <input
              {...register("password")}
              type="password"
              placeholder="Password"
              className="w-full p-2 rounded-md bg-gray-700 text-yellow-400 border border-yellow-400 mb-2"
            />
            {errors.password && <p>{errors.password.message}</p>}
            <button
              type="submit"
              className="w-full px-4 py-2 rounded-md bg-yellow-400 text-black font-semibold shadow hover:bg-yellow-300"
            >
              Login
            </button>
          </form>
          <p
            className="text-sm mt-4 text-yellow-400 text-center hover:underline cursor-pointer"
            onClick={handleForgotPassword}
          >
            Forgot your password?
          </p>
        </div>
      </div>
    </div>
  );
}
