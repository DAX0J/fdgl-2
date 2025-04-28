// وظيفة اختبار للتحقق من عمل Firebase Admin
const { getFirebaseAdminDatabase } = require('./firebase-admin');
const { createSuccessResponse, createErrorResponse } = require('./utils/util');

exports.handler = async (event, context) => {
  try {
    // التحقق من اتصال Firebase Admin
    const db = getFirebaseAdminDatabase();
    const testRef = db.ref('test_connection');
    
    // كتابة قيمة اختبار
    const timestamp = Date.now();
    await testRef.set({
      timestamp,
      success: true,
      message: 'Test connection successful'
    });
    
    // قراءة القيمة للتأكد من الاتصال الصحيح
    const snapshot = await testRef.once('value');
    const data = snapshot.val();
    
    return createSuccessResponse({
      message: "تم الاتصال بـ Firebase بنجاح",
      serverTimestamp: timestamp,
      retrievedTimestamp: data.timestamp,
      firebaseConfig: {
        databaseConnected: !!db,
        databaseInitialized: true
      }
    });
  } catch (error) {
    console.error('Error testing Firebase connection:', error);
    
    return createErrorResponse(500, 'حدث خطأ أثناء اختبار اتصال Firebase', {
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};