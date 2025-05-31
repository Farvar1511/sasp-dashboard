import React, { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db as dbFirestore } from '../firebase';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import SubmitCIUTipModal from '../components/CaseFiles/SubmitCIUTipModal';
import { TipDetails } from '../components/CaseFiles/SubmitCIUTipModal';

const PublicSubmitCIUTip: React.FC = () => {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleTipSubmit = async ({ tipDetails, detectiveWorkedWith }: { tipDetails: TipDetails; detectiveWorkedWith?: string }) => {
        setIsSubmitting(true);
        console.log('📝 Public tip submission:', { tipDetails, detectiveWorkedWith });

        try {
            const caseData = {
                title: tipDetails.title || `Anonymous Tip - ${new Date().toLocaleDateString()}`,
                description: tipDetails.summary,
                status: 'Open - Unassigned', // Always create as unassigned for public tips
                assignedToId: null,
                assignedToName: null,
                createdBy: 'public',
                createdByName: 'Public Submission',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                imageLinks: tipDetails.photos.filter(p => p.trim()),
                details: JSON.stringify({
                    incidentReport: tipDetails.incidentReport,
                    evidence: tipDetails.evidence,
                    photos: tipDetails.photos.filter(p => p.trim()),
                    photoSectionDescription: tipDetails.photoSectionDescription,
                    location: tipDetails.location,
                    namesOfInterest: tipDetails.namesOfInterest,
                    gangInfo: tipDetails.gangInfo,
                    videoNotes: tipDetails.videoNotes,
                    charges: tipDetails.charges,
                    detectiveWorkedWith: detectiveWorkedWith || null
                }),
                updates: [],
            };

            console.log('💾 Creating case from public tip:', caseData);
            
            const docRef = await addDoc(collection(dbFirestore, 'caseFiles'), caseData);
            console.log('✅ Case created with ID:', docRef.id);
            
            toast.success("Your tip has been submitted successfully and will be reviewed by CIU detectives.");
            
            // Redirect to a thank you page or close
            setTimeout(() => {
                window.location.href = '/';
            }, 3000);
            
        } catch (error) {
            console.error('❌ Error submitting public tip:', error);
            toast.error("Failed to submit tip. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        window.location.href = '/';
    };

    return (
        <div className="min-h-screen bg-background">
            <SubmitCIUTipModal
                isOpen={true}
                onClose={handleClose}
                onSubmit={handleTipSubmit}
                hideDetectiveAssignment={true}
            />
            <ToastContainer
                position="bottom-right"
                autoClose={5000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="dark"
            />
        </div>
    );
};

export default PublicSubmitCIUTip;
