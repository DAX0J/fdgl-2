import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as firebaseAuth from '@/lib/firebaseAuth';
import { User } from 'firebase/auth';

// نوع حالة الأمان
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

// نوع سياق الأمان
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

// إنشاء السياق
const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

// الحالة الافتراضية
const defaultSecurityState: SecurityState = {
  isAuthenticated: false,
  isAdmin: false,
  user: null,
  isPasswordProtectionEnabled: true,
  isUnlocked: false,
  isLoading: true,
  ipBanned: false,
  ipCooldown: null
};

export const SecurityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SecurityState>(defaultSecurityState);
  
  // تحميل الحالة الأولية
  useEffect(() => {
    const loadInitialState = async () => {
      try {
        // تحقق من حالة كلمة المرور
        const isPasswordProtected = await firebaseAuth.isPasswordProtectionEnabled();
        
        // تحقق من حالة القفل (من الجلسة)
        const isUnlocked = sessionStorage.getItem('siteUnlocked') === 'true';
        
        // تحقق من حالة عنوان IP
        const ipStatus = await firebaseAuth.checkIPStatus();
        
        // تحقق من حالة المستخدم الحالي
        const currentUser = firebaseAuth.getCurrentUser();
        
        setState({
          ...state,
          isPasswordProtectionEnabled: isPasswordProtected,
          isUnlocked: isUnlocked || !isPasswordProtected, // فتح الموقع إذا كانت الحماية معطلة
          isAuthenticated: !!currentUser,
          isAdmin: !!currentUser, // في هذه الحالة البسيطة، أي مستخدم مسجل دخول هو مشرف
          user: currentUser,
          ipBanned: ipStatus.banned,
          ipCooldown: ipStatus.cooldown,
          isLoading: false
        });
      } catch (error) {
        console.error('Error loading security state:', error);
        setState({
          ...state,
          isLoading: false
        });
      }
    };
    
    loadInitialState();
    
    // الاستماع لتغييرات حالة المصادقة
    const unsubscribe = firebaseAuth.subscribeToAuthChanges((user) => {
      setState(prevState => ({
        ...prevState,
        isAuthenticated: !!user,
        isAdmin: !!user,
        user
      }));
    });
    
    return () => unsubscribe();
  }, []);
  
  // وظيفة تسجيل دخول المشرف
  const loginAdmin = async (email: string, password: string): Promise<boolean> => {
    try {
      const user = await firebaseAuth.loginAdmin(email, password);
      setState({
        ...state,
        isAuthenticated: true,
        isAdmin: true,
        user
      });
      return true;
    } catch (error) {
      console.error('Login error:', error);
      // التحقق من حالة IP بعد محاولة فاشلة
      await checkIPStatus();
      return false;
    }
  };
  
  // وظيفة تسجيل خروج المشرف
  const logoutAdmin = async (): Promise<void> => {
    try {
      await firebaseAuth.logoutAdmin();
      setState({
        ...state,
        isAuthenticated: false,
        isAdmin: false,
        user: null
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };
  
  // وظيفة فتح الموقع بكلمة المرور
  const unlockSite = async (password: string): Promise<boolean> => {
    try {
      const isValid = await firebaseAuth.validateSitePassword(password);
      
      if (isValid) {
        // تخزين حالة الفتح في الجلسة
        sessionStorage.setItem('siteUnlocked', 'true');
        
        setState({
          ...state,
          isUnlocked: true
        });
      }
      
      // التحقق من حالة IP بعد المحاولة
      await checkIPStatus();
      
      return isValid;
    } catch (error) {
      console.error('Error unlocking site:', error);
      await checkIPStatus();
      return false;
    }
  };
  
  // وظيفة تفعيل/تعطيل حماية كلمة المرور
  const togglePasswordProtection = async (enabled: boolean): Promise<boolean> => {
    try {
      const success = await firebaseAuth.togglePasswordProtection(enabled);
      
      if (success) {
        setState({
          ...state,
          isPasswordProtectionEnabled: enabled,
          isUnlocked: !enabled || state.isUnlocked // فتح الموقع تلقائيًا إذا تم تعطيل الحماية
        });
      }
      
      return success;
    } catch (error) {
      console.error('Error toggling password protection:', error);
      return false;
    }
  };
  
  // وظيفة تحديث كلمة مرور الموقع
  const updateSitePassword = async (newPassword: string): Promise<boolean> => {
    try {
      const success = await firebaseAuth.updateSitePassword(newPassword);
      return success;
    } catch (error) {
      console.error('Error updating site password:', error);
      return false;
    }
  };
  
  // وظيفة التحقق من حالة عنوان IP
  const checkIPStatus = async (): Promise<void> => {
    try {
      const ipStatus = await firebaseAuth.checkIPStatus();
      
      setState({
        ...state,
        ipBanned: ipStatus.banned,
        ipCooldown: ipStatus.cooldown
      });
    } catch (error) {
      console.error('Error checking IP status:', error);
    }
  };
  
  // القيمة التي سيتم توفيرها لجميع المكونات الفرعية
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

// Hook للوصول إلى سياق الأمان
export const useSecurity = (): SecurityContextType => {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
};