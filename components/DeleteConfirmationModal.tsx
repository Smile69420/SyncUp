import React, { useState } from 'react';
import type { EventType, Booking } from '../types';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Spinner from './ui/Spinner';
import { format } from 'date-fns';

interface DeleteConfirmationModalProps {
    eventType: EventType;
    associatedBookings: Booking[] | null;
    onClose: () => void;
    onConfirmDelete: () => void;
}

// FIX: Pass the entire eventType object to the function to access customFormFields.
const exportBookingsToCSV = (bookings: Booking[], eventType: EventType) => {
    if (!bookings.length) return;

    const headers = [
        'Booking ID', 'Booker Name', 'Booker Email', 'Booker Phone', 
        'Start Time', 'End Time', 'Meeting Link'
    ];
    
    // Add custom answer headers dynamically
    const customFieldLabels = eventType.customFormFields.map(f => f.label);
    const fullHeaders = [...headers, ...customFieldLabels].join(',');

    const rows = bookings.map(booking => {
        const standardData = [
            booking.id,
            booking.bookerName,
            booking.bookerEmail,
            booking.bookerPhone,
            format(new Date(booking.startTime), 'yyyy-MM-dd HH:mm:ss'),
            format(new Date(booking.endTime), 'yyyy-MM-dd HH:mm:ss'),
            booking.meetingLink || 'N/A'
        ];

        // FIX: Access customFormFields from the passed eventType object.
        const customData = eventType.customFormFields.map(field => {
            const answer = booking.customAnswers?.[field.id] || 'N/A';
            return answer === 'true' ? 'Yes' : (answer === 'false' ? 'No' : answer);
        });

        const allData = [...standardData, ...customData];

        return allData.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',');
    });

    const csvContent = [fullHeaders, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const fileName = `bookings_for_${eventType.name.replace(/\s+/g, '_')}.csv`;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};


const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({ eventType, associatedBookings, onClose, onConfirmDelete }) => {
    const [isChecked, setIsChecked] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const bookingCount = associatedBookings?.length ?? 0;

    const handleConfirm = async () => {
        setIsDeleting(true);
        await onConfirmDelete();
        setIsDeleting(false);
    };

    return (
        <Modal title="Confirm Deletion" onClose={onClose}>
            <div className="space-y-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h3 className="text-lg font-bold text-red-800">
                        Delete "{eventType.name}"?
                    </h3>
                    <p className="mt-2 text-sm text-red-700">
                        This action is permanent and cannot be undone. It will delete the event type and all associated booking data from the database.
                    </p>
                </div>

                <div className="text-center p-4 border rounded-md">
                    {associatedBookings === null ? (
                        <div className="flex items-center justify-center space-x-2 text-slate-600">
                            <Spinner size="sm" />
                            <span>Checking for associated bookings...</span>
                        </div>
                    ) : (
                        <div>
                            <p className="text-2xl font-bold text-primary">{bookingCount}</p>
                            <p className="text-slate-600">
                                {bookingCount === 1 ? 'associated booking will be deleted.' : 'associated bookings will be deleted.'}
                            </p>
                            {bookingCount > 0 && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-3"
                                    onClick={() => { if (associatedBookings) { exportBookingsToCSV(associatedBookings, eventType); } }}
                                >
                                    Download Bookings (CSV)
                                </Button>
                            )}
                        </div>
                    )}
                </div>
                
                <div className="flex items-start space-x-3 bg-slate-50 p-3 rounded-md">
                    <input
                        id="confirm-checkbox"
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => setIsChecked(e.target.checked)}
                        className="h-5 w-5 text-red-600 focus:ring-red-500 border-slate-300 rounded mt-0.5"
                    />
                    <label htmlFor="confirm-checkbox" className="text-sm text-slate-700">
                        I understand that this action is irreversible and will permanently delete the event type and all its associated bookings.
                    </label>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!isChecked || associatedBookings === null || isDeleting}
                        className="!bg-red-600 hover:!bg-red-700 focus:ring-red-500"
                    >
                        {isDeleting ? <Spinner size="sm"/> : `Delete Permanently (${bookingCount})`}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default DeleteConfirmationModal;