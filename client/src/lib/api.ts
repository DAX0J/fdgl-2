import axios from 'axios';

// تحديد عنوان API حسب البيئة
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? '/.netlify/functions'
  : '/api'; // سيتم تحويل هذا عبر إعادة التوجيه في netlify.toml

// تكوين axios
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // السماح بإرسال الكوكيز
  headers: {
    'Content-Type': 'application/json'
  }
});

// إضافة معترض لإضافة رمز المصادقة إلى الطلبات
api.interceptors.request.use(
  (config) => {
    // إضافة رمز المصادقة من sessionStorage إذا كان موجودًا
    const token = sessionStorage.getItem('authToken');
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// إضافة معترض للتعامل مع الاستجابات
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // التعامل مع أخطاء المصادقة
    if (error.response && error.response.status === 401) {
      // إعادة تعيين حالة الدخول إذا كان الرمز غير صالح
      sessionStorage.removeItem('siteUnlocked');
      sessionStorage.removeItem('authToken');
    }
    return Promise.reject(error);
  }
);

// واجهة برمجية للتحقق من حالة حماية الموقع
export const checkSiteProtection = async (): Promise<{ enabled: boolean, authenticated: boolean }> => {
  try {
    const response = await api.get('/auth-check-protection');
    return response.data;
  } catch (error) {
    console.error('Error checking site protection status:', error);
    // افتراض أن الحماية مفعلة في حالة وجود خطأ
    return { enabled: true, authenticated: false };
  }
};

// واجهة برمجية للتحقق من كلمة المرور
export const validateSitePassword = async (password: string): Promise<{ success: boolean, token?: string }> => {
  try {
    const response = await api.post('/auth-validate-password', { password });
    
    // تخزين رمز المصادقة في sessionStorage إذا كان التحقق ناجحًا
    if (response.data.success && response.data.token) {
      sessionStorage.setItem('authToken', response.data.token);
      sessionStorage.setItem('siteUnlocked', 'true');
    }
    
    return response.data;
  } catch (error) {
    console.error('Error validating site password:', error);
    return { success: false };
  }
};

// واجهة برمجية لتسجيل دخول المسؤول
export const adminLogin = async (email: string, password: string): Promise<{ success: boolean, token?: string, user?: any }> => {
  try {
    const response = await api.post('/admin-login', { email, password });
    
    // تخزين رمز المصادقة في sessionStorage إذا كان التحقق ناجحًا
    if (response.data.success && response.data.token) {
      sessionStorage.setItem('adminAuthToken', response.data.token);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error during admin login:', error);
    return { success: false };
  }
};

// واجهة برمجية لتسجيل خروج المسؤول
export const adminLogout = async (): Promise<{ success: boolean }> => {
  try {
    const response = await api.post('/admin-logout');
    
    // إزالة رمز المصادقة من sessionStorage
    sessionStorage.removeItem('adminAuthToken');
    
    return response.data;
  } catch (error) {
    console.error('Error during admin logout:', error);
    // حتى في حالة الخطأ، قم بإزالة رمز المصادقة
    sessionStorage.removeItem('adminAuthToken');
    return { success: false };
  }
};

// واجهة برمجية للتحقق من حالة المصادقة
export const checkAuthStatus = async (): Promise<{ authenticated: boolean, isAdmin: boolean, passwordProtectionEnabled: boolean }> => {
  try {
    const response = await api.get('/auth-status');
    return response.data;
  } catch (error) {
    console.error('Error checking authentication status:', error);
    return { authenticated: false, isAdmin: false, passwordProtectionEnabled: true };
  }
};

// واجهة برمجية لتحديث إعدادات كلمة المرور
export const updatePasswordSettings = async (settings: { password?: string, enabled?: boolean }): Promise<{ success: boolean }> => {
  try {
    const response = await api.post('/admin-update-password', settings);
    return response.data;
  } catch (error) {
    console.error('Error updating password settings:', error);
    return { success: false };
  }
};

// واجهة برمجية لتحديث إعدادات العد التنازلي
export const updateCountdownSettings = async (settings: any): Promise<{ success: boolean }> => {
  try {
    const response = await api.post('/admin-update-settings', { 
      section: 'countdownSettings',
      settings 
    });
    return response.data;
  } catch (error) {
    console.error('Error updating countdown settings:', error);
    return { success: false };
  }
};

// واجهة برمجية لتحديث إعدادات الشحن
export const updateShippingSettings = async (settings: any): Promise<{ success: boolean }> => {
  try {
    const response = await api.post('/admin-update-settings', { 
      section: 'shippingSettings',
      settings 
    });
    return response.data;
  } catch (error) {
    console.error('Error updating shipping settings:', error);
    return { success: false };
  }
};

// واجهة برمجية لتحديث إعدادات وسائل التواصل الاجتماعي
export const updateSocialMediaSettings = async (settings: any): Promise<{ success: boolean }> => {
  try {
    const response = await api.post('/admin-update-settings', { 
      section: 'socialMedia',
      settings 
    });
    return response.data;
  } catch (error) {
    console.error('Error updating social media settings:', error);
    return { success: false };
  }
};

export default api;