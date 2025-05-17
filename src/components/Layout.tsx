import React, { useState, useEffect, useMemo, useCallback, ReactNode } from "react"; // Removed useRef, ElementRef if no longer needed
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom"; // Added useNavigate
import { useAuth } from "../context/AuthContext";
import { hasCIUPermission } from "../utils/ciuUtils";
import { computeIsAdmin } from "../utils/isadmin"; // Import computeIsAdmin
import {
  LayoutDashboard,
  Users,
  Car,
  ClipboardList, // Keep for potential future use
  LogOut,
  FileText, // Keep for potential future use
  GraduationCap,
  ShieldCheck,
  UserCog,
  User as UserIcon, // Renamed User to UserIcon to avoid conflict
  MessagesSquare, // Use for Department Chat
  GanttChartSquare, // Use for Gangs
  Briefcase,
  Clipboard, // Use for Cases
  XIcon, // Added XIcon - Can remove if not used elsewhere
} from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button"; // Import Button component
// Import the new Sidebar component
import Sidebar from "../components/Sidebar";
// Import Avatar components
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
// Import getInitials or similar utility
import { getInitials } from "../utils/getInitials"; // Assuming path
// Import ProfileModal
import ProfileModal from "./ProfileModal"; // Assuming path
// Import NavItemProps type from Sidebar
import { NavItemProps } from "../components/Sidebar";
// Import backgroundImages directly
import { backgroundImages } from "../data/images";
import { FaTachometerAlt, FaUsers, FaCar, FaFileAlt, FaChalkboardTeacher, FaUserSecret, FaUserShield, FaGavel, FaBullhorn, FaSignOutAlt, FaComments, FaBell } from 'react-icons/fa'; // Added FaFileAlt
// Helper function to format name
import { formatUserNameShort, formatUserName, getAvatarFallback } from "./Chat/utils"; // Assuming formatUserNameShort exists or create it, Added formatUserName, getAvatarFallback
// Import types for chat
import { User } from "../types/User"; // Keep User type
// REMOVED ChatGroup, ChatMessage types if only used for bubble
// REMOVED ExpandableChat imports
// REMOVED ChatWindow import
// Import Firestore functions and types
import {
    collection, query, where, orderBy, onSnapshot, addDoc,
    serverTimestamp, doc, updateDoc, getDoc, setDoc, Timestamp, getDocs,
    arrayRemove, // Added arrayRemove
} from 'firebase/firestore'; // Keep getDocs for allUsers
import { db as dbFirestore } from '../firebase'; // Assuming db export
import { toast } from 'react-toastify'; // Keep for potential other uses
// Import notification store and related types/utils
import { useNotificationStore, UnreadNotification } from '../store/notificationStore';
import { getDirectChatId } from './Chat/CIUChatInterface'; // For stable IDs
import { ChatGroup } from '../types/ChatGroup'; // For type checking target

// REMOVED getDirectChatId if only used for bubble chat

// REMOVED ActiveChatInfo interface

const chatContext = 'department'; // Define context for department chats

