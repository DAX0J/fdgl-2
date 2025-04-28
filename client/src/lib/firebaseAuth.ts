import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  getDatabase, 
  ref, 
  get, 
  set, 
  query, 
  orderByChild, 
  equalTo, 
  push,
  update,
  serverTimestamp
} from 'firebase/database';

// تكوين Firebase
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
  databaseURL: `https://${import.meta.env.VITE_FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// تهيئة تطبيق Firebase
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  console.error('Error initializing Firebase:', error);
}

// الحصول على خدمات Firebase
const auth = getAuth(app);
const database = getDatabase(app);

// تنسيق معرف الجهاز للاستخدام في قاعدة البيانات
export const sanitizeIP = (ip: string): string => {
  return ip.replace(/\./g, '_');
};

/**
 * تسجيل الدخول كمسؤول
 * @param email البريد الإلكتروني للمسؤول
 * @param password كلمة المرور
 * @returns وعد بالمستخدم إذا نجح تسجيل الدخول
 */
export const loginAdmin = async (email: string, password: string): Promise<FirebaseUser> => {
  try {
    // تسجيل الدخول باستخدام Firebase Authentication
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    // التحقق مما إذا كان المستخدم مسؤولاً
    const userRef = ref(database, `users/${userCredential.user.uid}`);
    const userSnapshot = await get(userRef);
    
    if (!userSnapshot.exists() || !userSnapshot.val().isAdmin) {
      // إذا لم يكن المستخدم مسؤولاً، قم بتسجيل الخروج وارفض الوعد
      await signOut(auth);
      throw new Error('User is not an admin');
    }
    
    // تسجيل محاولة تسجيل الدخول الناجحة
    const ip = await getCurrentIP();
    logLoginAttempt(email, ip, true);
    
    return userCredential.user;
  } catch (error) {
    // تسجيل محاولة تسجيل الدخول الفاشلة
    const ip = await getCurrentIP();
    logLoginAttempt(email, ip, false);
    
    throw error;
  }
};

/**
 * تسجيل الخروج
 */
export const logoutAdmin = async (): Promise<void> => {
  return signOut(auth);
};

/**
 * فحص ما إذا كان المستخدم مسجل الدخول
 * @param callback دالة يتم استدعاؤها عند تغيير حالة المصادقة
 * @returns دالة لإلغاء الاشتراك
 */
export const onAuthStateChange = (
  callback: (user: FirebaseUser | null, isAdmin: boolean) => void
) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      // إذا كان المستخدم موجوداً، تحقق مما إذا كان مسؤولاً
      const userRef = ref(database, `users/${user.uid}`);
      const userSnapshot = await get(userRef);
      const isAdmin = userSnapshot.exists() && userSnapshot.val().isAdmin;
      callback(user, isAdmin);
    } else {
      callback(null, false);
    }
  });
};

/**
 * التحقق من كلمة مرور حماية الموقع
 * @param password كلمة المرور المقدمة
 * @returns صحيح إذا كانت كلمة المرور صحيحة
 */
export const validateSitePassword = async (password: string): Promise<boolean> => {
  try {
    // الحصول على كلمة المرور الصحيحة من Firebase
    const passwordRef = ref(database, 'siteSettings/passwordProtection/password');
    const snapshot = await get(passwordRef);
    
    if (!snapshot.exists()) {
      console.error('Site password not found in database');
      return false;
    }
    
    const correctPassword = snapshot.val();
    
    // تسجيل محاولة المصادقة
    const ip = await getCurrentIP();
    const success = password === correctPassword;
    
    // تسجيل المحاولة
    await logPasswordAttempt(ip, success);
    
    return success;
  } catch (error) {
    console.error('Error validating site password:', error);
    return false;
  }
};

/**
 * التحقق مما إذا كانت حماية كلمة المرور ممكّنة
 * @returns صحيح إذا كانت الحماية ممكّنة
 */
export const checkPasswordProtectionEnabled = async (): Promise<boolean> => {
  try {
    const enabledRef = ref(database, 'siteSettings/passwordProtection/enabled');
    const snapshot = await get(enabledRef);
    
    return snapshot.exists() ? snapshot.val() : false;
  } catch (error) {
    console.error('Error checking password protection status:', error);
    return false;
  }
};

/**
 * تمكين أو تعطيل حماية كلمة المرور
 * @param enabled الحالة الجديدة
 */
export const setPasswordProtection = async (enabled: boolean): Promise<void> => {
  try {
    const enabledRef = ref(database, 'siteSettings/passwordProtection/enabled');
    await set(enabledRef, enabled);
  } catch (error) {
    console.error('Error setting password protection:', error);
    throw error;
  }
};

/**
 * تغيير كلمة مرور الموقع
 * @param newPassword كلمة المرور الجديدة
 */
export const setSitePassword = async (newPassword: string): Promise<void> => {
  try {
    const passwordRef = ref(database, 'siteSettings/passwordProtection/password');
    await set(passwordRef, newPassword);
  } catch (error) {
    console.error('Error setting site password:', error);
    throw error;
  }
};

/**
 * الحصول على عنوان IP الحالي
 * @returns وعد بعنوان IP
 */
export const getCurrentIP = async (): Promise<string> => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error('Error getting IP address:', error);
    return 'unknown';
  }
};

/**
 * تسجيل محاولة تسجيل الدخول
 * @param email البريد الإلكتروني المستخدم
 * @param ip عنوان IP
 * @param success نجاح المحاولة
 */
export const logLoginAttempt = async (
  email: string,
  ip: string,
  success: boolean
): Promise<void> => {
  try {
    const sanitizedIP = sanitizeIP(ip);
    const loginAttemptsRef = ref(database, 'security/loginAttempts');
    
    // تسجيل المحاولة
    await push(loginAttemptsRef, {
      email,
      ip: sanitizedIP,
      success,
      timestamp: serverTimestamp(),
      userAgent: navigator.userAgent
    });
    
    // إذا فشلت المحاولة، قم بتحديث عدد المحاولات الفاشلة لهذا العنوان IP
    if (!success) {
      // الحصول على حالة IP الحالية
      const ipStatusRef = ref(database, `security/ipStatus/${sanitizedIP}`);
      const ipStatusSnapshot = await get(ipStatusRef);
      
      let failedAttempts = 1;
      
      if (ipStatusSnapshot.exists()) {
        failedAttempts = (ipStatusSnapshot.val().failedAttempts || 0) + 1;
      }
      
      // تحديث حالة IP
      await update(ipStatusRef, {
        failedAttempts,
        lastAttempt: serverTimestamp()
      });
      
      // إذا تجاوز عدد المحاولات الفاشلة الحد المسموح به، قم بوضع تأخير مؤقت أو حظر
      if (failedAttempts >= 10) {
        // حظر دائم بعد 10 محاولات فاشلة
        await update(ipStatusRef, {
          banned: true,
          bannedTimestamp: serverTimestamp()
        });
      } else if (failedAttempts >= 5) {
        // تأخير مؤقت بعد 5 محاولات فاشلة
        const cooldownTime = Date.now() + (30 * 1000); // 30 ثانية من الآن
        await update(ipStatusRef, {
          cooldown: cooldownTime
        });
      }
    } else {
      // إذا نجحت المحاولة، قم بإعادة تعيين عدد المحاولات الفاشلة
      const ipStatusRef = ref(database, `security/ipStatus/${sanitizedIP}`);
      await update(ipStatusRef, {
        failedAttempts: 0,
        cooldown: null,
        lastSuccessfulLogin: serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Error logging login attempt:', error);
  }
};

/**
 * تسجيل محاولة إدخال كلمة مرور الموقع
 * @param ip عنوان IP
 * @param success نجاح المحاولة
 */
export const logPasswordAttempt = async (
  ip: string,
  success: boolean
): Promise<void> => {
  try {
    const sanitizedIP = sanitizeIP(ip);
    const passwordAttemptsRef = ref(database, 'security/passwordAttempts');
    
    // تسجيل المحاولة
    await push(passwordAttemptsRef, {
      ip: sanitizedIP,
      success,
      timestamp: serverTimestamp(),
      userAgent: navigator.userAgent
    });
    
    // إذا فشلت المحاولة، قم بتحديث عدد المحاولات الفاشلة لهذا العنوان IP
    if (!success) {
      // الحصول على حالة IP الحالية
      const ipStatusRef = ref(database, `security/ipStatus/${sanitizedIP}`);
      const ipStatusSnapshot = await get(ipStatusRef);
      
      let failedAttempts = 1;
      
      if (ipStatusSnapshot.exists()) {
        failedAttempts = (ipStatusSnapshot.val().failedPasswordAttempts || 0) + 1;
      }
      
      // تحديث حالة IP
      await update(ipStatusRef, {
        failedPasswordAttempts: failedAttempts,
        lastPasswordAttempt: serverTimestamp()
      });
      
      // إذا تجاوز عدد المحاولات الفاشلة الحد المسموح به، قم بوضع تأخير مؤقت أو حظر
      if (failedAttempts >= 10) {
        // حظر دائم بعد 10 محاولات فاشلة
        await update(ipStatusRef, {
          banned: true,
          bannedTimestamp: serverTimestamp()
        });
      } else if (failedAttempts >= 5) {
        // تأخير مؤقت بعد 5 محاولات فاشلة
        const cooldownTime = Date.now() + (30 * 1000); // 30 ثانية من الآن
        await update(ipStatusRef, {
          cooldown: cooldownTime
        });
      }
    } else {
      // إذا نجحت المحاولة، قم بإعادة تعيين عدد المحاولات الفاشلة
      const ipStatusRef = ref(database, `security/ipStatus/${sanitizedIP}`);
      await update(ipStatusRef, {
        failedPasswordAttempts: 0,
        cooldown: null,
        lastSuccessfulPasswordAttempt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Error logging password attempt:', error);
  }
};

/**
 * فحص حالة عنوان IP
 * @param ip عنوان IP للفحص
 * @returns معلومات حول حالة عنوان IP
 */
export const checkIPStatus = async (ip: string): Promise<{
  banned: boolean;
  cooldown: number | null;
}> => {
  try {
    const sanitizedIP = sanitizeIP(ip);
    const ipStatusRef = ref(database, `security/ipStatus/${sanitizedIP}`);
    const snapshot = await get(ipStatusRef);
    
    if (!snapshot.exists()) {
      return { banned: false, cooldown: null };
    }
    
    const status = snapshot.val();
    
    // التحقق من الحظر
    if (status.banned) {
      return { banned: true, cooldown: null };
    }
    
    // التحقق من التأخير المؤقت
    if (status.cooldown && status.cooldown > Date.now()) {
      return { banned: false, cooldown: status.cooldown };
    }
    
    // إذا انتهى التأخير المؤقت، قم بإزالته
    if (status.cooldown && status.cooldown <= Date.now()) {
      await update(ipStatusRef, { cooldown: null });
    }
    
    return { banned: false, cooldown: null };
  } catch (error) {
    console.error('Error checking IP status:', error);
    return { banned: false, cooldown: null };
  }
};