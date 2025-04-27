import React from 'react';
import Layout from '../components/Layout';
import CaseFiles from '../components/CaseFiles/CaseFiles'; 
import { useAuth } from '../context/AuthContext';



const CaseFilesPage: React.FC = () => {
  const { user: currentUser, loading: authLoading } = useAuth();

  
  const canViewCaseFiles = true; 

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
      {/* Apply consistent container styling */}
      <div className="p-4 md:p-6 space-y-6 bg-card border border-border rounded-lg shadow-md min-h-[calc(100vh-100px)]">
        {/* Use text-brand for heading */}
        <h1 className="text-3xl font-bold text-brand">Case Files Management</h1>
        {}
        <CaseFiles gangId="defaultGangId" />
      </div>
    </Layout>
  );
};

export default CaseFilesPage;
