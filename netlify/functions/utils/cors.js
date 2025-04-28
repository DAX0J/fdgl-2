/**
 * التحقق مما إذا كان المصدر مسموح به
 */
function isAllowedOrigin(origin) {
  if (!origin) return false;
  
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : [
        'http://localhost:5000',
        'http://localhost:3000',
        'https://e2-com-10-2024-to-11-2024.web.app'
      ];
  
  return allowedOrigins.includes(origin);
}

/**
 * إنشاء هيدرز CORS للاستجابة
 */
function createCorsHeaders(event) {
  const origin = event.headers.origin || '';
  
  // في بيئة التطوير، السماح لجميع المصادر
  if (process.env.NODE_ENV !== 'production') {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true'
    };
  }
  
  // في بيئة الإنتاج، التحقق من المصدر
  if (isAllowedOrigin(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true'
    };
  }
  
  // إذا لم يكن المصدر مسموح به، إرجاع هيدرز محدودة
  return {
    'Access-Control-Allow-Origin': 'https://e2-com-10-2024-to-11-2024.web.app'
  };
}

/**
 * تطبيق CORS على الاستجابة
 */
function applyCorsHeaders(response, event) {
  const corsHeaders = createCorsHeaders(event);
  
  return {
    ...response,
    headers: {
      ...response.headers,
      ...corsHeaders
    }
  };
}

/**
 * التعامل مع طلبات OPTIONS
 */
function handleOptionsRequest(event) {
  return {
    statusCode: 204,
    headers: createCorsHeaders(event),
    body: ''
  };
}

module.exports = {
  isAllowedOrigin,
  createCorsHeaders,
  applyCorsHeaders,
  handleOptionsRequest
};