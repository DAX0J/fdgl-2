// ملف مساعد لتسجيل الأنشطة الأمنية في وظائف Netlify Functions
const { getFirebaseAdminDatabase } = require('../firebase-admin');
const UAParser = require('ua-parser-js');

/**
 * تحليل معلومات المتصفح والجهاز من سلسلة User-Agent
 * @param {string} userAgent سلسلة User-Agent للمتصفح
 * @returns {object} معلومات المتصفح والجهاز
 */
function parseUserAgent(userAgent) {
  try {
    const parser = new UAParser(userAgent);
    const result = parser.getResult();
    
    return {
      browser: `${result.browser.name || 'Unknown'} ${result.browser.version || ''}`.trim(),
      os: `${result.os.name || 'Unknown'} ${result.os.version || ''}`.trim(),
      device: result.device.vendor 
        ? `${result.device.vendor} ${result.device.model || ''} (${result.device.type || 'Unknown'})`
        : 'Unknown Device'
    };
  } catch (error) {
    console.error('Error parsing user agent:', error);
    return {
      browser: 'Unknown',
      os: 'Unknown',
      device: 'Unknown Device'
    };
  }
}

/**
 * تسجيل محاولة تسجيل الدخول في Firebase
 * @param {string} email البريد الإلكتروني المستخدم في محاولة تسجيل الدخول
 * @param {string} ip عنوان IP للمستخدم
 * @param {string} userAgent سلسلة User-Agent للمتصفح
 * @param {boolean} success هل نجحت محاولة تسجيل الدخول
 * @returns {Promise<void>}
 */
async function logLoginAttempt(email, ip, userAgent, success) {
  try {
    const db = getFirebaseAdminDatabase();
    const deviceInfo = parseUserAgent(userAgent);
    
    const loginAttempt = {
      ip,
      email: email || 'unknown-email',
      timestamp: Date.now(),
      userAgent,
      success,
      deviceInfo
    };
    
    // تخزين محاولة تسجيل الدخول في Firebase
    await db.ref('security/loginAttempts').push(loginAttempt);
    
    // إذا فشلت محاولة تسجيل الدخول، قم بتحديث حالة IP
    if (!success) {
      await updateIPStatus(ip);
    }
    
    return true;
  } catch (error) {
    console.error('Error logging login attempt:', error);
    return false;
  }
}

/**
 * تحديث حالة IP بعد محاولة فاشلة
 * @param {string} ip عنوان IP للتحديث
 * @returns {Promise<void>}
 */
async function updateIPStatus(ip) {
  try {
    const db = getFirebaseAdminDatabase();
    const ipStatusRef = db.ref(`security/ipStatus/${ip.replace(/\./g, '_')}`);
    
    // الحصول على حالة IP الحالية
    const snapshot = await ipStatusRef.once('value');
    const currentStatus = snapshot.val() || { failedAttempts: 0, lastAttemptTime: 0 };
    
    const now = Date.now();
    const cooldownTime = 15 * 60 * 1000; // 15 دقيقة
    const banThreshold = 5; // عدد المحاولات الفاشلة قبل الحظر
    
    // إعادة تعيين العداد إذا كان آخر محاولة منذ أكثر من ساعة
    if (now - currentStatus.lastAttemptTime > 60 * 60 * 1000) {
      currentStatus.failedAttempts = 1;
    } else {
      currentStatus.failedAttempts += 1;
    }
    
    // تحديث حالة IP
    const updatedStatus = {
      ip,
      failedAttempts: currentStatus.failedAttempts,
      lastAttemptTime: now,
      cooldownUntil: currentStatus.failedAttempts >= 3 ? now + cooldownTime : null,
      banned: currentStatus.failedAttempts >= banThreshold
    };
    
    await ipStatusRef.set(updatedStatus);
    
    return updatedStatus;
  } catch (error) {
    console.error('Error updating IP status:', error);
    return null;
  }
}

