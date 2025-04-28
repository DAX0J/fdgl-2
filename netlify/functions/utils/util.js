// ملف وظائف مساعدة عامة لاستخدامها في وظائف Netlify Functions

/**
 * إنشاء استجابة نجاح موحدة
 * @param {object} data البيانات المراد إرجاعها في الاستجابة
 * @param {object} headers رؤوس HTTP الإضافية
 * @returns {object} كائن استجابة موحد
 */
function createSuccessResponse(data = {}, headers = {}) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify({
      success: true,
      data
    })
  };
}

/**
 * إنشاء استجابة خطأ موحدة
 * @param {number} statusCode رمز حالة HTTP
 * @param {string} message رسالة الخطأ
 * @param {object} details تفاصيل إضافية عن الخطأ
 * @param {object} headers رؤوس HTTP الإضافية
 * @returns {object} كائن استجابة موحد
 */
function createErrorResponse(statusCode = 400, message = 'حدث خطأ', details = {}, headers = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify({
      success: false,
      error: {
        message,
        ...details
      }
    })
  };
}

/**
 * معالجة خطأ بطريقة موحدة
 * @param {Error} error كائن الخطأ
 * @param {string} defaultMessage رسالة افتراضية
 * @returns {object} استجابة خطأ موحدة
 */
function handleError(error, defaultMessage = 'حدث خطأ في الخادم') {
  console.error('Error:', error);
  
  let statusCode = 500;
  let message = defaultMessage;
  
  // محاولة استخراج معلومات أكثر تفصيلاً من الخطأ إذا كانت متاحة
  if (error.statusCode) {
    statusCode = error.statusCode;
  }
  
  if (error.message) {
    message = error.message;
  }
  
  return createErrorResponse(statusCode, message, {
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
}

/**
 * تنظيف مسار عنوان IP لاستخدامه في Firebase
 * @param {string} ip عنوان IP الأصلي
 * @returns {string} عنوان IP المنظف للاستخدام كمفتاح في Firebase
 */
function sanitizeIPForFirebase(ip) {
  return ip.replace(/\./g, '_');
}

/**
 * استخراج عنوان IP من طلب Netlify Function
 * @param {object} event كائن حدث Netlify Function
 * @returns {string} عنوان IP
 */
function getIPFromRequest(event) {
  // أولًا، نحاول الحصول على IP من رؤوس Netlify
  const netlifySources = [
    event.headers['x-nf-client-connection-ip'],
    event.headers['client-ip'],
  ];
  
  // ثم نحاول الحصول على IP من الرؤوس القياسية
  const standardSources = [
    event.headers['x-forwarded-for'],
    event.headers['x-real-ip'],
    event.headers['true-client-ip']
  ];
  
  // البحث عن أول قيمة صالحة في مصادر Netlify
  for (const source of netlifySources) {
    if (source) {
      // إذا كان هناك قائمة IPs، نأخذ الأول (الأصلي)
      return source.split(',')[0].trim();
    }
  }
  
  // البحث عن أول قيمة صالحة في المصادر القياسية
  for (const source of standardSources) {
    if (source) {
      // إذا كان هناك قائمة IPs، نأخذ الأول (الأصلي)
      return source.split(',')[0].trim();
    }
  }
  
  // اللجوء إلى القيمة الافتراضية إذا لم نجد أي شيء
  return event.requestContext?.identity?.sourceIp || '0.0.0.0';
}

/**
 * إنشاء معرف فريد
 * @returns {string} معرف فريد
 */
function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

module.exports = {
  createSuccessResponse,
  createErrorResponse,
  handleError,
  sanitizeIPForFirebase,
  getIPFromRequest,
  generateUniqueId
};