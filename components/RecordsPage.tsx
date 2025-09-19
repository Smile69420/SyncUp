import React, { useState, useEffect, useMemo } from 'react';
import { firestoreService } from '../services/firestoreService';
import type { EventType, Booking, MergedBooking } from '../types';
import Spinner from './ui/Spinner';
import Card from './ui/Card';
import EventTypeRecordsView from './EventTypeRecordsView';

const RecordsPage: React.FC = () => {
    const [eventTypes, setEventTypes] = useState<EventType[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEventType, setSelectedEventType] = useState<EventType | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [types, books] = await Promise.all([
                    firestoreService.getEventTypes(),
                    firestoreService.getBookings(),
                ]);
                setEventTypes(types);
                setBookings(books);
            } catch (error) {
                console.error("Failed to fetch records data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const bookingCounts = useMemo(() => {
        return bookings.reduce((acc, booking) => {
            acc[booking.eventTypeId] = (acc[booking.eventTypeId] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    }, [bookings]);

    if (loading) {
        return <div className="flex justify-center items-center h-96"><Spinner /></div>;
    }

    if (selectedEventType) {
        return (
            <EventTypeRecordsView 
                eventType={selectedEventType} 
                onBack={() => setSelectedEventType(null)} 
            />
        );
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Data Explorer</h1>
            <p className="text-slate-600">Select an event type below to view its records.</p>
            
            {eventTypes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {eventTypes.map(et => (
                        <Card 
                            key={et.id} 
                            className="flex flex-col !p-0 overflow-hidden cursor-pointer transition-transform transform hover:-translate-y-1"
                            onClick={() => setSelectedEventType(et)}
                        >
                            <div className="p-5 flex-grow">
                                <h2 className="font-bold text-lg text-slate-800 truncate">{et.name}</h2>
                                <p className="text-sm text-slate-500">{et.duration} min</p>
                            </div>
                            <div className="bg-slate-50 px-5 py-3 border-t">
                                <p className="text-2xl font-bold text-primary">{bookingCounts[et.id] || 0}</p>
                                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                                    {bookingCounts[et.id] === 1 ? 'Record' : 'Records'}
                                </p>
                            </div>
                            <div className="h-1.5 w-full" style={{backgroundColor: et.color}}></div>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 text-slate-500 border-2 border-dashed rounded-lg">
                    <h2 className="font-semibold">No Event Types Found</h2>
                    <p className="text-sm mt-2">Create your first event type from the Dashboard to see records here.</p>
                </div>
            )}
        </div>
    );
};

export default RecordsPage;