/**
 * التحقق من حالة IP
 * @param {string} ip عنوان IP للتحقق منه
 * @returns {Promise<object>} حالة IP
 */
async function checkIPStatus(ip) {
  try {
    const db = getFirebaseAdminDatabase();
    const ipStatusRef = db.ref(`security/ipStatus/${ip.replace(/\./g, '_')}`);
    
    const snapshot = await ipStatusRef.once('value');
    const status = snapshot.val();
    
    if (!status) {
      return { banned: false, cooldown: null };
    }
    
    const now = Date.now();
    
    // التحقق إذا كان في فترة التهدئة
    if (status.cooldownUntil && status.cooldownUntil > now) {
      return { banned: false, cooldown: status.cooldownUntil };
    }
    
    // إذا تم حظر IP
    if (status.banned) {
      return { banned: true, cooldown: null };
    }
    
    return { banned: false, cooldown: null };
  } catch (error) {
    console.error('Error checking IP status:', error);
    return { banned: false, cooldown: null };
  }
}

/**
 * تسجيل نشاط أمني
 * @param {string} userId معرف المستخدم (اختياري)
 * @param {string} action نوع النشاط
 * @param {string} ip عنوان IP للمستخدم
 * @param {string} userAgent سلسلة User-Agent للمتصفح
 * @param {object} details تفاصيل إضافية عن النشاط
 * @returns {Promise<boolean>} هل تم تسجيل النشاط بنجاح
 */
async function logSecurityActivity(userId, action, ip, userAgent, details = {}) {
  try {
    const db = getFirebaseAdminDatabase();
    const deviceInfo = parseUserAgent(userAgent);
    
    const activity = {
      userId: userId || 'anonymous',
      action,
      ip,
      timestamp: Date.now(),
      userAgent,
      deviceInfo,
      details
    };
    
    // تخزين النشاط في Firebase
    await db.ref('security/activityLogs').push(activity);
    
    return true;
  } catch (error) {
    console.error('Error logging security activity:', error);
    return false;
  }
}

/**
 * البحث عن تهديدات أمنية محتملة
 * @returns {Promise<Array>} قائمة بالتهديدات المحتملة
 */
async function detectThreats() {
  try {
    const db = getFirebaseAdminDatabase();
    const threats = [];
    
    // 1. البحث عن محاولات تسجيل دخول متعددة فاشلة
    const loginAttemptsRef = db.ref('security/loginAttempts')
      .orderByChild('timestamp')
      .limitToLast(100);
    
    const loginSnapshot = await loginAttemptsRef.once('value');
    const loginAttempts = [];
    
    loginSnapshot.forEach(child => {
      loginAttempts.push(child.val());
    });
    
    // تجميع محاولات تسجيل الدخول حسب IP وحسب البريد الإلكتروني
    const ipAttempts = {};
    const emailAttempts = {};
    
    loginAttempts.forEach(attempt => {
      // تجميع حسب IP
      if (!ipAttempts[attempt.ip]) {
        ipAttempts[attempt.ip] = { count: 0, failed: 0, timestamp: [] };
      }
      ipAttempts[attempt.ip].count += 1;
      if (!attempt.success) {
        ipAttempts[attempt.ip].failed += 1;
      }
      ipAttempts[attempt.ip].timestamp.push(attempt.timestamp);
      
      // تجميع حسب البريد الإلكتروني
      if (attempt.email && attempt.email !== 'unknown-email') {
        if (!emailAttempts[attempt.email]) {
          emailAttempts[attempt.email] = { count: 0, failed: 0, timestamp: [] };
        }
        emailAttempts[attempt.email].count += 1;
        if (!attempt.success) {
          emailAttempts[attempt.email].failed += 1;
        }
        emailAttempts[attempt.email].timestamp.push(attempt.timestamp);
      }
    });
    
    // البحث عن تهديدات محتملة
    const now = Date.now();
    const thresholdTime = 30 * 60 * 1000; // 30 دقيقة
    
    // فحص محاولات IP
    Object.keys(ipAttempts).forEach(ip => {
      const attempts = ipAttempts[ip];
      
      // التحقق من المحاولات في آخر 30 دقيقة
      const recentAttempts = attempts.timestamp.filter(t => now - t < thresholdTime).length;
      
      if (attempts.failed >= 5 && recentAttempts >= 3) {
        threats.push({
          type: 'suspicious_login_ip',
          ip,
          severity: 'high',
          details: {
            totalAttempts: attempts.count,
            failedAttempts: attempts.failed,
            recentAttempts
          }
        });
      }
    });
    
    // فحص محاولات البريد الإلكتروني
    Object.keys(emailAttempts).forEach(email => {
      const attempts = emailAttempts[email];
      
      // التحقق من المحاولات في آخر 30 دقيقة
      const recentAttempts = attempts.timestamp.filter(t => now - t < thresholdTime).length;
      
      if (attempts.failed >= 3 && recentAttempts >= 2) {
        threats.push({
          type: 'suspicious_login_email',
          email,
          severity: 'medium',
          details: {
            totalAttempts: attempts.count,
            failedAttempts: attempts.failed,
            recentAttempts
          }
        });
      }
    });
    
    return threats;
  } catch (error) {
    console.error('Error detecting threats:', error);
    return [];
  }
}

