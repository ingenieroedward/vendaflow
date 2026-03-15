import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import Layout from '../components/layout/Layout';
import Login from '../pages/Login';
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
      <Layout>
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

          {/* Redirect any unknown routes to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default AppRouter;