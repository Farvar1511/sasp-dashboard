import { useEffect, useState } from 'react';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { images } from '../data/images';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

interface Props {}

export default function Login() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });
  const [background, setBackground] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const randomImage = images[Math.floor(Math.random() * images.length)];
    setBackground(randomImage);
  }, []);

  const onSubmit = async (data: { email: string; password: string }) => {
    setError(null); // Clear previous errors
    try {
      const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
      console.log('User logged in:', userCredential.user);
      // Redirect or handle successful login here
    } catch (error: any) {
      console.error('Login error:', error);
      setError('Invalid email or password.');
    }
  };

  const handleForgotPassword = async () => {
    const emailInput = document.querySelector('input[name="email"]') as HTMLInputElement;
    const email = emailInput?.value;

    if (!email) {
      setError('Please enter your email first.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      alert('📩 Password reset email sent!');
    } catch (err: any) {
      console.error('Forgot password error:', err);
      setError('Error sending reset email: ' + err.message);
    }
  };

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: `url(${background})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(3px)',
          zIndex: -1,
          opacity: 0.5,
        }}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          zIndex: 1,
          position: 'relative',
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(34, 34, 34, 0.8)',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
            maxWidth: '400px',
            width: '90%',
          }}
        >
          <h2 style={{ color: '#FFD700', textAlign: 'center' }}>SASP Login</h2>
          {error && <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>}
          <form onSubmit={handleSubmit(onSubmit)}>
            <input {...register('email')} placeholder="Email" style={inputStyle} />
            {errors.email && <p style={{ color: 'red', textAlign: 'center' }}>{errors.email.message}</p>}
            <input {...register('password')} placeholder="Password" type="password" style={inputStyle} />
            {errors.password && <p style={{ color: 'red', textAlign: 'center' }}>{errors.password.message}</p>}
            <button type="submit" style={buttonStyle}>
              Login
            </button>
          </form>
          <p
            style={{
              marginTop: '10px',
              color: '#FFD700',
              textDecoration: 'underline',
              cursor: 'pointer',
              textAlign: 'center',
            }}
            onClick={handleForgotPassword}
          >
            Forgot your password?
          </p>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '10px',
  margin: '10px 0',
  borderRadius: '5px',
  border: '1px solid #FFD700',
  backgroundColor: '#111',
  color: '#FFD700',
};

const buttonStyle = {
  width: '100%',
  padding: '10px',
  borderRadius: '5px',
  border: '1px solid #FFD700',
  backgroundColor: '#222',
  color: '#FFD700',
  cursor: 'pointer',
  fontWeight: 'bold',
};
