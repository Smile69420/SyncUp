import React, { useState, useEffect } from 'react';
import type { BookingDetails } from '../types';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Select from './ui/Select';
import Spinner from './ui/Spinner';

interface EditorProps {
    booking: BookingDetails;
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
    
    const handleCheckboxChange = (field: keyof BookingDetails, checked: boolean) => {
        setDetails(prev => ({...prev, [field]: checked}));
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
                {/* Section 1: Client and Company */}
                <fieldset className="p-4 border rounded-lg">
                    <legend className="px-2 font-semibold text-slate-700">Client & Company</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Company Name</label>
                            <input type="text" value={details.companyName || ''} onChange={e => handleChange('companyName', e.target.value)} className={inputClasses} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Designation</label>
                            <input type="text" value={details.designation || ''} onChange={e => handleChange('designation', e.target.value)} className={inputClasses} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Generalized Designation</label>
                            <input type="text" value={details.generalizedDesignation || ''} onChange={e => handleChange('generalizedDesignation', e.target.value)} className={inputClasses} />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-slate-700">State</label>
                            <input type="text" value={details.state || ''} onChange={e => handleChange('state', e.target.value)} className={inputClasses} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">District</label>
                            <input type="text" value={details.district || ''} onChange={e => handleChange('district', e.target.value)} className={inputClasses} />
                        </div>
                    </div>
                </fieldset>

                {/* Section 2: Meeting Details */}
                <fieldset className="p-4 border rounded-lg">
                    <legend className="px-2 font-semibold text-slate-700">Meeting Details</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Consultation Done By</label>
                            <input type="text" value={details.consultationDoneBy || ''} onChange={e => handleChange('consultationDoneBy', e.target.value)} className={inputClasses} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">No of Employees</label>
                            <input type="text" value={details.noOfEmployeesInCompany || ''} onChange={e => handleChange('noOfEmployeesInCompany', e.target.value)} className={inputClasses} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">No of Attendants</label>
                            <input type="text" value={details.noOfAttendants || ''} onChange={e => handleChange('noOfAttendants', e.target.value)} className={inputClasses} />
                        </div>
                         <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700">Operations Performed In Brief</label>
                            <textarea value={details.operationsPerfomedInBrief || ''} onChange={e => handleChange('operationsPerfomedInBrief', e.target.value)} rows={3} className={inputClasses} />
                        </div>
                    </div>
                </fieldset>
                
                 {/* Section 3: Sector & Challenges */}
                 <fieldset className="p-4 border rounded-lg">
                    <legend className="px-2 font-semibold text-slate-700">Sector & Challenges</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Sector</label>
                            <input type="text" value={details.sector || ''} onChange={e => handleChange('sector', e.target.value)} className={inputClasses} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Sector Generalized</label>
                            <input type="text" value={details.sectorGeneralized || ''} onChange={e => handleChange('sectorGeneralized', e.target.value)} className={inputClasses} />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700">Challenges</label>
                            <textarea value={details.challenges || ''} onChange={e => handleChange('challenges', e.target.value)} rows={3} className={inputClasses} />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700">Manual Tasks</label>
                            <textarea value={details.manualTasks || ''} onChange={e => handleChange('manualTasks', e.target.value)} rows={3} className={inputClasses} />
                        </div>
                    </div>
                 </fieldset>

                {/* Section 4: AI & Tools */}
                <fieldset className="p-4 border rounded-lg">
                    <legend className="px-2 font-semibold text-slate-700">AI & Tools</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-medium text-slate-700">AI Familiarity (Pre)</label>
                            <input type="text" value={details.aiFamiliarityPre || ''} onChange={e => handleChange('aiFamiliarityPre', e.target.value)} className={inputClasses} />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-slate-700">AI Familiarity (Post)</label>
                            <input type="text" value={details.aiFamiliarityPost || ''} onChange={e => handleChange('aiFamiliarityPost', e.target.value)} className={inputClasses} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Suggested Tools</label>
                            <input type="text" value={details.suggestedTools || ''} onChange={e => handleChange('suggestedTools', e.target.value)} className={inputClasses} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Tool Categories</label>
                            <input type="text" value={details.toolCategories || ''} onChange={e => handleChange('toolCategories', e.target.value)} className={inputClasses} />
                        </div>
                    </div>
                </fieldset>

                {/* Section 5: Follow-up & Status */}
                <fieldset className="p-4 border rounded-lg">
                    <legend className="px-2 font-semibold text-slate-700">Follow-up & Membership</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-medium text-slate-700">Feedback Sent</label>
                            <Select value={details.feedbackSent || 'Pending'} onChange={e => handleChange('feedbackSent', e.target.value)}>
                                <option value="Pending">Pending</option>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                            </Select>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-slate-700">Follow Up Status</label>
                            <Select value={details.followUpStatus || 'Pending'} onChange={e => handleChange('followUpStatus', e.target.value)}>
                                <option value="Pending">Pending</option>
                                <option value="Done">Done</option>
                            </Select>
                        </div>
                        <div className="flex items-center">
                            <input type="checkbox" id="interest" checked={!!details.shownInterestInMembership} onChange={e => handleCheckboxChange('shownInterestInMembership', e.target.checked)} className="h-4 w-4 text-primary rounded border-slate-300" />
                            <label htmlFor="interest" className="ml-2 text-sm font-medium text-slate-700">Shown Interest in Membership</label>
                        </div>
                         <div className="flex items-center">
                            <input type="checkbox" id="membership" checked={!!details.membership} onChange={e => handleCheckboxChange('membership', e.target.checked)} className="h-4 w-4 text-primary rounded border-slate-300" />
                            <label htmlFor="membership" className="ml-2 text-sm font-medium text-slate-700">Membership</label>
                        </div>
                    </div>
                </fieldset>

                {/* Section 6: Post-Meeting Details */}
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