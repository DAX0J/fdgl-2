import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import * as AuthService from '@/lib/firebaseAuth';

// تعريف نوع المستخدم
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  isAdmin: boolean;
}

// تعريف حالة الأمان
interface SecurityState {
  // حالة المصادقة
  isAuthenticated: boolean;
  isAdmin: boolean;
  user: User | null;
  
  // حالة حماية كلمة المرور
  isPasswordProtectionEnabled: boolean;
  isUnlocked: boolean;
  
  // حالة التحميل
  isLoading: boolean;
  
  // حالة عنوان IP
  ipBanned: boolean;
  ipCooldown: number | null;
}

// تعريف سياق الأمان
interface SecurityContextType extends SecurityState {
  // وظائف المصادقة
  loginAdmin: (email: string, password: string) => Promise<boolean>;
  logoutAdmin: () => Promise<void>;
  
  // وظائف حماية كلمة المرور
  unlockSite: (password: string) => Promise<boolean>;
  togglePasswordProtection: (enabled: boolean) => Promise<boolean>;
  updateSitePassword: (newPassword: string) => Promise<boolean>;
  
  // وظائف فحص الحالة
  checkIPStatus: () => Promise<void>;
}

// حالة الأمان الافتراضية
const defaultSecurityState: SecurityState = {
  isAuthenticated: false,
  isAdmin: false,
  user: null,
  isPasswordProtectionEnabled: false,
  isUnlocked: false,
  isLoading: true,
  ipBanned: false,
  ipCooldown: null
};

// إنشاء سياق الأمان
const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

// مزود سياق الأمان
export const SecurityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SecurityState>(defaultSecurityState);
  
  // التحقق من حالة المصادقة عند تحميل المكون
  useEffect(() => {
    // التحقق من حالة كلمة مرور الموقع
    const checkSiteProtection = async () => {
      try {
        const isProtectionEnabled = await AuthService.checkPasswordProtectionEnabled();
        
        const sessionUnlocked = sessionStorage.getItem('siteUnlocked') === 'true';
        
        // تعيين حالة الحماية
        setState(prev => ({
          ...prev,
          isPasswordProtectionEnabled: isProtectionEnabled,
          isUnlocked: !isProtectionEnabled || sessionUnlocked
        }));
      } catch (error) {
        console.error('Error checking site protection:', error);
      }
    };
    
    // التحقق من حالة مصادقة المستخدم
    const unsubscribe = AuthService.onAuthStateChange((user, isAdmin) => {
      if (user) {
        // تحويل مستخدم Firebase إلى نموذج المستخدم الخاص بنا
        const appUser: User = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          isAdmin
        };
        
        setState(prev => ({
          ...prev,
          isAuthenticated: true,
          isAdmin,
          user: appUser,
          isLoading: false
        }));
      } else {
        setState(prev => ({
          ...prev,
          isAuthenticated: false,
          isAdmin: false,
          user: null,
          isLoading: false
        }));
      }
    });
    
    // فحص حالة IP
    const checkCurrentIPStatus = async () => {
      try {
        const ip = await AuthService.getCurrentIP();
        const status = await AuthService.checkIPStatus(ip);
        
        // تحديث الحالة
        setState(prev => ({
          ...prev,
          ipBanned: status.banned,
          ipCooldown: status.cooldown
        }));
      } catch (error) {
        console.error('Error checking IP status:', error);
      }
    };
    
    // تنفيذ عمليات الفحص
    checkSiteProtection();
    checkCurrentIPStatus();
    
    // تنظيف المشتركين عند إلغاء تحميل المكون
    return () => {
      unsubscribe();
    };
  }, []);
  
  // وظيفة تسجيل دخول المسؤول
  const loginAdmin = async (email: string, password: string): Promise<boolean> => {
    try {
      await AuthService.loginAdmin(email, password);
      return true;
    } catch (error) {
      console.error('Admin login error:', error);
      return false;
    }
  };
  
  // وظيفة تسجيل خروج المسؤول
  const logoutAdmin = async (): Promise<void> => {
    try {
      await AuthService.logoutAdmin();
    } catch (error) {
      console.error('Admin logout error:', error);
    }
  };
  
  // وظيفة إلغاء قفل الموقع
  const unlockSite = async (password: string): Promise<boolean> => {
    try {
      const success = await AuthService.validateSitePassword(password);
      
      if (success) {
        // تخزين حالة إلغاء القفل في الجلسة
        sessionStorage.setItem('siteUnlocked', 'true');
        
        // تحديث الحالة
        setState(prev => ({
          ...prev,
          isUnlocked: true
        }));
      }
      
      return success;
    } catch (error) {
      console.error('Error unlocking site:', error);
      return false;
    }
  };
  
  // وظيفة تبديل حماية كلمة المرور
  const togglePasswordProtection = async (enabled: boolean): Promise<boolean> => {
    try {
      await AuthService.setPasswordProtection(enabled);
      
      // تحديث الحالة
      setState(prev => ({
        ...prev,
        isPasswordProtectionEnabled: enabled,
        isUnlocked: !enabled || prev.isUnlocked
      }));
      
      return true;
    } catch (error) {
      console.error('Error toggling password protection:', error);
      return false;
    }
  };
  
  // وظيفة تحديث كلمة مرور الموقع
  const updateSitePassword = async (newPassword: string): Promise<boolean> => {
    try {
      await AuthService.setSitePassword(newPassword);
      return true;
    } catch (error) {
      console.error('Error updating site password:', error);
      return false;
    }
  };
  
  // وظيفة التحقق من حالة عنوان IP
  const checkIPStatus = async (): Promise<void> => {
    try {
      const ip = await AuthService.getCurrentIP();
      const status = await AuthService.checkIPStatus(ip);
      
      // تحديث الحالة
      setState(prev => ({
        ...prev,
        ipBanned: status.banned,
        ipCooldown: status.cooldown
      }));
    } catch (error) {
      console.error('Error checking IP status:', error);
    }
  };
  
  // قيمة السياق المقدمة للمكونات الفرعية
  const contextValue: SecurityContextType = {
    ...state,
    loginAdmin,
    logoutAdmin,
    unlockSite,
    togglePasswordProtection,
    updateSitePassword,
    checkIPStatus
  };
  
  return (
    <SecurityContext.Provider value={contextValue}>
      {children}
    </SecurityContext.Provider>
  );
};

// هوك استخدام سياق الأمان
export const useSecurity = (): SecurityContextType => {
  const context = useContext(SecurityContext);
  
  if (!context) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  
  return context;
};