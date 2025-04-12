import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import Layout from './Layout';

interface Bulletin {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

export default function Bulletins({ user }: { user: any }) {
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBulletins = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'bulletins'));
        const fetchedBulletins = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Bulletin[];
        setBulletins(fetchedBulletins);
      } catch (err) {
        console.error('Error fetching bulletins:', err);
        setError('Failed to load bulletins.');
      }
    };

    fetchBulletins();
  }, []);

  return (
    <Layout user={user}>
      <div className="page-content">
        <h1>Bulletins</h1>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <ul>
          {bulletins.map((bulletin) => (
            <li key={bulletin.id}>
              <h3>{bulletin.title}</h3>
              <p>{bulletin.body}</p>
              <small>Created at: {new Date(bulletin.createdAt).toLocaleString()}</small>
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  );
}
