import React from 'react';
import { formatTimestampForDisplay } from '../utils/timeHelpers';

interface Bulletin {
  id: string;
  title: string;
  content: string;
  postedByName: string;
  postedByRank: string;
  createdAt: Date;
}

interface BulletinsModalProps {
  bulletin: Bulletin | null;
  isOpen: boolean;
  onClose: () => void;
}

const BulletinsModal: React.FC<BulletinsModalProps> = ({ bulletin, isOpen, onClose }) => {
  if (!isOpen || !bulletin) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-90" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className="relative rounded-lg shadow-2xl w-[95vw] max-w-6xl max-h-[90vh] overflow-hidden border-2"
        style={{ 
          backgroundColor: 'oklch(0.02 0 0)', // Very dark background (98% black)
          borderColor: '#f3c700' 
        }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between p-6 border-b-2"
          style={{ 
            backgroundColor: 'oklch(0.05 0 0)', // Slightly lighter dark for header
            borderColor: '#f3c700'
          }}
        >
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-[#f3c700] break-words font-inter">
              {bulletin.title}
            </h2>
            <p className="text-sm text-gray-300 mt-1 font-inter">
              Posted by {bulletin.postedByName} ({bulletin.postedByRank}) • {formatTimestampForDisplay(bulletin.createdAt)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-gray-300 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-700"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto max-h-[calc(90vh-140px)]">
          <style>{`
            .bulletin-content {
              color: #ffffff !important;
              font-size: 16px !important;
              line-height: 1.7 !important;
              max-width: 100% !important;
              font-family: 'Inter', sans-serif !important;
            }
            
            .bulletin-content h1 {
              color: #f3c700 !important;
              font-size: 1.875rem !important;
              font-weight: 700 !important;
              margin: 1.5em 0 0.75em 0 !important;
              border-bottom: 2px solid #f3c700 !important;
              padding-bottom: 0.5em !important;
              font-family: 'Inter', sans-serif !important;
            }
            
            .bulletin-content h2 {
              color: #f3c700 !important;
              font-size: 1.5rem !important;
              font-weight: 600 !important;
              margin: 1.25em 0 0.5em 0 !important;
              font-family: 'Inter', sans-serif !important;
            }
            
            .bulletin-content h3 {
              color: #f3c700 !important;
              font-size: 1.25rem !important;
              font-weight: 600 !important;
              margin: 1em 0 0.5em 0 !important;
              font-family: 'Inter', sans-serif !important;
            }
            
            .bulletin-content h4,
            .bulletin-content h5,
            .bulletin-content h6 {
              color: #f3c700 !important;
              font-weight: 600 !important;
              margin: 0.75em 0 0.5em 0 !important;
              font-family: 'Inter', sans-serif !important;
            }
            
            .bulletin-content p {
              margin: 1em 0 !important;
              color: #ffffff !important;
              font-family: 'Inter', sans-serif !important;
            }
            
            /* Enhanced list styling */
            .bulletin-content ul,
            .bulletin-content ol {
              margin: 1em 0 !important;
              padding-left: 2em !important;
              color: #ffffff !important;
              font-family: 'Inter', sans-serif !important;
            }
            
            .bulletin-content li {
              margin: 0.5em 0 !important;
              color: #ffffff !important;
              font-family: 'Inter', sans-serif !important;
              position: relative !important;
            }
            
            .bulletin-content li p {
              margin: 0.25em 0 !important;
              color: #ffffff !important;
              display: inline !important;
            }
            
            /* Nested lists */
            .bulletin-content ul ul,
            .bulletin-content ol ol,
            .bulletin-content ul ol,
            .bulletin-content ol ul {
              margin: 0.5em 0 !important;
              padding-left: 1.5em !important;
            }
            
            /* Custom bullet points */
            .bulletin-content ul {
              list-style-type: disc !important;
            }
            
            .bulletin-content ul ul {
              list-style-type: circle !important;
            }
            
            .bulletin-content ul ul ul {
              list-style-type: square !important;
            }
            
            .bulletin-content ol {
              list-style-type: decimal !important;
            }
            
            .bulletin-content ol ol {
              list-style-type: lower-alpha !important;
            }
            
            .bulletin-content ol ol ol {
              list-style-type: lower-roman !important;
            }
            
            /* Ensure list markers are visible */
            .bulletin-content li::marker {
              color: #f3c700 !important;
              font-weight: bold !important;
            }
            
            .bulletin-content strong,
            .bulletin-content b {
              font-weight: 700 !important;
              color: #ffffff !important;
              font-family: 'Inter', sans-serif !important;
            }
            
            .bulletin-content em,
            .bulletin-content i {
              font-style: italic !important;
              color: #e5e5e5 !important;
              font-family: 'Inter', sans-serif !important;
            }
            
            .bulletin-content a {
              color: #f3c700 !important;
              text-decoration: underline !important;
              font-family: 'Inter', sans-serif !important;
            }
            
            .bulletin-content a:hover {
              color: #ffe066 !important;
            }
            
            .bulletin-content blockquote {
              border-left: 4px solid #f3c700 !important;
              margin: 1.5em 0 !important;
              padding: 1em 1.5em !important;
              background-color: rgba(243, 199, 0, 0.1) !important;
              font-style: italic !important;
              color: #e5e5e5 !important;
              font-family: 'Inter', sans-serif !important;
            }
            
            .bulletin-content code {
              background-color: rgba(255, 255, 255, 0.1) !important;
              color: #f3c700 !important;
              padding: 0.2em 0.4em !important;
              border-radius: 4px !important;
              font-family: 'JetBrains Mono', 'Fira Code', monospace !important;
              font-size: 0.9em !important;
            }
            
            .bulletin-content pre {
              background-color: rgba(255, 255, 255, 0.05) !important;
              color: #ffffff !important;
              padding: 1em !important;
              border-radius: 8px !important;
              margin: 1.5em 0 !important;
              font-family: 'JetBrains Mono', 'Fira Code', monospace !important;
              font-size: 0.9em !important;
              overflow-x: auto !important;
              border: 1px solid rgba(243, 199, 0, 0.2) !important;
            }
            
            .bulletin-content hr {
              border: none !important;
              border-top: 2px solid #f3c700 !important;
              margin: 2em 0 !important;
            }
            
            .bulletin-content table {
              width: 100% !important;
              border-collapse: collapse !important;
              margin: 1.5em 0 !important;
              font-family: 'Inter', sans-serif !important;
            }
            
            .bulletin-content th,
            .bulletin-content td {
              border: 1px solid #444444 !important;
              padding: 0.75em !important;
              text-align: left !important;
            }
            
            .bulletin-content th {
              background-color: rgba(243, 199, 0, 0.2) !important;
              color: #f3c700 !important;
              font-weight: 600 !important;
              font-family: 'Inter', sans-serif !important;
            }
            
            .bulletin-content td {
              color: #ffffff !important;
              font-family: 'Inter', sans-serif !important;
            }
            
            /* Additional markdown support */
            .bulletin-content del,
            .bulletin-content s {
              text-decoration: line-through !important;
              color: #cccccc !important;
            }
            
            .bulletin-content mark {
              background-color: rgba(243, 199, 0, 0.3) !important;
              color: #000000 !important;
              padding: 0.1em 0.2em !important;
            }
            
            .bulletin-content kbd {
              background-color: #2a2a2a !important;
              border: 1px solid #555555 !important;
              border-radius: 3px !important;
              padding: 0.1em 0.3em !important;
              font-family: monospace !important;
              font-size: 0.85em !important;
              color: #ffffff !important;
            }
            
            /* Task lists */
            .bulletin-content input[type="checkbox"] {
              margin-right: 0.5em !important;
              accent-color: #f3c700 !important;
            }
            
            /* Definition lists */
            .bulletin-content dl {
              margin: 1em 0 !important;
            }
            
            .bulletin-content dt {
              font-weight: bold !important;
              color: #f3c700 !important;
              margin-top: 1em !important;
            }
            
            .bulletin-content dd {
              margin: 0.5em 0 0.5em 2em !important;
              color: #ffffff !important;
            }
          `}</style>
          <div 
            className="bulletin-content font-inter"
            dangerouslySetInnerHTML={{ __html: bulletin.content }}
          />
        </div>
      </div>
    </div>
  );
};

export default BulletinsModal;
