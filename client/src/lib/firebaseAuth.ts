import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  getDatabase, 
  ref, 
  set, 
  get, 
  update 
} from 'firebase/database';

// تكوين Firebase - نفس التكوين الموجود في firebase.ts
const firebaseConfig = {
  apiKey: "AIzaSyBoBqVU1lvtuNZ2FlAZgdYCA4BaMlNy1pw",
  authDomain: "e2-com-10-2024-to-11-2024.firebaseapp.com",
  databaseURL: "https://e2-com-10-2024-to-11-2024-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "e2-com-10-2024-to-11-2024",
  storageBucket: "e2-com-10-2024-to-11-2024.firebasestorage.app",
  messagingSenderId: "859750456330",
  appId: "1:859750456330:web:cb21a5c394917b470713f3",
  measurementId: "G-KLPJPL70KN"
};

// تهيئة Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// --------- وظائف المصادقة الأساسية ---------

/**
 * تسجيل الدخول كمشرف باستخدام البريد الإلكتروني وكلمة المرور
 */
export const loginAdmin = async (email: string, password: string): Promise<User> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    // تخزين معلومات تسجيل الدخول للأغراض الأمنية
    await logLoginAttempt(email, true);
    
    return userCredential.user;
  } catch (error) {
    // تسجيل محاولة الدخول الفاشلة
    await logLoginAttempt(email, false);
    throw error;
  }
};

/**
 * تسجيل الخروج
 */
export const logoutAdmin = async (): Promise<void> => {
  await signOut(auth);
  // حذف أي بيانات جلسة محفوظة
  sessionStorage.removeItem('adminAuthToken');
};

/**
 * الاستماع لتغييرات حالة المصادقة
 */
export const subscribeToAuthChanges = (callback: (user: User | null) => void): (() => void) => {
  return onAuthStateChanged(auth, callback);
};

/**
 * الحصول على المستخدم الحالي
 */
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

// --------- وظائف حماية الموقع ---------

/**
 * التحقق مما إذا كانت حماية كلمة المرور مفعلة
 */
export const isPasswordProtectionEnabled = async (): Promise<boolean> => {
  try {
    const snapshot = await get(ref(database, 'settings/passwordProtection/enabled'));
    return snapshot.exists() ? snapshot.val() : true; // تمكين الحماية بشكل افتراضي
  } catch (error) {
    console.error('Error checking password protection:', error);
    return true; // إعادة القيمة الافتراضية في حالة الخطأ
  }
};

/**
 * التحقق من صحة كلمة مرور الموقع
 */
export const validateSitePassword = async (password: string): Promise<boolean> => {
  try {
    const snapshot = await get(ref(database, 'settings/passwordProtection/password'));
    const correctPassword = snapshot.exists() ? snapshot.val() : 'password123'; // كلمة المرور الافتراضية
    
    // تسجيل محاولة التحقق من كلمة المرور
    const ip = await getClientIP();
    const userAgent = navigator.userAgent;
    await logPasswordAttempt(ip, userAgent, password === correctPassword);
    
    return password === correctPassword;
  } catch (error) {
    console.error('Error validating site password:', error);
    return false;
  }
};

/**
 * تحديث كلمة مرور الموقع (للمشرف فقط)
 */
export const updateSitePassword = async (newPassword: string): Promise<boolean> => {
  try {
    await set(ref(database, 'settings/passwordProtection/password'), newPassword);
    return true;
  } catch (error) {
    console.error('Error updating site password:', error);
    return false;
  }
};

/**
 * تفعيل أو تعطيل حماية كلمة المرور (للمشرف فقط)
 */
export const togglePasswordProtection = async (enabled: boolean): Promise<boolean> => {
  try {
    await set(ref(database, 'settings/passwordProtection/enabled'), enabled);
    return true;
  } catch (error) {
    console.error('Error toggling password protection:', error);
    return false;
  }
};

// --------- وظائف تسجيل الأمان ---------

/**
 * تسجيل محاولة تسجيل الدخول
 */
export const logLoginAttempt = async (email: string, success: boolean): Promise<void> => {
  try {
    const ip = await getClientIP();
    const timestamp = Date.now();
    const userAgent = navigator.userAgent;
    
    // تحليل معلومات المتصفح والجهاز بشكل بسيط
    const deviceInfo = parseUserAgent(userAgent);
    
    // حفظ معلومات محاولة تسجيل الدخول
    const logRef = ref(database, `security/loginAttempts/${sanitizeIP(ip)}/${timestamp}`);
    await set(logRef, {
      email,
      timestamp,
      userAgent,
      deviceInfo,
      success
    });
    
    // إذا فشلت المحاولة، تحديث عداد المحاولات الفاشلة
    if (!success) {
      await updateFailedAttempts(ip);
    }
  } catch (error) {
    console.error('Error logging login attempt:', error);
  }
};

/**
 * تسجيل محاولة التحقق من كلمة المرور
 */
export const logPasswordAttempt = async (ip: string, userAgent: string, success: boolean): Promise<void> => {
  try {
    const timestamp = Date.now();
    
    // حفظ معلومات محاولة كلمة المرور
    const logRef = ref(database, `security/passwordAttempts/${sanitizeIP(ip)}/${timestamp}`);
    await set(logRef, {
      timestamp,
      userAgent,
      success
    });
    
    // إذا فشلت المحاولة، تحديث عداد المحاولات الفاشلة
    if (!success) {
      await updateFailedAttempts(ip);
    }
  } catch (error) {
    console.error('Error logging password attempt:', error);
  }
};

