import React, { useState, useEffect } from 'react';
import { UserTask } from '../types/User';
import { toast } from 'react-toastify';
import { deleteField, FieldValue } from 'firebase/firestore'; // Import FieldValue if needed, though 'as any' works

interface EditTaskModalProps {
    task: UserTask & { userId: string }; // Renamed from initialTaskData and updated type
    onClose: () => void;
    onSave: (userId: string, taskId: string, updatedTaskData: Partial<UserTask>) => Promise<void>;
}

const EditTaskModal: React.FC<EditTaskModalProps> = ({ task, onSave, onClose }) => { // Destructure 'task' instead of 'initialTaskData'
    const [taskContent, setTaskContent] = useState(task.task || ''); // Use 'task'
    const [type, setType] = useState<'normal' | 'goal'>(task.type || 'normal'); // Use 'task'
    const [goal, setGoal] = useState<number>(task.goal || 1); // Use 'task'
    const [progress, setProgress] = useState<number>(task.progress || 0); // Use 'task'
    const [completed, setCompleted] = useState<boolean>(task.completed || false); // Use 'task'
    const [archived, setArchived] = useState<boolean>(task.archived || false); // Use 'task'
    const [isSaving, setIsSaving] = useState(false);

    // Ensure progress doesn't exceed goal if type is goal
    useEffect(() => {
        if (type === 'goal' && progress > goal) {
            setProgress(goal);
        }
    }, [progress, goal, type]);

    // Auto-complete goal task when progress meets goal
    useEffect(() => {
        if (type === 'goal' && progress >= goal) {
            setCompleted(true);
        }
    }, [progress, goal, type]);


    const handleSaveClick = async () => {
        // Validate using taskContent state
        if (!taskContent.trim()) {
            toast.error("Task description cannot be empty.");
            return;
        }
        if (type === 'goal' && goal <= 0) {
            toast.error("Goal must be greater than 0 for goal tasks.");
            return;
        }
        if (type === 'goal' && progress < 0) {
            toast.error("Progress cannot be negative.");
            return;
        }

        setIsSaving(true);
        const updatedData: Partial<UserTask> = {
            task: taskContent.trim(),
            type: type,
            completed: completed,
            archived: archived, // Include archived status
        };

        if (type === 'goal') {
            updatedData.goal = goal;
            updatedData.progress = Math.min(progress, goal); // Ensure progress doesn't exceed goal on save
            // Re-evaluate completion based on final progress/goal
            updatedData.completed = updatedData.progress >= updatedData.goal;
        } else {
            // Remove goal/progress if switching back to normal
            updatedData.goal = deleteField() as any; // Use type assertion
            updatedData.progress = deleteField() as any; // Use type assertion
        }

        // If archiving, ensure completed is false unless it's a goal task that met its goal
        if (archived && type === 'normal') {
            updatedData.completed = false;
        } else if (archived && type === 'goal') {
            updatedData.completed = (updatedData.progress ?? 0) >= (updatedData.goal ?? Infinity);
        }


        try {
            // Pass updatedData (which now includes 'task' field) to onSave
            await onSave(task.userId, task.id, updatedData); // Use 'task'
            toast.success("Task updated successfully!");
            onClose(); // Close modal on successful save
        } catch (error) {
            // Error handling is managed by the caller (AdminMenu)
            // toast.error("Failed to save task."); // Optionally keep local toast
        } finally {
            setIsSaving(false);
        }
    };

    const inputStyle = "w-full p-2 bg-gray-700 text-white rounded border border-gray-600 text-sm focus:ring-[#f3c700] focus:border-[#f3c700]";
    const buttonPrimary = "px-4 py-2 bg-[#f3c700] text-black font-bold rounded hover:bg-yellow-300 transition-colors duration-200 disabled:opacity-50";
    const buttonSecondary = "px-4 py-2 bg-gray-600 text-white font-bold rounded hover:bg-gray-500 transition-colors duration-200 disabled:opacity-50";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg border border-[#f3c700]/50">
                <h2 className="text-xl font-bold text-[#f3c700] mb-4">Edit Task</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Task Description</label>
                        <textarea
                            value={taskContent}
                            onChange={(e) => setTaskContent(e.target.value)}
                            className={`${inputStyle} min-h-[80px]`}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Task Type</label>
                        <select value={type} onChange={(e) => setType(e.target.value as 'normal' | 'goal')} className={inputStyle}>
                            <option value="normal">Normal</option>
                            <option value="goal">Goal</option>
                        </select>
                    </div>

                    {type === 'goal' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Goal Value</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={goal}
                                    onChange={(e) => setGoal(parseInt(e.target.value, 10) || 1)}
                                    className={inputStyle}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Progress</label>
                                <input
                                    type="number"
                                    min="0"
                                    max={goal}
                                    value={progress}
                                    onChange={(e) => setProgress(parseInt(e.target.value, 10) || 0)}
                                    className={inputStyle}
                                    required
                                />
                            </div>
                        </>
                    )}

                    {/* Completed Checkbox */}
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="completed"
                            checked={completed}
                            onChange={(e) => setCompleted(e.target.checked)}
                            className="h-4 w-4 text-[#f3c700] border-gray-500 rounded focus:ring-[#f3c700] bg-gray-600 mr-2"
                            // Disable if goal not met
                            disabled={type === 'goal' && progress < goal}
                            title={type === 'goal' && progress < goal ? "Progress must meet goal to complete" : ""}
                        />
                        <label htmlFor="completed" className={`text-sm ${type === 'goal' && progress < goal ? 'text-gray-500' : 'text-gray-300'}`}>
                            Mark as Complete
                        </label>
                    </div>

                    {/* Archived Checkbox */}
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="archived"
                            checked={archived}
                            onChange={(e) => setArchived(e.target.checked)}
                            className="h-4 w-4 text-blue-500 border-gray-500 rounded focus:ring-blue-500 bg-gray-600 mr-2"
                        />
                        <label htmlFor="archived" className="text-sm text-gray-300">
                            Archive Task (Hides from active/completed lists)
                        </label>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-600">
                    <button type="button" className={buttonSecondary} onClick={onClose} disabled={isSaving}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className={buttonPrimary}
                        onClick={handleSaveClick}
                        disabled={isSaving || !taskContent.trim()}
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditTaskModal;
