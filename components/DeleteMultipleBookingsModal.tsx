import React from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Spinner from './ui/Spinner';

interface DeleteMultipleBookingsModalProps {
    count: number;
    onClose: () => void;
    onConfirm: () => void;
    isDeleting: boolean;
}

const DeleteMultipleBookingsModal: React.FC<DeleteMultipleBookingsModalProps> = ({ count, onClose, onConfirm, isDeleting }) => {
    return (
        <Modal title="Confirm Bulk Deletion" onClose={onClose}>
            <div className="space-y-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h3 className="text-lg font-bold text-red-800">
                        Are you sure?
                    </h3>
                    <p className="mt-2 text-sm text-red-700">
                        You are about to permanently delete <strong>{count}</strong> selected booking(s).
                    </p>
                    <p className="mt-1 text-sm text-red-700">
                        This will remove the records from SyncUp, Google Calendar, and Google Sheets. This action cannot be undone.
                    </p>
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                    <Button variant="outline" onClick={onClose} disabled={isDeleting}>Cancel</Button>
                    <Button
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className="!bg-red-600 hover:!bg-red-700 focus:ring-red-500"
                    >
                        {isDeleting ? <Spinner size="sm"/> : `Delete ${count} Booking(s)`}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default DeleteMultipleBookingsModal;
