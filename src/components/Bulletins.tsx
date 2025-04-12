import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import Layout from "./Layout";

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
        const snapshot = await getDocs(collection(db, "bulletins"));
        const fetchedBulletins = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Bulletin[];
        setBulletins(fetchedBulletins);
      } catch (err) {
        console.error("Error fetching bulletins:", err);
        setError("Failed to load bulletins.");
      }
    };

    fetchBulletins();
  }, []);

  const deleteBulletin = async (id: string) => {
    try {
      await deleteDoc(doc(db, "bulletins", id));
      setBulletins((prev) => prev.filter((bulletin) => bulletin.id !== id));
    } catch (err) {
      console.error("Error deleting bulletin:", err);
      setError("Failed to delete bulletin.");
    }
  };

  const saveBulletin = async () => {
    if (!editingBulletin) return;

    try {
      await updateDoc(doc(db, "bulletins", editingBulletin.id), {
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
      console.error("Error updating bulletin:", err);
      setError("Failed to update bulletin.");
    }
  };

  return (
    <Layout user={user}>
      <div className="page-content">
        <h1 className="text-3xl font-bold mb-6 text-[#f3c700]">📢 Bulletins</h1>

        {error && <p className="text-red-500 mb-4">{error}</p>}

        {bulletins.length === 0 ? (
          <p className="text-yellow-400 italic">No announcements yet.</p>
        ) : (
          <div className="bulletins">
            {bulletins.map((bulletin) => (
              <div key={bulletin.id} className="bulletin-item relative">
                {editingBulletin?.id === bulletin.id ? (
                  <div className="bulletin-edit-form">
                    <input
                      type="text"
                      className="input"
                      value={editingBulletin.title}
                      onChange={(e) =>
                        setEditingBulletin({
                          ...editingBulletin,
                          title: e.target.value,
                        })
                      }
                      placeholder="Bulletin Title"
                    />
                    <textarea
                      className="input"
                      rows={4}
                      value={editingBulletin.body}
                      onChange={(e) =>
                        setEditingBulletin({
                          ...editingBulletin,
                          body: e.target.value,
                        })
                      }
                      placeholder="Bulletin Body"
                    />
                    <div className="flex gap-2">
                      <button className="button-primary" onClick={saveBulletin}>
                        Save
                      </button>
                      <button
                        className="button-secondary"
                        onClick={() => setEditingBulletin(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h3 className="bulletin-title">{bulletin.title}</h3>
                    <p className="bulletin-body">{bulletin.body}</p>
                    <p className="bulletin-meta">
                      Created: {new Date(bulletin.createdAt).toLocaleString()}
                    </p>

                    {user?.isAdmin && (
                      <div className="bulletin-actions absolute top-2 right-2 opacity-0 hover:opacity-100 transition-opacity">
                        <button
                          className="button-secondary"
                          onClick={() => setEditingBulletin(bulletin)}
                        >
                          ✏️
                        </button>
                        <button
                          className="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-400"
                          onClick={() => deleteBulletin(bulletin.id)}
                        >
                          🗑
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
