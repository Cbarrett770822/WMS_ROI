import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/utils/apiClient';

// Define user type
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  companies?: string[];
  permissions?: string[];
}

// Define auth context type
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string | string[]) => boolean;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  // Check if user is authenticated on initial load
  useEffect(() => {
    const initAuth = async () => {
      await checkAuth();
      setIsLoading(false);
    };
    
    initAuth();
  }, []);

  // Check authentication status
  const checkAuth = async (): Promise<boolean> => {
    try {
      // Check if token exists
      const token = localStorage.getItem('authToken');
      if (!token) {
        setUser(null);
        setIsAuthenticated(false);
        return false;
      }

      // Verify token with backend
      const response = await apiClient.get<User>('/auth/profile');
      setUser(response);
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      console.error('Authentication check failed:', error);
      localStorage.removeItem('authToken');
      setUser(null);
      setIsAuthenticated(false);
      return false;
    }
  };

  // Login function
  const login = async (email: string, password: string): Promise<void> => {
    try {
      setIsLoading(true);
      const response = await apiClient.post('/auth/login', { email, password });
      
      // Save token to localStorage
      localStorage.setItem('authToken', response.token);
      
      // Get user profile
      const userProfile = await apiClient.get<User>('/auth/profile');
      setUser(userProfile);
      setIsAuthenticated(true);
      
      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = async (): Promise<void> => {
    try {
      setIsLoading(true);
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage and state regardless of API response
      localStorage.removeItem('authToken');
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
      router.push('/auth/login');
    }
  };

  // Check if user has specific permission
  const hasPermission = (permission: string): boolean => {
    if (!user || !user.permissions) return false;
    return user.permissions.includes(permission);
  };

  // Check if user has specific role
  const hasRole = (role: string | string[]): boolean => {
    if (!user) return false;
    
    if (Array.isArray(role)) {
      return role.includes(user.role);
    }
    
    return user.role === role;
  };

  const value = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    checkAuth,
    hasPermission,
    hasRole
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Higher-order component to protect routes
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  requiredRoles?: string[]
): React.FC<P> {
  const AuthenticatedComponent: React.FC<P> = (props) => {
    const { isAuthenticated, isLoading, user, hasRole } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!isLoading && !isAuthenticated) {
        router.push('/auth/login');
      }
      
      if (!isLoading && isAuthenticated && requiredRoles && user) {
        const hasRequiredRole = requiredRoles.includes(user.role);
        if (!hasRequiredRole) {
          router.push('/unauthorized');
        }
      }
    }, [isLoading, isAuthenticated, user, router]);

    if (isLoading) {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh' 
        }}>
          Loading...
        </div>
      );
    }

    if (!isAuthenticated) {
      return null; // Will redirect in useEffect
    }

    if (requiredRoles && user && !requiredRoles.includes(user.role)) {
      return null; // Will redirect in useEffect
    }

    return <Component {...props} />;
  };

  return AuthenticatedComponent;
}

// RequireAuth component for use with App Router
export const RequireAuth = ({ 
  children, 
  requiredRoles 
}: { 
  children: ReactNode, 
  requiredRoles?: string[] 
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
    
    if (!isLoading && isAuthenticated && requiredRoles && user) {
      const hasRequiredRole = requiredRoles.includes(user.role);
      if (!hasRequiredRole) {
        router.push('/unauthorized');
      }
    }
  }, [isLoading, isAuthenticated, user, router, requiredRoles]);

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  if (requiredRoles && user && !requiredRoles.includes(user.role)) {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;
};
