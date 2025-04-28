// ملف مساعد للتعامل مع CORS في وظائف Netlify

/**
 * التحقق ما إذا كان المصدر مسموح به
 * @param {string} origin المصدر الذي يجب التحقق منه
 * @returns {boolean} ما إذا كان المصدر مسموح به
 */
const isOriginAllowed = (origin) => {
  // قائمة المصادر المسموح بها
  const allowedOrigins = [
    'http://localhost:5000',
    'https://e2-com-10-2024-to-11-2024.netlify.app'
  ];

  // إذا كانت هناك قائمة مصادر محددة في متغيرات البيئة، استخدمها
  if (process.env.ALLOWED_ORIGINS) {
    const originsFromEnv = process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
    allowedOrigins.push(...originsFromEnv);
  }

  // التحقق ما إذا كان المصدر المحدد مسموح به
  return allowedOrigins.includes(origin);
};

/**
 * إضافة رؤوس CORS للاستجابة
 * @param {Object} event كائن الحدث من Netlify Function
 * @param {Object} response كائن الاستجابة الذي سيتم إضافة رؤوس CORS إليه
 * @returns {Object} الاستجابة مع رؤوس CORS
 */
const addCorsHeaders = (event, response) => {
  const origin = event.headers.origin || event.headers.Origin;
  const headers = response.headers || {};

  // إذا كان المصدر مسموح به، أضف رؤوس CORS
  if (origin && isOriginAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Authorization';
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Access-Control-Max-Age'] = '86400';
  }

  // إعادة الاستجابة مع رؤوس CORS
  return { ...response, headers };
};

/**
 * معالجة طلبات CORS للوظائف السحابية
 * @param {Object} event كائن الحدث من Netlify Function
 * @param {Object} handler دالة معالج الوظيفة السحابية
 * @returns {Object|Function} استجابة لطلب CORS أو استدعاء المعالج
 */
const handleCors = (event, handler) => {
  const origin = event.headers.origin || event.headers.Origin;
  
  // التعامل مع طلبات OPTIONS
  if (event.httpMethod === 'OPTIONS') {
    if (origin && isOriginAllowed(origin)) {
      return {
        statusCode: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400'
        },
        body: ''
      };
    } else {
      return {
        statusCode: 403,
        body: JSON.stringify({ success: false, message: 'CORS not allowed' })
      };
    }
  }

  // التحقق من المصدر قبل معالجة الطلب
  if (origin && !isOriginAllowed(origin)) {
    return {
      statusCode: 403,
      body: JSON.stringify({ success: false, message: 'CORS not allowed' })
    };
  }

  // استمر بمعالجة الطلب واستخدم المعالج الأساسي
  return handler(event);
};

module.exports = {
  isOriginAllowed,
  addCorsHeaders,
  handleCors
};