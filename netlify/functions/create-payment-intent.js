// وظيفة إنشاء قصد دفع باستخدام Stripe
const { handleCors } = require('./utils/cors');
const { getIPFromRequest, createSuccessResponse, createErrorResponse } = require('./utils/util');
const Stripe = require('stripe');

// إنشاء مثيل من Stripe باستخدام المفتاح السري
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'YOUR_TEST_STRIPE_SECRET_KEY');

/**
 * وظيفة إنشاء قصد دفع باستخدام Stripe
 * تستخدم لإنشاء عملية دفع جديدة عندما يقرر المستخدم الشراء
 */
exports.handler = async (event, context) => {
  // معالجة CORS
  if (event.httpMethod === 'OPTIONS') {
    return handleCors(event, () => ({
      statusCode: 204,
      body: ''
    }));
  }
  
  // التأكد من أن الطلب هو POST
  if (event.httpMethod !== 'POST') {
    const response = createErrorResponse(405, 'طريقة الطلب غير مسموح بها. استخدم POST.');
    return handleCors(event, () => response);
  }

  try {
    // استخراج معلومات العميل
    const ip = getIPFromRequest(event);
    
    // محاولة استخراج معلومات الطلب
    let payload;
    try {
      payload = JSON.parse(event.body);
    } catch (error) {
      return handleCors(event, () => createErrorResponse(400, 'نص JSON غير صالح', { error: error.message }));
    }
    
    // التحقق من وجود البيانات المطلوبة
    if (!payload.amount) {
      return handleCors(event, () => createErrorResponse(400, 'البيانات مفقودة: amount مطلوب'));
    }
    
    // التحقق من صحة المبلغ
    const amount = parseInt(payload.amount * 100, 10); // تحويل إلى سنتات
    if (isNaN(amount) || amount <= 0) {
      return handleCors(event, () => createErrorResponse(400, 'المبلغ غير صالح. يجب أن يكون رقمًا موجبًا.'));
    }
    
    // إنشاء قصد دفع باستخدام Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      metadata: {
        ip,
        orderId: payload.orderId || '',
        customerEmail: payload.email || '',
        products: JSON.stringify(payload.items || []),
      },
    });
    
    // إرجاع النتائج
    const response = createSuccessResponse({
      success: true,
      clientSecret: paymentIntent.client_secret,
      amount: amount / 100, // إعادة التحويل إلى الدولارات
      id: paymentIntent.id,
    });
    
    return handleCors(event, () => response);
  } catch (error) {
    console.error('خطأ في إنشاء قصد دفع:', error);
    
    const response = createErrorResponse(
      error.statusCode || 500, 
      error.message || 'حدث خطأ أثناء إنشاء قصد دفع',
      { 
        error: error.type || error.name || 'ServerError',
        code: error.code
      }
    );
    
    return handleCors(event, () => response);
  }
};