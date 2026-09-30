import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import CustomerDashboard from './dashboard/CustomerDashboard';

const DashboardRouter = () => {
  const { user } = useContext(AuthContext);
  if (!user) return null;

  // Every staff role (admin, operational head, doctor, pharmacy desk, inventory desk) lands on its own dashboard
  // inside the admin panel.
  if (['ADMIN', 'OPERATIONAL_HEAD', 'DOCTOR', 'PHARMACY', 'INVENTORY'].includes(user.role_name)) {
    return <Navigate to="/admin" replace />;
  }

  return <CustomerDashboard />;
};

export default DashboardRouter;
