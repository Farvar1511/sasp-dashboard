import { useEffect, useState } from 'react';
import Layout from './Layout';
import links from '../data/links';
import { images } from '../data/images';

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
    const randomImage = images[Math.floor(Math.random() * images.length)];
    setBackground(randomImage);

    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const hours = new Date().getHours();
    const greeting = hours < 12 ? 'Good Morning' : hours < 18 ? 'Good Afternoon' : 'Good Evening';
    const lastName = user.name.split(' ').slice(-1)[0];
    setWelcomeMessage(`${greeting}, ${user.rank} ${lastName}`);
  }, [user]);

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

  const openModal = (url: string) => {
    setOverlayUrl(url);
  };

  const closeModal = () => {
    setOverlayUrl(null);
  };

  return (
    <Layout user={user}>
      <div
        className="fixed inset-0 bg-cover bg-center blur-sm opacity-50"
        style={{ backgroundImage: `url(${background})` }}
      />
      <div className="flex flex-col items-center px-4">
        <div className="flex justify-between items-center w-full max-w-5xl mt-6">
          <img
            src="https://i.gyazo.com/1e84a251bf8ec475f4849db73766eea7.png"
            alt="SASP Logo"
            className="w-32 md:w-48 drop-shadow-lg"
          />
          <a
            href="https://script.google.com/macros/s/AKfycbwtIXoTvpYIxdvWRY1CJ9sy0ZZayRqbx43R9_VeVF7BVxK_xVyrhh9_yd4MSgWbl71L6g/exec"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm font-bold text-black bg-yellow-400 rounded-lg shadow-md hover:bg-yellow-300 transition"
          >
            Trooper Quick Reference
          </a>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold uppercase text-yellow-400 mt-4">
          San Andreas State Police
        </h1>
        <div className="text-lg font-bold text-yellow-400 mt-2">{welcomeMessage}</div>
        <div className="bg-black/70 border border-yellow-400 rounded-lg w-48 h-32 flex justify-center items-center text-center p-2 mt-4">
          <div className="text-yellow-400 text-lg">
            <div>{time.toLocaleDateString('en-US', { weekday: 'long' })}</div>
            <div>{time.toLocaleDateString('en-US')}</div>
            <div>{time.toLocaleTimeString()}</div>
          </div>
        </div>

        <div className="flex justify-center gap-4 mt-6">
          {topLinks.map((link) => (
            <button
              key={link.Label}
              onClick={() => openModal(link.Url)}
              className="px-4 py-2 text-sm font-bold text-black bg-yellow-400 rounded-lg shadow-md hover:bg-yellow-300 transition"
            >
              {link.Label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {Object.entries(groupedLinks).map(([category, items]) => (
            <div key={category} className="bg-black/70 border border-yellow-400 rounded-lg p-4 shadow-md">
              <h3 className="text-lg font-bold text-yellow-400 mb-2">{category}</h3>
              {items.map((item) => (
                <button
                  key={item.Label}
                  onClick={() => openModal(item.Url)}
                  className="block w-full bg-black text-yellow-400 border border-yellow-400 rounded-lg px-4 py-2 mb-2 font-semibold text-center hover:bg-gray-800 hover:text-white transition"
                >
                  {item.Label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {overlayUrl && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col justify-start items-center pt-12 border-2 border-yellow-400">
          <div className="w-full flex justify-end gap-2 px-4 py-2">
            <a
              href={overlayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-yellow-400 text-black px-4 py-2 rounded-lg font-bold hover:bg-yellow-300 transition"
            >
              🔗 Open in New Tab
            </a>
            <button
              className="bg-red-500 text-white px-4 py-2 rounded-full font-bold hover:bg-red-400 transition"
              onClick={closeModal}
            >
              ✕
            </button>
          </div>
          <div className="flex-grow w-11/12 h-5/6 bg-black border border-yellow-400 rounded-lg overflow-hidden">
            <iframe src={overlayUrl} title="Modal Content" className="w-full h-full border-none"></iframe>
          </div>
        </div>
      )}
    </Layout>
  );
}
