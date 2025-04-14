import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import Layout from "./Layout";

interface Bulletin {
  id: string;
  title: string;
  body: string;
  createdAt: Timestamp;
}

export default function AdminBulletins() {
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [editingBulletin, setEditingBulletin] = useState<Bulletin | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    <Layout>
      <div className="page-content">
        <h1 className="text-3xl font-bold mb-6">Admin Bulletins</h1>
        {error && <p className="text-red-500">{error}</p>}
        <ul className="space-y-4">
          {bulletins.map((bulletin) => (
            <li key={bulletin.id} className="p-4 bg-gray-800 rounded shadow">
              {editingBulletin?.id === bulletin.id ? (
                <div>
                  <input
                    type="text"
                    value={editingBulletin.title}
                    onChange={(e) =>
                      setEditingBulletin({
                        ...editingBulletin,
                        title: e.target.value,
                      })
                    }
                    className="input mb-2"
                  />
                  <textarea
                    value={editingBulletin.body}
                    onChange={(e) =>
                      setEditingBulletin({
                        ...editingBulletin,
                        body: e.target.value,
                      })
                    }
                    className="input mb-2"
                  />
                  <button onClick={saveBulletin} className="button-primary">
                    Save
                  </button>
                  <button
                    onClick={() => setEditingBulletin(null)}
                    className="button-secondary ml-2"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div>
                  <h3 className="text-xl font-bold">{bulletin.title}</h3>
                  <p>{bulletin.body}</p>
                  <div className="mt-2">
                    <button
                      onClick={() => setEditingBulletin(bulletin)}
                      className="button-secondary"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteBulletin(bulletin.id)}
                      className="button-danger ml-2"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  );
}
