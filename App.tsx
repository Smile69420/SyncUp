import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Outlet, useNavigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Analytics from './components/Analytics';
import BookingPage from './components/BookingPage';
import ConfirmationPage from './components/ConfirmationPage';
import { googleApiService } from './services/googleApiService';
import GoogleAuthButton from './components/GoogleAuthButton';
import LoginPage from './components/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import RecordsPage from './components/RecordsPage';


const Layout: React.FC = () => {
    return (
        <div className="min-h-screen bg-background text-foreground">
            <Header />
            <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                <Outlet />
            </main>
        </div>
    );
};


const App: React.FC = () => {

    useEffect(() => {
        googleApiService.initialize();
    }, []);

    return (
        <BrowserRouter>
            <Routes>
                {/* Public routes that do not require authentication */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/book/:eventTypeId" element={<BookingPage />} />
                <Route path="/confirmed" element={<ConfirmationPage />} />

                {/* Protected routes that require authentication */}
                <Route element={<ProtectedRoute />}>
                    <Route element={<Layout />}>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/analytics" element={<Analytics />} />
                        <Route path="/records" element={<RecordsPage />} />
                    </Route>
                </Route>
            </Routes>
        </BrowserRouter>
    );
};

const Header: React.FC = () => {
    return (
        <header className="bg-card border-b border-gray-200 sticky top-0 z-30 no-print">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <Link to="/" className="flex items-center space-x-2">
                         <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                        <span className="text-xl font-bold text-foreground">SyncUp</span>
                    </Link>
                    <nav className="flex items-center space-x-4">
                        <Link to="/" className="text-sm font-medium text-gray-500 hover:text-primary transition-colors">Dashboard</Link>
                        <Link to="/analytics" className="text-sm font-medium text-gray-500 hover:text-primary transition-colors">Analytics</Link>
                        <Link to="/records" className="text-sm font-medium text-gray-500 hover:text-primary transition-colors">Records</Link>
                        <div className="w-px h-6 bg-slate-200"></div>
                        <GoogleAuthButton />
                    </nav>
                </div>
            </div>
        </header>
    );
};

export default App;