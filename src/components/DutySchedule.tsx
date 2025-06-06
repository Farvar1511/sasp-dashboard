import React, { useState, useEffect, useCallback } from 'react';
import Layout from './Layout';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, collection, query, where, getDocs, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db as dbFirestore } from '../firebase';
import { PlusCircle, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';
import { getRandomQuote } from '../utils/Quotes';

// Mock UI components (replace with your actual UI library components e.g., from shadcn/ui)
const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; className?: string }> = ({ children, className, ...props }) => (
  <button {...props} className={`px-4 py-2 rounded font-medium transition-colors ${className}`}>
    {children}
  </button>
);

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}
const Modal: React.FC<ModalProps> = ({ open, onOpenChange, children }) => open ? (
  <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => onOpenChange(false)}>
    {children}
  </div>
) : null;

const ModalContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className, ...props }) => (
  <div {...props} className={`bg-card text-card-foreground border border-border rounded-lg shadow-xl p-6 w-full max-w-md ${className}`} onClick={e => e.stopPropagation()}>
    {children}
  </div>
);
const ModalHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className, ...props }) => <div {...props} className={`mb-4 ${className}`}>{children}</div>;
const ModalBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className, ...props }) => <div {...props} className={`mb-6 ${className}`}>{children}</div>;
const ModalFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className, ...props }) => <div {...props} className={`flex justify-end space-x-3 ${className}`}>{children}</div>;

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input {...props} className={`w-full p-2 rounded bg-input border border-border placeholder-muted-foreground focus:ring-2 focus:ring-ring focus:border-ring text-foreground ${props.className}`} />
);
// End Mock UI components

// Add rank abbreviations mapping
const rankAbbreviations: { [key: string]: string } = {
  'Commissioner': 'Comm.',
  'Deputy Commissioner': 'D.Comm.',
  'Assistant Commissioner': 'A.Comm.',
  'Commander': 'Cmdr.',
  'Captain': 'Capt.',
  'Lieutenant': 'Lt.',
  'Master Sergeant': 'M.Sgt.',
  'Gunnery Sergeant': 'G.Sgt.',
  'Sergeant': 'Sgt.',
  'Corporal': 'Cpl.',
  'Master Trooper': 'M.Tpr.',
  'Senior Trooper': 'S.Tpr.',
  'Trooper First Class': 'Tpr.1C',
  'Trooper Second Class': 'Tpr.2C',
  'Trooper': 'Tpr.',
  'Probationary Trooper': 'P.Tpr.',
  'Cadet': 'Cdt.',
};

// Helper function to format display name
const formatDisplayName = (name: string, rank: string): string => {
  if (!name) return 'Unknown User';
  
  const nameParts = name.trim().split(' ');
  
  if (nameParts.length >= 2) {
    const firstInitial = nameParts[0].charAt(0).toUpperCase();
    const lastName = nameParts[nameParts.length - 1];
    return `${firstInitial}. ${lastName}`;
  }
  
  return name;
};

// Helper to get days of the week, starting from Sunday
const getWeekDays = (startDate: Date): Date[] => {
  const days: Date[] = [];
  const startOfWeek = new Date(startDate);
  startOfWeek.setDate(startDate.getDate() - startDate.getDay()); // Adjust to Sunday
  for (let i = 0; i < 7; i++) {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    days.push(day);
  }
  return days;
};

// Helper to convert 24-hour to 12-hour format
const formatHour12 = (hour: number): string => {
  if (hour === 0) return '12:00 AM';
  if (hour < 12) return `${hour}:00 AM`;
  if (hour === 12) return '12:00 PM';
  return `${hour - 12}:00 PM`;
};

