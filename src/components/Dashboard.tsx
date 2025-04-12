import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from './Layout';
import links from '../data/links'; // Import links data
import { images } from '../data/images'; // Import images data
import './Dashboard.css';

interface User {
  name: string;
  rank: string;
  email: string;
}

interface Link {
  Label: string;
  Url: string;
  Category: string;
}

export default function Dashboard({ user }: { user: User }) {
  const [background, setBackground] = useState('');
  const [time, setTime] = useState(new Date());
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Randomly select a background image from images.ts
    const randomImage = images[Math.floor(Math.random() * images.length)];
    setBackground(randomImage);

    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const hours = new Date().getHours();
    const greeting = hours < 12 ? "Good Morning" : hours < 18 ? "Good Afternoon" : "Good Evening";
    const lastName = user.name.split(' ').slice(-1)[0];
    const message = `${greeting}, ${user.rank} ${lastName}`;

    let index = 0;
    let current = '';
    const timeoutRef = { current: 0 } as { current: number };

    const type = () => {
      if (index < message.length) {
        current += message.charAt(index);
        setWelcomeMessage(current);
        index++;
        timeoutRef.current = window.setTimeout(type, 100);
      }
    };

    type();
    return () => clearTimeout(timeoutRef.current);
  }, [user]);

  return (
    <Layout>
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
      <div className="page-content">
        <div className="header-stack">
          <img
            src="https://i.gyazo.com/1e84a251bf8ec475f4849db73766eea7.png"
            alt="SASP Logo"
            className="topbar-logo"
          />
          <h1 className="title">San Andreas State Police</h1>
          <div className="star-icon">
            <img src="https://i.gyazo.com/6e5fafdef23c369d0151409fb79b44ca.png" alt="SASP Star" />
          </div>
          <div id="welcomeArea">{welcomeMessage}</div>
          <div className="clock-container">
            <div className="clock">
              <div>{time.toLocaleDateString('en-US', { weekday: 'long' })}</div>
              <div>{time.toLocaleDateString('en-US')}</div>
              <div>{time.toLocaleTimeString()}</div>
            </div>
          </div>
        </div>

        <div className="action-buttons">
          {links
            .filter((link) => link.Category === 'Resources')
            .map((link, i) => (
              <button key={i} className="roster-btn" onClick={() => setOverlayUrl(link.Url)}>
                {link.Label}
              </button>
            ))}
        </div>

        <div className="link-grid">
          {Object.entries(
            links.reduce((acc, link) => {
              acc[link.Category] = acc[link.Category] || [];
              acc[link.Category].push(link);
              return acc;
            }, {} as Record<string, Link[]>)
          ).map(([category, categoryLinks]) => (
            <div className="link-card" key={category}>
              <h2>{category}</h2>
              {categoryLinks.map((link, i) => (
                <button key={i} className="button-primary" onClick={() => setOverlayUrl(link.Url)}>
                  {link.Label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
