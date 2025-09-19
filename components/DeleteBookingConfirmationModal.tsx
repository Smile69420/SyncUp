import React from 'react';
import type { MergedBooking } from '../types';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Spinner from './ui/Spinner';
import { format } from 'date-fns';

interface DeleteBookingConfirmationModalProps {
    booking: MergedBooking | null;
    onClose: () => void;
    onConfirm: (bookingId: string, eventTypeId: string) => void;
    isDeleting: boolean;
}

const DeleteBookingConfirmationModal: React.FC<DeleteBookingConfirmationModalProps> = ({ booking, onClose, onConfirm, isDeleting }) => {
    if (!booking) return null;

    return (
        <Modal title="Confirm Deletion" onClose={onClose}>
            <div className="space-y-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h3 className="text-lg font-bold text-red-800">
                        Are you sure?
                    </h3>
                    <p className="mt-2 text-sm text-red-700">
                        You are about to permanently delete the booking for <strong>{booking.bookerName}</strong> on <strong>{format(booking.startTime, 'PP')}</strong>.
                    </p>
                    <p className="mt-1 text-sm text-red-700">
                        This will remove the record from SyncUp, Google Calendar, and Google Sheets. This action cannot be undone.
                    </p>
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                    <Button variant="outline" onClick={onClose} disabled={isDeleting}>Cancel</Button>
                    <Button
                        onClick={() => onConfirm(booking.id, booking.eventTypeId)}
                        disabled={isDeleting}
                        className="!bg-red-600 hover:!bg-red-700 focus:ring-red-500"
                    >
                        {isDeleting ? <Spinner size="sm"/> : 'Delete Booking'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default DeleteBookingConfirmationModal;