// Helper to get EST time in user's timezone
const getESTTimeInUserTZ = (estHour: number): number => {
  // Create a date object to check if we're in DST
  const now = new Date();
  const january = new Date(now.getFullYear(), 0, 1);
  const july = new Date(now.getFullYear(), 6, 1);
  
  // Get timezone offsets
  const janOffset = january.getTimezoneOffset();
  const julyOffset = july.getTimezoneOffset();
  const currentOffset = now.getTimezoneOffset();
  
  // Determine if we're in DST (offset is smaller in DST)
  const isDST = currentOffset === Math.min(janOffset, julyOffset);
  
  // EST/EDT offset from UTC (EST = UTC-5, EDT = UTC-4)
  const eastCoastOffset = isDST ? 4 * 60 : 5 * 60; // minutes behind UTC
  
  // If user is on East Coast (within 1 hour tolerance)
  if (Math.abs(currentOffset - eastCoastOffset) < 60) {
    return estHour; // Return EST hour directly since user is in same timezone
  }
  
  // For other timezones, convert properly
  const offsetDiff = (currentOffset - eastCoastOffset) / 60;
  let userHour = estHour - offsetDiff;
  
  // Handle day wraparound
  if (userHour < 0) userHour += 24;
  if (userHour >= 24) userHour -= 24;
  
  return Math.floor(userHour);
};

// Reorder hours to start at 8 AM
const getOrderedHours = (): number[] => {
  const hours = [];
  // Start at 8 AM and go to 11 PM
  for (let i = 8; i <= 23; i++) {
    hours.push(i);
  }
  // Then add midnight to 7 AM
  for (let i = 0; i <= 7; i++) {
    hours.push(i);
  }
  return hours;
};

const orderedHours = getOrderedHours();

// Get server reset hours in user's timezone
const serverResetEvening = getESTTimeInUserTZ(18); // 6 PM EST
const serverResetMorning = getESTTimeInUserTZ(8);  // 8 AM EST

interface Shift {
  userId: string;
  userName: string;
  notes?: string;
}

interface ScheduleData {
  [dateKey: string]: { // YYYY-MM-DD
    [hour: number]: Shift[] | undefined; // Changed to array of shifts
  };
}

