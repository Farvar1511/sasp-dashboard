import React, { useMemo, useState } from "react";
import Layout from "./Layout";
import links from "../data/links";
import classNames from "classnames";

interface LinkItem {
  Label: string;
  Url: string;
  Category: string;
}

const Documents: React.FC = () => {
  const [modalLink, setModalLink] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const groupedLinks = useMemo(() => {
    const filtered = links.filter((link) => {
      const term = searchTerm.toLowerCase();
      return (
        link.Label.toLowerCase().includes(term) ||
        link.Category.toLowerCase().includes(term)
      );
    });

    return filtered.reduce((acc, link) => {
      const category = link.Category || "Uncategorized";
      if (!acc[category]) acc[category] = [];
      acc[category].push(link);
      return acc;
    }, {} as { [key: string]: LinkItem[] });
  }, [searchTerm]);

  const categoryOrder = [
    "Standard Operating Procedures",
    "Training",
    "Resources",
    "Department of Justice",
  ];

  const sortedCategories = Object.keys(groupedLinks).sort((a, b) => {
    const indexA = categoryOrder.indexOf(a);
    const indexB = categoryOrder.indexOf(b);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.localeCompare(b);
  });

  return (
    <Layout>
      <div className="min-h-screen bg-cover bg-center bg-no-repeat text-white p-6 md:p-10 relative">
        {/* Page Content Container */}
        <div className="bg-black/60 backdrop-blur-sm rounded-xl p-6 md:p-10 max-w-screen-2xl mx-auto shadow-2xl w-full">
          <h1 className="text-4xl font-extrabold text-[#f3c700] mb-8 text-center">
            Documents & Resources
          </h1>

          {/* Search */}
          <div className="mb-10 max-w-md mx-auto">
            <input
              type="text"
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 rounded bg-black/70 border border-[#f3c700] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f3c700] transition-all"
            />
          </div>

          {/* Modal */}
          {modalLink && (
            <div
              className={classNames(
                "fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex flex-col animate-fadeIn"
              )}
            >
              <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-black">
                <h2 className="text-lg font-semibold text-[#f3c700]">
                  Document Viewer
                </h2>
                <button
                  onClick={() => setModalLink(null)}
                  className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-500"
                >
                  Close
                </button>
              </div>
              <iframe
                src={modalLink}
                className="w-full h-[90vh] border-none"
                title="Document Viewer"
              />
              <div className="flex justify-end p-4 border-t border-gray-700 bg-black">
                <a
                  href={modalLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-[#f3c700] hover:bg-yellow-400 text-black font-semibold rounded"
                >
                  Open in New Tab
                </a>
              </div>
            </div>
          )}

          {/* Categories & Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {sortedCategories.length === 0 && (
              <p className="text-center text-gray-400 col-span-full">
                No documents found.
              </p>
            )}
            {sortedCategories.map((category) => (
              <div
                key={category}
                className="bg-black/60 border border-gray-700 rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow duration-200"
              >
                <h2 className="text-xl font-bold text-[#f3c700] mb-4 border-b border-yellow-500 pb-2">
                  {category}
                </h2>
                <div className="space-y-3">
                  {groupedLinks[category].map((link) => (
                    <button
                      key={link.Label}
                      onClick={() => setModalLink(link.Url)}
                      className="block w-full text-left px-4 py-2 rounded border border-[#f3c700] text-[#f3c700] bg-black/80 hover:bg-[#f3c700] hover:text-black font-semibold text-sm transition-all duration-200"
                    >
                      {link.Label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Animation Keyframes */}
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.98); }
            to { opacity: 1; transform: scale(1); }
          }

          .animate-fadeIn {
            animation: fadeIn 0.3s ease-out;
          }
        `}
      </style>
    </Layout>
  );
};

export default Documents;
