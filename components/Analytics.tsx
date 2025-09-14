
import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Sector } from 'recharts';
import { schedulingService } from '../services/schedulingService';
import type { Booking, EventType } from '../types';
import Spinner from './ui/Spinner';
import Card from './ui/Card';
import { format } from 'date-fns';

const Analytics: React.FC = () => {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [eventTypes, setEventTypes] = useState<EventType[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [books, types] = await Promise.all([
                    schedulingService.getBookings(),
                    schedulingService.getEventTypes(),
                ]);
                setBookings(books.map(b => ({...b, startTime: new Date(b.startTime), endTime: new Date(b.endTime)})));
                setEventTypes(types);
            } catch (error) {
                console.error("Failed to fetch analytics data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const eventTypeMap = useMemo(() =>
        eventTypes.reduce((acc, et) => {
            acc[et.id] = et;
            return acc;
        }, {} as Record<string, EventType>), [eventTypes]);

    const bookingsPerDay = useMemo(() => {
        const counts: { [key: string]: number } = {};
        bookings.forEach(booking => {
            const day = format(booking.startTime, 'yyyy-MM-dd');
            counts[day] = (counts[day] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [bookings]);

    const bookingsByEventType = useMemo(() => {
        const counts: { [key: string]: number } = {};
        bookings.forEach(booking => {
            const eventTypeName = eventTypeMap[booking.eventTypeId]?.name || 'Unknown';
            counts[eventTypeName] = (counts[eventTypeName] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [bookings, eventTypeMap]);

    const eventTypeColors = useMemo(() => {
        return eventTypes.map(et => et.color);
    }, [eventTypes]);

    if (loading) {
        return <div className="flex justify-center items-center h-96"><Spinner /></div>;
    }

    return (
        <div className="container mx-auto space-y-8">
            <h1 className="text-3xl font-bold">Analytics</h1>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card>
                    <h2 className="text-xl font-semibold mb-4">Bookings per Day</h2>
                    <div className="h-80">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={bookingsPerDay} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="count" fill="#4f46e5" name="Bookings" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
                <Card>
                    <h2 className="text-xl font-semibold mb-4">Bookings by Event Type</h2>
                     <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={bookingsByEventType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                    {bookingsByEventType.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={eventTypeColors[index % eventTypeColors.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>
             <Card>
                <h2 className="text-xl font-semibold mb-4">Key Metrics</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-3xl font-bold text-primary">{bookings.length}</p>
                        <p className="text-sm text-gray-500">Total Bookings</p>
                    </div>
                     <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-3xl font-bold text-primary">{eventTypes.length}</p>
                        <p className="text-sm text-gray-500">Event Types</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-3xl font-bold text-primary">{bookingsPerDay.length}</p>
                        <p className="text-sm text-gray-500">Active Days</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-3xl font-bold text-primary">
                            {bookings.length > 0 ? (bookings.reduce((sum, b) => sum + (eventTypes.find(et => et.id === b.eventTypeId)?.duration || 0), 0) / 60).toFixed(1) : 0}
                        </p>
                        <p className="text-sm text-gray-500">Total Hours Booked</p>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default Analytics;
