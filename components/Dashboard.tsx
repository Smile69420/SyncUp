
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import CalendarView from './CalendarView';
import EventTypeEditor from './EventTypeEditor';
import { schedulingService } from '../services/schedulingService';
import type { EventType, Booking } from '../types';
import Spinner from './ui/Spinner';
import Card from './ui/Card';
import Button from './ui/Button';

const Dashboard: React.FC = () => {
    const [eventTypes, setEventTypes] = useState<EventType[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [selectedEventType, setSelectedEventType] = useState<EventType | null>(null);
    const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);


    const fetchData = async () => {
        setLoading(true);
        try {
            const [types, books] = await Promise.all([
                schedulingService.getEventTypes(),
                schedulingService.getBookings(),
            ]);
            setEventTypes(types);
            setBookings(books.map(b => ({...b, startTime: new Date(b.startTime), endTime: new Date(b.endTime)})));
        } catch (error) {
            console.error("Failed to fetch data:", error);
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        fetchData();
    }, []);

    const handleEdit = (eventType: EventType) => {
        setSelectedEventType(eventType);
        setIsEditorOpen(true);
    };

    const handleAddNew = () => {
        setSelectedEventType(null);
        setIsEditorOpen(true);
    };

    const handleSave = async (eventType: Omit<EventType, 'id' | 'link'> & { id?: string }) => {
        await schedulingService.saveEventType(eventType);
        setIsEditorOpen(false);
        setSelectedEventType(null);
        await fetchData(); // Refresh data
    };
    
    const handleCopyLink = (link: string, id: string) => {
        const fullLink = `${window.location.origin}${window.location.pathname}#${link}`;
        navigator.clipboard.writeText(fullLink).then(() => {
            setCopiedLinkId(id);
            setTimeout(() => setCopiedLinkId(null), 2000);
        });
    };

    if (loading) {
        return <div className="flex justify-center items-center h-96"><Spinner /></div>;
    }

    return (
        <div className="container mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <Button onClick={handleAddNew}>+ Create Event Type</Button>
            </div>
            
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
                                    <Link to={et.link} className="text-sm font-medium text-primary hover:underline">View</Link>
                                    <button onClick={() => handleEdit(et)} className="text-sm font-medium text-gray-500 hover:text-gray-800">Edit</button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </section>
            
            <section>
                <h2 className="text-2xl font-semibold mb-4">Your Schedule</h2>
                <Card>
                    <CalendarView bookings={bookings} eventTypes={eventTypes} />
                </Card>
            </section>

            {isEditorOpen && (
                <EventTypeEditor 
                    eventType={selectedEventType}
                    onClose={() => setIsEditorOpen(false)}
                    onSave={handleSave}
                />
            )}
        </div>
    );
};

export default Dashboard;