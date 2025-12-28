// Use shared User model from centralized auth library
const User = require('../../../wms-shared-auth/src/models/User');

// TypeScript interface for type safety
export interface IUser {
  _id: any;
  username: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: 'super_admin' | 'admin' | 'user' | 'viewer';
  appPermissions: {
    wmsQuestionnaire: {
      enabled: boolean;
      role: string;
      assignedCompanies: any[];
    };
    roiAssessment: {
      enabled: boolean;
      role: string;
      assignedCompanies: any[];
    };
    dashboardGenerator: {
      enabled: boolean;
      role: string;
    };
    demoAssist: {
      enabled: boolean;
      role: string;
    };
  };
  isActive: boolean;
  lastLogin: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  hasAppAccess(appName: string): boolean;
  getAppRole(appName: string): string | null;
}

export default User;
