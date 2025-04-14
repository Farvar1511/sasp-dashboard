import { useState, useEffect } from "react";
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
import { User } from "../types/User";
import { images } from "../data/images"; // Import images

interface Bulletin {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
}

interface BulletinsProps {
  user: User | any;
}

export default function Bulletins({ user }: BulletinsProps) {
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingBulletin, setEditingBulletin] = useState<Bulletin | null>(null);
  const [background, setBackground] = useState(""); // State for background image

  useEffect(() => {
    const fetchBulletins = async () => {
      try {
        const snapshot = await getDocs(collection(db, "bulletins"));
        const fetchedBulletins = snapshot.docs.map((doc) => {
          const data = doc.data();
          let createdAt: Date;

          if (data.createdAt instanceof Timestamp) {
            createdAt = data.createdAt.toDate();
          } else if (typeof data.createdAt === "string") {
            createdAt = new Date(data.createdAt);
          } else if (data.createdAt?.seconds) {
            createdAt = new Timestamp(
              data.createdAt.seconds,
              data.createdAt.nanoseconds
            ).toDate();
          } else {
            console.warn(
              `Bulletin ${doc.id} missing or has invalid createdAt:`,
              data.createdAt
            );
            createdAt = new Date(0);
          }

          return {
            id: doc.id,
            title: data.title ?? "Untitled",
            body: data.body ?? "",
            createdAt,
          };
        });

        fetchedBulletins.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        );

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

  const formatTimestamp = (date: Date | undefined): string => {
    if (!date || isNaN(date.getTime()) || date.getTime() === 0) {
      return "Date unknown";
    }
    return date?.toLocaleString?.() ?? "Date unknown";
  };

  return (
    <Layout>
      {/* Background Image */}
      {background && (
        <div
          className="fixed top-0 left-0 w-full h-full bg-cover bg-center opacity-40 -z-10 backdrop-blur-md"
          style={{
            backgroundImage: `url('${background}')`,
            backgroundRepeat: "no-repeat",
            backgroundSize: "cover",
            backgroundAttachment: "fixed",
          }}
        />
      )}

      <div className="page-content min-h-screen flex flex-col custom-scrollbar">
        <h1 className="text-3xl font-bold mb-6 text-[#f3c700]">📢 Bulletins</h1>

        {error && <p className="text-red-500 mb-4">{error}</p>}

        {bulletins.length === 0 ? (
          <p className="text-yellow-400 italic">No announcements yet.</p>
        ) : (
          <ul className="space-y-6 flex-grow">
            {bulletins.map((bulletin) => (
              <li
                key={bulletin.id}
                className="bg-black/80 p-4 rounded-md border border-yellow-400 shadow relative"
              >
                {editingBulletin?.id === bulletin.id ? (
                  <div className="bulletin-edit-form space-y-2">
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
                  <div>
                    <h3 className="bulletin-title">{bulletin.title}</h3>
                    <p className="bulletin-body">{bulletin.body}</p>
                    <small className="bulletin-meta">
                      Created at: {formatTimestamp(bulletin.createdAt)}
                    </small>
                    {user?.isAdmin && (
                      <div className="bulletin-actions flex gap-2 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          className="button-secondary text-xs p-1"
                          onClick={() => setEditingBulletin(bulletin)}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className="delete-button small p-1"
                          onClick={() => deleteBulletin(bulletin.id)}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  );
}
