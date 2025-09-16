

import React, { useState, useEffect, useRef } from 'react';
// FIX: Changed to namespace import to fix module resolution issues.
import * as ReactRouterDOM from 'react-router-dom';
import { googleApiService } from '../services/googleApiService';
import Button from './ui/Button';
import Spinner from './ui/Spinner';

const GoogleAuthButton: React.FC = () => {
    const [isSignedIn, setIsSignedIn] = useState(false);
    const [userProfile, setUserProfile] = useState<any | null>(null);
    const [initState, setInitState] = useState<'pending' | 'success' | 'failed'>('pending');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const navigate = ReactRouterDOM.useNavigate();

    useEffect(() => {
        const unsubscribe = googleApiService.subscribe((signedIn, profile, init) => {
            setIsSignedIn(signedIn);
            setUserProfile(profile);
            setInitState(init);
        });

        // Handle clicks outside of the dropdown to close it
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            unsubscribe();
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleSignIn = () => {
        googleApiService.signIn();
    };

    const handleSignOut = () => {
        googleApiService.signOut();
        sessionStorage.removeItem('isAuthenticated');
        navigate('/login');
    };
    
    const handleRetry = () => {
        // The service resets its own state, so we just need to call initialize again.
        // The subscribe callback will update our component's state automatically.
        googleApiService.initialize();
    };


    if (initState === 'pending') {
        return (
            <Button size="sm" disabled>
                <Spinner size="sm" />
                <span className="ml-2">Connecting...</span>
            </Button>
        );
    }

    if (initState === 'failed') {
        return (
            <Button size="sm" onClick={handleRetry} title="Connection to Google failed. Check browser console and API configuration, then try again.">
                Retry Connection
            </Button>
        );
    }

    if (!isSignedIn) {
        return (
            <Button onClick={handleSignIn} size="sm">
                Connect Google Account
            </Button>
        );
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center space-x-2 focus:outline-none">
                {userProfile?.picture ? (
                    <img src={userProfile.picture} alt="User" className="w-8 h-8 rounded-full" />
                ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold">
                        {userProfile?.name?.[0] || '?'}
                    </div>
                )}
            </button>

            {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 z-40">
                    <div className="px-4 py-2 border-b">
                        <p className="text-sm font-medium text-gray-900 truncate">{userProfile?.name}</p>
                        <p className="text-sm text-gray-500 truncate">{userProfile?.email}</p>
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                        Sign Out
                    </button>
                </div>
            )}
        </div>
    );
};

export default GoogleAuthButton;