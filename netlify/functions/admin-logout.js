const { Handler } = require('@netlify/functions');
const { createSecureCookie } = require('./utils/auth');

const handler = async (event, context) => {
  // التأكد من أن الطلب هو POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'الطريقة غير مسموح بها' }),
      headers: { 'Content-Type': 'application/json' }
    };
  }

  try {
    // إنشاء كوكي تسجيل الخروج (تعيين القيمة لفارغة وتاريخ انتهاء في الماضي)
    const adminAuthCookie = createSecureCookie('adminAuthToken', '', {
      expires: new Date(0),
      maxAge: 0
    });
    
    const authCookie = createSecureCookie('authToken', '', {
      expires: new Date(0),
      maxAge: 0
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message: 'تم تسجيل الخروج بنجاح'
      }),
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': [adminAuthCookie, authCookie]
      }
    };
  } catch (error) {
    console.error('خطأ في تسجيل الخروج:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false, 
        message: 'خطأ في الخادم أثناء تسجيل الخروج'
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
};

exports.handler = Handler(handler, {
  cors: {
    origin: '*',  // يجب تغييره للإنتاج للسماح فقط بالمجالات المصرح بها
    headers: ['Content-Type', 'Authorization'],
    credentials: true
  }
});