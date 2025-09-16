

import React from 'react';
// FIX: Changed to namespace import to fix module resolution issues.
import * as ReactRouterDOM from 'react-router-dom';

const ProtectedRoute: React.FC = () => {
    const isAuthenticated = sessionStorage.getItem('isAuthenticated') === 'true';

    return isAuthenticated ? <ReactRouterDOM.Outlet /> : <ReactRouterDOM.Navigate to="/login" replace />;
};

export default ProtectedRoute;