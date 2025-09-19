import React, { useState, useEffect } from 'react';
import type { BookingDetails, MergedBooking } from '../types';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Select from './ui/Select';
import Spinner from './ui/Spinner';

interface EditorProps {
    booking: MergedBooking;
    onClose: () => void;
    onSave: (details: BookingDetails) => void;
}

const BookingDetailsEditorModal: React.FC<EditorProps> = ({ booking, onClose, onSave }) => {
    const [details, setDetails] = useState<BookingDetails>(booking);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setDetails(booking);
    }, [booking]);

    const handleChange = (field: keyof BookingDetails, value: any) => {
        setDetails(prev => ({...prev, [field]: value}));
    };
    
    const handleSave = async () => {
        setIsSaving(true);
        await onSave(details);
        setIsSaving(false);
    };
    
    const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm text-slate-900";

    return (
        <Modal title="Edit Booking Details" onClose={onClose}>
            <div className="space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar pr-4">
                 <fieldset className="p-4 border rounded-lg bg-slate-50">
                    <legend className="px-2 font-semibold text-slate-700">Post-Meeting Details</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Meeting Status</label>
                            <Select value={details.meetingStatus || 'Scheduled'} onChange={e => handleChange('meetingStatus', e.target.value)}>
                                <option value="Scheduled">Scheduled</option>
                                <option value="Completed">Completed</option>
                                <option value="Cancelled">Cancelled</option>
                                <option value="No Show">No Show</option>
                            </Select>
                        </div>
                         <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700">Fireflies Recording Link</label>
                            <input type="url" value={details.firefliesLink || ''} onChange={e => handleChange('firefliesLink', e.target.value)} className={inputClasses} placeholder="https://app.fireflies.ai/..."/>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700">Notes for Report</label>
                            <textarea value={details.notesForReport || ''} onChange={e => handleChange('notesForReport', e.target.value)} rows={4} className={inputClasses} />
                        </div>
                    </div>
                </fieldset>
            </div>
            <div className="flex justify-end space-x-3 pt-4 mt-4 border-t border-slate-200">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Spinner size="sm" /> : 'Save Changes'}
                </Button>
            </div>
        </Modal>
    );
};

export default BookingDetailsEditorModal;