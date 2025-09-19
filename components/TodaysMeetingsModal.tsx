import React from 'react';
import type { TodaysMeetingsModalProps, MergedBooking } from '../types';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { format } from 'date-fns';

const TodaysMeetingsModal: React.FC<TodaysMeetingsModalProps> = ({ isOpen, onClose, meetings, onViewDetails }) => {
    if (!isOpen) return null;

    return (
        <Modal title="Today's Meetings" onClose={onClose}>
            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                {meetings.length > 0 ? (
                    <ul className="divide-y divide-slate-200">
                        {meetings.map(booking => (
                            <li key={booking.id} className="py-3 flex items-center justify-between">
                                <div>
                                    <p className="font-semibold text-slate-800">{booking.eventTypeName}</p>
                                    <p className="text-sm text-slate-600">with {booking.bookerName}</p>
                                    <p className="text-sm text-primary font-medium">{format(booking.startTime, 'p')}</p>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => onViewDetails(booking)}>View Details</Button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="text-center py-8">
                        <p className="font-semibold text-slate-700">No meetings scheduled for today.</p>
                    </div>
                )}
            </div>
             <div className="flex justify-end pt-4 mt-4 border-t border-slate-200">
                <Button variant="outline" onClick={onClose}>Close</Button>
            </div>
        </Modal>
    );
};

export default TodaysMeetingsModal;