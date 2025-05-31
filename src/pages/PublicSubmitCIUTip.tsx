import React, { useState } from 'react';
import SubmitCIUTipModal, { TipDetails } from '../components/CaseFiles/SubmitCIUTipModal';
import { db as dbFirestore } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-toastify';

const PublicSubmitCIUTip: React.FC = () => {
    const [modalOpen, setModalOpen] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [detectiveWorkedWith, setDetectiveWorkedWith] = useState('');

    // This function will be called when the modal submits a tip
    const handleSubmit = async ({ tipDetails, detectiveWorkedWith: detectiveWorkedWithFromModal }: { tipDetails: TipDetails; assignee: any; detectiveWorkedWith?: string }) => {
        setSubmitting(true);
        try {
            // Helper to recursively clean empty strings to null and remove empty array items
            const clean = (val: any): any => {
                if (Array.isArray(val)) {
                    // Remove empty/invalid entries
                    return val
                        .map(clean)
                        .filter(
                            v =>
                                v !== null &&
                                v !== undefined &&
                                (typeof v !== 'object' || Object.values(v).some(x => x !== null && x !== undefined && x !== ''))
                        );
                }
                if (val && typeof val === 'object') {
                    const obj: any = {};
                    Object.entries(val).forEach(([k, v]) => {
                        const cleaned = clean(v);
                        if (
                            cleaned !== undefined &&
                            !(typeof cleaned === 'string' && cleaned.trim() === '') &&
                            !(Array.isArray(cleaned) && cleaned.length === 0)
                        ) {
                            obj[k] = cleaned;
                        }
                    });
                    // Special: If all fields are null, return null
                    return Object.keys(obj).length > 0 ? obj : null;
                }
                if (typeof val === 'string') {
                    return val.trim() === '' ? null : val.trim();
                }
                return val;
            };

            // Remove undefined/null fields at the top level
            const cleanedTipDetails = clean(tipDetails);

            // Remove undefined/null fields at the top level of the Firestore doc
            const docToSave: Record<string, any> = {
                ...cleanedTipDetails,
                status: 'Unassigned',
                assignedTo: null,
                assignedToName: null,
                submittedBy: 'Anonymous',
                submittedAt: serverTimestamp(),
                notes: '',
                type: 'CIU Tip',
                detectiveWorkedWith: clean(detectiveWorkedWithFromModal),
            };
            Object.keys(docToSave).forEach(
                k => (docToSave[k] === undefined || docToSave[k] === null) && delete docToSave[k]
            );

            await addDoc(collection(dbFirestore, 'caseFiles'), docToSave);
            toast.success('Your tip has been submitted! Thank you.');
            setModalOpen(false);
        } catch (err) {
            toast.error('Failed to submit tip. Please try again later.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center"
            style={{ background: 'oklch(0 0 0)' }}
        >
            <div className="max-w-2xl w-full px-4 py-8">
                <h1 className="text-3xl font-bold mb-4 text-center text-brand">Submit a CIU Tip</h1>
                <p className="mb-8 text-center text-muted-foreground">
                    Use this form to submit information to the Criminal Investigations Unit. You may remain anonymous. 
                    Your tip will be reviewed and assigned to a detective if appropriate.
                </p>
                <SubmitCIUTipModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    onSubmit={handleSubmit}
                    hideDetectiveAssignment
                    detectiveWorkedWith={detectiveWorkedWith}
                    setDetectiveWorkedWith={setDetectiveWorkedWith}
                />
                {!modalOpen && (
                    <div className="mt-8 text-center">
                        <p className="text-lg font-semibold text-green-600">Thank you for your submission!</p>
                        <button
                            className="mt-4 px-4 py-2 bg-brand text-brand-foreground rounded hover:bg-brand/90"
                            onClick={() => {
                                setDetectiveWorkedWith('');
                                setModalOpen(true);
                            }}
                        >
                            Submit Another Tip
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PublicSubmitCIUTip;
