import React, { useState, useEffect } from 'react';
import { UserTask } from '../types/User';
import { toast } from 'react-toastify';
import { deleteField } from 'firebase/firestore';
import { Input } from './ui/input'; // Import Shadcn Input
import { Label } from './ui/label'; // Import Shadcn Label
import { Textarea } from './ui/textarea'; // Import Shadcn Textarea
import { Checkbox } from './ui/checkbox'; // Import Shadcn Checkbox
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'; // Import Shadcn Select

interface EditTaskModalProps {
    task: UserTask & { userId: string }; // Renamed from initialTaskData and updated type
    onClose: () => void;
    onSave: (userId: string, taskId: string, updatedTaskData: Partial<UserTask>) => Promise<void>;
}

const EditTaskModal: React.FC<EditTaskModalProps> = ({ task, onClose, onSave }) => {
    const [taskContent, setTaskContent] = useState<string>(task.task.replace(/ \[[^\]]+\]$/, '')); // Remove date string for editing
    const [type, setType] = useState<'normal' | 'goal'>(task.type);
    const [goal, setGoal] = useState<number>(task.goal ?? 0);
    const [progress, setProgress] = useState<number>(task.progress ?? 0);
    const [completed, setCompleted] = useState<boolean>(task.completed);
    const [archived, setArchived] = useState<boolean>(task.archived || false); // Use 'task'
    const [startDate, setStartDate] = useState<string>(task.startDate || ""); // Add start date state
    const [dueDate, setDueDate] = useState<string>(task.dueDate || ""); // Add due date state
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
        if (startDate && dueDate && new Date(startDate) > new Date(dueDate)) {
            toast.error("Start date cannot be after the due date.");
            return;
        }


        setIsSaving(true);
        const updatedData: Partial<UserTask> = {
            task: taskContent.trim(), // Base task description
            type: type,
            completed: completed,
            archived: archived, // Include archived status
            startDate: startDate || null, // Include dates, use null if empty
            dueDate: dueDate || null,
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
            // Only set completed to false if goal not met when archiving
            updatedData.completed = (updatedData.progress ?? 0) >= (updatedData.goal ?? Infinity);
        }


        try {
            // Pass updatedData (which now includes 'task' field) to onSave
            // onSave will handle formatting the task string with dates
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
                        <Label className="block text-sm font-medium text-gray-300 mb-1">Task Description</Label>
                        <Textarea
                            value={taskContent}
                            onChange={(e) => setTaskContent(e.target.value)}
                            className={`${inputStyle} min-h-[80px]`}
                            required
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <Label className="block text-sm font-medium text-gray-300 mb-1">Task Type</Label>
                            <Select value={type} onValueChange={(value: 'normal' | 'goal') => setType(value)}>
                                <SelectTrigger className={inputStyle}>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent className="bg-gray-700 text-white border-gray-600">
                                    <SelectItem value="normal">Normal</SelectItem>
                                    <SelectItem value="goal">Goal</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {type === 'goal' && (
                            <>
                                <div>
                                    <Label className="block text-sm font-medium text-gray-300 mb-1">Goal</Label>
                                    <Input
                                        type="number"
                                        value={goal}
                                        onChange={(e) => setGoal(Number(e.target.value))}
                                        className={inputStyle}
                                        min="1"
                                    />
                                </div>
                                <div>
                                    <Label className="block text-sm font-medium text-gray-300 mb-1">Progress</Label>
                                    <Input
                                        type="number"
                                        value={progress}
                                        onChange={(e) => setProgress(Number(e.target.value))}
                                        className={inputStyle}
                                        min="0"
                                        max={goal} // Set max based on goal
                                    />
                                </div>
                            </>
                        )}
                    </div>
                     {/* Date Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="editTaskStartDate" className="block text-sm font-medium text-gray-300 mb-1">
                                Start Date (Optional)
                            </Label>
                            <Input
                                id="editTaskStartDate"
                                type="date"
                                className={`${inputStyle} appearance-none`}
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label htmlFor="editTaskDueDate" className="block text-sm font-medium text-gray-300 mb-1">
                                Due Date (Optional)
                            </Label>
                            <Input
                                id="editTaskDueDate"
                                type="date"
                                className={`${inputStyle} appearance-none`}
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                min={startDate || undefined} // Prevent due date before start date
                            />
                        </div>
                    </div>
                    {/* Archived Checkbox */}
                    <div className="flex items-center space-x-2 pt-2">
                        <Checkbox
                            id="archived"
                            checked={archived}
                            onCheckedChange={(checked) => setArchived(Boolean(checked))}
                            className="h-4 w-4 text-blue-500 border-gray-500 rounded focus:ring-blue-500 bg-gray-600"
                        />
                        <Label htmlFor="archived" className="text-sm text-gray-300">
                            Archive Task (Hides from active/completed lists)
                        </Label>
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
