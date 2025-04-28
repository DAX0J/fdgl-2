import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { readData, writeData, watchData } from '../lib/firebase';

interface CountdownSettings {
  enabled: boolean;
  targetDate: string;
  title: string;
}

interface PasswordProtection {
  enabled: boolean;
  password: string;
}

import { ShippingProvince, shippingProvinces } from '../data/shippingProvinces';

interface ShippingSettings {
  provinces: ShippingProvince[];
  freeShippingThreshold: number;
  minPrice: number;
  maxPrice: number;
}

interface SocialMediaSettings {
  instagram: string;
  twitter: string;
  facebook: string;
  youtube: string;
  tiktok: string;
  enabled: boolean;
}

interface SiteSettings {
  countdownSettings: CountdownSettings;
  passwordProtection: PasswordProtection;
  shippingSettings: ShippingSettings;
  socialMedia: SocialMediaSettings;
  isUnlocked: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  currency: string;
}

interface SiteSettingsContextType extends SiteSettings {
  unlockSite: (password: string) => Promise<boolean>;
  togglePasswordProtection: (enabled: boolean) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  updateCountdownSettings: (settings: Partial<CountdownSettings>) => Promise<void>;
  updateShippingSettings: (settings: Partial<ShippingSettings>) => Promise<void>;
  updateSocialMediaSettings: (settings: Partial<SocialMediaSettings>) => Promise<void>;
  adminLogin: (email: string, password: string) => Promise<boolean>;
  adminLogout: () => void;
}

const defaultSettings: SiteSettings = {
  countdownSettings: {
    enabled: true,
    targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    title: 'Next Drop Coming Soon',
  },
  passwordProtection: {
    enabled: true,
    password: 'password123',
  },
  shippingSettings: {
    provinces: shippingProvinces,
    freeShippingThreshold: 5000,
    minPrice: 300,
    maxPrice: 800
  },
  socialMedia: {
    instagram: 'https://instagram.com/drp',
    twitter: 'https://twitter.com/drp',
    facebook: 'https://facebook.com/drp',
    youtube: 'https://youtube.com/drp',
    tiktok: 'https://tiktok.com/@drp',
    enabled: true
  },
  isUnlocked: false,
  isAdmin: false,
  isLoading: true,
  currency: 'DZD',
};

const SiteSettingsContext = createContext<SiteSettingsContextType | undefined>(undefined);

