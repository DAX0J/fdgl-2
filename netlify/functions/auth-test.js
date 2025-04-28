// وظيفة اختبار المصادقة
const { handleCors } = require('./utils/cors');
const { requireAuth, requireAdmin, generateToken } = require('./utils/auth');
const { createSuccessResponse, createErrorResponse } = require('./utils/util');

/**
 * وظيفة اختبار المصادقة
 * هذه الوظيفة تستخدم فقط لاختبار ما إذا كان المستخدم مصادقًا عليه
 * يمكن استخدامها أيضًا لاختبار ما إذا كان المستخدم لديه صلاحيات إدارية
 */
exports.handler = async (event, context) => {
  // معالجة CORS
  if (event.httpMethod === 'OPTIONS') {
    return handleCors(event, () => ({
      statusCode: 204,
      body: ''
    }));
  }

  try {
    // التحقق من المصادقة - اعتمادًا على المعلمة المقدمة
    const params = new URLSearchParams(event.queryStringParameters || {});
    const checkAdmin = params.get('checkAdmin') === 'true';
    
    // التحقق من المستخدم
    const authResult = checkAdmin ? 
      await requireAdmin(event) : 
      await requireAuth(event);
    
    if (!authResult.isAuthorized) {
      return handleCors(event, () => authResult.error);
    }
    
    // إنشاء رمز جديد للمستخدم (للتجديد)
    const newToken = generateToken(authResult.user.uid, {
      email: authResult.user.email,
      isAdmin: authResult.user.isAdmin || false
    });
    
    // إرجاع النتائج
    const response = createSuccessResponse({
      message: checkAdmin ? 
        "أنت مصادق عليك كمسؤول" : 
        "أنت مصادق عليك",
      user: {
        uid: authResult.user.uid,
        email: authResult.user.email,
        isAdmin: authResult.user.isAdmin || false
      },
      token: newToken,
      timestamp: new Date().toISOString()
    });
    
    // إضافة رؤوس CORS
    return handleCors(event, () => response);
  } catch (error) {
    console.error('Error in auth test:', error);
    
    const response = createErrorResponse(500, 'حدث خطأ أثناء اختبار المصادقة', {
      error: error.message
    });
    
    // إضافة رؤوس CORS
    return handleCors(event, () => response);
  }
};