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

  // Filter links into top bar and categorized groups
  const topBarCategories = ['Fleet Management', 'SASP Roster'];
  const topLinks = links.filter((link) => topBarCategories.includes(link.Label));
  const groupedLinks = links
    .filter((link) => !topBarCategories.includes(link.Label))
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

        {/* 🔝 TOP BAR BUTTONS */}
        <div className="top-bar">
          {topLinks.map((link) => (
            <a
              key={link.Label}
              href={link.Url}
              target="_blank"
              rel="noopener noreferrer"
              className="top-bar-button"
            >
              {link.Label}
            </a>
          ))}
        </div>

        {/* 📚 CATEGORIZED LINK BOXES */}
        <div className="category-container">
          {Object.entries(groupedLinks).map(([category, items]) => (
            <div key={category} className="category-box">
              <h3>{category}</h3>
              {items.map((item) => (
                <a
                  key={item.Label}
                  href={item.Url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="category-link"
                >
                  {item.Label}
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
