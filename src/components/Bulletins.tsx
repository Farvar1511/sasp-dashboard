import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db as dbFirestore } from "../firebase";
import Layout from "./Layout";
import { formatTimestampForDisplay } from "../utils/timeHelpers";
import { formatDisplayRankName } from "../utils/userHelpers"; // Import new formatter

interface Bulletin {
  id: string;
  title: string;
  content: string;
  postedByName?: string; // Store name
  postedByRank?: string; // Store rank
  createdAt: Timestamp;
}

const Bulletins: React.FC = () => {
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [loading, setLoading] = useState(true);

  // Helper to render bulletin content safely
  const renderContent = (content: string) => {
    return content
      ? content
          .replace(/\n/g, "<br />")
          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // Bold
          .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, "<em>$1</em>") // Italic (handle single asterisks carefully)
          .replace(/<u>(.*?)<\/u>/g, "<u>$1</u>") // Underline
          // Allow span tags for color and size
          .replace(
            /<span style="color: (.*?);">(.*?)<\/span>/g,
            '<span style="color: $1;">$2</span>'
          )
          .replace(
            /<span style="font-size: (.*?)px;">(.*?)<\/span>/g,
            '<span style="font-size: $1px;">$2</span>'
          )
      : "No content";
  };

  useEffect(() => {
    const fetchBulletins = async () => {
      try {
        const bulletinsQuery = query(
          collection(dbFirestore, "bulletins"),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(bulletinsQuery);
        const fetchedBulletins = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Bulletin[]; // Use updated interface
        setBulletins(fetchedBulletins);
      } catch (error) {
        console.error("Error fetching bulletins:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBulletins();
  }, []);

  return (
    <Layout>
      <div className="page-content p-6">
        <h1 className="text-2xl font-bold text-yellow-400 mb-4">Bulletins</h1>
        {loading ? (
          <p className="text-gray-400">Loading bulletins...</p>
        ) : bulletins.length === 0 ? (
          <p className="text-gray-400">No bulletins available.</p>
        ) : (
          <div className="space-y-6">
            {bulletins.map((bulletin) => (
              <div
                key={bulletin.id}
                className="bg-gray-800 p-4 rounded border border-gray-700"
              >
                <h2 className="text-lg font-bold text-yellow-300 mb-2">
                  {bulletin.title}
                </h2>
                <div
                  className="prose prose-yellow max-w-none mb-3"
                  dangerouslySetInnerHTML={{
                    __html: renderContent(bulletin.content),
                  }}
                />
                <p className="text-xs text-gray-400 mt-2 border-t border-gray-700 pt-2">
                  Posted by{" "}
                  {formatDisplayRankName(
                    bulletin.postedByRank,
                    bulletin.postedByName
                  )}{" "}
                  on {formatTimestampForDisplay(bulletin.createdAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Bulletins;
