

import React, { useState, useEffect, useMemo } from 'react';
// FIX: Changed to namespace import to fix module resolution issues.
import * as ReactRouterDOM from 'react-router-dom';
import CalendarView from './CalendarView';
import EventTypeEditor from './EventTypeEditor';
import { schedulingService } from '../services/schedulingService';
import type { EventType, Booking, BookingDetails, MergedBooking } from '../types';
import Spinner from './ui/Spinner';
import Card from './ui/Card';
import Button from './ui/Button';
import { format, isToday, isWithinInterval, addDays, startOfToday, subDays, isPast } from 'date-fns';
import BookingDetailsEditorModal from './BookingDetailsEditorModal';

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode }> = ({ title, value, icon }) => (
    <Card className="flex items-center p-4">
        <div className="p-3 rounded-full bg-primary/10 text-primary mr-4">{icon}</div>
        <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold truncate" title={value}>{value}</p>
        </div>
    </Card>
);


const Dashboard: React.FC = () => {
    const [eventTypes, setEventTypes] = useState<EventType[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [bookingDetails, setBookingDetails] = useState<BookingDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedEventType, setSelectedEventType] = useState<EventType | null>(null);
    const [selectedBooking, setSelectedBooking] = useState<MergedBooking | null>(null);
    const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);


    const fetchData = async () => {
        setLoading(true);
        try {
            const [types, books, details] = await Promise.all([
                schedulingService.getEventTypes(),
                schedulingService.getBookings(),
                schedulingService.getBookingDetails(),
            ]);
            setEventTypes(types);
            setBookings(books.map(b => ({...b, startTime: new Date(b.startTime), endTime: new Date(b.endTime)})));
            setBookingDetails(details);
        } catch (error) {
            console.error("Failed to fetch data:", error);
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        fetchData();
    }, []);

    const mergedData = useMemo((): MergedBooking[] => {
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
        });
    }, [bookings, eventTypes, bookingDetails]);
    
    const dashboardStats = useMemo(() => {
        const today = startOfToday();
        const next7Days = { start: today, end: addDays(today, 7) };

        const upcomingBookings = bookings.filter(b => isWithinInterval(b.startTime, next7Days)).length;
        const todaysBookings = bookings.filter(b => isToday(b.startTime)).length;

        const last30DaysBookings = bookings.filter(b => isWithinInterval(b.startTime, { start: subDays(today, 30), end: today }));
        const bookingsByDay = last30DaysBookings.reduce((acc, booking) => {
            const day = format(booking.startTime, 'yyyy-MM-dd');
            acc[day] = (acc[day] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        const busiestDay = Object.entries(bookingsByDay).sort((a, b) => b[1] - a[1])[0];
        
        const bookingsByEventType = bookings.reduce((acc, booking) => {
            const eventTypeName = eventTypes.find(et => et.id === booking.eventTypeId)?.name || 'Unknown';
            acc[eventTypeName] = (acc[eventTypeName] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    
        const mostBookedEvent = Object.entries(bookingsByEventType).sort((a, b) => b[1] - a[1])[0];


        return {
            upcomingBookings,
            todaysBookings,
            busiestDay: busiestDay ? { day: format(new Date(busiestDay[0]), 'MMM do'), count: busiestDay[1] } : { day: 'N/A', count: 0 },
            mostBookedEvent: mostBookedEvent ? { name: mostBookedEvent[0], count: mostBookedEvent[1] } : { name: 'N/A', count: 0 },
        };
    }, [bookings, eventTypes]);

    const pendingUpdates = useMemo(() => {
        const now = new Date();
        return mergedData
            .filter(b => isPast(b.endTime) && b.meetingStatus === 'Scheduled')
            .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    }, [mergedData]);


    const handleEditEventType = (eventType: EventType) => {
        setSelectedEventType(eventType);
        setIsEditorOpen(true);
    };

    const handleAddNewEventType = () => {
        setSelectedEventType(null);
        setIsEditorOpen(true);
    };

    const handleSaveEventType = async (eventType: Omit<EventType, 'id' | 'link'> & { id?: string }) => {
        await schedulingService.saveEventType(eventType);
        setIsEditorOpen(false);
        setSelectedEventType(null);
        await fetchData(); // Refresh data
    };
    
    const handleCopyLink = (link: string, id: string) => {
        const fullLink = `${window.location.origin}${link}`;
        navigator.clipboard.writeText(fullLink).then(() => {
            setCopiedLinkId(id);
            setTimeout(() => setCopiedLinkId(null), 2000);
        });
    };

    const handleEditDetails = (booking: MergedBooking) => {
        setSelectedBooking(booking);
        setIsDetailsModalOpen(true);
    };
    
    const handleDeleteEventType = async (eventTypeId: string, eventTypeName: string) => {
        if (window.confirm(`Are you sure you want to delete the "${eventTypeName}" event type? This action cannot be undone, but existing bookings will not be affected.`)) {
            try {
                await schedulingService.deleteEventType(eventTypeId);
                await fetchData(); // Refresh data to remove the deleted event type from the UI
            } catch (error) {
                console.error("Failed to delete event type:", error);
                alert("Could not delete the event type. Please try again.");
            }
        }
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


    if (loading) {
        return <div className="flex justify-center items-center h-96"><Spinner /></div>;
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <Button onClick={handleAddNewEventType}>+ Create Event Type</Button>
            </div>

            <section>
                 <h2 className="text-2xl font-semibold mb-4">Action Center</h2>
                 <Card>
                    <div className="flex items-center mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 mr-3"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
                        <h3 className="font-bold text-lg text-amber-700">Pending Updates ({pendingUpdates.length})</h3>
                    </div>
                     {pendingUpdates.length > 0 ? (
                        <>
                            <p className="text-sm text-gray-500 mb-4">These past meetings need their status and details updated.</p>
                            <ul className="divide-y divide-gray-200 max-h-60 overflow-y-auto custom-scrollbar">
                                {pendingUpdates.map(booking => (
                                    <li key={booking.id} className="py-3 flex items-center justify-between">
                                        <div>
                                            <p className="font-semibold text-gray-800">{booking.eventTypeName} with {booking.bookerName}</p>
                                            <p className="text-sm text-gray-500">{format(booking.startTime, 'PP p')}</p>
                                        </div>
                                        <Button size="sm" variant="outline" onClick={() => handleEditDetails(booking)}>Update Status</Button>
                                    </li>
                                ))}
                            </ul>
                        </>
                     ) : (
                         <div className="text-center py-4">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500 mx-auto mb-2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                             <p className="font-semibold text-gray-700">All caught up!</p>
                             <p className="text-sm text-gray-500">All past meetings have been updated.</p>
                         </div>
                     )}
                 </Card>
            </section>
            
             <section>
                <h2 className="text-2xl font-semibold mb-4">At a Glance</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                     <StatCard title="Upcoming (Next 7 days)" value={dashboardStats.upcomingBookings.toString()} icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>} />
                     <StatCard title="Today's Meetings" value={dashboardStats.todaysBookings.toString()} icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 6v6l4 2"/></svg>} />
                     <StatCard title="Busiest Day (Last 30d)" value={`${dashboardStats.busiestDay.day} (${dashboardStats.busiestDay.count} mtgs)`} icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" x2="12" y1="22.08" y2="12"/></svg>} />
                     <StatCard title="Most Booked Event" value={dashboardStats.mostBookedEvent.name} icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>} />
                </div>
            </section>
            
            <section>
                <h2 className="text-2xl font-semibold mb-4">Event Types</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {eventTypes.map(et => (
                        <Card key={et.id} className="flex flex-col">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="font-bold text-lg" style={{ color: et.color }}>{et.name}</h3>
                                    <p className="text-sm text-gray-500">{et.duration} minutes</p>
                                </div>
                                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: et.color }}></div>
                            </div>
                            <p className="text-gray-600 mt-2 flex-grow">{et.description}</p>
                             <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleCopyLink(et.link, et.id)}>
                                     {copiedLinkId === et.id ? 'Copied!' : 'Copy Link'}
                                </Button>
                                <div className="flex items-center gap-2">
                                    <ReactRouterDOM.Link to={et.link} className="text-sm font-medium text-primary hover:underline">View</ReactRouterDOM.Link>
                                    <button onClick={() => handleEditEventType(et)} className="text-sm font-medium text-gray-500 hover:text-gray-800">Edit</button>
                                    <button onClick={() => handleDeleteEventType(et.id, et.name)} className="text-sm font-medium text-red-500 hover:text-red-700">Delete</button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </section>
            
            <section>
                <h2 className="text-2xl font-semibold mb-4">Your Schedule</h2>
                <Card>
                    <CalendarView bookings={mergedData} eventTypes={eventTypes} />
                </Card>
            </section>

            {isEditorOpen && (
                <EventTypeEditor 
                    eventType={selectedEventType}
                    onClose={() => setIsEditorOpen(false)}
                    onSave={handleSaveEventType}
                />
            )}

            {isDetailsModalOpen && selectedBooking && (
                <BookingDetailsEditorModal 
                    booking={selectedBooking}
                    onClose={() => setIsDetailsModalOpen(false)}
                    onSave={handleSaveDetails}
                />
            )}
        </div>
    );
};

export default Dashboard;