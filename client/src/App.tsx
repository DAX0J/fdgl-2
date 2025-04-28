import { Routes, Route } from "react-router-dom";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import CountdownTimer from "./components/CountdownTimer";

// استيراد المكونات الجديدة
import NewUnlockSiteModal from "./components/NewUnlockSiteModal";
import { SecurityProvider } from "./contexts/SecurityContext";
import { SiteSettingsProvider } from "./contexts/SiteSettingsContext";
import { CartProvider } from "./contexts/CartContext";

import Home from "./pages/Home";
import Shop from "./pages/Shop";
import ProductDetail from "./pages/ProductDetail";
import ProductBuy from "./pages/ProductBuy";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import SearchResults from "./pages/SearchResults";
import NotFound from "@/pages/not-found";
import { lazy, Suspense, useEffect, useState } from "react";

// Lazy load the admin pages to improve initial load time
const AdminPage = lazy(() => import('@/pages/AdminPage'));
const NewAdminPage = lazy(() => import('@/pages/NewAdminPage'));

function Router() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/shop" element={<Shop />} />
      <Route path="/products/:id" element={<ProductDetail />} />
      <Route path="/products/:id/buy" element={<ProductBuy />} />
      <Route path="/cart" element={<Cart />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/search" element={<SearchResults />} />
      <Route 
        path="/gatekeeper-x9f2/*" 
        element={
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
            <NewAdminPage />
          </Suspense>
        } 
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

// Auth interceptor component to attach auth token to requests and handle unauthorized responses
function AuthInterceptor({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Create an interceptor for fetch to add auth token to all requests
    const originalFetch = window.fetch;
    
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      // Create new headers object with auth token if available
      const token = sessionStorage.getItem('authToken');
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      
      // Skip intercepting for vite or asset requests
      if (url.includes('/_vite') || url.includes('/assets/') || url.includes('favicon.ico')) {
        return originalFetch(input, init);
      }
      
      // Add auth token to all other requests if available
      const modifiedInit = init || {};
      
      if (token) {
        modifiedInit.headers = {
          ...modifiedInit.headers,
          'X-Auth-Token': token
        };
      }
      
      try {
        // Make the fetch call with modified headers
        const response = await originalFetch(input, modifiedInit);
        
        // Handle unauthorized responses for API endpoints only
        if (response.status === 401 && url.includes('/api/') && !url.includes('/api/auth/')) {
          // For API requests that return 401, we need to refresh auth
          console.log('API returned unauthorized - clearing session');
          sessionStorage.removeItem('siteUnlocked');
          sessionStorage.removeItem('authToken');
        }
        
        return response;
      } catch (error) {
        console.error('Fetch error:', error);
        return new Response(JSON.stringify({ error: 'Network error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    };
    
    // Cleanup on unmount
    return () => {
      window.fetch = originalFetch;
    };
  }, []);
  
  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* استخدام موفر الأمان الجديد */}
      <SecurityProvider>
        <SiteSettingsProvider>
          <CartProvider>
            <AuthInterceptor>
              <div className="flex flex-col min-h-screen bg-black text-white">
                {/* استخدام مكون إلغاء قفل الموقع الجديد */}
                <NewUnlockSiteModal />
                
                <Navbar />
                <main id="main-content" className="flex-grow">
                  <Router />
                </main>
                <Footer />
              </div>
              <Toaster />
            </AuthInterceptor>
          </CartProvider>
        </SiteSettingsProvider>
      </SecurityProvider>
    </QueryClientProvider>
  );
}

export default App;
