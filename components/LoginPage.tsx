

import React, { useState, FormEvent, useEffect } from 'react';
// FIX: Changed to namespace import to fix module resolution issues.
import * as ReactRouterDOM from 'react-router-dom';
import Button from './ui/Button';
import Spinner from './ui/Spinner';

// A simple, hardcoded password for internal team access.
const TEAM_PASSWORD = 'mccia';

const LoginPage: React.FC = () => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = ReactRouterDOM.useNavigate();
    const inputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Redirect if already authenticated
        if (sessionStorage.getItem('isAuthenticated') === 'true') {
            navigate('/');
        }
        // Focus the input field on component mount
        inputRef.current?.focus();
    }, [navigate]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (isLoading) return;

        setIsLoading(true);
        setError('');

        // Simulate a network request for better UX
        setTimeout(() => {
            if (password === TEAM_PASSWORD) {
                sessionStorage.setItem('isAuthenticated', 'true');
                navigate('/');
            } else {
                setError('Incorrect password. Please try again.');
                setPassword('');
            }
            setIsLoading(false);
        }, 500);
    };

    return (
        <div className="w-full min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                 <div className="bg-white rounded-2xl shadow-xl p-8 transform transition-all hover:scale-[1.02] duration-300 animate-scale-in">
                    <div className="flex flex-col items-center space-y-4">
                        <div className="flex items-center space-x-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                            <h1 className="text-3xl font-bold text-slate-800">SyncUp</h1>
                        </div>
                        <p className="text-slate-500">Team Access Portal</p>
                    </div>
                    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                        <div>
                            <label htmlFor="password" className="sr-only">Password</label>
                            <input
                                ref={inputRef}
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={`w-full px-4 py-3 border rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${error ? 'border-red-500 ring-red-200' : 'border-slate-300'}`}
                                placeholder="Enter team password"
                            />
                            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                        </div>

                        <Button type="submit" className="w-full !py-3 !text-base" disabled={isLoading}>
                            {isLoading ? <Spinner size="sm" /> : 'Enter'}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;