import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  collection,
  getDocs,
} from 'firebase/firestore';
import { db as dbFirestore } from '../firebase';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { hasCIUPermission, CaseFile } from '../utils/ciuUtils'; // Import CaseFile type
import { User } from '../types/User'; // Corrected path to User type
import { Button } from '../components/ui/button';
import ConfirmationModal from '../components/ConfirmationModal';
import { toast } from 'react-toastify';
// Import Tab components
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
// Import the new Tab content components
import GangManagementTab from '../components/Gangs/GangManagementTab'; // Assuming this handles gang listing/editing now
import CaseFilesTab from '../components/CaseFiles/CaseFilesTab';
import CIUPersonnelTab from '../components/CIUPersonnel/CIUPersonnelTab';
// Import Modals used by CaseFilesTab
import CreateCaseModal from '../components/CaseFiles/CreateCaseModal';
import EditCaseModal from '../components/CaseFiles/CaseDetailsModal';
// Import Chat components
import { CIUChatInterface } from '../components/Chat/CIUChatInterface'; // Changed to named import

const CIUManagement: React.FC = () => {
  const { user: currentUser, loading: authLoading } = useAuth();
  const [eligibleAssignees, setEligibleAssignees] = useState<User[]>([]); // State for users eligible to be assigned cases
  const [loadingUsers, setLoadingUsers] = useState(true);

  // State for Case Modals (managed here, passed to CaseFilesTab)
  const [isCreateCaseModalOpen, setIsCreateCaseModalOpen] = useState(false);
  const [isEditCaseModalOpen, setIsEditCaseModalOpen] = useState(false);
  const [selectedCaseForEdit, setSelectedCaseForEdit] = useState<CaseFile | null>(null);

  const canManageCIU = useMemo(() => {
    if (!currentUser) return false;
    return hasCIUPermission(currentUser);
  }, [currentUser]);

  // Fetch Users (for assignee list in modals)
  useEffect(() => {
    if (!canManageCIU) return; // Don't fetch if no permission

    setLoadingUsers(true);
    const fetchUsers = async () => {
      try {
        const usersSnapshot = await getDocs(collection(dbFirestore, "users"));
        const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[];
        // Filter for users with relevant CIU certs (TRAIN, CERT, LEAD, SUPER)
        const filteredUsers = usersData.filter(u => {
            const cert = u.certifications?.CIU?.toUpperCase();
            return ["TRAIN", "CERT", "LEAD", "SUPER"].includes(cert || "");
        });
        setEligibleAssignees(filteredUsers);
      } catch (err) {
        console.error("Error fetching users for assignment:", err);
        toast.error("Failed to load users for assignment.");
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, [canManageCIU]); // Re-fetch if permission changes (e.g., on login)


  // --- Modal Handlers (for Case Modals) ---
  const handleOpenCreateCaseModal = () => setIsCreateCaseModalOpen(true);
  const handleCloseCreateCaseModal = () => setIsCreateCaseModalOpen(false);
  const handleCreateCaseSuccess = () => {
      console.log("CIUManagement: Case created successfully.");
      // Data should refresh via CaseFilesTab's snapshot listener
  };

  const handleOpenEditCaseModal = (caseFile: CaseFile) => {
    setSelectedCaseForEdit(caseFile);
    setIsEditCaseModalOpen(true);
  };
  const handleCloseEditCaseModal = () => {
    setIsEditCaseModalOpen(false);
    setSelectedCaseForEdit(null);
  };
   const handleEditCaseSaveSuccess = () => {
      console.log("CIUManagement: Case updated successfully.");
      // Data should refresh via CaseFilesTab's snapshot listener
  };
  // --- End Modal Handlers ---


  if (authLoading) {
    return (
      <Layout>
        <div className="text-center p-8 text-[#f3c700]">Loading Authentication...</div>
      </Layout>
    );
  }

  // Use canManageCIU derived from useMemo
  if (!canManageCIU) {
    return (
      <Layout>
        <div className="text-center p-8 text-red-500">You do not have permission to access CIU Management.</div>
      </Layout>
    );
  }

  // Main component structure with Tabs
  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <h1 className="text-3xl font-bold text-[#f3c700]">CIU Management</h1>
          <Link to="/" className="text-sm text-[#f3c700] hover:underline">
            &larr; Back to Dashboard
          </Link>
        </div>

        {/* Tabs for different CIU sections */}
        <Tabs defaultValue="gangs" className="w-full">
          {/* Update grid columns to 4 */}
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="gangs">Gangs</TabsTrigger>
            <TabsTrigger value="cases">Case Files</TabsTrigger>
            <TabsTrigger value="personnel">Personnel</TabsTrigger>
            {/* Add new Chat trigger */}
            <TabsTrigger value="chat">Chat</TabsTrigger>
          </TabsList>

          {/* Gangs Tab */}
          <TabsContent value="gangs">
            <GangManagementTab />
          </TabsContent>

          {/* Case Files Tab */}
          <TabsContent value="cases">
            <CaseFilesTab
              openCreateModal={handleOpenCreateCaseModal}
              openEditModal={handleOpenEditCaseModal}
              loadingAssignees={loadingUsers}
            />
          </TabsContent>

          {/* Personnel Tab */}
          <TabsContent value="personnel">
            <CIUPersonnelTab />
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat">
            {/* Render the new Chat Interface Component */}
            <CIUChatInterface />
          </TabsContent>
        </Tabs>

        {/* Render Case Modals (controlled by state in this component) */}
        {isCreateCaseModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <CreateCaseModal
                    onClose={handleCloseCreateCaseModal}
                    onSuccess={handleCreateCaseSuccess}
                    eligibleAssignees={eligibleAssignees} // Pass fetched users
                />
            </div>
        )}

        {isEditCaseModalOpen && selectedCaseForEdit && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <EditCaseModal
                    caseData={selectedCaseForEdit}
                    onClose={handleCloseEditCaseModal}
                    onSaveSuccess={handleEditCaseSaveSuccess}
                    eligibleAssignees={eligibleAssignees} // Pass fetched users
                />
            </div>
        )}
      </div>
    </Layout>
  );
};

export default CIUManagement;