export const SiteSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);

  // تحميل الإعدادات ومعلومات المصادقة
  useEffect(() => {
    // استيراد وظائف API
    import('@/lib/api').then(({ checkSiteProtection, checkAuthStatus }) => {
      // التحقق من حالة حماية كلمة المرور أولاً
      const loadSiteProtection = async () => {
        try {
          const { enabled, authenticated } = await checkSiteProtection();
          
          // تحديث حالة الإعدادات
          setSettings(prev => ({
            ...prev,
            passwordProtection: {
              ...prev.passwordProtection,
              enabled: enabled
            },
            isUnlocked: authenticated || !enabled,
          }));
          
          // إذا كانت الحماية معطلة، تخزين حالة الدخول
          if (!enabled) {
            sessionStorage.setItem('siteUnlocked', 'true');
          }
        } catch (error) {
          console.error('Error checking site protection:', error);
        }
      };
      
      // تحميل إعدادات الموقع من Firebase عبر الدالة المساعدة
      const loadSettingsFromFirebase = async () => {
        try {
          // استخدام Firebase مباشرة فقط لتحميل الإعدادات العامة غير الحساسة
          const { readData } = await import('@/lib/firebase');
          
          // تحميل إعدادات العد التنازلي
          const countdownSnapshot = await readData('siteSettings/countdownSettings');
          if (countdownSnapshot.exists()) {
            setSettings(prev => ({
              ...prev,
              countdownSettings: countdownSnapshot.val() || defaultSettings.countdownSettings
            }));
          }
          
          // تحميل إعدادات الشحن
          const shippingSnapshot = await readData('siteSettings/shippingSettings');
          if (shippingSnapshot.exists()) {
            setSettings(prev => ({
              ...prev,
              shippingSettings: shippingSnapshot.val() || defaultSettings.shippingSettings
            }));
          }
          
          // تحميل إعدادات وسائل التواصل الاجتماعي
          const socialMediaSnapshot = await readData('siteSettings/socialMedia');
          if (socialMediaSnapshot.exists()) {
            setSettings(prev => ({
              ...prev,
              socialMedia: socialMediaSnapshot.val() || defaultSettings.socialMedia
            }));
          }
          
          setSettings(prev => ({ ...prev, isLoading: false }));
        } catch (error) {
          console.error('Error loading settings from Firebase:', error);
          setSettings(prev => ({ ...prev, isLoading: false }));
        }
      };
      
      // التحقق من حالة المصادقة
      const checkAuthentication = async () => {
        try {
          // تحقق من قيمة authToken و siteUnlocked في sessionStorage أولاً
          const storedUnlockStatus = sessionStorage.getItem('siteUnlocked');
          const adminAuthToken = sessionStorage.getItem('adminAuthToken');
          
          // تحديث حالة فتح الموقع إذا كانت موجودة في التخزين
          if (storedUnlockStatus === 'true') {
            setSettings(prev => ({ ...prev, isUnlocked: true }));
          }
          
          // التحقق من حالة المصادقة بالكامل من الخادم
          const authStatus = await checkAuthStatus();
          
          setSettings(prev => ({
            ...prev,
            isUnlocked: authStatus.authenticated || prev.isUnlocked,
            isAdmin: authStatus.isAdmin,
            passwordProtection: {
              ...prev.passwordProtection,
              enabled: authStatus.passwordProtectionEnabled
            }
          }));
        } catch (error) {
          console.error('Error checking auth status:', error);
        }
      };
      
      // تنفيذ الوظائف بالتتابع
      loadSiteProtection()
        .then(loadSettingsFromFirebase)
        .then(checkAuthentication)
        .catch(error => {
          console.error('Error in settings initialization:', error);
          setSettings(prev => ({ ...prev, isLoading: false }));
        });
    });
    
    // إعداد مراقبة التغييرات في Firebase لتحديث الإعدادات لحظيًا
    const setupFirebaseWatcher = async () => {
      try {
        const { watchData } = await import('@/lib/firebase');
        
        // مراقبة التغييرات في إعدادات الموقع
        return watchData('siteSettings', (data) => {
          if (data) {
            setSettings(prev => ({
              ...prev,
              countdownSettings: data.countdownSettings || prev.countdownSettings,
              passwordProtection: {
                ...prev.passwordProtection,
                enabled: data.passwordProtection?.enabled ?? prev.passwordProtection.enabled
              },
              shippingSettings: data.shippingSettings || prev.shippingSettings,
              socialMedia: data.socialMedia || prev.socialMedia,
            }));
          }
        });
      } catch (error) {
        console.error('Error setting up Firebase watcher:', error);
        return () => {}; // إرجاع دالة فارغة في حالة الخطأ
      }
    };
    
    // إعداد مراقبة التغييرات وتخزين دالة الإلغاء
    let unsubscribeFirebase: (() => void) | undefined;
    setupFirebaseWatcher().then(unsubscribe => {
      unsubscribeFirebase = unsubscribe;
    });
    
    // تنظيف عند تفكيك المكون
    return () => {
      if (typeof unsubscribeFirebase === 'function') {
        unsubscribeFirebase();
      }
    };
  }, []);

  const unlockSite = async (password: string): Promise<boolean> => {
    try {
      // استخدام واجهة API بدلاً من الاتصال المباشر بـ Firebase
      const { validateSitePassword } = await import('@/lib/api');
      const result = await validateSitePassword(password);
      
      if (result.success) {
        // تم تخزين الرمز بالفعل في واجهة API
        setSettings(prev => ({ ...prev, isUnlocked: true }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error unlocking site:', error);
      return false;
    }
  };

  const togglePasswordProtection = async (enabled: boolean): Promise<void> => {
    try {
      // استخدام واجهة API بدلاً من الاتصال المباشر بـ Firebase
      const { updatePasswordSettings } = await import('@/lib/api');
      const result = await updatePasswordSettings({ enabled });
      
      if (result.success) {
        console.log(`Password protection ${enabled ? 'enabled' : 'disabled'} successfully`);
        
        // تحديث الحالة المحلية
        setSettings(prev => ({
          ...prev,
          passwordProtection: {
            ...prev.passwordProtection,
            enabled,
          },
        }));
      } else {
        throw new Error('Failed to update password protection');
      }
    } catch (error) {
      console.error('Error toggling password protection:', error);
      alert('Error updating password protection setting. Please try again.');
    }
  };

  const changePassword = async (newPassword: string): Promise<void> => {
    try {
      // استخدام واجهة API بدلاً من الاتصال المباشر بـ Firebase
      const { updatePasswordSettings } = await import('@/lib/api');
      const result = await updatePasswordSettings({ password: newPassword });
      
      if (result.success) {
        console.log('Password updated successfully');
        
        // تحديث الحالة المحلية
        setSettings(prev => ({
          ...prev,
          passwordProtection: {
            ...prev.passwordProtection,
            password: newPassword,
          },
        }));
        
        // توفير تنبيه نجاح
        alert('تم تحديث كلمة المرور بنجاح!');
      } else {
        throw new Error('فشل تحديث كلمة المرور');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      alert('خطأ في تغيير كلمة المرور. يرجى المحاولة مرة أخرى.');
    }
  };

  const updateCountdownSettings = async (newSettings: Partial<CountdownSettings>): Promise<void> => {
    try {
      const updatedSettings = {
        ...settings.countdownSettings,
        ...newSettings,
      };
      
      // استخدام واجهة API بدلاً من الاتصال المباشر بـ Firebase
      const { updateCountdownSettings } = await import('@/lib/api');
      const result = await updateCountdownSettings(updatedSettings);
      
      if (result.success) {
        // تحديث الحالة المحلية
        setSettings(prev => ({
          ...prev,
          countdownSettings: updatedSettings,
        }));
      } else {
        throw new Error('فشل تحديث إعدادات العد التنازلي');
      }
    } catch (error) {
      console.error('Error updating countdown settings:', error);
      alert('حدث خطأ أثناء تحديث إعدادات العد التنازلي. يرجى المحاولة مرة أخرى.');
    }
  };
  
  const updateShippingSettings = async (newSettings: Partial<ShippingSettings>): Promise<void> => {
    try {
      const updatedSettings = {
        ...settings.shippingSettings,
        ...newSettings,
      };
      
      // استخدام واجهة API بدلاً من الاتصال المباشر بـ Firebase
      const { updateShippingSettings } = await import('@/lib/api');
      const result = await updateShippingSettings(updatedSettings);
      
      if (result.success) {
        // تحديث الحالة المحلية
        setSettings(prev => ({
          ...prev,
          shippingSettings: updatedSettings,
        }));
      } else {
        throw new Error('فشل تحديث إعدادات الشحن');
      }
    } catch (error) {
      console.error('Error updating shipping settings:', error);
      alert('حدث خطأ أثناء تحديث إعدادات الشحن. يرجى المحاولة مرة أخرى.');
    }
  };
  
  const updateSocialMediaSettings = async (newSettings: Partial<SocialMediaSettings>): Promise<void> => {
    try {
      const updatedSettings = {
        ...settings.socialMedia,
        ...newSettings,
      };
      
      // استخدام واجهة API بدلاً من الاتصال المباشر بـ Firebase
      const { updateSocialMediaSettings } = await import('@/lib/api');
      const result = await updateSocialMediaSettings(updatedSettings);
      
      if (result.success) {
        // تحديث الحالة المحلية
        setSettings(prev => ({
          ...prev,
          socialMedia: updatedSettings,
        }));
      } else {
        throw new Error('فشل تحديث إعدادات وسائل التواصل الاجتماعي');
      }
    } catch (error) {
      console.error('Error updating social media settings:', error);
      alert('حدث خطأ أثناء تحديث إعدادات وسائل التواصل الاجتماعي. يرجى المحاولة مرة أخرى.');
    }
  };

  const adminLogin = async (email: string, password: string): Promise<boolean> => {
    try {
      // استخدام واجهة API بدلاً من الاتصال المباشر
      const { adminLogin } = await import('@/lib/api');
      
      // محاولة تسجيل الدخول
      const result = await adminLogin(email, password);
      
      if (result.success && result.token) {
        // تم تخزين الرمز بالفعل في واجهة API (في الكوكيز)
        setSettings(prev => ({ ...prev, isAdmin: true }));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Admin login error:', error);
      return false;
    }
  };

  const adminLogout = async () => {
    try {
      // استخدام واجهة API بدلاً من الاتصال المباشر
      const { adminLogout } = await import('@/lib/api');
      
      // تسجيل الخروج
      const result = await adminLogout();
      
      // تحديث الحالة
      setSettings(prev => ({ ...prev, isAdmin: false }));
      
      // حذف الكوكي المشفر إضافيًا للتأكيد (وظيفة API تقوم بذلك أيضًا)
      document.cookie = "adminLoggedIn=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict; Secure";
    } catch (error) {
      console.error('Error during logout:', error);
      // تحديث الحالة حتى في حالة وجود خطأ
      setSettings(prev => ({ ...prev, isAdmin: false }));
      document.cookie = "adminLoggedIn=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict; Secure";
      sessionStorage.removeItem('adminAuthToken');
    }
  };

  return (
    <SiteSettingsContext.Provider
      value={{
        ...settings,
        unlockSite,
        togglePasswordProtection,
        changePassword,
        updateCountdownSettings,
        updateShippingSettings,
        updateSocialMediaSettings,
        adminLogin,
        adminLogout,
      }}
    >
      {children}
    </SiteSettingsContext.Provider>
  );
};

export const useSiteSettings = (): SiteSettingsContextType => {
  const context = useContext(SiteSettingsContext);
  if (!context) {
    throw new Error('useSiteSettings must be used within a SiteSettingsProvider');
  }
  return context;
};