import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { hasAdminPrivileges } from '../data/users'; // Corrected import statement
import Layout from './Layout';
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
  const [links, setLinks] = useState<Link[]>([]);
  const [background, setBackground] = useState('');
  const [time, setTime] = useState(new Date());
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const navigate = useNavigate();

  const everfallUrl = 'https://www.everfallcommunity.com';
  const trooperUrl = 'https://script.google.com/macros/s/AKfycbwtIXoTvpYIxdvWRY1CJ9sy0ZZayRqbx43R9_VeVF7BVxK_xVyrhh9_yd4MSgWbl71L6g/exec';
  const rosterUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQY_reY_QNw_faOG9LvgJm0TiDujgCxXD3KXQQ37e6PMY44E9aRIQ_g-tUThtvnJQ1LHzSrZHuQRYyw/pubhtml?gid=1777737199';
  const fleetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQBCfEXdC6jygMC25n1545ZZiNcWwzljaI09-1lqZjd5AHJrRoX38ecyDuZk_GMipcGpXkkuMF3XYR8/pubhtml?gid=0';

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_URL}/api/links`, {
      headers: { 'x-api-key': import.meta.env.VITE_API_KEY },
    })
      .then(res => setLinks(res.data))
      .catch(err => console.error('Error fetching links:', err));

    axios.get(`${import.meta.env.VITE_API_URL}/api/background`, {
      headers: { 'x-api-key': import.meta.env.VITE_API_KEY },
    })
      .then(res => setBackground(res.data.url))
      .catch(err => console.error('Error fetching background:', err));

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
          <button className="roster-btn" onClick={() => setOverlayUrl(rosterUrl)}>SASP Roster</button>
          <button className="roster-btn" onClick={() => setOverlayUrl(fleetUrl)}>Fleet Management</button>
        </div>

        <div className="link-grid">
          {Object.entries(links.reduce((acc, link) => {
            acc[link.Category] = acc[link.Category] || [];
            acc[link.Category].push(link);
            return acc;
          }, {} as Record<string, Link[]>)).map(([category, links]) => (
            <div className="link-card" key={category}>
              <h2>{category}</h2>
              {links.map((link, i) => (
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