// --------- وظائف مساعدة ---------

/**
 * الحصول على عنوان IP الخاص بالعميل
 */
export const getClientIP = async (): Promise<string> => {
  try {
    // استخدام خدمة خارجية للحصول على عنوان IP
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error('Error fetching client IP:', error);
    return 'unknown';
  }
};

/**
 * معالجة عنوان IP ليكون آمنًا للاستخدام في مسارات Firebase
 */
export const sanitizeIP = (ip: string): string => {
  if (!ip) return 'unknown';
  return ip.replace(/\./g, '_');
};

/**
 * تحليل معلومات المتصفح والجهاز من User-Agent
 */
export const parseUserAgent = (userAgent: string): { browser: string; os: string; device: string } => {
  // تنفيذ بسيط لتحليل User-Agent
  let browser = 'Unknown';
  let os = 'Unknown';
  let device = 'Unknown';
  
  // تحديد المتصفح
  if (userAgent.includes('Chrome')) {
    browser = 'Chrome';
  } else if (userAgent.includes('Firefox')) {
    browser = 'Firefox';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browser = 'Safari';
  } else if (userAgent.includes('MSIE') || userAgent.includes('Trident/')) {
    browser = 'Internet Explorer';
  } else if (userAgent.includes('Edge')) {
    browser = 'Edge';
  }
  
  // تحديد نظام التشغيل
  if (userAgent.includes('Windows')) {
    os = 'Windows';
  } else if (userAgent.includes('Mac OS')) {
    os = 'macOS';
  } else if (userAgent.includes('Android')) {
    os = 'Android';
  } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    os = 'iOS';
  } else if (userAgent.includes('Linux')) {
    os = 'Linux';
  }
  
  // تحديد نوع الجهاز
  if (userAgent.includes('Mobile')) {
    device = 'Mobile';
  } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
    device = 'Tablet';
  } else {
    device = 'Desktop';
  }
  
  return { browser, os, device };
};

/**
 * تحديث عداد المحاولات الفاشلة لعنوان IP
 */
export const updateFailedAttempts = async (ip: string): Promise<void> => {
  try {
    const safeIP = sanitizeIP(ip);
    const statsRef = ref(database, `security/ipStats/${safeIP}`);
    
    // قراءة البيانات الحالية
    const snapshot = await get(statsRef);
    const stats = snapshot.exists() ? snapshot.val() : { failedAttempts: 0 };
    
    // زيادة عدد المحاولات الفاشلة
    stats.failedAttempts = (stats.failedAttempts || 0) + 1;
    stats.lastFailedAttempt = Date.now();
    
    // تحديث البيانات
    await set(statsRef, stats);
    
    // التحقق من الحاجة إلى منع الوصول
    if (stats.failedAttempts >= 10) {
      await banIP(ip);
    } else if (stats.failedAttempts >= 5) {
      await cooldownIP(ip);
    }
  } catch (error) {
    console.error('Error updating failed attempts:', error);
  }
};

/**
 * منع وصول عنوان IP
 */
export const banIP = async (ip: string): Promise<void> => {
  try {
    const safeIP = sanitizeIP(ip);
    await set(ref(database, `security/ipStatus/${safeIP}`), {
      banned: true,
      bannedAt: Date.now(),
      reason: 'Too many failed attempts',
      lastUpdated: Date.now()
    });
  } catch (error) {
    console.error('Error banning IP:', error);
  }
};

/**
 * فرض تأخير على عنوان IP
 */
export const cooldownIP = async (ip: string): Promise<void> => {
  try {
    const safeIP = sanitizeIP(ip);
    const cooldownTime = Date.now() + 30 * 60 * 1000; // 30 دقيقة
    
    await set(ref(database, `security/ipStatus/${safeIP}`), {
      banned: false,
      cooldownUntil: cooldownTime,
      lastUpdated: Date.now()
    });
  } catch (error) {
    console.error('Error setting cooldown for IP:', error);
  }
};

/**
 * التحقق من حالة عنوان IP
 */
export const checkIPStatus = async (ip?: string): Promise<{ banned: boolean; cooldown: number | null }> => {
  try {
    // إذا لم يتم تمرير عنوان IP، استخدام عنوان IP الحالي
    const clientIP = ip || await getClientIP();
    const safeIP = sanitizeIP(clientIP);
    
    const snapshot = await get(ref(database, `security/ipStatus/${safeIP}`));
    
    if (!snapshot.exists()) {
      return { banned: false, cooldown: null };
    }
    
    const status = snapshot.val();
    const now = Date.now();
    
    return {
      banned: status.banned === true,
      cooldown: status.cooldownUntil && status.cooldownUntil > now ? status.cooldownUntil : null
    };
  } catch (error) {
    console.error('Error checking IP status:', error);
    // في حالة الخطأ، السماح بالوصول
    return { banned: false, cooldown: null };
  }
};

export default {
  auth,
  loginAdmin,
  logoutAdmin,
  getCurrentUser,
  isPasswordProtectionEnabled,
  validateSitePassword,
  updateSitePassword,
  togglePasswordProtection,
  checkIPStatus
};