const DutySchedule: React.FC = () => {
  const { user: authUser } = useAuth(); // Get authenticated user
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    displayName: string;
    rank: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedule, setSchedule] = useState<ScheduleData>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ day: Date; hour: number } | null>(null);
  const [shiftUserName, setShiftUserName] = useState(currentUser?.name || '');
  const [shiftNotes, setShiftNotes] = useState('');

  const weekDays = getWeekDays(currentDate);

  const formatDateKey = (date: Date): string => date.toISOString().split('T')[0];

  // Save shift to Firestore
  const saveShiftToFirestore = async (dateKey: string, hour: number, shift: Shift) => {
    try {
      const shiftId = `${dateKey}-${hour}-${shift.userId}`;
      await setDoc(doc(dbFirestore, 'dutySchedule', shiftId), {
        dateKey,
        hour,
        userId: shift.userId,
        userName: shift.userName,
        notes: shift.notes || '',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error saving shift to Firestore:', error);
      alert('Failed to save shift. Please try again.');
    }
  };

  // Delete shift from Firestore
  const deleteShiftFromFirestore = async (dateKey: string, hour: number, userId: string) => {
    try {
      const shiftId = `${dateKey}-${hour}-${userId}`;
      await deleteDoc(doc(dbFirestore, 'dutySchedule', shiftId));
    } catch (error) {
      console.error('Error deleting shift from Firestore:', error);
      alert('Failed to delete shift. Please try again.');
    }
  };

  // Load schedule from Firestore
  const loadScheduleFromFirestore = async () => {
    try {
      const startDate = weekDays[0];
      const endDate = weekDays[6];
      
      const scheduleQuery = query(
        collection(dbFirestore, 'dutySchedule'),
        where('dateKey', '>=', formatDateKey(startDate)),
        where('dateKey', '<=', formatDateKey(endDate))
      );
      
      const querySnapshot = await getDocs(scheduleQuery);
      const newSchedule: ScheduleData = {};
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const { dateKey, hour, userId, userName, notes } = data;
        
        if (!newSchedule[dateKey]) newSchedule[dateKey] = {};
        if (!newSchedule[dateKey][hour]) newSchedule[dateKey][hour] = [];
        newSchedule[dateKey][hour]!.push({ userId, userName, notes });
      });
      
      setSchedule(newSchedule);
    } catch (error) {
      console.error('Error loading schedule from Firestore:', error);
    }
  };

  // Fetch user data from Firestore
  useEffect(() => {
    const fetchUserData = async () => {
      if (!authUser?.email) {
        setLoading(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(dbFirestore, 'users', authUser.email));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const formattedDisplayName = formatDisplayName(userData.name || '', userData.rank || '');
          
          setCurrentUser({
            id: authUser.email,
            name: userData.name || 'Unknown User',
            displayName: formattedDisplayName,
            rank: userData.rank || 'Unknown'
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [authUser]);

  // Load schedule when week changes
  useEffect(() => {
    if (currentUser) {
      loadScheduleFromFirestore();
    }
  }, [currentDate, currentUser]);

  // Update initial state for shift user name
  useEffect(() => {
    if (currentUser) {
      setShiftUserName(currentUser.displayName);
    }
  }, [currentUser]);

  const handleSlotClick = async (day: Date, hour: number) => {
    if (!currentUser) return;

    const dateKey = formatDateKey(day);
    const existingShifts = schedule[dateKey]?.[hour] || [];
    const userShift = existingShifts.find(shift => shift.userId === currentUser.id);

    if (userShift) {
      // If user already has a shift in this slot, remove it directly
      const newSchedule = { ...schedule };
      newSchedule[dateKey]![hour] = existingShifts.filter(shift => shift.userId !== currentUser.id);
      
      // Remove the hour entry if no shifts remain
      if (newSchedule[dateKey]![hour]!.length === 0) {
        delete newSchedule[dateKey]![hour];
        
        // Remove the date entry if no hours remain
        if (Object.keys(newSchedule[dateKey]!).length === 0) {
          delete newSchedule[dateKey];
        }
      }
      
      setSchedule(newSchedule);
      
      // Delete from Firestore
      await deleteShiftFromFirestore(dateKey, hour, currentUser.id);
    } else {
      // If user doesn't have a shift in this slot, assign current user directly
      const newShift: Shift = { 
        userId: currentUser.id, 
        userName: currentUser.displayName, 
        notes: '' 
      };
      
      const newSchedule = { ...schedule };
      if (!newSchedule[dateKey]) newSchedule[dateKey] = {};
      if (!newSchedule[dateKey][hour]) newSchedule[dateKey][hour] = [];
      newSchedule[dateKey][hour]!.push(newShift);
      setSchedule(newSchedule);
      
      // Save to Firestore
      await saveShiftToFirestore(dateKey, hour, newShift);
    }
  };

  const handleOpenModalGeneral = () => {
    if (!currentUser) return;
    setSelectedSlot(null);
    setShiftUserName(currentUser.displayName);
    setShiftNotes('');
    setIsModalOpen(true);
  };
  
  const handleOpenModalForSlot = (day: Date, hour: number) => {
    if (!currentUser) return;
    const dateKey = formatDateKey(day);
    const shifts = schedule[dateKey]?.[hour] || [];
    const userShift = shifts.find(shift => shift.userId === currentUser.id);
    setSelectedSlot({ day, hour });
    setShiftUserName(userShift?.userName || currentUser.displayName);
    setShiftNotes(userShift?.notes || '');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedSlot(null);
    setShiftNotes('');
  };

  const handleSaveShift = async () => {
    if (!shiftUserName.trim() || !currentUser) {
      alert("User name cannot be empty.");
      return;
    }
    
    if (!selectedSlot) {
        alert("Please select a time slot on the calendar first.");
        return;
    }

    const { day, hour } = selectedSlot;
    const dateKey = formatDateKey(day);

    const newSchedule = { ...schedule };
    if (!newSchedule[dateKey]) newSchedule[dateKey] = {};
    if (!newSchedule[dateKey][hour]) newSchedule[dateKey][hour] = [];
    
    const existingShifts = newSchedule[dateKey][hour]!
    const userShiftIndex = existingShifts.findIndex(shift => shift.userId === currentUser.id);
    
    const updatedShift: Shift = {
        userId: currentUser.id,
        userName: shiftUserName.trim(),
        notes: shiftNotes.trim()
    };
    
    if (userShiftIndex >= 0) {
      // Update existing shift
      existingShifts[userShiftIndex] = updatedShift;
    } else {
      // Add new shift
      existingShifts.push(updatedShift);
    }
    
    setSchedule(newSchedule);
    
    // Save to Firestore
    await saveShiftToFirestore(dateKey, hour, updatedShift);
    
    handleCloseModal();
  };
  
  const handleRemoveShift = async () => {
    if (!selectedSlot || !currentUser) return;
    const { day, hour } = selectedSlot;
    const dateKey = formatDateKey(day);

    const existingShifts = schedule[dateKey]?.[hour];
    if (!existingShifts) return;

    const newSchedule = { ...schedule };
    const userShiftIndex = existingShifts.findIndex(shift => shift.userId === currentUser.id);
    
    if (userShiftIndex >= 0) {
      newSchedule[dateKey]![hour] = existingShifts.filter(shift => shift.userId !== currentUser.id);
      
      // Remove the hour entry if no shifts remain
      if (newSchedule[dateKey]![hour]!.length === 0) {
        delete newSchedule[dateKey]![hour];
        
        // Remove the date entry if no hours remain
        if (Object.keys(newSchedule[dateKey]!).length === 0) {
          delete newSchedule[dateKey];
        }
      }
      
      setSchedule(newSchedule);
      
      // Delete from Firestore
      await deleteShiftFromFirestore(dateKey, hour, currentUser.id);
    }
    handleCloseModal();
  };

  const changeWeek = (offset: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + offset * 7);
    setCurrentDate(newDate);
    // Schedule for the new week will be empty as it's based on current component state.
  };

  // Show loading state while fetching user data
  if (loading) {
    return (
      <Layout>
        <div className="p-4 md:p-6 bg-black text-white min-h-screen">
          <div className="flex justify-center items-center h-64">
            <p className="text-lg">Loading schedule...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Show error if no user found
  if (!currentUser) {
    return (
      <Layout>
        <div className="p-4 md:p-6 bg-black text-white min-h-screen">
          <div className="flex justify-center items-center h-64">
            <p className="text-lg text-red-400">Unable to load user data. Please try refreshing the page.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 bg-background text-foreground min-h-screen">
        <div className="flex flex-col lg:flex-row justify-between items-center mb-6 gap-4">
          <div className="bg-card/80 backdrop-blur-sm border border-border rounded-lg p-4 flex-shrink-0">
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Duty Schedule</h1>
            <p className="text-xs text-muted-foreground mt-1">Logged in as: {currentUser.displayName}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Server Reset: {formatHour12(serverResetEvening)} & {formatHour12(serverResetMorning)}
            </p>
          </div>

          <div className="bg-card/80 backdrop-blur-sm border border-border rounded-lg p-4 flex-grow max-w-2xl">
            <h3 className="text-lg font-bold text-foreground mb-2 text-center">Quote of the Day</h3>
            <blockquote className="text-muted-foreground italic text-sm leading-relaxed text-center">
              "{getRandomQuote()}"
            </blockquote>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            <Button onClick={() => changeWeek(-1)} variant="outline" className="bg-secondary hover:bg-secondary/80 border-border text-secondary-foreground">
              <ChevronLeft size={16} className="mr-1" /> Prev
            </Button>
            <Button onClick={() => changeWeek(1)} variant="outline" className="bg-secondary hover:bg-secondary/80 border-border text-secondary-foreground">
              Next <ChevronRight size={16} className="ml-1" />
            </Button>
            <Button onClick={handleOpenModalGeneral} className="bg-secondary hover:bg-secondary/80 border border-[#f3c700] text-[#f3c700] hover:text-[#f3c700]/90 transition-colors">
              <PlusCircle size={16} className="mr-1" /> Add
            </Button>
          </div>
        </div>
        
        <div className="text-center mb-4">
          <div className="inline-block bg-card/80 backdrop-blur-sm border border-border rounded-lg px-6 py-3">
            <h2 className="text-lg font-semibold text-foreground">
              Week of: {weekDays[0].toLocaleDateString()} - {weekDays[6].toLocaleDateString()}
            </h2>
          </div>
        </div>

        <div className="overflow-x-auto shadow-lg rounded-lg border border-border">
          <table className="min-w-full border-collapse bg-card">
            <thead className="sticky top-0 z-10">
              <tr className="bg-black border-b" style={{ borderColor: 'oklch(0.269 0 0)' }}>
                <th className="p-2 md:p-3 border-r w-20 md:w-24 text-xs md:text-sm text-white font-medium bg-black" style={{ borderColor: 'oklch(0.269 0 0)' }}>Time</th>
                {weekDays.map(day => (
                  <th key={formatDateKey(day)} className="p-2 md:p-3 border-r last:border-r-0 text-xs md:text-sm text-white font-medium bg-black" style={{ borderColor: 'oklch(0.269 0 0)' }}>
                    {day.toLocaleDateString(undefined, { weekday: 'short' })}
                    <br />
                    <span style={{ color: 'oklch(0.7 0 0)' }}>
                      {day.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-black">
              {orderedHours.map((hour, index) => {
                const isServerReset = hour === serverResetEvening || hour === serverResetMorning;
                const isOddRow = index % 2 === 1;
                
                return (
                  <React.Fragment key={hour}>
                    {isServerReset && (
                      <tr>
                        <td colSpan={8} className="h-1 bg-[#f3c700] border-0 p-0">
                          <div className="w-full h-1 bg-gradient-to-r from-[#f3c700] via-[#f3c700] to-[#f3c700]"></div>
                        </td>
                      </tr>
                    )}
                    <tr className={`border-b transition-colors duration-200 ${
                      isOddRow ? 'hover:bg-gray-800' : 'hover:bg-gray-800'
                    } ${isServerReset ? 'border-t-2 border-[#f3c700]' : ''}`} 
                    style={{ 
                      backgroundColor: isOddRow ? 'oklch(0.15 0 0)' : 'oklch(0.08 0 0)',
                      borderColor: 'oklch(0.269 0 0)'
                    }}>
                      <td className="p-2 md:p-3 border-r text-center font-medium text-xs md:text-sm bg-inherit" style={{ borderColor: 'oklch(0.269 0 0)' }}>
                        <div className="flex flex-col">
                          <span className="font-bold text-white">{formatHour12(hour)}</span>
                          {isServerReset && (
                            <span className="text-xs text-[#f3c700] font-semibold mt-1">
                              {hour === serverResetEvening ? 'Evening Reset' : 'Morning Reset'}
                            </span>
                          )}
                        </div>
                      </td>
                      {weekDays.map(day => {
                        const dateKey = formatDateKey(day);
                        const shifts = schedule[dateKey]?.[hour] || [];
                        const userShift = shifts.find(shift => shift.userId === currentUser.id);
                        const hasMultipleShifts = shifts.length > 1;
                        
                        return (
                          <td
                            key={`${dateKey}-${hour}`}
                            className={`p-1 md:p-2 border-r last:border-r-0 h-16 md:h-18 text-center relative group cursor-pointer transition-all duration-200
                                         ${shifts.length > 0 ? (
                                           userShift 
                                             ? 'border-l-2 border-l-green-400' 
                                             : ''
                                         ) : ''}
                                         ${isServerReset ? 'border-t-2 border-t-[#f3c700]' : ''}`}
                            style={{
                              backgroundColor: shifts.length > 0
                                ? (userShift 
                                    ? 'oklch(0.4 0.15 140 / 20%)' // Light neutral green for user's shifts
                                    : 'oklch(0.3 0 0)') // Neutral light gray for others
                                : 'transparent',
                              borderRightColor: 'oklch(0.269 0 0)',
                              borderTopColor: isServerReset ? '#f3c700' : 'oklch(0.269 0 0)'
                            }}
                            onMouseEnter={(e) => {
                              if (shifts.length === 0) {
                                e.currentTarget.style.backgroundColor = 'oklch(0.25 0 0)';
                              } else if (userShift) {
                                e.currentTarget.style.backgroundColor = 'oklch(0.4 0.15 140 / 30%)';
                              } else {
                                e.currentTarget.style.backgroundColor = 'oklch(0.35 0 0)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (shifts.length === 0) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              } else if (userShift) {
                                e.currentTarget.style.backgroundColor = 'oklch(0.4 0.15 140 / 20%)';
                              } else {
                                e.currentTarget.style.backgroundColor = 'oklch(0.3 0 0)';
                              }
                            }}
                            onClick={() => handleSlotClick(day, hour)}
                          >
                            {shifts.length > 0 ? (
                              <div className="text-xs md:text-sm flex flex-col justify-center items-center h-full overflow-hidden">
                                {hasMultipleShifts && (
                                  <div className="absolute top-1 left-1 bg-[#f3c700] text-black text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                                    {shifts.length}
                                  </div>
                                )}
                                {shifts.slice(0, 3).map((shift, index) => (
                                  <span 
                                    key={shift.userId}
                                    className={`font-semibold truncate w-full px-1 text-xs ${
                                      shift.userId === currentUser.id ? 'text-green-400' : ''
                                    }`}
                                    style={{
                                      color: shift.userId !== currentUser.id ? 'oklch(0.85 0.1726 92.66 / 70%)' : undefined
                                    }}
                                  >
                                    {shift.userName}
                                  </span>
                                ))}
                                {shifts.length > 3 && (
                                  <span className="text-xs" style={{ color: 'oklch(0.7 0 0)' }}>
                                    +{shifts.length - 3} more
                                  </span>
                                )}
                                {userShift?.notes && (
                                  <span className="text-xs truncate italic w-full px-1 mt-1" style={{ color: 'oklch(0.7 0 0)' }}>
                                    {userShift.notes}
                                  </span>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenModalForSlot(day, hour);
                                  }}
                                  className="absolute top-1 right-1 hover:text-[#f3c700] p-1 rounded opacity-0 group-hover:opacity-100 transition-all duration-200"
                                  style={{ color: 'oklch(0.6 0 0)' }}
                                  title="Edit notes"
                                >
                                  <Edit2 size={12} />
                                </button>
                              </div>
                            ) : (
                              <div className="opacity-0 group-hover:opacity-60 transition-opacity text-xs" style={{ color: 'oklch(0.6 0 0)' }}>
                                Click to assign
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <Modal open={isModalOpen} onOpenChange={setIsModalOpen}>
            <ModalContent>
              <ModalHeader>
                <h2 className="text-xl font-semibold text-card-foreground">
                  {selectedSlot ? (
                    schedule[formatDateKey(selectedSlot.day)]?.[selectedSlot.hour]?.find(shift => shift.userId === currentUser.id) 
                      ? 'Edit Your Shift' 
                      : 'Add Your Shift'
                  ) : 'Add New Shift'}
                </h2>
                {selectedSlot && (
                  <div className="mt-2">
                    <p className="text-sm text-muted-foreground">
                      <span className="text-[#f3c700] font-medium">
                        {selectedSlot.day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                      </span>
                      {' at '}
                      <span className="text-[#f3c700] font-medium">
                        {formatHour12(selectedSlot.hour)}
                      </span>
                    </p>
                    {(() => {
                      const shifts = schedule[formatDateKey(selectedSlot.day)]?.[selectedSlot.hour] || [];
                      const otherShifts = shifts.filter(shift => shift.userId !== currentUser.id);
                      
                      if (otherShifts.length > 0) {
                        return (
                          <p className="text-xs text-muted-foreground mt-1">
                            Also assigned: {otherShifts.map(shift => shift.userName).join(', ')}
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
              </ModalHeader>
              <ModalBody className="space-y-4">
                {!selectedSlot && (
                    <p className="text-sm text-[#f3c700] bg-[#f3c700]/10 p-3 rounded border border-[#f3c700]/20">
                      Note: To add a new shift without pre-selecting, ensure day/time inputs are added to this modal.
                    </p>
                )}
                <div>
                  <label htmlFor="shiftUser" className="block text-sm font-medium mb-2 text-card-foreground">User Name:</label>
                  <Input
                    id="shiftUser"
                    type="text"
                    value={shiftUserName}
                    onChange={(e) => setShiftUserName(e.target.value)}
                    placeholder="Enter user name for the shift"
                  />
                </div>
                <div>
                  <label htmlFor="shiftNotes" className="block text-sm font-medium mb-2 text-card-foreground">Notes (Optional):</label>
                  <Input
                    id="shiftNotes"
                    type="text"
                    value={shiftNotes}
                    onChange={(e) => setShiftNotes(e.target.value)}
                    placeholder="Short note for the shift"
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button onClick={handleCloseModal} variant="outline" className="bg-secondary hover:bg-secondary/80 border-border text-secondary-foreground">
                  Cancel
                </Button>
                <Button onClick={handleSaveShift} className="bg-secondary hover:bg-secondary/80 border border-[#f3c700] text-[#f3c700] hover:text-[#f3c700]/90 transition-colors">
                  Save Changes
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>
      </div>
    </Layout>
  );
};

export default DutySchedule;
