import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';

// Public Cadovet Replica Pages
import HomePage from './pages/home/HomePage';
import AboutUsPage from './pages/public/AboutUsPage';
import BlogPage from './pages/public/BlogPage';
import DogsPackagesPage from './pages/public/DogsPackagesPage';
import CatPackagesPage from './pages/public/CatPackagesPage';
import VaccinationPage from './pages/public/VaccinationPage';
import ServicesCatalogPage from './pages/public/ServicesCatalogPage';
import SurgeryPage from './pages/public/SurgeryPage';
import GroomingPage from './pages/public/GroomingPage';
import LabTestsPage from './pages/public/LabTestsPage';
import ProductDetailPage from './pages/public/ProductDetailPage';
import CartPage from './pages/public/CartPage';
import ContactUsPage from './pages/public/ContactUsPage';

// Auth
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import Signup from './pages/auth/Signup';

// Dashboard Router
import DashboardRouter from './pages/DashboardRouter';

// Admin Pages
import AdminDashboard from './pages/dashboard/AdminDashboard';
import { AdminHome } from './pages/dashboard/RoleDashboards';
import CustomersPage from './pages/customers/CustomersPage';
import PetsPage from './pages/pets/PetsPage';
import AppointmentsPage from './pages/appointments/AppointmentsPage';
import MedicalRecordsPage from './pages/medical/MedicalRecordsPage';
import InvoicesPage from './pages/invoices/InvoicesPage';
import InventoryPage from './pages/inventory/InventoryPage';
import MyStockPage from './pages/inventory/MyStockPage';
import StockDisputesPage from './pages/inventory/StockDisputesPage';
import PharmacyPage from './pages/pharmacy/PharmacyPage';
import ServicesPage from './pages/services/ServicesPage';
import DoctorsPage from './pages/doctors/DoctorsPage';
import UsersPage from './pages/users/UsersPage';
import RolesPage from './pages/roles/RolesPage';
import AuditLogsPage from './pages/audit/AuditLogsPage';
import LocationsPage from './pages/locations/LocationsPage';

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <CartProvider>
            <Router>
              <ScrollToTop />
              <Routes>
                {/* Public Cadovet Replica Pages */}
                <Route path="/" element={<HomePage />} />
                <Route path="/about-us" element={<AboutUsPage />} />
                <Route path="/contact-us" element={<ContactUsPage />} />
                <Route path="/contact" element={<ContactUsPage />} />
                <Route path="/blog" element={<BlogPage />} />
                <Route path="/dogs-packages" element={<DogsPackagesPage />} />
                <Route path="/cat-packages" element={<CatPackagesPage />} />
                <Route path="/vaccination" element={<VaccinationPage />} />
                <Route path="/services" element={<ServicesCatalogPage />} />
                <Route path="/major-minor-surgery" element={<SurgeryPage />} />
                <Route path="/dog-grooming" element={<GroomingPage />} />
                <Route path="/lab-tests" element={<LabTestsPage />} />
                <Route path="/consultation" element={<ProductDetailPage />} />
                <Route path="/product/:slug" element={<ProductDetailPage />} />
                <Route path="/cart" element={<CartPage />} />

                {/* Auth */}
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />

                {/* Smart Portal Redirect based on User Role */}
                <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />

                {/* Hospital Admin & Staff Management Portal */}
                <Route path="/admin" element={<ProtectedRoute allowedRoles={['ADMIN', 'PHARMACY', 'INVENTORY', 'OPERATIONAL_HEAD', 'DOCTOR']}><AdminHome /></ProtectedRoute>} />
                <Route path="/admin/appointments" element={<ProtectedRoute allowedRoles={['ADMIN', 'OPERATIONAL_HEAD', 'DOCTOR']}><AppointmentsPage /></ProtectedRoute>} />
                <Route path="/admin/customers" element={<ProtectedRoute allowedRoles={['ADMIN', 'OPERATIONAL_HEAD']}><CustomersPage /></ProtectedRoute>} />
                <Route path="/admin/pets" element={<ProtectedRoute allowedRoles={['ADMIN', 'OPERATIONAL_HEAD']}><PetsPage /></ProtectedRoute>} />
                <Route path="/admin/medical-records" element={<ProtectedRoute allowedRoles={['ADMIN', 'OPERATIONAL_HEAD', 'DOCTOR', 'PHARMACY', 'INVENTORY']}><MedicalRecordsPage /></ProtectedRoute>} />
                {/* Prescriptions is now folded into Clinical Records — redirect any old bookmark/link there. */}
                <Route path="/admin/prescriptions" element={<Navigate to="/admin/medical-records" replace />} />
                <Route path="/admin/invoices" element={<ProtectedRoute allowedRoles={['ADMIN', 'OPERATIONAL_HEAD']}><InvoicesPage /></ProtectedRoute>} />
                <Route path="/admin/inventory" element={<ProtectedRoute allowedRoles={['ADMIN', 'OPERATIONAL_HEAD', 'PHARMACY', 'INVENTORY']}><InventoryPage /></ProtectedRoute>} />
                <Route path="/admin/pharmacy" element={<ProtectedRoute allowedRoles={['ADMIN', 'OPERATIONAL_HEAD', 'PHARMACY', 'INVENTORY']}><PharmacyPage /></ProtectedRoute>} />
                <Route path="/admin/my-stock" element={<ProtectedRoute allowedRoles={['DOCTOR']}><MyStockPage /></ProtectedRoute>} />
                <Route path="/admin/stock-disputes" element={<ProtectedRoute allowedRoles={['ADMIN', 'OPERATIONAL_HEAD', 'PHARMACY', 'INVENTORY']}><StockDisputesPage /></ProtectedRoute>} />
                <Route path="/admin/services" element={<ProtectedRoute allowedRoles={['ADMIN', 'OPERATIONAL_HEAD', 'DOCTOR']}><ServicesPage /></ProtectedRoute>} />
                <Route path="/admin/doctors" element={<ProtectedRoute allowedRoles={['ADMIN', 'OPERATIONAL_HEAD', 'PHARMACY', 'INVENTORY']}><DoctorsPage /></ProtectedRoute>} />
                <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['ADMIN']}><UsersPage /></ProtectedRoute>} />
                <Route path="/admin/roles" element={<ProtectedRoute allowedRoles={['ADMIN']}><RolesPage /></ProtectedRoute>} />
                <Route path="/admin/locations" element={<ProtectedRoute allowedRoles={['ADMIN']}><LocationsPage /></ProtectedRoute>} />
                <Route path="/admin/audit-logs" element={<ProtectedRoute allowedRoles={['ADMIN']}><AuditLogsPage /></ProtectedRoute>} />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Router>
          </CartProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
