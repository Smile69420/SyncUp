import React, { useState, useEffect, useMemo } from 'react';
import { schedulingService } from '../services/schedulingService';
import type { Booking, EventType, BookingDetails, MergedBooking, ColumnConfiguration } from '../types';
import Spinner from './ui/Spinner';
import Card from './ui/Card';
import Button from './ui/Button';
import BookingDetailsEditorModal from './BookingDetailsEditorModal';
import ColumnManagerModal from './ColumnManagerModal';
import { format, getWeek } from 'date-fns';

const RecordsPage: React.FC = () => {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [eventTypes, setEventTypes] = useState<EventType[]>([]);
    const [bookingDetails, setBookingDetails] = useState<BookingDetails[]>([]);
    const [columnConfig, setColumnConfig] = useState<ColumnConfiguration | null>(null);
    const [loading, setLoading] = useState(true);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [isColumnManagerOpen, setIsColumnManagerOpen] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState<MergedBooking | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [books, types, details, config] = await Promise.all([
                schedulingService.getBookings(),
                schedulingService.getEventTypes(),
                schedulingService.getBookingDetails(),
                schedulingService.getColumnConfiguration(),
            ]);
            setBookings(books.map(b => ({...b, startTime: new Date(b.startTime), endTime: new Date(b.endTime)})));
            setEventTypes(types);
            setBookingDetails(details);
            setColumnConfig(config);
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

        return bookings.map(booking => {
            const details = bookingDetailsMap.get(booking.id) || { id: booking.id };
            const eventType = eventTypeMap.get(booking.eventTypeId);
            return {
                ...booking,
                ...details,
                eventTypeName: eventType?.name || 'Unknown',
                mode: eventType?.mode || 'N/A',
            };
        }).sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    }, [bookings, eventTypes, bookingDetails]);
    
    const handleEdit = (booking: MergedBooking) => {
        setSelectedBooking(booking);
        setIsDetailsModalOpen(true);
    };
    
    const handleSaveDetails = async (details: BookingDetails) => {
        try {
            const { id, ...dataToSave } = details;
            await schedulingService.updateBookingDetails(id, dataToSave);
            setIsDetailsModalOpen(false);
            setSelectedBooking(null);
            await fetchData(); // Refresh data
        } catch(error) {
            console.error("Failed to save details:", error);
            alert("Could not save changes. Please try again.");
        }
    };

    const handleSaveColumnConfig = async (newConfig: ColumnConfiguration) => {
        try {
            await schedulingService.saveColumnConfiguration(newConfig);
            setColumnConfig(newConfig);
            setIsColumnManagerOpen(false);
        } catch(error) {
            console.error("Failed to save column configuration:", error);
            alert("Could not save column settings. Please try again.");
        }
    };
    
    const getDisplayValue = (item: MergedBooking, key: string) => {
        if (key === 'derivedDate') return format(item.startTime, 'PP');
        if (key === 'derivedWeekNo') return getWeek(item.startTime);
        if (key === 'derivedSlot') return `${format(item.startTime, 'p')} - ${format(item.endTime, 'p')}`;
        if (key === 'derivedDay') return format(item.startTime, 'EEEE');
        if (key === 'derivedMonth') return format(item.startTime, 'MMMM');
        
        const value = (item as any)[key];
        if (typeof value === 'boolean') {
            return value ? 'Yes' : 'No';
        }
        return value || 'N/A';
    };
    
    const handleExportToCSV = () => {
        if (!columnConfig) return;
        
        const visibleColumns = columnConfig.filter(c => c.isVisible);
        const csvRows = [];
        const headerLabels = visibleColumns.map(c => c.label);
        csvRows.push(headerLabels.join(','));

        for (const row of mergedData) {
            const values = visibleColumns.map(col => {
                const value = getDisplayValue(row, col.key as string);
                const stringValue = String(value ?? '').replace(/"/g, '""');
                return `"${stringValue}"`;
            });
            csvRows.push(values.join(','));
        }

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'syncup_records.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading || !columnConfig) {
        return <div className="flex justify-center items-center h-96"><Spinner /></div>;
    }
    
    const visibleColumns = columnConfig.filter(c => c.isVisible);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Booking Records</h1>
                <div className="flex items-center gap-4">
                    <Button variant="outline" onClick={() => setIsColumnManagerOpen(true)}>Columns</Button>
                    <Button onClick={handleExportToCSV}>Export to CSV</Button>
                </div>
            </div>
            
            <Card className="p-0">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50 sticky top-0">
                            <tr>
                                <th scope="col" className="sticky left-0 bg-slate-50 px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider z-10">Actions</th>
                                {visibleColumns.map(col => (
                                    <th key={col.key as string} scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">{col.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {mergedData.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50">
                                    <td className="sticky left-0 bg-white hover:bg-slate-50 px-6 py-4 whitespace-nowrap text-sm font-medium z-10 border-r">
                                        <Button size="sm" variant="outline" onClick={() => handleEdit(item)}>Edit Details</Button>
                                    </td>
                                    {visibleColumns.map(col => (
                                        <td key={col.key as string} className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">{getDisplayValue(item, col.key as string)}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {isDetailsModalOpen && selectedBooking && (
                <BookingDetailsEditorModal 
                    booking={selectedBooking}
                    onClose={() => setIsDetailsModalOpen(false)}
                    onSave={handleSaveDetails}
                />
            )}
            
            {isColumnManagerOpen && columnConfig && (
                <ColumnManagerModal
                    initialConfig={columnConfig}
                    onClose={() => setIsColumnManagerOpen(false)}
                    onSave={handleSaveColumnConfig}
                />
            )}
        </div>
    );
};

export default RecordsPage;
