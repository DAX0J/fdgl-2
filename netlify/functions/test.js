// وظيفة اختبار بسيطة للتحقق من أن Netlify Functions تعمل بشكل صحيح

exports.handler = async (event, context) => {
  // الإستجابة البسيطة
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "مرحبًا! وظائف Netlify Functions تعمل بشكل صحيح",
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development'
    }),
    headers: {
      "Content-Type": "application/json"
    }
  };
};