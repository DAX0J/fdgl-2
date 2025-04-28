// ملف مساعد للتحقق من المصادقة في وظائف Netlify Functions
const jwt = require('jsonwebtoken');
const { getFirebaseAdminAuth } = require('../firebase-admin');
const { createErrorResponse } = require('./util');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-do-not-use-in-production';
const JWT_EXPIRY = '24h'; // مدة صلاحية الرمز

/**
 * التحقق مما إذا كان المستخدم مصادقًا عليه
 * @param {object} event كائن الحدث من Netlify Function
 * @returns {boolean} ما إذا كان المستخدم مصادقًا عليه
 */
const isAuthenticated = (event) => {
  const token = extractAuthToken(event);
  if (!token) {
    return false;
  }
  
  const decoded = verifyToken(token);
  return decoded !== null;
};

/**
 * إنشاء رمز JWT للمستخدم المصادق عليه
 * @param {string} uid معرف المستخدم
 * @param {object} additionalClaims معلومات إضافية لتضمينها في الرمز
 * @returns {string} رمز JWT
 */
const generateToken = (uid, additionalClaims = {}) => {
  return jwt.sign(
    { 
      uid,
      ...additionalClaims
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
};

/**
 * التحقق من صحة رمز JWT
 * @param {string} token رمز JWT للتحقق منه
 * @returns {object|null} معلومات المستخدم إذا كان الرمز صالحًا، وإلا فارغ
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('Error verifying JWT token:', error.message);
    return null;
  }
};

/**
 * استخراج رمز المصادقة من رؤوس الطلب
 * @param {object} event كائن الحدث من Netlify Function
 * @returns {string|null} رمز المصادقة أو فارغ إذا لم يتم العثور عليه
 */
const extractAuthToken = (event) => {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  
  if (!authHeader) {
    return null;
  }
  
  // التحقق من نمط رمز المصادقة
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
};

/**
 * التحقق من المصادقة للوظائف التي تتطلب مستخدمًا مصادقًا عليه
 * @param {object} event كائن الحدث من Netlify Function
 * @returns {Promise<object>} معلومات المستخدم أو استجابة خطأ
 */
const requireAuth = async (event) => {
  const token = extractAuthToken(event);
  
  if (!token) {
    return { 
      isAuthorized: false,
      error: createErrorResponse(401, 'Authorization token is missing')
    };
  }
  
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return { 
      isAuthorized: false,
      error: createErrorResponse(401, 'Invalid or expired token')
    };
  }
  
  try {
    // التحقق من وجود المستخدم في Firebase إذا كان ذلك مطلوبًا
    // في بعض الحالات قد لا تحتاج إلى هذه الخطوة إذا كنت تثق في الرمز نفسه
    const auth = getFirebaseAdminAuth();
    const userRecord = await auth.getUser(decoded.uid);
    
    return { 
      isAuthorized: true,
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        isAdmin: decoded.isAdmin || false,
        ...decoded
      }
    };
  } catch (error) {
    console.error('Error verifying user:', error);
    return { 
      isAuthorized: false,
      error: createErrorResponse(401, 'Failed to verify user')
    };
  }
};

/**
 * التحقق من صلاحيات المسؤول للوظائف التي تتطلب صلاحيات مسؤول
 * @param {object} event كائن الحدث من Netlify Function
 * @returns {Promise<object>} معلومات المستخدم أو استجابة خطأ
 */
const requireAdmin = async (event) => {
  const authResult = await requireAuth(event);
  
  if (!authResult.isAuthorized) {
    return authResult;
  }
  
  if (!authResult.user.isAdmin) {
    return { 
      isAuthorized: false,
      error: createErrorResponse(403, 'Insufficient permissions. Admin access required.')
    };
  }
  
  return authResult;
};

// تخزين محلي لمحاولات تسجيل الدخول الفاشلة
// يتم مسح هذا التخزين عند إعادة تشغيل الوظيفة
const loginAttempts = {};

/**
 * التحقق من محاولات تسجيل الدخول لعنوان IP
 * @param {string} ip عنوان IP
 * @returns {{allowed: boolean, reason: string, delay: number}} حالة السماح وسبب المنع وتأخير التحقق
 */
const checkLoginAttempts = (ip) => {
  if (!loginAttempts[ip]) {
    loginAttempts[ip] = {
      count: 0,
      lastAttempt: 0
    };
  }

  const now = Date.now();
  const attempts = loginAttempts[ip];
  
  // تعيين توقيت آخر محاولة
  attempts.lastAttempt = now;
  
  // إذا وصلت المحاولات إلى الحد الأقصى، ارفض الطلب
  if (attempts.count >= 5) {
    return {
      allowed: false,
      reason: 'العديد من محاولات تسجيل الدخول الفاشلة. يرجى المحاولة مرة أخرى لاحقًا.',
      delay: 0
    };
  }
  
  // تأخير يزداد مع عدد المحاولات الفاشلة
  const delay = attempts.count > 0 ? attempts.count * 1000 : 0;
  
  return {
    allowed: true,
    reason: '',
    delay
  };
};

/**
 * تسجيل محاولة تسجيل دخول فاشلة
 * @param {string} ip عنوان IP
 * @param {string} userAgent متصفح المستخدم
 */
const recordFailedLoginAttempt = (ip, userAgent) => {
  if (!loginAttempts[ip]) {
    loginAttempts[ip] = {
      count: 0,
      lastAttempt: Date.now(),
      userAgent
    };
  }
  
  loginAttempts[ip].count++;
  loginAttempts[ip].lastAttempt = Date.now();
};

/**
 * إعادة تعيين محاولات تسجيل الدخول لعنوان IP
 * @param {string} ip عنوان IP
 */
const resetLoginAttempts = (ip) => {
  if (loginAttempts[ip]) {
    loginAttempts[ip].count = 0;
    loginAttempts[ip].lastAttempt = Date.now();
  }
};

/**
 * إنشاء استجابة مع كوكي
 * @param {number} statusCode رمز الحالة
 * @param {object} body محتوى الاستجابة
 * @param {string} cookieName اسم الكوكي
 * @param {string} cookieValue قيمة الكوكي
 * @returns {object} استجابة مع كوكي
 */
const createResponseWithCookie = (statusCode, body, cookieName, cookieValue) => {
  const expires = new Date();
  expires.setDate(expires.getDate() + 1); // كوكي تنتهي بعد يوم واحد
  
  return {
    statusCode,
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `${cookieName}=${cookieValue}; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=${expires.toUTCString()}`
    }
  };
};

/**
 * إنشاء استجابة غير مصرح بها
 * @param {string} message رسالة الخطأ
 * @param {object} event كائن الحدث
 * @param {string} resourceType نوع المورد المحمي
 * @returns {object} استجابة غير مصرح بها
 */
const unauthorizedResponse = (message, event, resourceType) => {
  return {
    statusCode: 401,
    body: JSON.stringify({
      success: false,
      message: message || 'غير مصرح به',
      authenticated: false
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  };
};

module.exports = {
  generateToken,
  verifyToken,
  extractAuthToken,
  requireAuth,
  requireAdmin,
  isAuthenticated,
  checkLoginAttempts,
  recordFailedLoginAttempt,
  resetLoginAttempts,
  createResponseWithCookie,
  unauthorizedResponse
};