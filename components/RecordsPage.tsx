import React, { useState, useEffect, useMemo } from 'react';
import { schedulingService } from '../services/schedulingService';
import type { Booking, EventType, BookingDetails } from '../types';
import Spinner from './ui/Spinner';
import Card from './ui/Card';
import Button from './ui/Button';
import BookingDetailsEditorModal from './BookingDetailsEditorModal';
import { format, getWeek } from 'date-fns';

type MergedBooking = Booking & BookingDetails & {
    eventTypeName: string;
    mode: string;
};

const RecordsPage: React.FC = () => {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [eventTypes, setEventTypes] = useState<EventType[]>([]);
    const [bookingDetails, setBookingDetails] = useState<BookingDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState<MergedBooking | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [books, types, details] = await Promise.all([
                schedulingService.getBookings(),
                schedulingService.getEventTypes(),
                schedulingService.getBookingDetails(),
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
    
    const { mergedData, headers } = useMemo(() => {
        const eventTypeMap = new Map(eventTypes.map(et => [et.id, et]));
        const bookingDetailsMap = new Map(bookingDetails.map(bd => [bd.id, bd]));

        const data: MergedBooking[] = bookings.map(booking => {
            const details = bookingDetailsMap.get(booking.id) || { id: booking.id };
            const eventType = eventTypeMap.get(booking.eventTypeId);
            return {
                ...booking,
                ...details,
                eventTypeName: eventType?.name || 'Unknown',
                mode: eventType?.mode || 'N/A',
            };
        }).sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
        
        const columnHeaders = [
            { key: 'derivedDate', label: 'Date' },
            { key: 'companyName', label: 'Company Name' },
            { key: 'derivedWeekNo', label: 'Week No.' },
            { key: 'derivedSlot', label: 'Slot' },
            { key: 'derivedDay', label: 'Day' },
            { key: 'consultationDoneBy', label: 'Consultation Done By' },
            { key: 'mode', label: 'Mode' },
            { key: 'derivedMonth', label: 'Month' },
            { key: 'bookerName', label: 'Client Name' },
            { key: 'designation', label: 'Designation' },
            { key: 'generalizedDesignation', label: 'Generalized Designation' },
            { key: 'bookerPhone', label: 'Phone Number' },
            { key: 'level', label: 'Level' },
            { key: 'capability', label: 'Capability' },
            { key: 'feedbackSent', label: 'Feedback Sent' },
            { key: 'shownInterestInMembership', label: 'Shown Interest in Membership' },
            { key: 'membership', label: 'Membership' },
            { key: 'membershipVerification', label: 'Membership Verification' },
            { key: 'bookerEmail', label: 'Email Id' },
            { key: 'state', label: 'State' },
            { key: 'district', label: 'District' },
            { key: 'womenEntrepreneur', label: 'Women Entrepreneur' },
            { key: 'noOfEmployeesInCompany', label: 'No of Employees in Company' },
            { key: 'noOfAttendants', label: 'No of Attendants' },
            { key: 'sector', label: 'Sector' },
            { key: 'sectorGeneralized', label: 'Sector Generalized' },
            { key: 'operationsPerfomedInBrief', label: 'Operations Perfomed In Brief' },
            { key: 'scale', label: 'Scale' },
            { key: 'challenges', label: 'Challenges' },
            { key: 'manualTasks', label: 'Manual Tasks' },
            { key: 'suggestedTools', label: 'Suggested Tools' },
            { key: 'toolCategories', label: 'Tool Categories' },
            { key: 'aiFamiliarityPre', label: 'AI Familiarity (Pre Consultation)' },
            { key: 'kpi', label: 'KPI' },
            { key: 'aiFamiliarityPost', label: 'AI Familiarty Post Consultation' },
            { key: 'kpiValue', label: 'KPI Value' },
            { key: 'howDidTheyGetToKnow', label: 'How did they get to know about AI Consultation' },
            { key: 'additionalNotes1', label: 'Column 35' },
            { key: 'notesForReport', label: 'Notes for Report' },
            { key: 'followUpRequestStatus', label: 'Follow Up Request Status' },
            { key: 'followUpStatus', label: 'Follow Up (Done / Pending )' },
            { key: 'meetingDone', label: 'Meeting Done' },
        ];

        return { mergedData: data, headers: columnHeaders };
    }, [bookings, eventTypes, bookingDetails]);
    
    const handleEdit = (booking: MergedBooking) => {
        setSelectedBooking(booking);
        setIsModalOpen(true);
    };
    
    const handleSaveDetails = async (details: BookingDetails) => {
        try {
            const { id, ...dataToSave } = details;
            await schedulingService.updateBookingDetails(id, dataToSave);
            setIsModalOpen(false);
            setSelectedBooking(null);
            await fetchData(); // Refresh data
        } catch(error) {
            console.error("Failed to save details:", error);
            alert("Could not save changes. Please try again.");
        }
    };
    
    const handleExportToCSV = () => {
        const csvRows = [];
        const headerLabels = headers.map(h => h.label);
        csvRows.push(headerLabels.join(','));

        for (const row of mergedData) {
            const values = headers.map(header => {
                let value: any;
                // Handle derived fields
                if (header.key === 'derivedDate') value = format(row.startTime, 'yyyy-MM-dd');
                else if (header.key === 'derivedWeekNo') value = getWeek(row.startTime);
                else if (header.key === 'derivedSlot') value = `${format(row.startTime, 'p')} - ${format(row.endTime, 'p')}`;
                else if (header.key === 'derivedDay') value = format(row.startTime, 'EEEE');
                else if (header.key === 'derivedMonth') value = format(row.startTime, 'MMMM');
                else value = (row as any)[header.key];
                
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

    if (loading) {
        return <div className="flex justify-center items-center h-96"><Spinner /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Booking Records</h1>
                <Button onClick={handleExportToCSV}>Export to CSV</Button>
            </div>
            
            <Card className="p-0">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50 sticky top-0">
                            <tr>
                                <th scope="col" className="sticky left-0 bg-slate-50 px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                                {headers.map(h => (
                                    <th key={h.key} scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">{h.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {mergedData.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50">
                                    <td className="sticky left-0 bg-white hover:bg-slate-50 px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <Button size="sm" variant="outline" onClick={() => handleEdit(item)}>Edit Details</Button>
                                    </td>
                                    {headers.map(header => {
                                        let displayValue: any;
                                        // Handle derived fields
                                        if (header.key === 'derivedDate') displayValue = format(item.startTime, 'PP');
                                        else if (header.key === 'derivedWeekNo') displayValue = getWeek(item.startTime);
                                        else if (header.key === 'derivedSlot') displayValue = `${format(item.startTime, 'p')} - ${format(item.endTime, 'p')}`;
                                        else if (header.key === 'derivedDay') displayValue = format(item.startTime, 'EEEE');
                                        else if (header.key === 'derivedMonth') displayValue = format(item.startTime, 'MMMM');
                                        else {
                                            const value = (item as any)[header.key];
                                            if (typeof value === 'boolean') {
                                                displayValue = value ? 'Yes' : 'No';
                                            } else {
                                                displayValue = value || 'N/A';
                                            }
                                        }
                                        return <td key={header.key} className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">{displayValue}</td>
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {isModalOpen && selectedBooking && (
                <BookingDetailsEditorModal 
                    booking={selectedBooking}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSaveDetails}
                />
            )}
        </div>
    );
};

export default RecordsPage;
