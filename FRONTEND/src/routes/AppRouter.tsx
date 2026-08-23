import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import Layout from '../components/layout/Layout';
import Login from '../pages/Login';
import Registro from '../pages/Registro';
import Landing from '../pages/Landing';
import FeatureGate from '../components/ui/FeatureGate';
import { detectTenantSlug } from '../services/tenant';
const Home = React.lazy(() => import('../pages/Home'));
const ProductDetail = React.lazy(() => import('../pages/ProductDetail'));
const ProductNew = React.lazy(() => import('../pages/ProductNew'));
const ProductEdit = React.lazy(() => import('../pages/ProductEdit'));
const OrderDetail = React.lazy(() => import('../pages/OrderDetail'));
const OrderNew = React.lazy(() => import('../pages/OrderNew'));
const Orders = React.lazy(() => import('../pages/Orders'));
const Users = React.lazy(() => import('../pages/Users'));
const UserNew = React.lazy(() => import('../pages/UserNew'));
const UserEdit = React.lazy(() => import('../pages/UserEdit'));
const OrderEdit = React.lazy(() => import('../pages/OrderEdit'));
const Suppliers = React.lazy(() => import('../pages/Suppliers'));
const Categories = React.lazy(() => import('../pages/Categories'));
const Prices = React.lazy(() => import('../pages/Prices'));
const Customers = React.lazy(() => import('../pages/Customers'));
const Reports = React.lazy(() => import('../pages/Reports'));
const Inventory = React.lazy(() => import('../pages/Inventory'));
const Pos = React.lazy(() => import('../pages/Pos'));
const PurchaseOrders = React.lazy(() => import('../pages/PurchaseOrders'));
const PurchaseOrderNew = React.lazy(() => import('../pages/PurchaseOrderNew'));
const PurchaseOrderDetail = React.lazy(() => import('../pages/PurchaseOrderDetail'));
const TenantSettings = React.lazy(() => import('../pages/TenantSettings'));
const Profile = React.lazy(() => import('../pages/Profile'));

// Protected Route Component
interface RouteProps {
  children: React.ReactNode;
}
// Admin Route Component
const AdminRoute: React.FC<RouteProps> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};


// Buyer Route Component (admin or buyer) - Acceso a productos
const BuyerRoute: React.FC<RouteProps> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  // Admin tiene acceso a todo, buyer tiene acceso a productos
  if (user?.role !== 'admin' && user?.role !== 'buyer') {
    return <Navigate to="/orders" replace />;
  }
  
  return <>{children}</>;
};

// Seller Route Component (admin or seller) - Acceso a órdenes
const SellerRoute: React.FC<RouteProps> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  // Admin tiene acceso a todo, seller tiene acceso a órdenes
  if (user?.role !== 'admin' && user?.role !== 'seller') {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

// Auth Route Component — cualquier rol autenticado (admin/buyer/seller), sin
// restricción adicional. Para páginas como el perfil propio, donde todos los
// roles necesitan entrar.
const AuthRoute: React.FC<RouteProps> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Public Route Component (redirects to home if authenticated)
const PublicRoute: React.FC<RouteProps> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to={'/'} replace />;
  }

  return <>{children}</>;
};

// Fuerza remount completo de ProductDetail en cada navegación,
// evitando estado corrupto por requests async "huérfanos" del mount anterior.
const ProductDetailRoute: React.FC = () => {
  const location = useLocation();
  return <ProductDetail key={location.key} />;
};

const AppRouter: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* All other routes inside Layout */}
        <Route path="*" element={
          <Layout>
            <InnerRoutes />
          </Layout>
        } />
      </Routes>
    </Router>
  );
};

const PageFallback = (
  <div className="flex items-center justify-center py-24">
    <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
  </div>
);