const Layout = ({ children }: { children: ReactNode }) => {
  const { user: currentUser, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const setNotifications = useNotificationStore(state => state.setNotifications); // Get setNotifications from store

  // --- State Initialization ---
  // Read from sessionStorage immediately for initial state
  const initialBgImage = sessionStorage.getItem('currentBgImage') || "";
  const initialOpacity = initialBgImage ? 1 : 0; // Start with full opacity if image exists

  // State for background image and opacity
  const [currentBgImage, setCurrentBgImage] = useState<string>(initialBgImage);
  const [bgOpacity, setBgOpacity] = useState(initialOpacity); // Initialize opacity based on stored image
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false); // State for profile modal
  const [allUsers, setAllUsers] = useState<User[]>([]); // State for all users - KEEP for DepartmentChatPopup

  // --- State for Department Notifications Logic ---
  const [departmentForNotifications_ChatDocs, setDepartmentForNotifications_ChatDocs] = useState<any[]>([]);
  const [departmentForNotifications_UnreadIds, setDepartmentForNotifications_UnreadIds] = useState<Set<string>>(new Set());
  const [departmentForNotifications_HiddenChatIds, setDepartmentForNotifications_HiddenChatIds] = useState<Set<string>>(new Set());
  const [departmentForNotifications_HiddenChatsLoaded, setDepartmentForNotifications_HiddenChatsLoaded] = useState(false);
  // ADDED: State to store unread message counts for each chat
  const [unreadMessageCounts, setUnreadMessageCounts] = useState<Map<string, number>>(new Map());


  // Initialize isCollapsed from localStorage, default to false (expanded)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    const savedState = localStorage.getItem('sidebarCollapsed');
    return savedState ? JSON.parse(savedState) : false;
  });

  // --- Derived State ---
  const isAdmin = useMemo(() => computeIsAdmin(currentUser), [currentUser]);
  const isFTOQualified = useMemo(() => {
    if (!currentUser || !currentUser.certifications) return false;
    const ftoCert = currentUser.certifications["FTO"];
    return ftoCert === 'CERT' || ftoCert === 'LEAD' || ftoCert === 'SUPER' || ftoCert === 'TRAIN';
  }, [currentUser]);
  const isCadet = useMemo(() => currentUser?.rank?.toLowerCase() === 'cadet', [currentUser]);
  const canAccessCIU = useMemo(() => {
    if (isAdmin) return true;
    if (!currentUser || !currentUser.certifications) return false;
    const ciuCert = currentUser.certifications["CIU"];
    return ciuCert === 'CERT' || ciuCert === 'LEAD' || ciuCert === 'SUPER' || ciuCert === 'TRAIN';
  }, [currentUser, isAdmin]);


  // --- Effects ---

  // Effect to save isCollapsed state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  // Effect to fetch all users (needed for DepartmentChatPopup potentially) - KEEP
  useEffect(() => {
    const fetchUsers = async () => {
        try {
            const usersSnapshot = await getDocs(collection(dbFirestore, "users"));
            const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
            setAllUsers(usersData); // Keep updating allUsers
        } catch (error) {
            console.error("Error fetching all users:", error);
            // Handle error appropriately, maybe set an error state
        }
    };
    fetchUsers();
  }, []);

  // Effect to load hidden chat IDs for department notifications
  useEffect(() => {
    let isMounted = true;
    setDepartmentForNotifications_HiddenChatsLoaded(false);
    if (currentUser?.email) {
      const userDocRef = doc(dbFirestore, 'users', currentUser.email);
      getDoc(userDocRef).then(docSnap => {
        if (isMounted) {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const hiddenChats = data[`hiddenChats_${chatContext}`];
            if (Array.isArray(hiddenChats)) {
              setDepartmentForNotifications_HiddenChatIds(new Set(hiddenChats));
            } else {
              setDepartmentForNotifications_HiddenChatIds(new Set());
            }
          } else {
            setDepartmentForNotifications_HiddenChatIds(new Set());
          }
          setDepartmentForNotifications_HiddenChatsLoaded(true);
        }
      }).catch(error => {
        console.error("Layout: Error fetching user hidden chats for notifications:", error);
        if (isMounted) {
          setDepartmentForNotifications_HiddenChatIds(new Set());
          setDepartmentForNotifications_HiddenChatsLoaded(true);
        }
      });
    } else {
        if (isMounted) {
            setDepartmentForNotifications_HiddenChatIds(new Set());
            setDepartmentForNotifications_HiddenChatsLoaded(true); // No user, so "loaded"
        }
    }
    return () => { isMounted = false; };
  }, [currentUser?.email]);

  // Effect to listen to department chats for notifications (determines globally unread chats)
  useEffect(() => {
    if (!currentUser?.cid) {
      setDepartmentForNotifications_ChatDocs([]);
      setDepartmentForNotifications_UnreadIds(new Set());
      return () => {};
    }

    const chatsQuery = query(
      collection(dbFirestore, 'chats'),
      where('members', 'array-contains', currentUser.cid),
      where('context', '==', chatContext)
    );

    const unsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
      const newChatDocs: any[] = [];
      const newUnreadIds = new Set<string>();
      let changedHiddenIdsInFirestore = false;
      const hiddenChatsUpdatePayload: { [key: string]: any } = {};
      
      let currentLocalHiddenChatIds = new Set(departmentForNotifications_HiddenChatIds);

      snapshot.docs.forEach(docSnapshot => {
        const data = docSnapshot.data();
        const firestoreDocId = docSnapshot.id;
        newChatDocs.push({ id: firestoreDocId, ...data });

        const lastMessageTimestamp = data.lastMessageTimestamp as Timestamp | undefined;
        // IMPORTANT: Use currentUser.cid directly here as it's confirmed by the effect's guard
        const userLastReadTimestamp = data.lastRead?.[currentUser.cid!] as Timestamp | undefined;
        let isUnread = false;

        if (lastMessageTimestamp) {
          if (!userLastReadTimestamp || lastMessageTimestamp.toMillis() > userLastReadTimestamp.toMillis()) {
            isUnread = true;
            newUnreadIds.add(firestoreDocId);
          }
        }

        // Unhide on receive logic for notifications
        let stableId = '';
        if (data.type === 'group') {
          stableId = firestoreDocId;
        } else if (data.type === 'direct') { 
          const members = data.members as string[] || [];
          const otherMemberCid = members.find(cid => cid !== currentUser!.cid); 
          if (otherMemberCid) { 
            stableId = getDirectChatId(currentUser!.cid as string, otherMemberCid, chatContext);
          }
        }

        if (stableId && currentLocalHiddenChatIds.has(stableId) && isUnread) {
          hiddenChatsUpdatePayload[`hiddenChats_${chatContext}`] = arrayRemove(stableId);
          changedHiddenIdsInFirestore = true;
          currentLocalHiddenChatIds.delete(stableId); 
          console.log(`Layout: Queued unhide for chat ${stableId} due to new message for notifications.`);
        }
      });

      setDepartmentForNotifications_ChatDocs(newChatDocs);
      setDepartmentForNotifications_UnreadIds(newUnreadIds);
      
      if (changedHiddenIdsInFirestore) {
        setDepartmentForNotifications_HiddenChatIds(new Set(currentLocalHiddenChatIds)); 
        if (currentUser?.email) {
          const userDocRef = doc(dbFirestore, 'users', currentUser.email);
          try {
            await updateDoc(userDocRef, hiddenChatsUpdatePayload);
            console.log(`Layout: Updated hidden chats in Firestore for notifications for user ${currentUser.email}.`);
          } catch (error) {
            console.error('Layout: Error updating hiddenChats in Firestore for notifications:', error);
          }
        }
      }
    }, (error) => {
      console.error(`Layout: Error fetching department chats for notifications:`, error);
    });

    return () => unsubscribe();
  }, [currentUser?.cid, currentUser?.email, departmentForNotifications_HiddenChatIds]);

  // ADDED: Effect to calculate unread message counts
  useEffect(() => {
    if (!currentUser?.cid || departmentForNotifications_UnreadIds.size === 0) {
      setUnreadMessageCounts(new Map()); // Clear counts if no user or no unread chats
      return;
    }

    const fetchCounts = async () => {
      const newCounts = new Map<string, number>();
      // Create a stable copy of unread IDs and hidden IDs for this async operation
      const unreadIdsToProcess = new Set(departmentForNotifications_UnreadIds);
      const currentHiddenIds = new Set(departmentForNotifications_HiddenChatIds);

      for (const firestoreDocId of unreadIdsToProcess) {
        const chatDocData = departmentForNotifications_ChatDocs.find(d => d.id === firestoreDocId);
        if (!chatDocData) continue;

        let stableId = '';
        if (chatDocData.type === 'group') {
          stableId = firestoreDocId;
        } else if (chatDocData.type === 'direct') {
          const members = chatDocData.members as string[] || [];
          const otherMemberCid = members.find(cid => cid !== currentUser!.cid);
          if (otherMemberCid) {
            stableId = getDirectChatId(currentUser!.cid as string, otherMemberCid, chatContext);
          }
        }

        // Only fetch count if chat is not hidden
        if (stableId && !currentHiddenIds.has(stableId)) {
          const userLastReadTimestamp = chatDocData.lastRead?.[currentUser.cid!] as Timestamp | undefined;
          const messagesRef = collection(dbFirestore, 'chats', firestoreDocId, 'messages');
          let messagesQuery;

          if (userLastReadTimestamp) {
            messagesQuery = query(messagesRef, where('timestamp', '>', userLastReadTimestamp));
          } else {
            // If no lastRead timestamp, all messages in the chat are unread
            messagesQuery = query(messagesRef);
          }
          
          try {
            const messagesSnapshot = await getDocs(messagesQuery);
            newCounts.set(firestoreDocId, messagesSnapshot.size);
          } catch (error) {
            console.error(`Layout: Error fetching message count for chat ${firestoreDocId}:`, error);
            newCounts.set(firestoreDocId, 0); // Default to 0 on error
          }
        } else {
          newCounts.set(firestoreDocId, 0); // Chat is hidden, so 0 unread for notification purposes
        }
      }
      setUnreadMessageCounts(newCounts);
    };

    fetchCounts();
  }, [
    departmentForNotifications_UnreadIds, 
    departmentForNotifications_ChatDocs, // To get lastRead timestamps
    departmentForNotifications_HiddenChatIds, 
    currentUser?.cid, // Ensure currentUser.cid is stable
  ]);


  // Effect to update Zustand notification store for department context
  useEffect(() => {
    if (!currentUser?.cid || !departmentForNotifications_HiddenChatsLoaded) {
      setNotifications('department', []);
      return;
    }

    const derivedNotifications: UnreadNotification[] = [];
    // Iterate over globally unread chat IDs
    departmentForNotifications_UnreadIds.forEach(firestoreDocId => {
      const chatDoc = departmentForNotifications_ChatDocs.find(d => d.id === firestoreDocId);
      if (!chatDoc) return;

      let stableId = '';
      let targetName = 'Unknown Chat';
      let targetType: 'direct' | 'group' = chatDoc.type;
      let targetId = '';

      if (chatDoc.type === 'group') {
        stableId = firestoreDocId;
        targetName = chatDoc.groupName || 'Unknown Group';
        targetId = firestoreDocId;
      } else if (chatDoc.type === 'direct') {
        const members = chatDoc.members as string[] || [];
        const otherMemberCid = members.find(cid => cid !== currentUser!.cid);
        if (otherMemberCid) {
          stableId = getDirectChatId(currentUser!.cid as string, otherMemberCid, chatContext);
          const otherUser = allUsers.find(u => u.cid === otherMemberCid);
          targetName = otherUser ? formatUserName(otherUser) : 'Unknown User';
          targetId = otherUser?.cid || '';
        }
      }
      
      // Get the calculated unread count for this chat
      const currentUnreadCount = unreadMessageCounts.get(firestoreDocId) || 0;

      // Only add notification if it's not hidden AND has unread messages
      if (stableId && !departmentForNotifications_HiddenChatIds.has(stableId) && targetId && currentUnreadCount > 0) {
        derivedNotifications.push({
          id: firestoreDocId,
          name: targetName,
          context: 'department',
          timestamp: chatDoc.lastMessageTimestamp instanceof Timestamp ? chatDoc.lastMessageTimestamp : null,
          targetType: targetType,
          targetId: targetId,
          stableId: stableId,
          unreadCount: currentUnreadCount, // Use the calculated count
        });
      }
    });

    setNotifications('department', derivedNotifications);

  }, [
    departmentForNotifications_UnreadIds,
    departmentForNotifications_ChatDocs,
    departmentForNotifications_HiddenChatIds,
    departmentForNotifications_HiddenChatsLoaded,
    unreadMessageCounts, // ADDED: Depend on message counts
    allUsers,
    currentUser?.cid,
    setNotifications
  ]);


  // Effect for background image loading and transition with persistence
  useEffect(() => {
    const lastBgSetTimeStr = sessionStorage.getItem('lastBgSetTime');
    const storedBgImage = sessionStorage.getItem('currentBgImage');
    const fiveMinutes = 5 * 60 * 1000;
    const now = Date.now();
    const lastBgSetTime = lastBgSetTimeStr ? parseInt(lastBgSetTimeStr, 10) : 0;

    let useEffectCleanup: (() => void) | null = null;

    const setNewBackground = (shouldFadeIn: boolean) => {
      const randomIndex = Math.floor(Math.random() * backgroundImages.length);
      const newBgUrl = backgroundImages[randomIndex];
      const img = new Image();

      img.onload = () => {
        setCurrentBgImage(newBgUrl);
        sessionStorage.setItem('currentBgImage', newBgUrl);
        sessionStorage.setItem('lastBgSetTime', now.toString());
        // Only fade in if explicitly told to (i.e., no image was loaded initially)
        if (shouldFadeIn) {
          setTimeout(() => setBgOpacity(1), 50);
        } else {
          // If not fading in, ensure opacity is 1 (might already be, but safe)
          setBgOpacity(1);
        }
      };
      img.onerror = () => {
        console.error("Failed to load background image:", newBgUrl);
        // Optionally clear storage if load fails?
        if (shouldFadeIn) setBgOpacity(0); // Hide if load fails during fade-in attempt
      };
      img.src = newBgUrl;

      useEffectCleanup = () => {
        img.onload = null;
        img.onerror = null;
      };
    };

    // If there's a stored image AND it's recent, we don't need to do anything here
    // because the initial state already handled it.
    // If there's NO stored image OR it's too old, set a new one.
    if (!storedBgImage || (now - lastBgSetTime >= fiveMinutes)) {
      // Set a new background. Fade in only if there wasn't an initial image.
      setNewBackground(!initialBgImage);
    } else if (!initialBgImage && storedBgImage) {
      // This case handles if sessionStorage had an image, but initial state didn't catch it
      // (shouldn't happen with the new init logic, but as a fallback)
      setCurrentBgImage(storedBgImage);
      setBgOpacity(1); // Ensure opacity is 1
    }

    return () => {
      if (useEffectCleanup) {
        useEffectCleanup();
      }
    };
    // Depend on initialBgImage to know if we should fade in a new background
  }, [initialBgImage]);

  // Effect for redirecting unauthenticated users
  useEffect(() => {
    if (!loading && !currentUser) {
      // Redirect to login if not authenticated
      // NOTE: The actual login component should handle the redirect *to* '/' upon successful login.
      navigate("/login");
    }
  }, [loading, currentUser, navigate]);


  // --- Event Handlers ---
  const toggleProfileModal = () => setIsProfileModalOpen(!isProfileModalOpen); // Handler for profile modal

  // --- Navigation Items ---
  // Use NavItemProps type from Sidebar.tsx
  const navItems = useMemo((): NavItemProps[] => [
    {
      name: "Dashboard",
      icon: LayoutDashboard,
      href: "/", // Points to Home.tsx
      showCondition: "always",
      title: "Dashboard",
    },
        {
      name: "Documents",
      icon: Clipboard,
      href: "/Documents",
      showCondition: "always",
      title: "Documents",
    },
    {
      name: "Roster",
      icon: Users,
      href: "/roster",
      showCondition: "always",
      title: "SASP Roster",
    },
    {
      name: "Fleet",
      icon: Car,
      href: "/Fleet",
      showCondition: "always",
      title: "Vehicle Fleet",
    },
    {
      name: "FTO", // Name will be dynamically changed by Sidebar component
      icon: ShieldCheck, // Default icon, will be changed by Sidebar component
      href: "/fto",
      showCondition: "isFTOQualifiedOrCadet",
      title: "FTO Management / Training", // Generic title
    },
    {
      name: "CIU",
      icon: UserIcon, // Use renamed UserIcon
      href: "/ciu",
      showCondition: "canAccessCIU",
      title: "CIU Management",
    },
    {
      name: "Admin Menu",
      icon: UserCog, // Re-using icon, consider a different one if available
      href: "/admin",
      showCondition: "isAdmin",
      title: "Admin Management",
    },
  ], []); // Empty dependency array as base items don't change

  if (loading) {
    return (
      // Basic loading state
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <h1>Loading...</h1>
      </div>
    );
  }

  const userInitials = currentUser?.name ? getInitials(currentUser.name) : '?';
  // Format name for header display (e.g., J. Doe)
  const formattedName = currentUser ? formatUserNameShort(currentUser) : '';

  return (
    // Add relative positioning to the main container
    <div className="relative min-h-screen">
      {/* Background Image Div */}
      <div
        className="fixed inset-0 z-[-1] bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${currentBgImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity: bgOpacity, // Apply opacity state
          transition: "opacity 1.5s ease-in-out", // Add transition effect
        }}
      ></div>

      {/* Content Container (Sidebar + Main) */}
      {/* Add relative positioning and z-index */}
      <div className="flex h-screen relative z-10">
        {/* New Sidebar */}
        <Sidebar
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          navItems={navItems}
          isAdmin={isAdmin}
          isFTOQualified={isFTOQualified}
          canAccessCIU={canAccessCIU}
          isCadet={isCadet}
          // REMOVED onOpenChat prop
          allUsers={allUsers} // Pass allUsers down
        />

        {/* Main Content Area */}
        {/* Adjust padding-left classes */}
        <main className={cn(
            "flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out",
            // Apply base padding for collapsed sidebar width (w-20 = 5rem) on ALL screen sizes
            "pl-20",
            // On medium screens and up, override padding ONLY when expanded (w-64 = 16rem)
            !isCollapsed && "md:pl-64"
        )}>
           {/* Header */}
           <header className="h-16 border-b border-border flex items-center justify-between px-4 sm:px-6 flex-shrink-0 bg-[#0a0a0a]">
             {/* Right side - User Info and Avatar/Profile Button */}
             {/* Add ml-auto to push the right side content to the right */}
             <div className="flex items-center gap-2 sm:gap-3 ml-auto"> {/* Added ml-auto */}
                {currentUser && (
                    <>
                        {/* User Rank and Name */}
                        <div className="text-right">
                            <p className="text-sm font-medium text-foreground truncate">{currentUser.rank}</p>
                            <p className="text-xs text-muted-foreground truncate">{formattedName}</p>
                        </div>
                        {/* Avatar Button */}
                        <Button variant="ghost" size="icon" onClick={toggleProfileModal} className="rounded-full flex-shrink-0">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={currentUser.photoURL || undefined} alt={currentUser.name ?? 'User'} />
                                <AvatarFallback>{userInitials}</AvatarFallback>
                            </Avatar>
                        </Button>
                    </>
                )}
             </div>
           </header>
           {/* Page Content */}
           <div className="flex-1 overflow-y-auto p-4 md:p-6">
             {children}
           </div>
        </main>

        {/* Profile Modal */}
        {currentUser && (
            <ProfileModal
                isOpen={isProfileModalOpen}
                onClose={toggleProfileModal}
                user={currentUser}
            />
        )}
      </div>
    </div>
  );
};

export default Layout;

