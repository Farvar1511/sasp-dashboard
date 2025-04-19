import React, { useMemo, useState } from "react";
import Layout from "./Layout";
import links from "../data/links";

interface LinkItem {
  Label: string;
  Url: string;
  Category: string;
}

const Documents: React.FC = () => {
  const [modalLink, setModalLink] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const grouped = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return links
      .filter(
        (l) =>
          l.Label.toLowerCase().includes(term) ||
          l.Category.toLowerCase().includes(term)
      )
      .reduce((acc: Record<string, LinkItem[]>, l) => {
        const cat = l.Category || "Uncategorized";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(l);
        return acc;
      }, {});
  }, [searchTerm]);

  const order = [
    "Standard Operating Procedures",
    "Training",
    "Resources",
    "Department of Justice",
  ];
  const cats = Object.keys(grouped).sort((a, b) => {
    const ia = order.indexOf(a),
      ib = order.indexOf(b);
    if (ia !== -1 || ib !== -1) return ia === -1 ? 1 : ib === -1 ? -1 : ia - ib;
    return a.localeCompare(b);
  });

  return (
    <Layout>
      <div className="min-h-screen p-6 lg:p-12 text-white">
        <h1 className="text-4xl lg:text-5xl font-extrabold text-center text-[#f3c700] mb-8">
          Documents & Resources
        </h1>

        <div className="max-w-xl mx-auto mb-12">
          <input
            type="text"
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent border-b-2 border-white text-white placeholder-white/60 px-2 py-2 focus:border-[#f3c700] focus:outline-none transition"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {cats.length === 0 && (
            <p className="col-span-full text-center text-white/60">
              No documents found
            </p>
          )}

          {cats.map((cat) => (
            <div
              key={cat}
              className="flex flex-col bg-black bg-opacity-60 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition"
            >
              <div className="flex items-center bg-black bg-opacity-80 px-6 py-4 border-l-4 border-[#f3c700]">
                <h2 className="text-lg lg:text-xl font-semibold text-white">
                  {cat}
                </h2>
              </div>
              <div className="flex-1 overflow-y-auto py-4 px-6 space-y-3 max-h-[60vh] scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/30 hover:scrollbar-thumb-white/50 transition">
                {grouped[cat].map(({ Label, Url }) => (
                  <button
                    key={Label}
                    onClick={() => setModalLink(Url)}
                    className="w-full h-10 flex items-center px-4 border border-[#f3c700] rounded-lg text-sm lg:text-base font-medium uppercase tracking-wider text-white bg-transparent hover:bg-[#f3c700] hover:text-black transition"
                  >
                    {Label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {modalLink && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-95 flex flex-col animate-fadeIn">
            <div className="flex justify-between items-center px-6 py-4 border-b border-[#f3c700]">
              <h3 className="text-xl font-semibold text-[#f3c700]">
                Document Viewer
              </h3>
              <div className="flex items-center gap-4">
                <a
                  href={modalLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-[#f3c700] text-black font-semibold rounded hover:bg-yellow-400 transition text-sm"
                >
                  Open in New Tab
                </a>
                <button
                  onClick={() => setModalLink(null)}
                  className="px-3 py-1.5 bg-white text-black rounded hover:bg-white/90 transition text-sm"
                >
                  Close
                </button>
              </div>
            </div>
            <iframe
              src={modalLink}
              className="flex-1 w-full border-none"
              title="Document Viewer"
            />
          </div>
        )}

        <style>
          {`
            @keyframes fadeIn {
              from { opacity: 0; transform: scale(0.98); }
              to   { opacity: 1; transform: scale(1); }
            }
            .animate-fadeIn {
              animation: fadeIn 0.3s ease-out;
            }
          `}
        </style>
      </div>
    </Layout>
  );
};

export default Documents;