const InnerRoutes: React.FC = () => (
  <React.Suspense fallback={PageFallback}>
  <Routes>
    {/* Public Routes */}
    <Route
      path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } 
          />

          <Route path="/registro" element={<Registro />} />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              detectTenantSlug() ? (
                <BuyerRoute>
                  <Home />
                </BuyerRoute>
              ) : (
                <Landing />
              )
            }
          />

          {/* Product Routes - Solo admin y buyer */}
          <Route 
            path="/products/new" 
            element={
              <BuyerRoute>
                <ProductNew />
              </BuyerRoute>
            } 
          />
          
          <Route
            path="/products/:id"
            element={
              <BuyerRoute>
                <ProductDetailRoute />
              </BuyerRoute>
            }
          />
          
          <Route 
            path="/products/:id/edit" 
            element={
              <BuyerRoute>
                <ProductEdit />
              </BuyerRoute>
            } 
          />

          {/* Order Routes - Solo admin y seller */}
          <Route 
            path="/orders" 
            element={
              <SellerRoute>
                <Orders />
              </SellerRoute>
            } 
          />
          <Route 
            path="/orders/new" 
            element={
              <SellerRoute>
                <OrderNew />
              </SellerRoute>
            } 
          />
          <Route 
            path="/orders/:id" 
            element={
              <SellerRoute>
                <OrderDetail />
              </SellerRoute>
            } 
          />
          <Route 
            path="/orders/:id/edit" 
            element={
              <SellerRoute>
                <OrderEdit />
              </SellerRoute>
            } 
          />

          {/* Buyer Routes - Precios, Proveedores, Categorías */}
          <Route
            path="/suppliers"
            element={
              <BuyerRoute>
                <Suppliers />
              </BuyerRoute>
            }
          />
          <Route
            path="/categories"
            element={
              <BuyerRoute>
                <Categories />
              </BuyerRoute>
            }
          />
          <Route
            path="/prices"
            element={
              <BuyerRoute>
                <Prices />
              </BuyerRoute>
            }
          />

          {/* Customer Routes - Admin y seller */}
          <Route
            path="/customers"
            element={
              <SellerRoute>
                <Customers />
              </SellerRoute>
            }
          />

          {/* Reports - seller y admin */}
          <Route
            path="/reports"
            element={
              <SellerRoute>
                <Reports />
              </SellerRoute>
            }
          />

          {/* Admin Routes - Solo admin */}
          <Route
            path="/users"
            element={
              <AdminRoute>
                <Users />
              </AdminRoute>
            }
          />
          
          <Route 
            path="/users/new" 
            element={
              <AdminRoute>
                <UserNew />
              </AdminRoute>
            } 
          />
          
          <Route 
            path="/users/:id/edit" 
            element={
              <AdminRoute>
                <UserEdit />
              </AdminRoute>
            } 
          />

          {/* POS - seller y admin, gateado por plan */}
          <Route
            path="/pos"
            element={
              <SellerRoute>
                <FeatureGate feature="pos">
                  <Pos />
                </FeatureGate>
              </SellerRoute>
            }
          />

          {/* Inventory & Purchase Orders - seller y admin */}
          <Route
            path="/inventory"
            element={
              <SellerRoute>
                <Inventory />
              </SellerRoute>
            }
          />
          <Route
            path="/purchase-orders"
            element={
              <SellerRoute>
                <PurchaseOrders />
              </SellerRoute>
            }
          />
          <Route
            path="/purchase-orders/new"
            element={
              <SellerRoute>
                <PurchaseOrderNew />
              </SellerRoute>
            }
          />
          <Route
            path="/purchase-orders/:id"
            element={
              <SellerRoute>
                <PurchaseOrderDetail />
              </SellerRoute>
            }
          />

    {/* Perfil propio — cualquier rol */}
    <Route
      path="/profile"
      element={
        <AuthRoute>
          <Profile />
        </AuthRoute>
      }
    />

    {/* Admin: tenant settings */}
    <Route
      path="/settings"
      element={
        <AdminRoute>
          <TenantSettings />
        </AdminRoute>
      }
    />

    {/* Redirect any unknown routes to home */}
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
  </React.Suspense>
);

export default AppRouter;