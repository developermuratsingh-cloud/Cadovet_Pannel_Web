import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

const PermissionGuard = ({ permission, children, fallback = null }) => {
    const { hasPermission } = useContext(AuthContext);

    if (hasPermission(permission)) {
        return <>{children}</>;
    }

    return fallback;
};

export default PermissionGuard;
