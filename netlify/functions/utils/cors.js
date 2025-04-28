/**
 * وحدة مساعدة للتعامل مع CORS في وظائف Netlify Functions
 */

// الحصول على قائمة المجالات المسموح بها من متغيرات البيئة
const getAllowedOrigins = () => {
  // إذا كان متغير البيئة موجود، استخدمه
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(',');
  }
  
  // القائمة الافتراضية للمجالات المسموح بها في بيئة التطوير
  return [
    'http://localhost:3000',
    'http://localhost:5000',
    'https://e2-com-10-2024-to-11-2024.netlify.app' // استبدل هذا بمجال موقعك الرسمي
  ];
};

// التحقق مما إذا كان المجال مسموح به
const isOriginAllowed = (origin) => {
  if (!origin) return false;
  
  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.includes(origin) || allowedOrigins.includes('*');
};

// إعداد رؤوس CORS للاستجابة
const setCorsHeaders = (response, origin) => {
  // إذا كان المجال مسموح به، أرجع رؤوس CORS المناسبة
  if (isOriginAllowed(origin)) {
    response.headers = {
      ...response.headers,
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400', // 24 ساعة
    };
  } else {
    // إذا لم يكن المجال مسموح به، استخدم القيمة الافتراضية
    // في بيئة الإنتاج، قد ترغب في رفض الطلب بدلاً من ذلك
    response.headers = {
      ...response.headers,
      'Access-Control-Allow-Origin': 'http://localhost:5000'
    };
  }
  
  return response;
};

// معالج الطلبات المسبقة (OPTIONS)
const handlePreflight = (event) => {
  const origin = event.headers.origin || event.headers.Origin;
  
  if (event.httpMethod === 'OPTIONS') {
    const response = {
      statusCode: 204,
      headers: {},
      body: ''
    };
    
    return setCorsHeaders(response, origin);
  }
  
  return null;
};

// ربط CORS مع معالج الوظيفة
const applyCors = (handler) => {
  return async (event, context) => {
    // معالجة طلبات OPTIONS المسبقة
    const preflightResponse = handlePreflight(event);
    if (preflightResponse) {
      return preflightResponse;
    }
    
    // استدعاء المعالج الأصلي
    const response = await handler(event, context);
    
    // إضافة رؤوس CORS إلى الاستجابة
    const origin = event.headers.origin || event.headers.Origin;
    return setCorsHeaders(response, origin);
  };
};

module.exports = {
  applyCors,
  isOriginAllowed,
  setCorsHeaders,
  handlePreflight
};