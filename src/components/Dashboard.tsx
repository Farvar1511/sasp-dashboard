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
        className="fixed inset-0 bg-cover bg-center blur-sm opacity-50 -z-10"
        style={{ backgroundImage: `url(${background})` }}
      />
      <div className="min-h-screen bg-black text-yellow-400 font-sans px-4 py-8 flex flex-col items-center">
        {/* Header */}
        <div className="flex justify-between items-center w-full max-w-6xl mb-6">
          <img
            src="https://i.gyazo.com/1e84a251bf8ec475f4849db73766eea7.png"
            alt="SASP Logo"
            className="w-24 md:w-32 max-w-full drop-shadow-lg"
          />
          <a
            href="https://script.google.com/macros/s/AKfycbwtIXoTvpYIxdvWRY1CJ9sy0ZZayRqbx43R9_VeVF7BVxK_xVyrhh9_yd4MSgWbl71L6g/exec"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-yellow-400 text-black px-4 py-2 rounded-md font-semibold shadow hover:bg-yellow-300 transition"
          >
            Trooper Quick Reference
          </a>
        </div>

        {/* Title & Greeting */}
        <h1 className="text-4xl font-black uppercase text-center mb-1 drop-shadow-md">
          San Andreas State Police
        </h1>
        <p className="text-lg font-semibold text-center mb-4">{welcomeMessage}</p>

        {/* Clock */}
        <div className="bg-black/70 border border-yellow-400 rounded-lg p-4 text-center w-52 mb-8 shadow">
          <div className="font-mono text-md space-y-1">
            <div>{time.toLocaleDateString('en-US', { weekday: 'long' })}</div>
            <div>{time.toLocaleDateString('en-US')}</div>
            <div>{time.toLocaleTimeString()}</div>
          </div>
        </div>

        {/* Top Buttons */}
        <div className="flex flex-wrap justify-center gap-4 mb-10">
          {topLinks.map((link) => (
            <button
              key={link.Label}
              onClick={() => openModal(link.Url)}
              className="bg-yellow-400 text-black font-bold px-6 py-3 rounded-lg shadow hover:bg-yellow-300 transition"
            >
              {link.Label}
            </button>
          ))}
        </div>

        {/* Link Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl w-full">
          {Object.entries(groupedLinks).map(([category, items]) => (
            <div key={category} className="bg-black/70 border border-yellow-400 rounded-lg p-5 shadow-lg">
              <h3 className="text-xl font-bold mb-3">{category}</h3>
              {items.map((item) => (
                <button
                  key={item.Label}
                  onClick={() => openModal(item.Url)}
                  className="block w-full px-4 py-2 mb-2 bg-black border border-yellow-400 text-yellow-400 rounded-md font-semibold hover:bg-gray-900 hover:text-white transition"
                >
                  {item.Label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {overlayUrl && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col justify-start items-center pt-12 px-4">
          <div className="w-full max-w-6xl flex justify-end gap-2 mb-2">
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
          <div className="flex-grow w-full max-w-6xl h-[90vh] bg-black border border-yellow-400 rounded-lg overflow-hidden">
            <iframe src={overlayUrl} title="Modal Content" className="w-full h-full border-none"></iframe>
          </div>
        </div>
      )}
    </Layout>
  );
}
