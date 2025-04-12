import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
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
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Pull additional user info from Firestore using email as doc ID
      const userDocRef = doc(db, 'users', firebaseUser.email!);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        onLogin(userData); // Send full user info back to app
      } else {
        alert('No user profile found in Firestore.');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Invalid email or password.');
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      alert("Please enter your email first.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      alert("📩 Password reset email sent!");
    } catch (err: any) {
      console.error("Forgot password error:", err);
      alert("Error sending reset email: " + err.message);
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
          }}
        >
          <h2 style={{ color: '#FFD700', textAlign: 'center' }}>SASP Login</h2>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            style={inputStyle}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            style={inputStyle}
          />
          <button onClick={handleLogin} style={buttonStyle}>
            Login
          </button>
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
