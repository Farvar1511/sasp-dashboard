import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { UserTask, DisciplineEntry, NoteEntry, FirestoreUserWithDetails } from '../types/User'; // Ensure FirestoreUserWithDetails is imported
import { formatIssuedAt } from '../utils/timeHelpers';
import { FaEdit, FaTrash, FaArchive, FaUndo } from 'react-icons/fa';

interface UserCardDetailsTabsProps {
    userData: FirestoreUserWithDetails; // Use the extended type
    tasks: UserTask[];
    disciplineEntries: DisciplineEntry[];
    generalNotes: NoteEntry[];
    onEditTask: (user: FirestoreUserWithDetails, task: UserTask) => void;
    onDeleteTask: (userId: string, taskId: string) => void;
    onToggleTaskCompletion: (userId: string, taskId: string, currentStatus: boolean) => void;
    onArchiveTask: (userId: string, taskId: string, currentArchivedStatus: boolean) => void; // Add archive handler prop
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
    onArchiveTask, // Destructure archive handler
    textAccent,
    textSecondary,
}) => {
    // Filter tasks based on archived status
    const activeTasks = tasks.filter(task => !task.archived);
    const archivedTasks = tasks.filter(task => task.archived);

    const renderTaskItem = (task: UserTask, tabType: 'active' | 'archived') => (
        <div
            key={task.id}
            // Adjusted padding and margin for nested tabs
            className="p-1.5 border border-gray-600 rounded bg-gray-700/50 text-sm relative group mb-1"
        >
            {/* Apply line-through style if completed, regardless of tab */}
            <p className={`text-gray-300 ${task.completed ? 'line-through text-gray-500' : ''}`}>
                {task.task}
            </p>
            <small className="text-gray-400 text-xs block">
                {task.type === "goal" ? `Goal: ${task.progress ?? 0}/${task.goal ?? "N/A"} | ` : ''}
                Issued: {formatIssuedAt(task.issueddate, task.issuedtime)} | By: {task.issuedby}
            </small>
            {/* Action buttons */}
            <div className="absolute top-0 right-0 flex items-center space-x-1 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-gray-800/80 rounded-bl">
                 {/* Toggle Completion - Show only in Active tab */}
                 {tabType === 'active' && (
                     <input
                         type="checkbox"
                         checked={task.completed}
                         onChange={() => onToggleTaskCompletion(userData.id, task.id, task.completed)}
                         className="h-3 w-3 text-[#f3c700] border-gray-500 rounded focus:ring-[#f3c700] bg-gray-600 cursor-pointer"
                         title={task.completed ? "Mark Incomplete" : "Mark Complete"}
                         // Disable if goal not met
                         disabled={task.type === 'goal' && !task.completed && (task.progress ?? 0) < (task.goal ?? Infinity)}
                     />
                 )}
                 {/* Edit button - Show only in Active tab */}
                 {tabType === 'active' && (
                     <FaEdit title="Edit Task" className={`${textAccent} hover:text-yellow-300 cursor-pointer`} size="0.75em" onClick={() => onEditTask(userData, task)} />
                 )}
                 {/* Archive/Unarchive button */}
                 {tabType === 'active' ? (
                     <FaArchive title="Archive Task" className="text-blue-500 hover:text-blue-400 cursor-pointer" size="0.75em" onClick={() => onArchiveTask(userData.id, task.id, false)} />
                 ) : ( // tabType === 'archived'
                     <FaUndo title="Unarchive Task" className="text-blue-500 hover:text-blue-400 cursor-pointer" size="0.75em" onClick={() => onArchiveTask(userData.id, task.id, true)} />
                 )}
                {/* Delete button always available */}
                <FaTrash title="Delete Task" className="text-red-500 hover:text-red-400 cursor-pointer" size="0.75em" onClick={() => onDeleteTask(userData.id, task.id)} />
            </div>
        </div>
    );

    return (
        // Main Tabs component
        <Tabs defaultValue="active" className="w-full text-xs mt-2">
            {/* Main Tabs List - Simplified */}
            <TabsList className="grid w-full grid-cols-4 h-7 p-0 bg-black/40 border border-white/10">
                <TabsTrigger value="active" className="h-full text-[10px] px-1 py-0 data-[state=active]:bg-[#f3c700]/20 data-[state=active]:text-[#f3c700]">
                    Active Tasks ({activeTasks.length})
                </TabsTrigger>
                <TabsTrigger value="archived" className="h-full text-[10px] px-1 py-0 data-[state=active]:bg-[#f3c700]/20 data-[state=active]:text-[#f3c700]">
                    Archived ({archivedTasks.length})
                </TabsTrigger>
                <TabsTrigger value="discipline" className="h-full text-[10px] px-1 py-0 data-[state=active]:bg-[#f3c700]/20 data-[state=active]:text-[#f3c700]">
                    Discipline ({disciplineEntries.length})
                </TabsTrigger>
                <TabsTrigger value="notes" className="h-full text-[10px] px-1 py-0 data-[state=active]:bg-[#f3c700]/20 data-[state=active]:text-[#f3c700]">
                    Notes ({generalNotes.length})
                </TabsTrigger>
            </TabsList>

            {/* Active Tasks Content */}
            <TabsContent value="active" className="mt-1.5 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                {activeTasks.length === 0 ? (
                    <p className="text-gray-500 italic text-xs text-center py-2">No active tasks.</p>
                ) : (
                    activeTasks.map(task => renderTaskItem(task, 'active'))
                )}
            </TabsContent>

            {/* Archived Tasks Content */}
            <TabsContent value="archived" className="mt-1.5 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                {archivedTasks.length === 0 ? (
                    <p className="text-gray-500 italic text-xs text-center py-2">No archived tasks.</p>
                ) : (
                    archivedTasks.map(task => renderTaskItem(task, 'archived'))
                )}
            </TabsContent>

            {/* Discipline Content */}
            <TabsContent value="discipline" className="mt-1.5 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                {disciplineEntries.length === 0 ? (
                    <p className="text-gray-500 italic text-xs text-center py-2">No discipline entries.</p>
                ) : (
                    disciplineEntries.map((entry) => (
                        // Adjusted padding and margin
                        <div key={entry.id} className="p-1.5 border border-gray-600 rounded bg-gray-700/50 text-sm mb-1">
                            <p className="text-gray-300 font-semibold capitalize">{entry.type}</p>
                            <p className="text-gray-400 text-xs">{entry.disciplinenotes}</p>
                            <small className="text-gray-500 text-[10px] block mt-0.5">
                                Issued: {formatIssuedAt(entry.issueddate, entry.issuedtime)} | By: {entry.issuedby}
                            </small>
                        </div>
                    ))
                )}
            </TabsContent>

            {/* Notes Content */}
            <TabsContent value="notes" className="mt-1.5 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                {generalNotes.length === 0 ? (
                    <p className="text-gray-500 italic text-xs text-center py-2">No general notes.</p>
                ) : (
                    generalNotes.map((note) => (
                        // Adjusted padding and margin
                        <div key={note.id} className="p-1.5 border border-gray-600 rounded bg-gray-700/50 text-sm mb-1">
                            <p className="text-gray-400 text-xs">{note.note}</p>
                            <small className="text-gray-500 text-[10px] block mt-0.5">
                                Issued: {formatIssuedAt(note.issueddate, note.issuedtime)} | By: {note.issuedby}
                            </small>
                        </div>
                    ))
                )}
            </TabsContent>
        </Tabs>
    );
};

export default UserCardDetailsTabs;
