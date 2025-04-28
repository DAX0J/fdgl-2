const jwt = require('jsonwebtoken');
const cookie = require('cookie');

// استخدام سر من متغيرات البيئة (يجب تعيينه في إعدادات Netlify)
const JWT_SECRET = process.env.JWT_SECRET || 'temp_secret_replace_in_production';
const TOKEN_EXPIRY = '24h';

// معلومات المحاولات الفاشلة لتسجيل الدخول
const failedLoginAttempts = new Map();
const ipBlockList = new Map();

// وقت الحظر للعنوان IP (بالدقائق)
const IP_BAN_TIME = 30;
// الحد الأقصى للمحاولات الفاشلة
const MAX_FAILED_ATTEMPTS = 5;
// فترة إعادة تعيين المحاولات الفاشلة (بالدقائق)
const RESET_PERIOD = 10;

/**
 * توليد رمز JWT
 */
function generateToken(data) {
  return jwt.sign(data, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

/**
 * التحقق من صحة الرمز
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * إنشاء كوكي آمنة
 */
function createSecureCookie(name, value, options = {}) {
  return cookie.serialize(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 24 * 60 * 60, // 24 ساعة
    ...options
  });
}

/**
 * التحقق من محاولات تسجيل الدخول الفاشلة
 */
function checkLoginAttempts(ip) {
  // التحقق إذا كان العنوان IP محظورًا
  if (ipBlockList.has(ip)) {
    const blockUntil = ipBlockList.get(ip);
    if (Date.now() < blockUntil) {
      // حساب الوقت المتبقي للحظر
      const remainingTime = Math.ceil((blockUntil - Date.now()) / (1000 * 60));
      return {
        allowed: false,
        reason: `تم حظر هذا العنوان IP لمدة ${remainingTime} دقيقة بسبب العديد من محاولات تسجيل الدخول الفاشلة.`
      };
    } else {
      // إزالة الحظر إذا انتهت المدة
      ipBlockList.delete(ip);
    }
  }

  // إذا لم يكن هناك محاولات سابقة، السماح بالدخول
  if (!failedLoginAttempts.has(ip)) {
    return { allowed: true };
  }

  const attempts = failedLoginAttempts.get(ip);
  
  // التحقق إذا كان يجب إعادة تعيين المحاولات
  if (Date.now() > attempts.resetTime) {
    failedLoginAttempts.delete(ip);
    return { allowed: true };
  }

  // التحقق من عدد المحاولات
  if (attempts.count >= MAX_FAILED_ATTEMPTS) {
    // حظر العنوان IP
    const blockUntil = Date.now() + IP_BAN_TIME * 60 * 1000;
    ipBlockList.set(ip, blockUntil);
    failedLoginAttempts.delete(ip);
    
    return {
      allowed: false,
      reason: `تم تجاوز الحد الأقصى لمحاولات تسجيل الدخول. تم حظر العنوان IP لمدة ${IP_BAN_TIME} دقيقة.`
    };
  }

  // حساب التأخير بناءً على عدد المحاولات
  const delay = Math.pow(2, attempts.count) * 1000;
  
  return {
    allowed: true,
    delay
  };
}

/**
 * تسجيل محاولة فاشلة
 */
function recordFailedLoginAttempt(ip, userAgent) {
  let attempts = failedLoginAttempts.get(ip);
  
  if (!attempts) {
    attempts = {
      count: 0,
      resetTime: Date.now() + RESET_PERIOD * 60 * 1000,
      attempts: []
    };
  }
  
  attempts.count += 1;
  attempts.attempts.push({
    timestamp: Date.now(),
    userAgent
  });
  
  failedLoginAttempts.set(ip, attempts);
  
  return attempts;
}

/**
 * إعادة تعيين محاولات تسجيل الدخول الفاشلة
 */
function resetLoginAttempts(ip) {
  failedLoginAttempts.delete(ip);
}

/**
 * التحقق من هيدر المصادقة
 */
function extractTokenFromRequest(event) {
  // التحقق من كوكي
  const cookies = cookie.parse(event.headers.cookie || '');
  if (cookies.authToken) {
    return cookies.authToken;
  }
  
  // التحقق من هيدر التفويض
  const authHeader = event.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return null;
}

/**
 * التحقق من المصادقة في الطلب
 */
function isAuthenticated(event) {
  const token = extractTokenFromRequest(event);
  if (!token) return false;
  
  const decoded = verifyToken(token);
  return !!decoded;
}

/**
 * الحصول على بيانات المستخدم من الرمز
 */
function getUserFromRequest(event) {
  const token = extractTokenFromRequest(event);
  if (!token) return null;
  
  return verifyToken(token);
}

/**
 * كود استجابة قياسي لطلب غير مصادق
 */
function unauthorizedResponse(message = 'غير مصرح به') {
  return {
    statusCode: 401,
    body: JSON.stringify({ error: message }),
    headers: {
      'Content-Type': 'application/json'
    }
  };
}

/**
 * كود استجابة قياسي لطلب محظور
 */
function forbiddenResponse(message = 'محظور') {
  return {
    statusCode: 403,
    body: JSON.stringify({ error: message }),
    headers: {
      'Content-Type': 'application/json'
    }
  };
}

/**
 * إنشاء استجابة مع كوكي
 */
function createResponseWithCookie(statusCode, body, cookieName, cookieValue, cookieOptions = {}) {
  const cookieHeader = createSecureCookie(cookieName, cookieValue, cookieOptions);
  
  return {
    statusCode,
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookieHeader
    }
  };
}

module.exports = {
  generateToken,
  verifyToken,
  createSecureCookie,
  checkLoginAttempts,
  recordFailedLoginAttempt,
  resetLoginAttempts,
  extractTokenFromRequest,
  isAuthenticated,
  getUserFromRequest,
  unauthorizedResponse,
  forbiddenResponse,
  createResponseWithCookie
};