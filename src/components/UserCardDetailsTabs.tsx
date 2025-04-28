import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { FirestoreUserWithDetails } from './AdminMenu'; // Adjust import path if needed
import { UserTask, DisciplineEntry, NoteEntry } from '../types/User'; // Adjust import path if needed
import { formatIssuedAt } from '../utils/timeHelpers';
import { FaEdit, FaTrash, FaCheckCircle, FaRegCircle, FaArchive, FaUndo } from 'react-icons/fa';

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

    // Filter tasks based on status
    const activeTasks = tasks.filter(task => !task.completed && !task.archived);
    // Filter for the nested tabs
    const completedNonArchivedTasks = tasks.filter(task => task.completed && !task.archived);
    const archivedTasks = tasks.filter(task => task.archived);

    const renderTaskItem = (task: UserTask, tabType: 'active' | 'completed' | 'archived') => (
        <div
            key={task.id}
            // Adjusted padding and margin for nested tabs
            className="p-1.5 border border-gray-600 rounded bg-gray-700/50 text-sm relative group mb-1"
        >
            <p className={`text-gray-300 ${task.completed && tabType !== 'active' ? 'line-through text-gray-500' : ''}`}>
                {task.task}
            </p>
            <small className="text-gray-400 text-xs block">
                {task.type === "goal" ? `Goal: ${task.progress ?? 0}/${task.goal ?? "N/A"} | ` : ''}
                Issued: {formatIssuedAt(task.issueddate, task.issuedtime)} | By: {task.issuedby}
            </small>
            {/* Action Buttons - Adjusted size and positioning slightly */}
            <div className="absolute top-0.5 right-0.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {tabType === 'active' && (
                    <>
                        <FaEdit title="Edit Task" className="text-white/60 hover:text-[#f3c700] cursor-pointer" size="0.75em" onClick={() => onEditTask(userData, task)} />
                        <FaCheckCircle title="Mark Complete" className="text-green-500 hover:text-green-400 cursor-pointer" size="0.75em" onClick={() => onToggleTaskCompletion(userData.id, task.id, false)} />
                    </>
                )}
                 {tabType === 'completed' && (
                    <FaUndo title="Mark Incomplete" className="text-yellow-500 hover:text-yellow-400 cursor-pointer" size="0.75em" onClick={() => onToggleTaskCompletion(userData.id, task.id, true)} />
                 )}
                 {tabType !== 'archived' && (
                     <FaArchive title="Archive Task" className="text-blue-500 hover:text-blue-400 cursor-pointer" size="0.75em" onClick={() => onArchiveTask(userData.id, task.id, false)} />
                 )}
                 {tabType === 'archived' && (
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
            {/* Main Tabs List */}
            <TabsList className="grid w-full grid-cols-4 h-7 p-0 bg-black/40 border border-white/10">
                <TabsTrigger value="active" className="h-full text-[10px] px-1 py-0 data-[state=active]:bg-[#f3c700]/20 data-[state=active]:text-[#f3c700]">
                    Active ({activeTasks.length})
                </TabsTrigger>
                {/* Combined Completed/Archived Tab */}
                <TabsTrigger value="completed" className="h-full text-[10px] px-1 py-0 data-[state=active]:bg-[#f3c700]/20 data-[state=active]:text-[#f3c700]">
                    Completed ({completedNonArchivedTasks.length}) / Archived ({archivedTasks.length})
                </TabsTrigger>
                <TabsTrigger value="discipline" className="h-full text-[10px] px-1 py-0 data-[state=active]:bg-[#f3c700]/20 data-[state=active]:text-[#f3c700]">
                    Discipline ({disciplineEntries.length})
                </TabsTrigger>
                <TabsTrigger value="notes" className="h-full text-[10px] px-1 py-0 data-[state=active]:bg-[#f3c700]/20 data-[state=active]:text-[#f3c700]">
                    Notes ({generalNotes.length})
                </TabsTrigger>
                {/* Removed Archived Tab Trigger */}
            </TabsList>

            {/* Active Tasks Content - Increased max-h */}
            <TabsContent value="active" className="mt-1.5 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                {activeTasks.length === 0 ? (
                    <p className="text-gray-500 italic text-xs text-center py-2">No active tasks.</p>
                ) : (
                    activeTasks.map(task => renderTaskItem(task, 'active'))
                )}
            </TabsContent>

            {/* Completed/Archived Nested Tabs Content */}
            <TabsContent value="completed" className="mt-1.5">
                {/* Nested Tabs for Completed and Archived */}
                <Tabs defaultValue="completed-list" className="w-full text-xs">
                    {/* Nested Tabs List */}
                    <TabsList className="grid w-full grid-cols-2 h-6 p-0 bg-gray-800/50 border border-gray-600">
                        <TabsTrigger value="completed-list" className="h-full text-[9px] px-1 py-0 data-[state=active]:bg-gray-600/50 data-[state=active]:text-white/90 text-white/60">
                            Completed ({completedNonArchivedTasks.length})
                        </TabsTrigger>
                        <TabsTrigger value="archived-list" className="h-full text-[9px] px-1 py-0 data-[state=active]:bg-gray-600/50 data-[state=active]:text-white/90 text-white/60">
                            Archived ({archivedTasks.length})
                        </TabsTrigger>
                    </TabsList>

                    {/* Nested Content for Completed Tasks - Increased max-h */}
                    <TabsContent value="completed-list" className="mt-1 max-h-[calc(9rem-1.5rem)] overflow-y-auto custom-scrollbar pr-1"> {/* Adjusted max-h (9rem = max-h-36) */}
                        {completedNonArchivedTasks.length === 0 ? (
                            <p className="text-gray-500 italic text-xs text-center py-2">No completed tasks.</p>
                        ) : (
                            completedNonArchivedTasks.map(task => renderTaskItem(task, 'completed'))
                        )}
                    </TabsContent>

                    {/* Nested Content for Archived Tasks - Increased max-h */}
                    <TabsContent value="archived-list" className="mt-1 max-h-[calc(9rem-1.5rem)] overflow-y-auto custom-scrollbar pr-1"> {/* Adjusted max-h (9rem = max-h-36) */}
                        {archivedTasks.length === 0 ? (
                            <p className="text-gray-500 italic text-xs text-center py-2">No archived tasks.</p>
                        ) : (
                            archivedTasks.map(task => renderTaskItem(task, 'archived'))
                        )}
                    </TabsContent>
                </Tabs>
            </TabsContent>

            {/* Discipline Content - Increased max-h */}
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

            {/* Notes Content - Increased max-h */}
            <TabsContent value="notes" className="mt-1.5 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                {generalNotes.length === 0 ? (
                    <p className="text-gray-500 italic text-xs text-center py-2">No general notes.</p>
                ) : (
                    generalNotes.map((note) => (
                         // Adjusted padding and margin
                        <div key={note.id} className="p-1.5 border border-gray-600 rounded bg-gray-700/50 text-sm mb-1">
                            <p className="text-gray-300">{note.note}</p>
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

export type { FirestoreUserWithDetails };
