import React from 'react';
import Layout from '../components/Layout';
import CaseFiles from '../components/CaseFiles/CaseFiles'; // Import the main CaseFiles component
import { useAuth } from '../context/AuthContext';
// Import permission check if needed, e.g., hasCaseFilePermission
// import { hasCaseFilePermission } from '../utils/permissions'; // Example path

const CaseFilesPage: React.FC = () => {
  const { user: currentUser, loading: authLoading } = useAuth();

  // Example permission check (replace with actual logic if needed)
  const canViewCaseFiles = true; // Assume true for now, replace with actual check, e.g., hasCaseFilePermission(currentUser)

  if (authLoading) {
    return <Layout><p className="text-center text-muted-foreground p-4">Loading user data...</p></Layout>;
  }

  if (!canViewCaseFiles) {
    return (
      <Layout>
        <div className="text-center text-destructive p-4 border border-destructive/50 rounded-md bg-destructive/10">
          You do not have permission to access Case Files.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        <h1 className="text-3xl font-bold text-[#f3c700]">Case Files Management</h1>
        {/* Render the main CaseFiles component. Assumes it handles overview when no gangId is passed. */}
        <CaseFiles gangId="defaultGangId" />
      </div>
    </Layout>
  );
};

export default CaseFilesPage;
