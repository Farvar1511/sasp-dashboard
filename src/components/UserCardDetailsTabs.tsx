import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { UserTask, DisciplineEntry, NoteEntry, FirestoreUserWithDetails } from '../types/User';
import { FaCheckCircle, FaRegCircle, FaEdit, FaTrash, FaArchive, FaUndo, FaExclamationTriangle } from 'react-icons/fa';
import { formatIssuedAt, calculateTimeRemainingPercentage, getTaskTimeColorClass, isDueDatePast } from '../utils/timeHelpers'; // Import new helpers
import { cn } from '../lib/utils';

interface UserCardDetailsTabsProps {
    userData: FirestoreUserWithDetails;
    tasks: UserTask[];
    disciplineEntries: DisciplineEntry[];
    generalNotes: NoteEntry[];
    onEditTask: (user: FirestoreUserWithDetails, task: UserTask) => void;
    onDeleteTask: (userId: string, taskId: string) => void;
    onToggleTaskCompletion: (userId: string, taskId: string, currentStatus: boolean) => void;
    onArchiveTask: (userId: string, taskId: string, currentArchivedStatus: boolean) => void;
    textAccent: string;
    textSecondary: string;
}

const UserCardDetailsTabs: React.FC<UserCardDetailsTabsProps> = ({
    userData,
    tasks,
    disciplineEntries,
    generalNotes,
    onEditTask,
    onDeleteTask,
    onToggleTaskCompletion,
    onArchiveTask,
    textAccent,
    textSecondary,
}) => {

    const activeTasks = tasks.filter(task => !task.archived && !task.completed);
    const completedTasks = tasks.filter(task => !task.archived && task.completed);
    const archivedTasks = tasks.filter(task => task.archived);

    const renderTaskItem = (task: UserTask, isArchivedView: boolean) => {
        const timeRemainingPercentage = calculateTimeRemainingPercentage(task.startDate, task.dueDate);
        const isPast = isDueDatePast(task.dueDate);
        const timeColorClass = (!task.completed && !task.archived && task.dueDate)
            ? getTaskTimeColorClass(timeRemainingPercentage, isPast)
            : 'text-gray-300'; // Default color if completed, archived, or no due date

        return (
            <div
                key={task.id}
                className={cn(
                    "flex flex-row justify-between items-center p-1.5 border-b border-white/10 last:border-b-0 text-xs",
                    task.completed && !isArchivedView && "bg-green-800/40", // Green background for completed (non-archived)
                    isArchivedView && "opacity-70" // Dim archived tasks slightly
                )}
            >
                <div className="flex-grow mr-2 overflow-hidden">
                    <p
                        className={cn(
                            "truncate",
                            task.completed ? "text-white/90" : timeColorClass, // Remove line-through, ensure text is white/light for completed
                            task.archived && 'italic' // Italicize archived task text
                        )}
                        title={task.task} // Show full task on hover
                    >
                        {task.task}
                        {isPast && !task.completed && !task.archived && <FaExclamationTriangle className="inline ml-1 text-red-500" title="Past Due" />}
                    </p>
                    <p className="text-[10px] text-white/50 mt-0.5">
                        Issued: {formatIssuedAt(task.issueddate, task.issuedtime)} by {task.issuedby}
                        {task.type === 'goal' && task.goal != null && ` | Goal: ${task.progress ?? 0}/${task.goal}`}
                    </p>
                </div>
                <div className="flex flex-row space-x-1 items-center flex-shrink-0 ml-2">
                    {/* Toggle Completion Button */}
                    <button
                        onClick={() => onToggleTaskCompletion(userData.id, task.id, task.completed)}
                        className={cn(
                            "p-1 rounded hover:bg-white/10 transition-colors", // Standard padding
                            task.completed ? 'text-green-400 hover:text-green-300' : 'text-gray-400 hover:text-white',
                            task.archived && 'text-orange-500 hover:text-orange-400' // Adjust icon color if archived
                        )}
                        title={task.completed ? "Mark as Incomplete" : "Mark as Complete"}
                        disabled={task.archived} // Disable completion toggle for archived tasks
                    >
                        {task.completed ? <FaCheckCircle size="0.8rem" /> : <FaRegCircle size="0.8rem" />}
                    </button>
                    {/* Edit Button */}
                     {!isArchivedView && ( // Only show Edit on Active/Completed tasks (not in Archived view)
                        <button
                            onClick={() => onEditTask(userData, task)}
                            className={`p-1 rounded text-blue-400 hover:text-blue-300 hover:bg-white/10 transition-colors`} // Standard padding
                            title="Edit Task"
                        >
                            <FaEdit size="0.8rem" />
                        </button>
                     )}
                    {/* Archive/Unarchive Button */}
                    <button
                        onClick={() => onArchiveTask(userData.id, task.id, task.archived ?? false)}
                        className={`p-1 rounded hover:bg-white/10 transition-colors ${task.archived ? 'text-yellow-500 hover:text-yellow-400' : 'text-gray-400 hover:text-white'}`} // Standard padding
                        title={task.archived ? "Unarchive Task" : "Archive Task"}
                    >
                        {task.archived ? <FaUndo size="0.8rem" /> : <FaArchive size="0.8rem" />}
                    </button>
                    {/* Delete Button (Consider if needed on archived tasks) */}
                    <button
                        onClick={() => onDeleteTask(userData.id, task.id)}
                        className={`p-1 rounded text-red-500 hover:text-red-400 hover:bg-white/10 transition-colors`} // Standard padding
                        title="Delete Task"
                    >
                        <FaTrash size="0.8rem" />
                    </button>
                </div>
            </div>
        );
    };

    const renderDisciplineItem = (entry: DisciplineEntry) => (
        <div key={entry.id} className="p-2 border-b border-white/10 last:border-b-0">
            <p className="text-sm text-white font-semibold uppercase">{entry.type}</p>
            <p className="text-xs text-white/80 mt-0.5">{entry.disciplinenotes}</p>
            <p className="text-[10px] text-white/50 mt-0.5">
                Issued: {formatIssuedAt(entry.issueddate, entry.issuedtime)} by {entry.issuedby}
            </p>
        </div>
    );

    const renderNoteItem = (note: NoteEntry) => (
        <div key={note.id} className="p-2 border-b border-white/10 last:border-b-0">
            <p className="text-sm text-white">{note.note}</p>
            <p className="text-[10px] text-white/50 mt-0.5">
                Issued: {formatIssuedAt(note.issueddate, note.issuedtime)} by {note.issuedby}
            </p>
            {/* Add Edit/Delete buttons for notes if needed */}
        </div>
    );

    return (
        <Tabs defaultValue="tasks" className="w-full text-xs mt-2">
            <TabsList className="grid w-full grid-cols-5 h-7 p-0 bg-black/50 border border-white/10 rounded-md">
                <TabsTrigger value="tasks" className="h-full text-[10px] px-1 py-0 rounded-l-sm data-[state=active]:bg-[#f3c700]/20 data-[state=active]:text-[#f3c700]">Active ({activeTasks.length})</TabsTrigger>
                <TabsTrigger value="completed_tasks" className="h-full text-[10px] px-1 py-0 data-[state=active]:bg-[#f3c700]/20 data-[state=active]:text-[#f3c700]">Completed ({completedTasks.length})</TabsTrigger>
                <TabsTrigger value="archived_tasks" className="h-full text-[10px] px-1 py-0 data-[state=active]:bg-[#f3c700]/20 data-[state=active]:text-[#f3c700]">Archived ({archivedTasks.length})</TabsTrigger>
                <TabsTrigger value="discipline" className="h-full text-[10px] px-1 py-0 data-[state=active]:bg-[#f3c700]/20 data-[state=active]:text-[#f3c700]">Discipline ({disciplineEntries.length})</TabsTrigger>
                <TabsTrigger value="notes" className="h-full text-[10px] px-1 py-0 rounded-r-sm data-[state=active]:bg-[#f3c700]/20 data-[state=active]:text-[#f3c700]">Notes ({generalNotes.length})</TabsTrigger>
            </TabsList>

            {/* Active Tasks Tab */}
            <TabsContent value="tasks" className="mt-1 max-h-28 overflow-y-auto custom-scrollbar border border-white/10 rounded-b-md bg-black/30">
                {activeTasks.length > 0 ? (
                    activeTasks.map(task => renderTaskItem(task, false))
                ) : (
                    <p className="p-2 text-center text-[10px] text-white/50 italic">No active tasks.</p> // Standard padding
                )}
            </TabsContent>

             {/* Completed Tasks Tab */}
            <TabsContent value="completed_tasks" className="mt-1 max-h-28 overflow-y-auto custom-scrollbar border border-white/10 rounded-b-md bg-black/30">
                {completedTasks.length > 0 ? (
                    completedTasks.map(task => renderTaskItem(task, false))
                ) : (
                    <p className="p-2 text-center text-[10px] text-white/50 italic">No completed tasks.</p> // Standard padding
                )}
            </TabsContent>

            {/* Archived Tasks Tab */}
            <TabsContent value="archived_tasks" className="mt-1 max-h-28 overflow-y-auto custom-scrollbar border border-white/10 rounded-b-md bg-black/30">
                {archivedTasks.length > 0 ? (
                    archivedTasks.map(task => renderTaskItem(task, true))
                ) : (
                    <p className="p-2 text-center text-[10px] text-white/50 italic">No archived tasks.</p> // Standard padding
                )}
            </TabsContent>

            {/* Discipline Tab */}
            <TabsContent value="discipline" className="mt-1 max-h-28 overflow-y-auto custom-scrollbar border border-white/10 rounded-b-md bg-black/30">
                {disciplineEntries.length > 0 ? (
                    disciplineEntries.map(renderDisciplineItem)
                ) : (
                    <p className="p-2 text-center text-[10px] text-white/50 italic">No discipline entries.</p> // Standard padding
                )}
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes" className="mt-1 max-h-28 overflow-y-auto custom-scrollbar border border-white/10 rounded-b-md bg-black/30">
                {generalNotes.length > 0 ? (
                    generalNotes.map(renderNoteItem)
                ) : (
                    <p className="p-2 text-center text-[10px] text-white/50 italic">No general notes.</p> // Standard padding
                )}
            </TabsContent>
        </Tabs>
    );
};

export default UserCardDetailsTabs;
