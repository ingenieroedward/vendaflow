import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import Layout from '../components/layout/Layout';
import Login from '../pages/Login';
import Superadmin from '../pages/Superadmin';
import Home from '../pages/Home';
import ProductDetail from '../pages/ProductDetail';
import ProductNew from '../pages/ProductNew';
import ProductEdit from '../pages/ProductEdit';
import OrderDetail from '../pages/OrderDetail';
import OrderNew from '../pages/OrderNew';
import Orders from '../pages/Orders';
import Users from '../pages/Users';
import UserNew from '../pages/UserNew';
import UserEdit from '../pages/UserEdit';
import OrderEdit from '../pages/OrderEdit';
import Suppliers from '../pages/Suppliers';
import Categories from '../pages/Categories';
import Prices from '../pages/Prices';
import Customers from '../pages/Customers';
import Reports from '../pages/Reports';
import Inventory from '../pages/Inventory';
import PurchaseOrders from '../pages/PurchaseOrders';
import PurchaseOrderNew from '../pages/PurchaseOrderNew';
import PurchaseOrderDetail from '../pages/PurchaseOrderDetail';

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

// Superadmin Route — standalone, no app chrome
const SuperadminRoute: React.FC<RouteProps> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'superadmin') return <Navigate to="/" replace />;
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

// Public Route Component (redirects to home if authenticated)
const PublicRoute: React.FC<RouteProps> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
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
        {/* Superadmin panel — rendered without app chrome (no Sidebar/Header/BottomNav) */}
        <Route
          path="/superadmin"
          element={<SuperadminRoute><Superadmin /></SuperadminRoute>}
        />

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

const InnerRoutes: React.FC = () => (
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

          {/* Protected Routes */}
          <Route 
            path="/" 
            element={
              <BuyerRoute>
                <Home />
              </BuyerRoute>
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

    {/* Redirect any unknown routes to home */}
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default AppRouter;