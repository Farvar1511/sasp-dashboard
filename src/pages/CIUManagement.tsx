import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  collection,
  getDocs,
} from 'firebase/firestore';
import { db as dbFirestore } from '../firebase';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { hasCIUPermission, CaseFile } from '../utils/ciuUtils'; 
import { User } from '../types/User'; 
import { Button } from '../components/ui/button';
import ConfirmationModal from '../components/ConfirmationModal';
import { toast } from 'react-toastify';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import GangManagementTab from '../components/Gangs/GangManagementTab'; 
import CaseFilesTab from '../components/CaseFiles/CaseFilesTab';
import CIUPersonnelTab from '../components/CIUPersonnel/CIUPersonnelTab';
import CreateCaseModal from '../components/CaseFiles/CreateCaseModal';
import EditCaseModal from '../components/CaseFiles/CaseDetailsModal';
import { CIUChatInterface } from '../components/Chat/CIUChatInterface'; 
import { Badge } from '../components/ui/badge';


export default function CIUManagement() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const [eligibleAssignees, setEligibleAssignees] = useState<User[]>([]); 
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [isCreateCaseModalOpen, setIsCreateCaseModalOpen] = useState(false);
  const [isEditCaseModalOpen, setIsEditCaseModalOpen] = useState(false);
  const [selectedCaseForEdit, setSelectedCaseForEdit] = useState<CaseFile | null>(null);
  const [unreadChatCount, setUnreadChatCount] = useState(0); 

  const canManageCIU = useMemo(() => {
    if (!currentUser) return false;
    return hasCIUPermission(currentUser);
  }, [currentUser]);

  
  useEffect(() => {
    if (!canManageCIU) return; 

    setLoadingUsers(true);
    const fetchUsers = async () => {
      try {
        const usersSnapshot = await getDocs(collection(dbFirestore, "users"));
        const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[];
        
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
  }, [canManageCIU]); 


  
  const handleOpenCreateCaseModal = () => setIsCreateCaseModalOpen(true);
  const handleCloseCreateCaseModal = () => setIsCreateCaseModalOpen(false);
  const handleCreateCaseSuccess = () => {
      console.log("CIUManagement: Case created successfully.");
      
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
      
  };
  


  
  const handleUnreadChatCountChange = useCallback((count: number) => {
      setUnreadChatCount(count);
  }, []);


  if (authLoading) {
    return (
      <Layout>
        {/* Use text-brand for loading text */}
        <div className="text-center p-8 text-brand">Loading Authentication...</div>
      </Layout>
    );
  }


  if (!canManageCIU) {
    return (
      <Layout>
        {/* Use text-destructive for error text */}
        <div className="text-center p-8 text-destructive">You do not have permission to access CIU Management.</div>
      </Layout>
    );
  }


  return (
    <Layout unreadChatCount={unreadChatCount}> {}
      {}
      {/* Change background to dark black */}
      <div className="p-4 sm:p-6 bg-black/90 border border-border rounded-lg shadow-md min-h-[calc(100vh-100px)]">
        {}
        {/* Use text-brand for the main heading */}
        <h1 className="text-3xl font-bold text-brand pb-4">CIU Management Dashboard</h1>

        {}
        <Tabs defaultValue="cases" className="w-full">
          {/* Apply consistent TabsList styling */}
          <TabsList className="bg-transparent p-0 border-b border-border grid w-full grid-cols-4 mb-4">
            {/* Update active and hover states: yellow background, black text */}
            <TabsTrigger value="cases" className="bg-transparent text-brand px-4 py-2 data-[state=active]:bg-brand data-[state=active]:text-black data-[state=active]:border-transparent hover:bg-brand hover:text-black">Case Files</TabsTrigger>
            <TabsTrigger value="gangs" className="bg-transparent text-brand px-4 py-2 data-[state=active]:bg-brand data-[state=active]:text-black data-[state=active]:border-transparent hover:bg-brand hover:text-black">Gangs</TabsTrigger>
            <TabsTrigger value="personnel" className="bg-transparent text-brand px-4 py-2 data-[state=active]:bg-brand data-[state=active]:text-black data-[state=active]:border-transparent hover:bg-brand hover:text-black">Personnel</TabsTrigger>
            <TabsTrigger value="chat" className="relative bg-transparent text-brand px-4 py-2 data-[state=active]:bg-brand data-[state=active]:text-black data-[state=active]:border-transparent hover:bg-brand hover:text-black"> {}
              Chat
              {unreadChatCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute top-1 right-1 h-5 w-5 p-0 flex items-center justify-center text-xs rounded-full"
                >
                  {unreadChatCount > 9 ? '9+' : unreadChatCount}
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

          {/* Remove bg-secondary to make transparent */}
          <TabsContent value="personnel" className="p-4 rounded-b-md border border-t-0 border-border">
            <CIUPersonnelTab />
          </TabsContent>

          {/* Remove bg-secondary to make transparent */}
          <TabsContent value="chat" className="p-4 rounded-b-md border border-t-0 border-border">
            {}
            <CIUChatInterface onUnreadCountChange={handleUnreadChatCountChange} />
          </TabsContent>
        </Tabs>

        {}
        {isCreateCaseModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <CreateCaseModal
                    onClose={handleCloseCreateCaseModal}
                    onSuccess={handleCreateCaseSuccess}
                    eligibleAssignees={eligibleAssignees} 
                />
            </div>
        )}

        {isEditCaseModalOpen && selectedCaseForEdit && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <EditCaseModal
                    caseData={selectedCaseForEdit}
                    onClose={handleCloseEditCaseModal}
                    onSaveSuccess={handleEditCaseSaveSuccess}
                    eligibleAssignees={eligibleAssignees} 
                />
            </div>
        )}
      </div>
    </Layout>
  );
}
