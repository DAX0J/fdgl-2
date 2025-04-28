const { initializeApp } = require('firebase/app');
const { getDatabase, ref, push, serverTimestamp } = require('firebase/database');

// Firebase تكوين
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyBoBqVU1lvtuNZ2FlAZgdYCA4BaMlNy1pw",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "e2-com-10-2024-to-11-2024.firebaseapp.com",
  databaseURL: process.env.FIREBASE_DATABASE_URL || "https://e2-com-10-2024-to-11-2024-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: process.env.FIREBASE_PROJECT_ID || "e2-com-10-2024-to-11-2024",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "e2-com-10-2024-to-11-2024.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "859750456330",
  appId: process.env.FIREBASE_APP_ID || "1:859750456330:web:cb21a5c394917b470713f3",
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-KLPJPL70KN"
};

// تهيئة Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

/**
 * استخراج معلومات المتصفح والجهاز من User-Agent
 */
function parseUserAgent(userAgent) {
  let browser = 'Unknown';
  let os = 'Unknown';
  let device = 'Unknown';

  if (!userAgent) return { browser, os, device };

  // تحليل المتصفح
  if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Safari')) browser = 'Safari';
  else if (userAgent.includes('Edge')) browser = 'Edge';
  else if (userAgent.includes('MSIE') || userAgent.includes('Trident/')) browser = 'Internet Explorer';

  // تحليل نظام التشغيل
  if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac')) os = 'MacOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';

  // تحليل الجهاز
  if (userAgent.includes('Mobile')) device = 'Mobile';
  else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) device = 'Tablet';
  else device = 'Desktop';

  return { browser, os, device };
}

/**
 * تسجيل محاولة وصول غير مصرح بها
 */
async function logUnauthorizedAccess(event, resource) {
  try {
    const ip = event.headers['client-ip'] || 
               event.headers['x-forwarded-for'] || 
               'unknown-ip';
    
    const userAgent = event.headers['user-agent'] || 'unknown';
    const deviceInfo = parseUserAgent(userAgent);
    
    const method = event.httpMethod;
    const path = event.path;
    const timestamp = Date.now();
    
    // بيانات السجل
    const logData = {
      ip,
      userAgent,
      deviceInfo,
      method,
      path,
      resource,
      timestamp,
      date: new Date(timestamp).toISOString()
    };
    
    // دفع البيانات إلى Firebase
    const accessLogsRef = ref(database, 'accessLogs');
    await push(accessLogsRef, logData);
    
    console.log(`Unauthorized access logged for ${ip} to ${resource}`);
  } catch (error) {
    console.error('Error logging unauthorized access:', error);
  }
}

module.exports = {
  logUnauthorizedAccess,
  parseUserAgent
};