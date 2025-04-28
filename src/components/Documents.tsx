import React, { useMemo, useState } from "react";
import Layout from "./Layout";
import links from "../data/links";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { CardHeader, CardTitle, CardContent } from "./ui/card";

interface LinkItem {
  Label: string;
  Url: string;
  Category: string;
}

const Documents: React.FC = () => {
  const [modalLink, setModalLink] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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
      <div className="min-h-screen p-6 lg:p-12 text-white space-y-8">
        <h1 className="text-4xl lg:text-5xl font-extrabold text-center text-[#f3c700]">
          Documents & Resources
        </h1>

        <div className="w-full max-w-xl mx-auto">
          <Input
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-card text-foreground"
          />
        </div>

        <div className="w-full max-w-5xl mx-auto grid grid-cols-1 gap-8">
          {cats.length === 0 && (
            <p className="text-center text-white/60">No documents found</p>
          )}

          {cats.map((cat) => (
            <div key={cat} className="bg-black bg-opacity-60 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition">
              <div
                onClick={() => setExpanded(prev => ({ ...prev, [cat]: !prev[cat] }))}
                className="cursor-pointer bg-black bg-opacity-80 border-l-4 border-[#f3c700] px-6 py-4"
              >
                <h2 className="text-lg lg:text-xl font-semibold text-white">{cat}</h2>
              </div>
              {expanded[cat] && (
                <Card className="bg-black bg-opacity-60">
                  <CardContent className="py-4 px-6 space-y-3 max-h-[60vh] overflow-y-auto">
                    {grouped[cat].map(({ Label, Url }) => (
                      <Button
                        key={Label}
                        onClick={() => setModalLink(Url)}
                        className="w-full h-10 flex items-center px-4 border border-[#f3c700] rounded-lg text-sm lg:text-base font-medium uppercase tracking-wider text-white bg-transparent hover:bg-[#f3c700] hover:text-black transition"
                      >
                        {Label}
                      </Button>
                    ))}
                  </CardContent>
                </Card>
              )}
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
                <Button variant="default" asChild>
                  <a
                    href={modalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-[#f3c700] text-black font-semibold rounded hover:bg-yellow-400 transition text-sm"
                  >
                    Open in New Tab
                  </a>
                </Button>
                <Button onClick={() => setModalLink(null)}>Close</Button>
              </div>
            </div>
            <iframe
              src={modalLink}
              className="flex-1 w-full border-none"
              title="Document Viewer"
            />
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Documents;
