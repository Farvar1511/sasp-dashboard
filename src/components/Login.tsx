import { useState, useEffect } from 'react';
import axios from 'axios';

interface Props {
  onLogin: (user: any) => void;
}

export default function Login({ onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [background, setBackground] = useState('');

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_URL}/api/background`, {
      headers: { 'x-api-key': import.meta.env.VITE_API_KEY },
    })
      .then((res) => setBackground(res.data.url))
      .catch((error) => console.error('Error fetching background:', error));
  }, []);

  const handleLogin = async () => {
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/login`,
        { email, password },
        { headers: { 'x-api-key': import.meta.env.VITE_API_KEY } }
      );

      if (res.data.success) {
        onLogin(res.data.user);
      } else {
        alert("Invalid credentials.");
      }
    } catch (err) {
      console.error("Login error:", err);
      alert("Login error. Check the console for details.");
    }
  };

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
      {/* Background */}
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
          zIndex: -1, // Ensure the background is behind the form
          opacity: 0.5,
        }}
      />
      {/* Login Form */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          zIndex: 1, // Ensure the form is above the background
          position: 'relative',
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(34, 34, 34, 0.8)',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
          }}
        >
          <h2 style={{ color: '#FFD700', textAlign: 'center' }}>SASP Login</h2>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            style={{
              width: '100%',
              padding: '10px',
              margin: '10px 0',
              borderRadius: '5px',
              border: '1px solid #FFD700',
              backgroundColor: '#111',
              color: '#FFD700',
            }}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            style={{
              width: '100%',
              padding: '10px',
              margin: '10px 0',
              borderRadius: '5px',
              border: '1px solid #FFD700',
              backgroundColor: '#111',
              color: '#FFD700',
            }}
          />
          <button
            onClick={handleLogin}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '5px',
              border: '1px solid #FFD700',
              backgroundColor: '#222',
              color: '#FFD700',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Login
          </button>
        </div>
      </div>
    </div>
  );
}
