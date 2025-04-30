import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import GangManagementTab from '../components/Gangs/GangManagementTab';
import CaseFilesTab from '../components/CaseFiles/CaseFilesTab';
import { CIUChatInterface } from '../components/Chat/CIUChatInterface'; // Import CIUChatInterface
import CreateCaseModal from '../components/CaseFiles/CreateCaseModal';
import EditCaseModal from '../components/CaseFiles/CaseDetailsModal'; // Ensure this file exists or update the path
import { useAuth } from '../context/AuthContext'; // Import useAuth
import { collection, getDocs, query, where } from 'firebase/firestore'; // Import Firestore functions
import { db as dbFirestore } from '../firebase'; // Import Firestore instance
import { User } from '../types/User'; // Import User type
import { Badge } from '../components/ui/badge'; // Import Badge
import { useNotificationStore } from '../store/notificationStore'; // Import Zustand store
import { CaseFile } from '@/utils/ciuUtils';
import CIUPersonnelTab from '../components/CIUPersonnel/CIUPersonnelTab'; // Import CIUPersonnelTab

// Define eligible roles for case assignment
const ELIGIBLE_ROLES_FOR_ASSIGNMENT = ['admin', 'ciu'];

export default function CIUManagement() {
  const { user: currentUser } = useAuth(); // Get current user from AuthContext
  const [isCreateCaseModalOpen, setIsCreateCaseModalOpen] = useState(false);
  const [isEditCaseModalOpen, setIsEditCaseModalOpen] = useState(false);
  const [selectedCaseForEdit, setSelectedCaseForEdit] = useState<CaseFile | null>(null);
  const [eligibleAssignees, setEligibleAssignees] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  // Remove unreadChatCount state
  // const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Get unread count directly from Zustand store - corrected property name
  const ciuUnreadCount = useNotificationStore(state =>
    state.notifications?.length ?? 0 // Use 'notifications' instead of 'ciuNotifications'
  );


  // Fetch eligible users for assignment
  useEffect(() => {
    const fetchEligibleUsers = async () => {
      setLoadingUsers(true);
      try {
        const usersRef = collection(dbFirestore, 'users');
        // Query users whose role is in the eligible list
        const q = query(usersRef, where('role', 'in', ELIGIBLE_ROLES_FOR_ASSIGNMENT));
        const querySnapshot = await getDocs(q);
        const users: User[] = [];
        querySnapshot.forEach((doc) => {
          // Ensure user has necessary fields (id, name, role)
          const data = doc.data();
          if (data.name && data.role) {
            // Ensure id is explicitly included
            users.push({ id: doc.id, name: data.name, role: data.role } as User);
          }
        });
        setEligibleAssignees(users);
      } catch (error) {
        console.error("Error fetching eligible assignees:", error);
        // Handle error appropriately, e.g., show a toast message
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchEligibleUsers();
  }, []); // Run once on mount

  // Handlers for modals
  const handleOpenCreateCaseModal = () => setIsCreateCaseModalOpen(true);
  const handleCloseCreateCaseModal = () => setIsCreateCaseModalOpen(false);

  const handleOpenEditCaseModal = (caseFile: CaseFile) => {
    setSelectedCaseForEdit(caseFile);
    setIsEditCaseModalOpen(true);
  };
  const handleCloseEditCaseModal = () => {
    setSelectedCaseForEdit(null);
    setIsEditCaseModalOpen(false);
  };

  // Handler for successful save (optional, e.g., for refetching data)
  const handleCreateCaseSaveSuccess = () => {
    handleCloseCreateCaseModal();
    // Optionally trigger data refetch here if needed
  };
  const handleEditCaseSaveSuccess = () => {
    handleCloseEditCaseModal();
    // Optionally trigger data refetch here if needed
  };

  // Remove handleUnreadChatCountChange function
  // const handleUnreadChatCountChange = useCallback((count: number) => {
  //   setUnreadChatCount(count);
  // }, []);


  // Memoize eligible assignees to prevent unnecessary re-renders of modals
  const memoizedEligibleAssignees = useMemo(() => eligibleAssignees, [eligibleAssignees]);

  return (
    // Remove unreadChatCount prop from Layout
    <Layout> {}
      {}
      {/* Change background to dark black */}
      <div className="p-4 sm:p-6 bg-black/90 border border-border rounded-lg shadow-md min-h-[calc(100vh-100px)]">
        {}
        {/* Use text-brand for the main heading */}
        <h1 className="text-3xl font-bold text-brand pb-4">CIU Management Dashboard</h1>

        {}
        <Tabs defaultValue="cases" className="w-full">
          {/* Apply consistent TabsList styling - updated grid columns */}
          <TabsList className="bg-transparent p-0 border-b border-border grid w-full grid-cols-5 mb-4"> {/* Changed grid-cols-4 to grid-cols-5 */}
            {/* Update active and hover states: yellow background, black text */}
            <TabsTrigger value="cases" className="bg-transparent text-brand px-4 py-2 data-[state=active]:bg-brand data-[state=active]:text-black data-[state=active]:border-transparent hover:bg-brand hover:text-black">Case Files</TabsTrigger>
            <TabsTrigger value="gangs" className="bg-transparent text-brand px-4 py-2 data-[state=active]:bg-brand data-[state=active]:text-black data-[state=active]:border-transparent hover:bg-brand hover:text-black">Gang Intel</TabsTrigger>
            {/* Add Personnel Tab Trigger */}
            <TabsTrigger value="personnel" className="bg-transparent text-brand px-4 py-2 data-[state=active]:bg-brand data-[state=active]:text-black data-[state=active]:border-transparent hover:bg-brand hover:text-black">Personnel</TabsTrigger>
            {/* Chat Tab Trigger with Badge */}
            <TabsTrigger value="chat" className="relative bg-transparent text-brand px-4 py-2 data-[state=active]:bg-brand data-[state=active]:text-black data-[state=active]:border-transparent hover:bg-brand hover:text-black">
              CIU Chat
              {/* Use ciuUnreadCount from Zustand */}
              {ciuUnreadCount > 0 && (
                <Badge
                  variant="destructive" // Use destructive variant for red background
                  className="absolute top-1 right-1 h-5 w-5 p-0 flex items-center justify-center text-xs rounded-full"
                >
                  {ciuUnreadCount > 9 ? '9+' : ciuUnreadCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Remove bg-secondary to make transparent */}
          <TabsContent value="gangs" className="p-4 rounded-b-md border border-t-0 border-border">
            <GangManagementTab />
          </TabsContent>

          {/* Remove bg-secondary to make transparent */}
          <TabsContent value="cases" className="p-4 rounded-b-md border border-t-0 border-border">
            <CaseFilesTab
              openCreateModal={handleOpenCreateCaseModal}
              openEditModal={handleOpenEditCaseModal}
              loadingAssignees={loadingUsers}
            />
          </TabsContent>

          {/* Add Personnel Tab Content */}
          <TabsContent value="personnel" className="p-4 rounded-b-md border border-t-0 border-border">
            <CIUPersonnelTab />
          </TabsContent>

          {/* Remove bg-secondary to make transparent */}
          {/* Chat Tab Content */}
          <TabsContent value="chat" className="p-0 rounded-b-md border border-t-0 border-border">
            {/* Remove onUnreadCountChange prop */}
            <CIUChatInterface />
          </TabsContent>
        </Tabs>

        {/* Modals */}
        {isCreateCaseModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <CreateCaseModal
                    onClose={handleCloseCreateCaseModal}
                    onSuccess={handleCreateCaseSaveSuccess}
                    eligibleAssignees={memoizedEligibleAssignees} // Pass memoized list
                />
            </div>
        )}
        {isEditCaseModalOpen && selectedCaseForEdit && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <EditCaseModal
                    caseData={selectedCaseForEdit}
                    onClose={handleCloseEditCaseModal}
                    onSaveSuccess={handleEditCaseSaveSuccess}
                    eligibleAssignees={memoizedEligibleAssignees} // Pass memoized list
                />
            </div>
        )}
      </div>
    </Layout>
  );
}
