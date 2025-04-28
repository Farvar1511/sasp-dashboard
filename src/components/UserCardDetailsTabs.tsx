import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { UserTask, DisciplineEntry, NoteEntry } from '../types/User';
import { FirestoreUserWithDetails } from './AdminMenu'; // Assuming type is exported
import { formatIssuedAt } from '../utils/timeHelpers';
import { FaEdit, FaTrash, FaCheckCircle, FaRegCircle } from 'react-icons/fa'; // Added check icons

interface UserCardDetailsTabsProps {
    userData: FirestoreUserWithDetails;
    tasks: UserTask[];
    disciplineEntries: DisciplineEntry[];
    generalNotes: NoteEntry[];
    onEditTask: (user: FirestoreUserWithDetails, task: UserTask) => void;
    onDeleteTask: (userId: string, taskId: string) => void;
    onToggleTaskCompletion: (userId: string, taskId: string, currentStatus: boolean) => void; // Add new prop type
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
    onToggleTaskCompletion, // Destructure the new prop
    textAccent,
    textSecondary,
}) => {

    // Sort tasks: incomplete first, then by issue date descending (already sorted by fetch)
    const sortedTasks = [...(tasks || [])].sort((a, b) => {
        if (a.completed === b.completed) return 0; // Keep original order if same status
        return a.completed ? 1 : -1; // Incomplete first
    });

    return (
        <Tabs defaultValue="tasks" className="w-full mt-2 text-xs"> {/* Base size is xs */}
            <TabsList className="grid w-full grid-cols-3 bg-black/50 border border-white/10 h-8">
                <TabsTrigger value="tasks" className="data-[state=active]:bg-[#f3c700]/20 data-[state=active]:text-[#f3c700] text-white/60 text-[10px] px-1">Tasks ({tasks.length})</TabsTrigger>
                <TabsTrigger value="discipline" className="data-[state=active]:bg-[#f3c700]/20 data-[state=active]:text-[#f3c700] text-white/60 text-[10px] px-1">Discipline ({disciplineEntries.length})</TabsTrigger>
                <TabsTrigger value="notes" className="data-[state=active]:bg-[#f3c700]/20 data-[state=active]:text-[#f3c700] text-white/60 text-[10px] px-1">Notes ({generalNotes.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="tasks" className="mt-2 max-h-32 overflow-y-auto custom-scrollbar pr-1 space-y-1">
                {sortedTasks.length === 0 ? (
                    // Keep italic message size small
                    <p className={`italic ${textSecondary} text-[11px]`}>No tasks assigned.</p>
                ) : (
                    sortedTasks.map(task => (
                        // Increase base font size for the task container
                        <div key={task.id} className={`p-1.5 rounded border text-xs relative group ${task.completed ? 'border-green-700/50 bg-green-900/20 opacity-70' : 'border-white/20 bg-black/40'}`}>
                            {/* Ensure task description uses the new base size */}
                            <p className={`pr-8 ${task.completed ? 'line-through text-white/60' : 'text-white/90'}`}>
                                {task.task} {/* Use task.task for display */}
                                {task.type === 'goal' && (
                                    // Keep goal text slightly smaller if desired, or make it text-xs too
                                    <span className={`ml-1 text-[11px] ${task.completed ? 'text-green-400/70' : textAccent}`}>
                                        ({task.progress ?? 0}/{task.goal})
                                    </span>
                                )}
                            </p>
                            {/* Keep the 'Issued by' text small */}
                            <small className={`block mt-0.5 text-[10px] ${task.completed ? 'text-white/40' : textSecondary}`}>
                                {task.completed ? (
                                    <FaCheckCircle
                                        className="inline mr-1 text-green-500 cursor-pointer hover:text-green-400" // Add cursor and hover effect
                                        title="Mark as Incomplete" // Add title
                                        onClick={() => onToggleTaskCompletion(userData.id, task.id, task.completed)} // Add onClick handler
                                    />
                                ) : (
                                    <FaRegCircle className="inline mr-1 text-white/40" />
                                )}
                                Issued: {formatIssuedAt(task.issueddate, task.issuedtime)} | By: {task.issuedby}
                            </small>
                            {/* Only show Edit/Delete buttons if not completed */}
                            {!task.completed && (
                                <div className="absolute top-1 right-1 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                    <FaEdit title="Edit Task" className="text-white/60 hover:text-[#f3c700] cursor-pointer" size="0.8em" onClick={() => onEditTask(userData, task)} />
                                    <FaTrash title="Delete Task" className="text-red-500 hover:text-red-400 cursor-pointer" size="0.8em" onClick={() => onDeleteTask(userData.id, task.id)} />
                                </div>
                            )}
                        </div>
                    ))
                )}
            </TabsContent>
            {/* ... Discipline and Notes Tabs Content (no changes needed here) ... */}
            <TabsContent value="discipline" className="mt-2 max-h-32 overflow-y-auto custom-scrollbar pr-1 space-y-1">
                 {disciplineEntries.length === 0 ? (
                    <p className={`italic ${textSecondary} text-[11px]`}>No discipline entries.</p>
                 ) : (
                    disciplineEntries.map(entry => (
                        // Increase base font size here too
                        <div key={entry.id} className="p-1.5 rounded border border-red-600/50 bg-red-900/20 text-xs">
                            <p className="text-white/90"><strong className="text-red-400">{entry.type}:</strong> {entry.disciplinenotes}</p>
                            <small className={`block mt-0.5 text-[10px] ${textSecondary}`}>
                                Issued: {formatIssuedAt(entry.issueddate, entry.issuedtime)} | By: {entry.issuedby}
                            </small>
                        </div>
                    ))
                 )}
            </TabsContent>
            <TabsContent value="notes" className="mt-2 max-h-32 overflow-y-auto custom-scrollbar pr-1 space-y-1">
                 {generalNotes.length === 0 ? (
                    <p className={`italic ${textSecondary} text-[11px]`}>No general notes.</p>
                 ) : (
                    generalNotes.map(note => (
                        // Increase base font size here too
                        <div key={note.id} className="p-1.5 rounded border border-blue-600/50 bg-blue-900/20 text-xs">
                            <p className="text-white/90">{note.note}</p>
                            <small className={`block mt-0.5 text-[10px] ${textSecondary}`}>
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