/**
 * تنظيف سجلات الأمان القديمة
 * @returns {Promise<object>} نتائج التنظيف
 */
async function cleanupOldLogs() {
  try {
    const db = getFirebaseAdminDatabase();
    const now = Date.now();
    const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000); // 30 يوم
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000); // 7 أيام
    
    const results = {
      accessLogs: 0,
      activityLogs: 0,
      unbannedIPs: 0
    };
    
    // 1. حذف سجلات تسجيل الدخول القديمة (أقدم من شهر)
    const loginAttemptsRef = db.ref('security/loginAttempts');
    const loginSnapshot = await loginAttemptsRef
      .orderByChild('timestamp')
      .endAt(oneMonthAgo)
      .once('value');
    
    const loginPromises = [];
    loginSnapshot.forEach(child => {
      loginPromises.push(child.ref.remove());
      results.accessLogs++;
    });
    
    // 2. حذف سجلات النشاط القديمة (أقدم من شهر)
    const activityLogsRef = db.ref('security/activityLogs');
    const activitySnapshot = await activityLogsRef
      .orderByChild('timestamp')
      .endAt(oneMonthAgo)
      .once('value');
    
    const activityPromises = [];
    activitySnapshot.forEach(child => {
      activityPromises.push(child.ref.remove());
      results.activityLogs++;
    });
    
    // 3. إلغاء حظر عناوين IP التي لم تحاول تسجيل الدخول لمدة أسبوع
    const ipStatusRef = db.ref('security/ipStatus');
    const ipStatusSnapshot = await ipStatusRef.once('value');
    
    const ipPromises = [];
    ipStatusSnapshot.forEach(child => {
      const ipStatus = child.val();
      
      if (ipStatus.banned && ipStatus.lastAttemptTime < oneWeekAgo) {
        ipPromises.push(child.ref.update({ banned: false, failedAttempts: 0 }));
        results.unbannedIPs++;
      }
    });
    
    // تنفيذ جميع عمليات الحذف
    await Promise.all([
      ...loginPromises,
      ...activityPromises,
      ...ipPromises
    ]);
    
    return results;
  } catch (error) {
    console.error('Error cleaning up old logs:', error);
    return { accessLogs: 0, activityLogs: 0, unbannedIPs: 0 };
  }
}

module.exports = {
  parseUserAgent,
  logLoginAttempt,
  updateIPStatus,
  checkIPStatus,
  logSecurityActivity,
  detectThreats,
  cleanupOldLogs
};