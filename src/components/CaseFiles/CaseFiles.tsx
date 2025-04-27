import React from 'react';

interface CaseFilesProps {
  gangId: string;
}

const CaseFiles: React.FC<CaseFilesProps> = ({ gangId }) => {
  // In the future, fetch and display case files related to the gangId

  return (
    // Use black background with opacity
    <div className="bg-black/95 p-4 rounded-lg border border-border">
      <h3 className="text-lg font-semibold text-accent mb-4">Case Files</h3>
      <p className="text-sm text-muted-foreground italic">
        Case file functionality is under development. Files related to gang ID: {gangId} will be shown here.
      </p>
      {/* Add case file listing, creation, etc. here later */}
    </div>
  );
};

export default CaseFiles;
