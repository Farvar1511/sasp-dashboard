import { useEffect, useState } from 'react';
import Layout from './Layout';
import links from '../data/links'; // Import links data
import { images } from '../data/images'; // Import images data
import './Dashboard.css';

interface User {
  name: string;
  rank: string;
  email: string;
}

export default function Dashboard({ user }: { user: User }) {
  const [background, setBackground] = useState('');
  const [time, setTime] = useState(new Date());
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);

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

  // Filter links into top bar and categorized groups, excluding specified categories
  const topBarCategories = ['Fleet Management', 'SASP Roster'];
  const excludedCategories = ['Community', 'Tools', 'Internal'];
  const topLinks = links.filter((link) => topBarCategories.includes(link.Label));
  const groupedLinks = links
    .filter((link) => !topBarCategories.includes(link.Label) && !excludedCategories.includes(link.Category))
    .reduce((acc, curr) => {
      if (!acc[curr.Category]) acc[curr.Category] = [];
      acc[curr.Category].push(curr);
      return acc;
    }, {} as Record<string, typeof links>);

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
          <div id="welcomeArea">{welcomeMessage}</div>
          <div className="clock-container">
            <div className="clock">
              <div>{time.toLocaleDateString('en-US', { weekday: 'long' })}</div>
              <div>{time.toLocaleDateString('en-US')}</div>
              <div>{time.toLocaleTimeString()}</div>
            </div>
          </div>
        </div>

        {/* 🔝 TOP BAR BUTTONS */}
        <div className="top-bar">
          {topLinks.map((link) => (
            <button
              key={link.Label}
              onClick={() => setOverlayUrl(link.Url)}
              className="top-bar-button"
            >
              {link.Label}
            </button>
          ))}
        </div>

        {/* 📚 CATEGORIZED LINK BOXES */}
        <div className="category-container">
          {Object.entries(groupedLinks).map(([category, items]) => (
            <div key={category} className="category-box">
              <h3>{category}</h3>
              {items.map((item) => (
                <button
                  key={item.Label}
                  onClick={() => setOverlayUrl(item.Url)}
                  className="category-link"
                >
                  {item.Label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Modal Overlay */}
      {overlayUrl && (
        <div className="overlay">
          <div className="overlay-content">
            <button className="close-button" onClick={() => setOverlayUrl(null)}>
              ✖
            </button>
            <iframe src={overlayUrl} title="Overlay Content" frameBorder="0"></iframe>
          </div>
        </div>
      )}
    </Layout>
  );
}
