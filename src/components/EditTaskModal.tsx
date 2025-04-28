import React, { useState, useEffect } from 'react';
import { UserTask } from '../types/User';
import { toast } from 'react-toastify';

interface EditTaskModalProps {
    task: UserTask & { userId: string };
    onClose: () => void;
    onSave: (userId: string, taskId: string, updatedTaskData: Partial<UserTask>) => Promise<void>;
}

const EditTaskModal: React.FC<EditTaskModalProps> = ({ task: initialTaskData, onClose, onSave }) => {
    // Use 'task' field for state, matching the UserTask interface
    const [taskContent, setTaskContent] = useState(initialTaskData.task || ''); // Renamed state variable
    const [type, setType] = useState<'normal' | 'goal'>(initialTaskData.type || 'normal');
    const [goal, setGoal] = useState<number>(initialTaskData.goal || 1);
    const [progress, setProgress] = useState<number>(initialTaskData.progress || 0);
    const [completed, setCompleted] = useState<boolean>(initialTaskData.completed || false);
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
        // Prepare updated data using 'task' field
        const updatedData: Partial<UserTask> = {
            task: taskContent.trim(), // Use 'task' field
            type: type,
            completed: completed,
        };

        if (type === 'goal') {
            updatedData.goal = goal;
            updatedData.progress = Math.min(progress, goal); // Ensure progress doesn't exceed goal on save
            // Re-evaluate completion based on final progress/goal
            updatedData.completed = updatedData.progress >= updatedData.goal;
        } else {
            // Remove goal/progress if switching back to normal
            updatedData.goal = undefined; // Or use deleteField() if preferred
            updatedData.progress = undefined;
        }

        try {
            // Pass updatedData (which now includes 'task' field) to onSave
            await onSave(initialTaskData.userId, initialTaskData.id, updatedData);
            // onClose(); // Let the caller handle closing
        } catch (error) {
            // Error handled in onSave
        } finally {
            setIsSaving(false);
        }
    };

    const inputStyle = "w-full p-2 bg-gray-700 text-white rounded border border-gray-600 text-sm focus:ring-[#f3c700] focus:border-[#f3c700]";
    const buttonPrimary = "px-4 py-2 bg-[#f3c700] text-black font-bold rounded hover:bg-yellow-300 transition-colors duration-200 disabled:opacity-50";
    const buttonSecondary = "px-4 py-2 border border-gray-600 text-white rounded hover:bg-gray-700 transition-colors duration-200";


    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md border border-[#f3c700]/50">
                <h2 className="text-xl font-bold text-[#f3c700] mb-4">Edit Task</h2>

                <div className="space-y-4">
                    <div>
                        {/* Update label and input to use taskContent state */}
                        <label className="block text-sm font-medium text-gray-300 mb-1">Task</label>
                        <textarea
                            value={taskContent} // Use taskContent state
                            onChange={(e) => setTaskContent(e.target.value)} // Update taskContent state
                            className={inputStyle}
                            rows={3}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Type</label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value as 'normal' | 'goal')}
                            className={inputStyle}
                        >
                            <option value="normal">Normal Task</option>
                            <option value="goal">Goal Task</option>
                        </select>
                    </div>

                    {type === 'goal' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Goal</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={goal}
                                    onChange={(e) => setGoal(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                    className={inputStyle}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Progress</label>
                                <input
                                    type="number"
                                    min="0"
                                    max={goal} // Set max based on current goal
                                    value={progress}
                                    onChange={(e) => setProgress(parseInt(e.target.value, 10) || 0)}
                                    className={inputStyle}
                                    required
                                />
                            </div>
                        </>
                    )}

                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="completed"
                            checked={completed}
                            onChange={(e) => setCompleted(e.target.checked)}
                            className="h-4 w-4 text-[#f3c700] border-gray-500 rounded focus:ring-[#f3c700] bg-gray-600 mr-2"
                        />
                        <label htmlFor="completed" className="text-sm text-gray-300">
                            Mark as Complete
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
                        // Validate using taskContent state
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
