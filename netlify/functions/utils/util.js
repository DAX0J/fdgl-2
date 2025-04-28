// ملف مساعد للنقطة المشتركة بين جميع وظائف Netlify Functions

// استخراج معلومات العميل من الطلب
const getClientInfo = (event) => {
  return {
    ip: event.headers['client-ip'] || 
        event.headers['x-forwarded-for'] || 
        event.headers['x-real-ip'] || 
        'unknown-ip',
    userAgent: event.headers['user-agent'] || 'unknown',
    origin: event.headers['origin'] || 'unknown',
    referer: event.headers['referer'] || 'unknown',
  };
};

// إنشاء استجابة خطأ قياسية
const createErrorResponse = (statusCode, message, additionalData = {}) => {
  return {
    statusCode,
    body: JSON.stringify({
      success: false,
      message,
      ...additionalData
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  };
};

// إنشاء استجابة نجاح قياسية
const createSuccessResponse = (data = {}, statusCode = 200) => {
  return {
    statusCode,
    body: JSON.stringify({
      success: true,
      ...data
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  };
};

// تصدير الدوال المساعدة
module.exports = {
  getClientInfo,
  createErrorResponse,
  createSuccessResponse
};