import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useSecurity } from '@/contexts/SecurityContext';
import NewAdminLogin from '@/components/NewAdminLogin';

// استيراد مكونات الإدارة (يمكن استخدام المكونات الحالية مع تعديلات بسيطة)
import AdminDashboard from '@/components/AdminDashboard';
import ProductsManagement from '@/components/ProductsManagement';
import OrdersManagement from '@/components/OrdersManagement';
import SiteSettings from '@/components/SiteSettings';

const NewAdminPage: React.FC = () => {
  const location = useLocation();
  const { isAuthenticated, isAdmin, isLoading } = useSecurity();
  
  // التحقق من حالة تسجيل الدخول
  useEffect(() => {
    // معالجة إعادة التوجيه من صفحة تسجيل الدخول إذا لزم الأمر
    // يمكن إضافة أي معالجة إضافية هنا
  }, [location.pathname]);
  
  // عرض شاشة تحميل أثناء التحقق من حالة المصادقة
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-4">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }
  
  // إذا لم يتم تسجيل الدخول، عرض شاشة تسجيل الدخول
  if (!isAuthenticated || !isAdmin) {
    return <NewAdminLogin />;
  }
  
  // منطق التوجيه للمستخدم المسجل دخوله
  return (
    <Routes>
      <Route path="dashboard/*" element={<AdminDashboard />} />
      <Route path="products/*" element={<ProductsManagement />} />
      <Route path="orders/*" element={<OrdersManagement />} />
      <Route path="settings/*" element={<SiteSettings />} />
      <Route path="*" element={<Navigate to="/gatekeeper-x9f2/dashboard" replace />} />
    </Routes>
  );
};

export default NewAdminPage;