import { useState, useEffect } from 'react';
import { collection, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
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
  const [editingBulletin, setEditingBulletin] = useState<Bulletin | null>(null);

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

  const deleteBulletin = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'bulletins', id));
      setBulletins((prev) => prev.filter((bulletin) => bulletin.id !== id));
    } catch (err) {
      console.error('Error deleting bulletin:', err);
      setError('Failed to delete bulletin.');
    }
  };

  const saveBulletin = async () => {
    if (!editingBulletin) return;

    try {
      await updateDoc(doc(db, 'bulletins', editingBulletin.id), {
        title: editingBulletin.title,
        body: editingBulletin.body,
      });
      setBulletins((prev) =>
        prev.map((bulletin) =>
          bulletin.id === editingBulletin.id ? editingBulletin : bulletin
        )
      );
      setEditingBulletin(null);
    } catch (err) {
      console.error('Error updating bulletin:', err);
      setError('Failed to update bulletin.');
    }
  };

  return (
    <Layout user={user}>
      <div className="page-content">
        <h1>Bulletins</h1>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <ul>
          {bulletins.map((bulletin) => (
            <li key={bulletin.id}>
              {editingBulletin?.id === bulletin.id ? (
                <div>
                  <input
                    type="text"
                    value={editingBulletin.title}
                    onChange={(e) =>
                      setEditingBulletin({ ...editingBulletin, title: e.target.value })
                    }
                  />
                  <textarea
                    value={editingBulletin.body}
                    onChange={(e) =>
                      setEditingBulletin({ ...editingBulletin, body: e.target.value })
                    }
                  />
                  <button onClick={saveBulletin}>Save</button>
                  <button onClick={() => setEditingBulletin(null)}>Cancel</button>
                </div>
              ) : (
                <div>
                  <h3>{bulletin.title}</h3>
                  <p>{bulletin.body}</p>
                  <small>Created at: {new Date(bulletin.createdAt).toLocaleString()}</small>
                  {user.isAdmin && (
                    <div>
                      <button onClick={() => setEditingBulletin(bulletin)}>Edit</button>
                      <button onClick={() => deleteBulletin(bulletin.id)}>Delete</button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  );
}
