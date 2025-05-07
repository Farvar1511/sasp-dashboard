import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import GangManagementTab from '../components/Gangs/GangManagementTab';
import CaseFilesTab from '../components/CaseFiles/CaseFilesTab';
import { CIUChatInterface } from '../components/Chat/CIUChatInterface';
import CreateCaseModal from '../components/CaseFiles/CreateCaseModal';
import EditCaseModal from '../components/CaseFiles/EditCaseModal';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs, query, where, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db as dbFirestore } from '../firebase';
import { User } from '../types/User';
import { Badge } from '../components/ui/badge';
import { useNotificationStore } from '../store/notificationStore';
import { CaseFile, FirestoreTip, TipStatus } from '@/utils/ciuUtils'; // Ensure FirestoreTip, TipStatus are imported
import CIUPersonnelTab from '../components/CIUPersonnel/CIUPersonnelTab';
import { toast } from 'react-toastify';
import { TipDetails } from '../components/CaseFiles/SubmitCIUTipModal';
import { serverTimestamp } from 'firebase/firestore';

// Define a type for the data used to pre-fill CreateCaseModal from a tip
export interface TipConversionData extends TipDetails {
  originalTipId: string;
}

export default function CIUManagement() {
  const { user: currentUser } = useAuth();
  const [isCreateCaseModalOpen, setIsCreateCaseModalOpen] = useState(false);
  const [isEditCaseModalOpen, setIsEditCaseModalOpen] = useState(false);
  const [selectedCaseForEdit, setSelectedCaseForEdit] = useState<CaseFile | null>(null);
  const [eligibleAssignees, setEligibleAssignees] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [initialDataForCreateCase, setInitialDataForCreateCase] = useState<TipConversionData | null>(null); // Renamed for clarity

  const ciuUnreadCount = useNotificationStore(state =>
    state.notifications?.length ?? 0
  );

  useEffect(() => {
    const fetchEligibleUsers = async () => {
      setLoadingUsers(true);
      try {
        const usersRef = collection(dbFirestore, 'users');
        const q = query(usersRef, where('isActive', '==', true), orderBy('name'));
        const querySnapshot = await getDocs(q);
        const usersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[];

        const allowedCerts = ['CERT', 'TRAIN', 'SUPER', 'LEAD'];
        const filteredUsers = usersData.filter(user => {
          const cert = user.certifications?.CIU?.toUpperCase();
          return allowedCerts.includes(cert || "");
        });

        setEligibleAssignees(filteredUsers);
      } catch (error) {
        console.error("Error fetching eligible assignees:", error);
        toast.error("Failed to load eligible users for assignment.");
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchEligibleUsers();
  }, []);

  const handleOpenCreateCaseModal = (initialData?: TipConversionData) => { // Parameter name updated
    if (initialData) {
      setInitialDataForCreateCase(initialData); // State name updated
    } else {
      setInitialDataForCreateCase(null); // State name updated
    }
    setIsCreateCaseModalOpen(true);
  };
  const handleCloseCreateCaseModal = () => {
    setIsCreateCaseModalOpen(false);
    setInitialDataForCreateCase(null); // Clear initial data when modal closes
  };

  const handleCreateCaseSaveSuccess = async (newCaseId?: string) => { // newCaseId can be passed from CreateCaseModal
    // The toast for case creation success is now handled in CreateCaseModal's onSuccess
    // toast.success("New case created successfully!");

    if (initialDataForCreateCase?.originalTipId && newCaseId) {
      try {
        const tipRef = doc(dbFirestore, 'ciuTips', initialDataForCreateCase.originalTipId);
        await updateDoc(tipRef, {
          status: 'ConvertedToCase' as TipStatus,
          // convertedToCaseId: newCaseId, // Optionally link the case ID to the tip
          updatedAt: fbServerTimestamp() // Assuming tips also have an updatedAt field
        });
        toast.info(`Tip ${initialDataForCreateCase.originalTipId} status updated to ConvertedToCase.`);
      } catch (error) {
        console.error("Error updating tip status:", error);
        toast.error("Failed to update original tip status.");
      }
    }
    handleCloseCreateCaseModal(); // Closes modal and clears initialDataForCreateCase
  };

  const handleOpenEditCaseModal = (caseFile: CaseFile) => {
    setSelectedCaseForEdit(caseFile);
    setIsEditCaseModalOpen(true);
  };
  const handleCloseEditCaseModal = () => {
    setSelectedCaseForEdit(null);
    setIsEditCaseModalOpen(false);
  };
  const handleEditCaseSaveSuccess = () => {
    handleCloseEditCaseModal();
    toast.success("Case updated successfully!");
  };

  const memoizedEligibleAssignees = useMemo(() => eligibleAssignees, [eligibleAssignees]);

  return (
    <Layout>
      <div className="p-4 sm:p-6 bg-black/90 border border-border rounded-lg shadow-md min-h-[calc(100vh-100px)]">
        <h1 className="text-3xl font-bold text-brand pb-4">CIU Management Dashboard</h1>

        <Tabs defaultValue="cases" className="w-full">
          <TabsList className="bg-transparent p-0 border-b border-border grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 mb-4">
            <TabsTrigger value="cases" className="bg-transparent text-brand px-2 sm:px-4 py-2 data-[state=active]:bg-brand data-[state=active]:text-black data-[state=active]:border-transparent hover:bg-brand hover:text-black text-xs sm:text-sm">Case Files</TabsTrigger>
            <TabsTrigger value="gangs" className="bg-transparent text-brand px-2 sm:px-4 py-2 data-[state=active]:bg-brand data-[state=active]:text-black data-[state=active]:border-transparent hover:bg-brand hover:text-black text-xs sm:text-sm">Gang Intel</TabsTrigger>
            <TabsTrigger value="personnel" className="bg-transparent text-brand px-2 sm:px-4 py-2 data-[state=active]:bg-brand data-[state=active]:text-black data-[state=active]:border-transparent hover:bg-brand hover:text-black text-xs sm:text-sm">Personnel</TabsTrigger>
            <TabsTrigger value="chat" className="relative bg-transparent text-brand px-2 sm:px-4 py-2 data-[state=active]:bg-brand data-[state=active]:text-black data-[state=active]:border-transparent hover:bg-brand hover:text-black text-xs sm:text-sm">
              CIU Chat
              {ciuUnreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute top-0.5 right-0.5 h-4 w-4 sm:h-5 sm:w-5 p-0 flex items-center justify-center text-[10px] sm:text-xs rounded-full"
                >
                  {ciuUnreadCount > 9 ? '9+' : ciuUnreadCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gangs" className="p-2 sm:p-4 rounded-b-md border border-t-0 border-border">
            <GangManagementTab />
          </TabsContent>

          <TabsContent value="cases" className="p-2 sm:p-4 rounded-b-md border border-t-0 border-border">
            <CaseFilesTab
              openCreateModal={handleOpenCreateCaseModal}
              openEditModal={handleOpenEditCaseModal}
              loadingAssignees={loadingUsers}
            />
          </TabsContent>

          <TabsContent value="personnel" className="p-2 sm:p-4 rounded-b-md border border-t-0 border-border">
            <CIUPersonnelTab />
          </TabsContent>

          <TabsContent value="chat" className="p-0 rounded-b-md border border-t-0 border-border">
            <CIUChatInterface />
          </TabsContent>
        </Tabs>

        {isCreateCaseModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm">
            <CreateCaseModal
              onClose={handleCloseCreateCaseModal}
              onSuccess={handleCreateCaseSaveSuccess} // Pass the updated success handler
              eligibleAssignees={memoizedEligibleAssignees}
              initialDataForCase={initialDataForCreateCase} // Pass initial data
            />
          </div>
        )}
        {isEditCaseModalOpen && selectedCaseForEdit && currentUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm">
            <EditCaseModal
              isOpen={isEditCaseModalOpen}
              caseData={selectedCaseForEdit}
              onClose={handleCloseEditCaseModal}
              onSaveSuccess={handleEditCaseSaveSuccess}
              eligibleAssignees={memoizedEligibleAssignees}
            />
          </div>
        )}
      </div>
    </Layout>
  );
}

function fbServerTimestamp(): unknown {
  return serverTimestamp();
}

