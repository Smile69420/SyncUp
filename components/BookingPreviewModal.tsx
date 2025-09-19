import React, { useState, useMemo } from 'react';
import type { Booking, EventType } from '../types';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { format } from 'date-fns';

interface BookingPreviewModalProps {
    booking: Booking | null;
    eventType: EventType | undefined;
    onClose: () => void;
    onInitiateReschedule: () => void;
}

const BookingPreviewModal: React.FC<BookingPreviewModalProps> = ({ booking, eventType, onClose, onInitiateReschedule }) => {
    const [isCopied, setIsCopied] = useState(false);

    const { reminderMessage, startTime, endTime } = useMemo(() => {
        if (!booking || !eventType) return { reminderMessage: '', startTime: null, endTime: null };
        
        const start = new Date(booking.startTime);
        const end = new Date(booking.endTime);

        const startTimeStr = format(start, 'p'); // e.g., 2:00 PM
        const endTimeStr = format(end, 'p');   // e.g., 2:45 PM
        const dateStr = format(start, 'do MMMM'); // e.g., 10th September
        const dayOfWeekStr = format(start, 'EEEE'); // e.g., Wednesday

        let modeDetails = '';
        if (eventType.mode === 'online') {
            const link = booking.meetingLink || eventType.conferencing?.customLink || '(Link will be sent via email)';
            modeDetails = `Mode : Online\nMeeting Link : ${link}`;
        } else {
             modeDetails = `Mode : Offline\nLocation : ${eventType.location || '5th Floor, MCCIA SB Road, Pune'}`;
        }


        const message = `Greetings from MCCIA!

This message is a reminder for your AI Experience Center !
Time slot: ${startTimeStr} - ${endTimeStr}
Day and Date: ${dateStr}, ${dayOfWeekStr}

Do reply back to confirm your presence, if you are unable to attend do let us know.
Looking forward to the discussion!
${modeDetails}
Thank you
Team MCCIA`;

        return { reminderMessage: message, startTime: start, endTime: end };

    }, [booking, eventType]);


    if (!booking || !eventType || !startTime || !endTime) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(reminderMessage).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    const customFieldsMap = eventType.customFormFields.reduce((acc, field) => {
        acc[field.id] = field.label;
        return acc;
    }, {} as Record<string, string>);
    
    const meetingLink = booking.meetingLink || eventType.conferencing?.customLink;

    return (
        <Modal title="Booking Details" onClose={onClose}>
            <div className="space-y-6">
                <div>
                    <div className="p-4 rounded-lg" style={{ backgroundColor: `${eventType.color}20` }}>
                        <h3 className="font-bold text-lg" style={{ color: eventType.color }}>{eventType.name}</h3>
                        <p className="font-semibold text-slate-800">{format(startTime, 'EEEE, LLLL d, yyyy')}</p>
                        <p className="text-slate-600">{format(startTime, 'p')} - {format(endTime, 'p')}</p>
                    </div>

                    <div className="mt-4 bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                        <div className="flex justify-between">
                            <span className="font-medium text-slate-500">Booker Name</span>
                            <span className="font-semibold text-slate-900">{booking.bookerName}</span>
                        </div>
                         <div className="flex justify-between">
                            <span className="font-medium text-slate-500">Booker Phone</span>
                            <span className="font-semibold text-slate-900">{booking.bookerPhone}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="font-medium text-slate-500">Booker Email</span>
                            <span className="font-semibold text-slate-900">{booking.bookerEmail}</span>
                        </div>
                    </div>

                    <div className="mt-4">
                        <h4 className="font-semibold text-slate-800 mb-2">Meeting Details</h4>
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                            <div className="flex justify-between">
                                <span className="font-medium text-slate-500">Mode</span>
                                <span className="font-semibold text-slate-900 capitalize">{eventType.mode}</span>
                            </div>
                            {eventType.mode === 'online' && (
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-slate-500">Meeting Link</span>
                                    {meetingLink ? (
                                        <a href={meetingLink} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline truncate max-w-[200px] sm:max-w-xs">
                                            Click to join
                                        </a>
                                    ) : (
                                        <span className="text-slate-500 text-sm">Link not yet available</span>
                                    )}
                                </div>
                            )}
                            {eventType.mode === 'offline' && eventType.location && (
                                <div className="flex justify-between">
                                    <span className="font-medium text-slate-500">Location</span>
                                    <span className="font-semibold text-slate-900">{eventType.location}</span>
                                </div>
                            )}
                             {eventType.mode === 'online' && meetingLink && (
                                <div className="pt-3 mt-3 border-t border-slate-200">
                                    <Button onClick={() => window.open(meetingLink, '_blank')} className="w-full">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 8v8"/><path d="m15 14 7-4-7-4"/></svg>
                                        Join Meeting
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>

                    {booking.customAnswers && Object.entries(booking.customAnswers).filter(([_, answer]) => answer && answer !== 'false').length > 0 && (
                        <div className="mt-4">
                            <h4 className="font-semibold text-slate-800 mb-2">Additional Information</h4>
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                                {Object.entries(booking.customAnswers)
                                    .filter(([_, answer]) => answer && answer !== 'false')
                                    .map(([fieldId, answer]) => (
                                        <div key={fieldId} className="flex flex-col text-sm">
                                            <span className="font-medium text-slate-500">{customFieldsMap[fieldId] || fieldId}</span>
                                            {/* FIX: Explicitly cast `answer` to a string to prevent rendering errors if the data is not a primitive. */}
                                            <span className="font-semibold text-slate-900 mt-1">{answer === 'true' ? 'Confirmed' : String(answer)}</span>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    )}
                </div>
                 <div>
                    <h4 className="font-semibold text-slate-800 mb-2">Reminder Message</h4>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                        <textarea
                            readOnly
                            value={reminderMessage}
                            className="w-full h-60 p-2 text-sm bg-white border border-slate-300 rounded-md font-mono custom-scrollbar"
                        />
                        <Button onClick={handleCopy} className="w-full">
                            {isCopied ? 'Copied!' : 'Copy Message'}
                        </Button>
                    </div>
                </div>
                <div className="flex justify-end space-x-3 pt-6 mt-4 border-t border-slate-200">
                    <Button variant="outline" onClick={onClose}>Close</Button>
                    <Button onClick={onInitiateReschedule}>Reschedule</Button>
                </div>
            </div>
        </Modal>
    );
};

export default BookingPreviewModal;