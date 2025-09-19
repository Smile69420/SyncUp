import React, { useState, useEffect, useMemo } from 'react';
import { firestoreService } from '../services/firestoreService';
import type { Booking, EventType, BookingDetails, MergedBooking, ColumnConfiguration, ColumnConfig } from '../types';
import Spinner from './ui/Spinner';
import Card from './ui/Card';
import Button from './ui/Button';
import BookingDetailsEditorModal from './BookingDetailsEditorModal';
import DeleteBookingConfirmationModal from './DeleteBookingConfirmationModal';
import { format, isValid, isWithinInterval, subDays, getWeek, getMonth, getDay } from 'date-fns';

// --- Static Column Configuration ---
const DEFAULT_COLUMNS: ColumnConfiguration = [
    { key: 'derivedDate', label: 'Date', isVisible: true },
    { key: 'companyName', label: 'Company Name', isVisible: true },
    { key: 'derivedWeekNo', label: 'Week No.', isVisible: true },
    { key: 'derivedSlot', label: 'Slot', isVisible: true },
    { key: 'derivedDay', label: 'Day', isVisible: true },
    { key: 'consultationDoneBy', label: 'Consultation Done By', isVisible: true },
    { key: 'mode', label: 'Mode', isVisible: true },
    { key: 'meetingStatus', label: 'Meeting Status', isVisible: true, type: 'select', options: ['Scheduled', 'Completed', 'Cancelled', 'No Show'] },
    { key: 'derivedMonth', label: 'Month', isVisible: true },
    { key: 'bookerName', label: 'Client Name', isVisible: true },
    { key: 'designation', label: 'Designation', isVisible: true },
    { key: 'generalizedDesignation', label: 'Generalized Designation', isVisible: true },
    { key: 'bookerPhone', label: 'Phone Number', isVisible: true },
    { key: 'level', label: 'Level', isVisible: false },
    { key: 'capability', label: 'Capability', isVisible: false },
    { key: 'feedbackSent', label: 'Feedback Sent', isVisible: true, type: 'select', options: ['Pending', 'Yes', 'No'] },
    { key: 'shownInterestInMembership', label: 'Shown Interest in Membership', isVisible: false, type: 'checkbox' },
    { key: 'membership', label: 'Membership', isVisible: false, type: 'checkbox' },
    { key: 'membershipVerification', label: 'Membership Verification', isVisible: false, type: 'checkbox' },
    { key: 'bookerEmail', label: 'Email Id', isVisible: true },
    { key: 'state', label: 'State', isVisible: false },
    { key: 'district', label: 'District', isVisible: false },
    { key: 'womenEntrepreneur', label: 'Women Entrepreneur', isVisible: false, type: 'checkbox' },
    { key: 'noOfEmployeesInCompany', label: 'No of Employees in Company', isVisible: false },
    { key: 'noOfAttendants', label: 'No of Attendants', isVisible: false },
    { key: 'sector', label: 'Sector', isVisible: true },
    { key: 'sectorGeneralized', label: 'Sector Generalized', isVisible: false },
    { key: 'operationsPerfomedInBrief', label: 'Operations Perfomed In Brief', isVisible: false, type: 'textarea' },
    { key: 'scale', label: 'Scale', isVisible: false },
    { key: 'challenges', label: 'Challenges', isVisible: false, type: 'textarea' },
    { key: 'manualTasks', label: 'Manual Tasks', isVisible: false, type: 'textarea' },
    { key: 'suggestedTools', label: 'Suggested Tools', isVisible: false, type: 'textarea' },
    { key: 'toolCategories', label: 'Tool Categories', isVisible: false },
    { key: 'aiFamiliarityPre', label: 'AI Familiarity (Pre Consultation)', isVisible: false },
    { key: 'kpi', label: 'KPI', isVisible: false },
    { key: 'aiFamiliarityPost', label: 'AI Familiarty Post Consultation', isVisible: false },
    { key: 'kpiValue', label: 'KPI Value', isVisible: false },
    { key: 'howDidTheyGetToKnow', label: 'How did they get to know about AI Consultation', isVisible: false },
    { key: 'additionalNotes1', label: 'Column 35', isVisible: false },
    { key: 'notesForReport', label: 'Notes for Report', isVisible: true, type: 'textarea' },
    { key: 'followUpRequestStatus', label: 'Follow Up Request Status', isVisible: false, type: 'select', options: ['Not Requested', 'Requested', 'Completed'] },
    { key: 'followUpStatus', label: 'Follow Up (Done / Pending )', isVisible: true, type: 'select', options: ['Pending', 'Done'] },
    { key: 'firefliesLink', label: 'Recording Link', isVisible: false, type: 'url' },
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

const KpiCard: React.FC<{ title: string; value: string | number; description?: string }> = ({ title, value, description }) => (
    <div className="bg-slate-50 p-4 rounded-lg">
        <p className="text-sm text-slate-500 font-medium">{title}</p>
        <p className="text-3xl font-bold text-primary mt-1">{value}</p>
        {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
    </div>
);


const DataExplorerPage: React.FC = () => {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [eventTypes, setEventTypes] = useState<EventType[]>([]);
    const [bookingDetails, setBookingDetails] = useState<BookingDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState<MergedBooking | null>(null);
    const [bookingToDelete, setBookingToDelete] = useState<MergedBooking | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
    const [dateRange, setDateRange] = useState('all');


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
                    ...booking, // FIX: Spread booking last to ensure its properties (like startTime) take precedence
                    eventTypeName: eventType?.name || '[Deleted Event]', // Robust handling for orphaned bookings
                    mode: eventType?.mode || 'N/A',
                };
            }).sort((a, b) => (b.startTime?.getTime() || 0) - (a.startTime?.getTime() || 0));
    }, [bookings, eventTypes, bookingDetails]);

    const filteredData = useMemo(() => {
        let data = mergedData;

        // Date Range Filter
        if (dateRange !== 'all') {
            const now = new Date();
            const rangeStart = subDays(now, parseInt(dateRange));
            data = data.filter(item => isWithinInterval(item.startTime, { start: rangeStart, end: now }));
        }

        // Search Query Filter
        if (searchQuery) {
            const lowercasedQuery = searchQuery.toLowerCase();
            data = data.filter(item =>
                item.bookerName?.toLowerCase().includes(lowercasedQuery) ||
                item.bookerEmail?.toLowerCase().includes(lowercasedQuery) ||
                item.companyName?.toLowerCase().includes(lowercasedQuery)
            );
        }

        // Event Type Filter
        if (selectedEventTypes.length > 0) {
            data = data.filter(item => selectedEventTypes.includes(item.eventTypeId));
        }

        // Status Filter
        if (selectedStatuses.length > 0) {
            data = data.filter(item => selectedStatuses.includes(item.meetingStatus || 'Scheduled'));
        }

        return data;
    }, [mergedData, searchQuery, selectedEventTypes, selectedStatuses, dateRange]);
    
    const analyticsData = useMemo(() => {
        const total = filteredData.length;
        const completed = filteredData.filter(b => b.meetingStatus === 'Completed').length;
        const noShows = filteredData.filter(b => b.meetingStatus === 'No Show').length;
        const completionRate = (completed + noShows) > 0 ? (completed / (completed + noShows) * 100) : 0;
        
        const eventTypeCounts = filteredData.reduce((acc, booking) => {
            acc[booking.eventTypeName] = (acc[booking.eventTypeName] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const mostPopularEvent = Object.entries(eventTypeCounts).sort((a, b) => b[1] - a[1])[0];

        return {
            totalBookings: total,
            completionRate: `${completionRate.toFixed(1)}%`,
            mostPopularEvent: mostPopularEvent ? mostPopularEvent[0] : 'N/A'
        };
    }, [filteredData]);
    
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
            await fetchData(); // Refresh data
        } catch(error) {
            console.error("Failed to save details:", error);
            alert("Could not save changes. Please try again.");
        }
    };

    const handleConfirmDelete = async (bookingId: string, eventTypeId: string) => {
        setIsDeleting(true);
        try {
            await firestoreService.deleteBooking(bookingId, eventTypeId);
            setBookingToDelete(null);
            await fetchData(); // Refresh data
        } catch (error) {
            console.error("Failed to delete booking:", error);
            alert("Could not delete the booking. Please try again.");
        } finally {
            setIsDeleting(false);
        }
    };
    
    const getDisplayValue = (item: MergedBooking, key: string): string => {
        try {
            const dateValid = item.startTime && isValid(item.startTime);
            if (key === 'derivedDate') return dateValid ? format(item.startTime, 'PP') : 'Invalid Date';
            if (key === 'derivedSlot') return dateValid && item.endTime && isValid(item.endTime) ? `${format(item.startTime, 'p')} - ${format(item.endTime, 'p')}` : 'Invalid Time';
            if (key === 'derivedWeekNo') return dateValid ? String(getWeek(item.startTime)) : 'N/A';
            if (key === 'derivedMonth') return dateValid ? format(item.startTime, 'MMMM') : 'N/A';
            if (key === 'derivedDay') return dateValid ? format(item.startTime, 'EEEE') : 'N/A';
            
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
        const visibleColumns = DEFAULT_COLUMNS.filter(c => c.isVisible);
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
    
    const visibleColumns = DEFAULT_COLUMNS.filter(c => c.isVisible);

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Data Explorer</h1>

            <Card>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                     <input type="text" placeholder="Search by name, email, company..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"/>
                     <select onChange={(e) => setSelectedEventTypes(Array.from(e.target.selectedOptions, option => option.value))} multiple className="w-full p-2 border rounded-md">
                        <option value="">All Event Types</option>
                        {eventTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
                     </select>
                     <select onChange={(e) => setSelectedStatuses(Array.from(e.target.selectedOptions, option => option.value))} multiple className="w-full p-2 border rounded-md">
                         <option value="">All Statuses</option>
                         {['Scheduled', 'Completed', 'Cancelled', 'No Show'].map(s => <option key={s} value={s}>{s}</option>)}
                     </select>
                     <select value={dateRange} onChange={e => setDateRange(e.target.value)} className="w-full p-2 border rounded-md">
                         <option value="all">All Time</option>
                         <option value="7">Last 7 Days</option>
                         <option value="30">Last 30 Days</option>
                         <option value="90">Last 90 Days</option>
                     </select>
                 </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KpiCard title="Total Bookings" value={analyticsData.totalBookings} description="Based on current filters" />
                <KpiCard title="Completion Rate" value={analyticsData.completionRate} description="Completed vs (Completed + No Shows)" />
                <KpiCard title="Most Popular Event" value={analyticsData.mostPopularEvent} description="Based on current filters" />
            </div>
            
            <Card className="p-0">
                <div className="flex justify-end p-4 border-b">
                     <Button onClick={handleExportToCSV}>Export CSV</Button>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    {filteredData.length > 0 ? (
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th scope="col" className="sticky left-0 bg-slate-50 px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider z-10">Actions</th>
                                    {visibleColumns.map(col => (
                                        <th key={col.key as string} scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">{col.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {filteredData.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-50">
                                        <td className="sticky left-0 bg-white hover:bg-slate-50 px-6 py-4 whitespace-nowrap text-sm font-medium z-10 border-r">
                                            <div className="flex items-center gap-2">
                                                <Button size="sm" variant="outline" onClick={() => handleEdit(item)}>View</Button>
                                                <button onClick={() => handleDelete(item)} disabled={isDeleting} className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Delete booking">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                                                </button>
                                            </div>
                                        </td>
                                        {visibleColumns.map(col => (
                                            <td key={col.key as string} className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 max-w-xs truncate" title={getDisplayValue(item, col.key as string)}>
                                                {col.key === 'meetingStatus' ? (
                                                    <StatusBadge status={item.meetingStatus} />
                                                ) : col.key === 'firefliesLink' && item.firefliesLink ? (
                                                    <a href={item.firefliesLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Recording</a>
                                                ) : (
                                                    getDisplayValue(item, col.key as string)
                                                )}
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
        </div>
    );
};

export default DataExplorerPage;