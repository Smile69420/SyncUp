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

// --- Static Column Configuration ---
const DISPLAY_COLUMNS: ColumnConfiguration = [
    { key: 'derivedDate', label: 'Date', isVisible: true },
    { key: 'companyName', label: 'Company Name', isVisible: true },
    { key: 'bookerName', label: 'Client Name', isVisible: true },
    { key: 'eventTypeName', label: 'Event Type', isVisible: true },
    { key: 'mode', label: 'Mode', isVisible: true },
    { key: 'meetingStatus', label: 'Meeting Status', isVisible: true },
    { key: 'followUpStatus', label: 'Follow-Up', isVisible: true },
    { key: 'consultationDoneBy', label: 'Consultant', isVisible: true },
    { key: 'bookerEmail', label: 'Email', isVisible: false },
    { key: 'bookerPhone', label: 'Phone', isVisible: false },
    { key: 'notesForReport', label: 'Notes', isVisible: false },
];

const StatusBadge: React.FC<{ status?: MergedBooking['meetingStatus']}> = ({ status }) => {
    const statusStyles = {
        Scheduled: 'bg-blue-100 text-blue-800',
        Completed: 'bg-emerald-100 text-emerald-800',
        Cancelled: 'bg-red-100 text-red-800',
        'No Show': 'bg-amber-100 text-amber-800',
        '[Deleted Event]': 'bg-gray-100 text-gray-800',
    };
    const style = statusStyles[status || 'Scheduled'] || 'bg-slate-100 text-slate-800';
    return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${style}`}>{status || 'Scheduled'}</span>
};

const RecordsPage: React.FC = () => {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [eventTypes, setEventTypes] = useState<EventType[]>([]);
    const [bookingDetails, setBookingDetails] = useState<BookingDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState<MergedBooking | null>(null);
    const [bookingToDelete, setBookingToDelete] = useState<MergedBooking | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Multi-select state
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isMultiDeleteModalOpen, setIsMultiDeleteModalOpen] = useState(false);

    // Filters state
    const [filters, setFilters] = useState({
        searchQuery: '',
        eventTypes: [] as string[],
        statuses: [] as string[],
        dateRange: 'all',
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [books, types, details] = await Promise.all([
                firestoreService.getBookings(),
                firestoreService.getEventTypes(),
                firestoreService.getBookingDetails(),
            ]);
            setBookings(books.map(b => ({...b, startTime: new Date(b.startTime), endTime: new Date(b.endTime)})));
            setEventTypes(types);
            setBookingDetails(details);
        } catch (error) {
            console.error("Failed to fetch records data:", error);
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        fetchData();
    }, []);
    
    const mergedData = useMemo(() => {
        const eventTypeMap = new Map(eventTypes.map(et => [et.id, et]));
        const bookingDetailsMap = new Map(bookingDetails.map(bd => [bd.id, bd]));

        return bookings
            .filter(booking => booking.startTime && isValid(booking.startTime))
            .map(booking => {
                const details = bookingDetailsMap.get(booking.id) || { id: booking.id };
                const eventType = eventTypeMap.get(booking.eventTypeId);
                return {
                    ...details,
                    ...booking,
                    eventTypeName: eventType?.name || '[Deleted Event]',
                    mode: eventType?.mode || 'N/A',
                };
            }).sort((a, b) => (b.startTime?.getTime() || 0) - (a.startTime?.getTime() || 0));
    }, [bookings, eventTypes, bookingDetails]);

    const filteredData = useMemo(() => {
        return firestoreService.filterBookings(mergedData, filters);
    }, [mergedData, filters]);
    
    
    const handleEdit = (booking: MergedBooking) => {
        setSelectedBooking(booking);
        setIsDetailsModalOpen(true);
    };

    const handleDelete = (booking: MergedBooking) => {
        setBookingToDelete(booking);
    };
    
    const handleSaveDetails = async (details: BookingDetails) => {
        if (!selectedBooking) return;
        try {
            const { id, ...dataToSave } = details;
            await firestoreService.updateBookingDetails(id, dataToSave, selectedBooking.eventTypeId);
            setIsDetailsModalOpen(false);
            setSelectedBooking(null);
            await fetchData();
        } catch(error) {
            console.error("Failed to save details:", error);
            alert("Could not save changes. Please try again. Check console for details.");
        }
    };

    const handleConfirmDelete = async (bookingId: string, eventTypeId: string) => {
        setIsDeleting(true);
        try {
            await firestoreService.deleteBooking(bookingId, eventTypeId);
            setBookingToDelete(null);
            await fetchData();
        } catch (error) {
            console.error("Failed to delete booking:", error);
            alert("Could not delete the booking. Please try again. Check console for details.");
        } finally {
            setIsDeleting(false);
        }
    };
    
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(filteredData.map(item => item.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleConfirmMultiDelete = async () => {
        setIsDeleting(true);
        try {
            const bookingToEventTypeMap = mergedData.reduce((acc, booking) => {
                if (selectedIds.includes(booking.id)) {
                    acc[booking.id] = booking.eventTypeId;
                }
                return acc;
            }, {} as { [bookingId: string]: string });

            await firestoreService.deleteMultipleBookings(selectedIds, bookingToEventTypeMap);
            setSelectedIds([]);
            setIsMultiDeleteModalOpen(false);
            await fetchData();
        } catch (error) {
            console.error("Failed to delete multiple bookings:", error);
            alert("Could not delete all selected bookings. Please try again. Check console for details.");
        } finally {
            setIsDeleting(false);
        }
    };
    
    const getDisplayValue = (item: MergedBooking, key: string): string => {
        try {
            if (key === 'derivedDate') return item.startTime && isValid(item.startTime) ? format(item.startTime, 'PP') : 'Invalid Date';
            
            const value = (item as any)[key];
            if (typeof value === 'boolean') return value ? 'Yes' : 'No';
            if (value === null || value === undefined) return 'N/A';
            return String(value);
        } catch (error) {
            console.error(`Error rendering cell for key "${key}" with item ID "${item.id}":`, error);
            return 'Render Error';
        }
    };
    
    const handleExportToCSV = () => {
        const visibleColumns = DISPLAY_COLUMNS.filter(c => c.isVisible);
        const headers = visibleColumns.map(c => c.label).join(',');
        const rows = filteredData.map(row => {
            return visibleColumns.map(col => {
                const value = getDisplayValue(row, col.key as string);
                const escapedValue = `"${String(value).replace(/"/g, '""')}"`;
                return escapedValue;
            }).join(',');
        });

        const csvString = [headers, ...rows].join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `syncup_data_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) {
        return <div className="flex justify-center items-center h-96"><Spinner /></div>;
    }
    
    const visibleColumns = DISPLAY_COLUMNS.filter(c => c.isVisible);

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Data Explorer</h1>

            <RecordsFilterBar
                eventTypes={eventTypes}
                onFilterChange={setFilters}
                onExport={handleExportToCSV}
                resultsCount={filteredData.length}
            />
            
            <Card className="p-0">
                <div className="overflow-x-auto custom-scrollbar">
                    {filteredData.length > 0 ? (
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th scope="col" className="px-4 py-3">
                                        <input 
                                            type="checkbox"
                                            className="h-4 w-4 text-primary rounded border-slate-300 focus:ring-primary"
                                            checked={selectedIds.length > 0 && selectedIds.length === filteredData.length}
                                            onChange={handleSelectAll}
                                            aria-label="Select all bookings"
                                        />
                                    </th>
                                    <th scope="col" className="sticky left-0 bg-slate-50 px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider z-10">Actions</th>
                                    {visibleColumns.map(col => (
                                        <th key={col.key as string} scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">{col.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {filteredData.map(item => (
                                    <tr key={item.id} className={`hover:bg-slate-50 ${selectedIds.includes(item.id) ? 'bg-primary/5' : ''}`}>
                                        <td className="px-4 py-4">
                                             <input 
                                                type="checkbox"
                                                className="h-4 w-4 text-primary rounded border-slate-300 focus:ring-primary"
                                                checked={selectedIds.includes(item.id)}
                                                onChange={() => handleSelectOne(item.id)}
                                                aria-label={`Select booking for ${item.bookerName}`}
                                            />
                                        </td>
                                        <td className="sticky left-0 bg-white hover:bg-slate-50 px-6 py-4 whitespace-nowrap text-sm font-medium z-10 border-r">
                                            <div className="flex items-center gap-2">
                                                <Button size="sm" variant="outline" onClick={() => handleEdit(item)}>View/Edit</Button>
                                                <button onClick={() => handleDelete(item)} disabled={isDeleting} className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Delete booking">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                                                </button>
                                            </div>
                                        </td>
                                        {visibleColumns.map(col => (
                                            <td key={col.key as string} className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 max-w-xs truncate" title={getDisplayValue(item, col.key as string)}>
                                                {col.key === 'meetingStatus' ? <StatusBadge status={item.meetingStatus} /> : getDisplayValue(item, col.key as string)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="text-center py-16 text-slate-500">
                            <p className="font-semibold">No records found</p>
                            <p className="text-sm">Try adjusting your filters.</p>
                        </div>
                    )}
                </div>
            </Card>

            {isDetailsModalOpen && selectedBooking && (
                <BookingDetailsEditorModal 
                    booking={selectedBooking}
                    eventType={eventTypes.find(et => et.id === selectedBooking.eventTypeId)}
                    onClose={() => setIsDetailsModalOpen(false)}
                    onSave={handleSaveDetails}
                />
            )}
            
            {bookingToDelete && (
                <DeleteBookingConfirmationModal
                    booking={bookingToDelete}
                    onClose={() => setBookingToDelete(null)}
                    onConfirm={handleConfirmDelete}
                    isDeleting={isDeleting}
                />
            )}
            
            {isMultiDeleteModalOpen && (
                <DeleteMultipleBookingsModal
                    count={selectedIds.length}
                    onClose={() => setIsMultiDeleteModalOpen(false)}
                    onConfirm={handleConfirmMultiDelete}
                    isDeleting={isDeleting}
                />
            )}
            
            {selectedIds.length > 0 && (
                <div className="fixed bottom-6 right-6 z-50 bg-white rounded-lg shadow-2xl p-4 flex items-center gap-4 animate-fade-in-up border">
                    <span className="text-sm font-medium text-slate-700">{selectedIds.length} selected</span>
                    <Button 
                        size="sm"
                        onClick={() => setIsMultiDeleteModalOpen(true)}
                        className="!bg-red-600 hover:!bg-red-700 focus:ring-red-500"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        Delete Selected
                    </Button>
                    <button onClick={() => setSelectedIds([])} className="text-sm text-slate-500 hover:text-slate-800">Cancel</button>
                </div>
            )}
        </div>
    );
};

export default RecordsPage;