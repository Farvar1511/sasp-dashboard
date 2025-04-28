import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { computeIsAdmin } from '../utils/isadmin'; // Import the updated function

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'isAdmin' | 'isFTOQualifiedOrCadet' | 'canAccessCIU'; // Add other roles as needed
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { user, loading } = useAuth();

  if (loading) {
    // Optional: Render a loading indicator while authentication state is resolving
    return <div className="text-center p-8">Loading...</div>;
  }

  if (!user) {
    // User not logged in, redirect to login
    return <Navigate to="/login" replace />;
  }

  // Check role/permission if requiredRole is provided
  if (requiredRole) {
    const isAdmin = computeIsAdmin(user); // Use the updated computeIsAdmin
    const ftoCert = user.certifications?.FTO?.toUpperCase();
    const ciuCert = user.certifications?.CIU?.toUpperCase();
    const isCadet = user.rank?.toLowerCase() === 'cadet';

    let hasPermission = false;

    switch (requiredRole) {
      case 'isAdmin':
        hasPermission = isAdmin;
        break;
      case 'isFTOQualifiedOrCadet':
        // Check FTO certs (TRAIN, CERT, LEAD, SUPER), Cadet rank, or Admin override
        hasPermission =
          isCadet ||
          (ftoCert && ["TRAIN", "CERT", "LEAD", "SUPER"].includes(ftoCert)) ||
          isAdmin;
        break;
      case 'canAccessCIU':
        // Check CIU certs (TRAIN, CERT, LEAD, SUPER) or Admin override
        hasPermission =
          (ciuCert && ["TRAIN", "CERT", "LEAD", "SUPER"].includes(ciuCert)) ||
          isAdmin;
        break;
      default:
        // If requiredRole is unknown, deny access by default
        hasPermission = false;
    }

    if (!hasPermission) {
      // User does not have the required role/permission, redirect or show an error
      // Redirecting to home page for simplicity
      console.warn(`Access denied for user ${user.email} to route requiring role: ${requiredRole}`);
      return <Navigate to="/" replace />;
      // Alternatively, show an "Access Denied" component:
      // return <AccessDeniedPage />;
    }
  }

  // User is logged in and has necessary permissions (if required)
  return <>{children}</>;
};

export default ProtectedRoute;
