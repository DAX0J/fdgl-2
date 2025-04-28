// ملف مساعد للتعامل مع CORS في وظائف Netlify

// قائمة الأصول المسموح بها (يمكن تغييرها حسب الحاجة)
const allowedOrigins = [
  'http://localhost:5000',
  'http://localhost:3000',
  'https://e2-com-10-2024-to-11-2024.netlify.app'
];

// التحقق ما إذا كان المصدر مسموح به
const isOriginAllowed = (origin) => {
  // إذا كانت هناك قائمة مصادر محددة في متغيرات البيئة، استخدمها
  if (process.env.ALLOWED_ORIGINS) {
    const originsFromEnv = process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
    return allowedOrigins.concat(originsFromEnv).includes(origin);
  }
  return allowedOrigins.includes(origin);
};

// إضافة رؤوس CORS للاستجابة
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

// معالجة طلبات CORS للوظائف السحابية
const handleCors = (event, handler) => {
  const origin = event.headers.origin || event.headers.Origin;
  
  // التعامل مع طلبات OPTIONS
  if (event.httpMethod === 'OPTIONS') {
    if (origin && isOriginAllowed(origin)) {
      return {
        statusCode: 204, // No content for preflight requests
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

  // استمر بمعالجة الطلب من خلال المعالج المقدم
  const result = handler(event);
  
  // إذا كان النتيجة عبارة عن Promise، قم بإضافة رؤوس CORS إلى الاستجابة النهائية
  if (result instanceof Promise) {
    return result.then(response => addCorsHeaders(event, response));
  }
  
  // وإلا، قم بإضافة رؤوس CORS إلى الاستجابة المباشرة
  return addCorsHeaders(event, result);
};

module.exports = {
  isOriginAllowed,
  addCorsHeaders,
  handleCors
};