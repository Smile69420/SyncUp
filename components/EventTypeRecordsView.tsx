import React, { useState, useEffect, useMemo } from 'react';
import { firestoreService } from '../services/firestoreService';
import type { Booking, EventType, BookingDetails, MergedBooking, ColumnConfiguration } from '../types';
import Spinner from './ui/Spinner';
import Card from './ui/Card';
import Button from './ui/Button';
import BookingDetailsEditorModal from './BookingDetailsEditorModal';
import DeleteBookingConfirmationModal from './DeleteBookingConfirmationModal';
import DeleteMultipleBookingsModal from './DeleteMultipleBookingsModal';
import RecordsFilterBar from './RecordsFilterBar';
import { format, isValid } from 'date-fns';

interface EventTypeRecordsViewProps {
    eventType: EventType;
    onBack: () => void;
}

const StatusBadge: React.FC<{ status?: MergedBooking['meetingStatus']}> = ({ status }) => {
    const statusStyles = {
        Scheduled: 'bg-blue-100 text-blue-800',
        Completed: 'bg-emerald-100 text-emerald-800',
        Cancelled: 'bg-red-100 text-red-800',
        'No Show': 'bg-amber-100 text-amber-800',
    };
    const style = statusStyles[status || 'Scheduled'] || 'bg-slate-100 text-slate-800';
    return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${style}`}>{status || 'Scheduled'}</span>
};

const EventTypeRecordsView: React.FC<EventTypeRecordsViewProps> = ({ eventType, onBack }) => {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [bookingDetails, setBookingDetails] = useState<BookingDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState<MergedBooking | null>(null);
    const [bookingToDelete, setBookingToDelete] = useState<MergedBooking | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isMultiDeleteModalOpen, setIsMultiDeleteModalOpen] = useState(false);
    const [filters, setFilters] = useState({
        searchQuery: '',
        statuses: [] as string[],
        dateRange: 'all',
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [books, details] = await Promise.all([
                firestoreService.getBookingsForEventType(eventType.id),
                firestoreService.getBookingDetails(),
            ]);
            setBookings(books.map(b => ({...b, startTime: new Date(b.startTime), endTime: new Date(b.endTime)})));
            setBookingDetails(details);
        } catch (error) {
            console.error(`Failed to fetch records for event type ${eventType.id}:`, error);
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        fetchData();
    }, [eventType.id]);
    
    const mergedData = useMemo(() => {
        const bookingDetailsMap = new Map(bookingDetails.map(bd => [bd.id, bd]));
        return bookings
            .filter(booking => booking.startTime && isValid(booking.startTime))
            .map(booking => {
                const details = bookingDetailsMap.get(booking.id) || { id: booking.id };
                return {
                    ...details,
                    ...booking,
                    eventTypeName: eventType.name,
                    mode: eventType.mode || 'N/A',
                };
            }).sort((a, b) => (b.startTime?.getTime() || 0) - (a.startTime?.getTime() || 0));
    }, [bookings, bookingDetails, eventType]);

    const filteredData = useMemo(() => {
        return firestoreService.filterBookings(mergedData, { ...filters, eventTypes: [eventType.id] });
    }, [mergedData, filters, eventType.id]);
    
    const columns = useMemo(() => {
        const baseColumns = [
            { key: 'derivedDate', label: 'Date' },
            { key: 'bookerName', label: 'Client Name' },
            { key: 'bookerEmail', label: 'Email' },
            { key: 'bookerPhone', label: 'Phone' },
            { key: 'meetingStatus', label: 'Status' },
        ];
        const customColumns = eventType.customFormFields.map(field => ({
            key: `custom_${field.id}`,
            label: field.label,
        }));
        return [...baseColumns, ...customColumns];
    }, [eventType]);

    const getDisplayValue = (item: MergedBooking, key: string): string => {
        if (key.startsWith('custom_')) {
            const fieldId = key.replace('custom_', '');
            const answer = item.customAnswers?.[fieldId];
            if (answer === 'true') return 'Yes';
            if (answer === 'false' || !answer) return 'N/A';
            return String(answer);
        }
        if (key === 'derivedDate') return item.startTime && isValid(item.startTime) ? format(item.startTime, 'PP') : 'Invalid Date';
        const value = (item as any)[key];
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        if (value === null || value === undefined) return 'N/A';
        return String(value);
    };
    
    // --- Action Handlers ---
    const handleEdit = (booking: MergedBooking) => { setSelectedBooking(booking); setIsDetailsModalOpen(true); };
    const handleDelete = (booking: MergedBooking) => { setBookingToDelete(booking); };
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => setSelectedIds(e.target.checked ? filteredData.map(item => item.id) : []);
    const handleSelectOne = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

    const handleSaveDetails = async (details: BookingDetails) => {
        if (!selectedBooking) return;
        try {
            await firestoreService.updateBookingDetails(selectedBooking.id, details, selectedBooking.eventTypeId);
            setIsDetailsModalOpen(false);
            setSelectedBooking(null);
            await fetchData();
        } catch(error) { console.error("Failed to save details:", error); alert("Could not save changes."); }
    };

    const handleConfirmDelete = async (bookingId: string, eventTypeId: string) => {
        setIsDeleting(true);
        try {
            await firestoreService.deleteBooking(bookingId, eventTypeId);
            setBookingToDelete(null);
            await fetchData();
        } catch (error) { console.error("Failed to delete:", error); alert("Could not delete booking."); } 
        finally { setIsDeleting(false); }
    };

    const handleConfirmMultiDelete = async () => {
        setIsDeleting(true);
        try {
            const map = { [eventType.id]: eventType.id };
            const bookingToEventTypeMap = selectedIds.reduce((acc, id) => ({ ...acc, [id]: eventType.id }), {});
            await firestoreService.deleteMultipleBookings(selectedIds, bookingToEventTypeMap);
            setSelectedIds([]);
            setIsMultiDeleteModalOpen(false);
            await fetchData();
        } catch (error) { console.error("Failed multi-delete:", error); alert("Could not delete bookings."); }
        finally { setIsDeleting(false); }
    };

    const handleExportToCSV = () => {
        const headers = columns.map(c => c.label).join(',');
        const rows = filteredData.map(row => 
            columns.map(col => `"${String(getDisplayValue(row, col.key)).replace(/"/g, '""')}"`).join(',')
        );
        const csvString = [headers, ...rows].join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `syncup_export_${eventType.name.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    if (loading) return <div className="flex justify-center items-center h-96"><Spinner /></div>;
    
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" onClick={onBack}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                    Back
                </Button>
                <div>
                    <h1 className="text-3xl font-bold">{eventType.name}</h1>
                    <p className="text-slate-500">Viewing all records for this event type.</p>
                </div>
            </div>

            <RecordsFilterBar
                eventTypes={[]}
                onFilterChange={setFilters}
                onExport={handleExportToCSV}
                resultsCount={filteredData.length}
                hideEventTypeFilter={true}
            />
            
            <Card className="p-0">
                <div className="overflow-x-auto custom-scrollbar">
                    {filteredData.length > 0 ? (
                        <table className="min-w-full divide-y divide-slate-200">
                             <thead className="bg-slate-50">
                                <tr>
                                    <th scope="col" className="px-4 py-3"><input type="checkbox" onChange={handleSelectAll} checked={selectedIds.length > 0 && selectedIds.length === filteredData.length} className="h-4 w-4 text-primary rounded border-slate-300 focus:ring-primary"/></th>
                                    <th scope="col" className="sticky left-0 bg-slate-50 px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider z-10">Actions</th>
                                    {columns.map(col => <th key={col.key} scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">{col.label}</th>)}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {filteredData.map(item => (
                                    <tr key={item.id} className={`hover:bg-slate-50 ${selectedIds.includes(item.id) ? 'bg-primary/5' : ''}`}>
                                        <td className="px-4 py-4"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => handleSelectOne(item.id)} className="h-4 w-4 text-primary rounded border-slate-300 focus:ring-primary"/></td>
                                        <td className="sticky left-0 bg-white hover:bg-slate-50 px-6 py-4 whitespace-nowrap text-sm font-medium z-10 border-r">
                                            <div className="flex items-center gap-2">
                                                <Button size="sm" variant="outline" onClick={() => handleEdit(item)}>View/Edit</Button>
                                                <button onClick={() => handleDelete(item)} disabled={isDeleting} className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-100"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg></button>
                                            </div>
                                        </td>
                                        {columns.map(col => (
                                            <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 max-w-xs truncate" title={getDisplayValue(item, col.key)}>
                                                {col.key === 'meetingStatus' ? <StatusBadge status={item.meetingStatus} /> : getDisplayValue(item, col.key)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="text-center py-16 text-slate-500"><p className="font-semibold">No records found</p><p className="text-sm">Try adjusting your filters.</p></div>
                    )}
                </div>
            </Card>

            {isDetailsModalOpen && selectedBooking && <BookingDetailsEditorModal booking={selectedBooking} eventType={eventType} onClose={() => setIsDetailsModalOpen(false)} onSave={handleSaveDetails}/>}
            {bookingToDelete && <DeleteBookingConfirmationModal booking={bookingToDelete} onClose={() => setBookingToDelete(null)} onConfirm={handleConfirmDelete} isDeleting={isDeleting}/>}
            {isMultiDeleteModalOpen && <DeleteMultipleBookingsModal count={selectedIds.length} onClose={() => setIsMultiDeleteModalOpen(false)} onConfirm={handleConfirmMultiDelete} isDeleting={isDeleting}/>}
            
            {selectedIds.length > 0 && (
                <div className="fixed bottom-6 right-6 z-50 bg-white rounded-lg shadow-2xl p-4 flex items-center gap-4 animate-fade-in-up border">
                    <span className="text-sm font-medium text-slate-700">{selectedIds.length} selected</span>
                    <Button size="sm" onClick={() => setIsMultiDeleteModalOpen(true)} className="!bg-red-600 hover:!bg-red-700 focus:ring-red-500"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>Delete Selected</Button>
                    <button onClick={() => setSelectedIds([])} className="text-sm text-slate-500 hover:text-slate-800">Cancel</button>
                </div>
            )}
        </div>
    );
};

export default EventTypeRecordsView;