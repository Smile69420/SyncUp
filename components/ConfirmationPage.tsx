
import React from 'react';
// FIX: Changed to namespace import to fix module resolution issues.
import * as ReactRouterDOM from 'react-router-dom';
import type { Booking, EventType } from '../types';
import Card from './ui/Card';
import { format } from 'date-fns';

const ConfirmationPage: React.FC = () => {
    const location = ReactRouterDOM.useLocation();
    const { booking, eventType } = (location.state as { booking: Booking, eventType: EventType }) || {};

    if (!booking || !eventType) {
        return (
            <div className="max-w-md mx-auto text-center">
                <Card className="p-8">
                    <h1 className="text-2xl font-bold">Something went wrong</h1>
                    <p className="mt-4 text-slate-600">We couldn't find your booking details. Please check your email for a confirmation.</p>
                    <ReactRouterDOM.Link to="/" className="mt-6 inline-block bg-primary text-white font-bold py-2 px-4 rounded hover:bg-primary/90">
                        Go to Dashboard
                    </ReactRouterDOM.Link>
                </Card>
            </div>
        );
    }
    
    const startTime = new Date(booking.startTime);

    const customFieldsMap = eventType.customFormFields.reduce((acc, field) => {
        acc[field.id] = field.label;
        return acc;
    }, {} as Record<string, string>);

    const meetingDetails = () => {
        if (eventType.mode === 'online') {
            const link = booking.meetingLink || eventType.conferencing?.customLink;
            if (!link) return null;
            return (
                <div className="flex justify-between items-center">
                    <span className="font-medium text-slate-500">Meeting Link</span>
                    <a href={link} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline truncate">
                        {link}
                    </a>
                </div>
            )
        }
        if (eventType.mode === 'offline') {
            if (!eventType.location) return null;
            return (
                <div className="flex justify-between items-center">
                    <span className="font-medium text-slate-500">Location</span>
                    <span className="font-semibold text-slate-900">{eventType.location}</span>
                </div>
            )
        }
        return null;
    }

    return (
        <div className="max-w-2xl mx-auto">
            <Card className="p-8">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <h1 className="text-2xl font-bold mt-4 text-center">Booking Confirmed!</h1>
                <p className="text-slate-600 mt-2 text-center">
                    Your meeting for <strong>{eventType.name}</strong> has been scheduled. A calendar invitation has been sent to <strong>{booking.bookerEmail}</strong>.
                </p>
                <div className="mt-8 text-left bg-slate-50 p-6 rounded-lg border border-slate-200 space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="font-medium text-slate-500">What</span>
                        <span className="font-semibold text-slate-900">{eventType.name}</span>
                    </div>
                     <div className="border-t border-slate-200"></div>
                    <div className="flex justify-between items-center">
                        <span className="font-medium text-slate-500">When</span>
                        <span className="font-semibold text-slate-900 text-right">{format(startTime, 'EEEE, LLLL d, yyyy')} at {format(startTime, 'p')}</span>
                    </div>
                     <div className="border-t border-slate-200"></div>
                     {meetingDetails()}
                     <div className="border-t border-slate-200"></div>
                     <div className="flex justify-between items-center">
                        <span className="font-medium text-slate-500">Who</span>
                        <span className="font-semibold text-slate-900 text-right">{booking.bookerName} ({booking.bookerEmail})</span>
                    </div>
                    {booking.customAnswers && Object.entries(booking.customAnswers).filter(([_, answer]) => answer && answer !== 'false').length > 0 && (
                        <>
                             <div className="border-t border-slate-200"></div>
                             {Object.entries(booking.customAnswers).filter(([_, answer]) => answer && answer !== 'false').map(([fieldId, answer]) => (
                                <div key={fieldId} className="flex justify-between items-start">
                                    <span className="font-medium text-slate-500">{customFieldsMap[fieldId] || 'Custom Info'}</span>
                                    <span className="font-semibold text-slate-900 text-right">{answer === 'true' ? 'Yes' : answer}</span>
                                </div>
                            ))}
                        </>
                    )}
                </div>
                 <ReactRouterDOM.Link to="/" className="mt-8 block text-center text-sm text-primary hover:underline font-medium">
                    Schedule another event
                </ReactRouterDOM.Link>
            </Card>
        </div>
    );
};

export default ConfirmationPage;