import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Booking, EventType } from '../types';
import {
    format, startOfWeek, endOfWeek, addDays, subDays, eachDayOfInterval, isSameDay, startOfDay, addHours,
    startOfMonth, endOfMonth, isSameMonth, isToday, addMonths, subMonths, addWeeks, subWeeks, getDay,
    getHours, getMinutes
} from 'date-fns';
import Button from './ui/Button';
import BookingPreviewModal from './BookingPreviewModal';

interface CalendarViewProps {
    bookings: Booking[];
    eventTypes: EventType[];
}

type ViewType = 'month' | 'week' | 'day';

const CALENDAR_START_HOUR = 9;
const CALENDAR_END_HOUR = 18;
const HOUR_HEIGHT_PX = 60; // Each hour is 60px tall

const CurrentTimeIndicator: React.FC = () => {
    const [topPosition, setTopPosition] = useState(0);
    const intervalRef = useRef<number | null>(null);

    const updatePosition = () => {
        const now = new Date();
        const hour = getHours(now);
        const minutes = getMinutes(now);

        if (hour >= CALENDAR_START_HOUR && hour < CALENDAR_END_HOUR) {
            const minutesSinceStart = (hour - CALENDAR_START_HOUR) * 60 + minutes;
            setTopPosition(minutesSinceStart * (HOUR_HEIGHT_PX / 60));
        } else {
            setTopPosition(-1); // Hide if outside business hours
        }
    };

    useEffect(() => {
        updatePosition(); // Initial position
        intervalRef.current = window.setInterval(updatePosition, 60000); // Update every minute

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    if (topPosition < 0) return null;

    return (
        <div className="absolute w-full z-20" style={{ top: `${topPosition}px` }}>
            <div className="relative h-px bg-red-500">
                <div className="absolute -left-2 -top-2 w-4 h-4 rounded-full bg-red-500"></div>
            </div>
        </div>
    );
};


const CalendarView: React.FC<CalendarViewProps> = ({ bookings, eventTypes }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<ViewType>('week');
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

    const eventTypeMap = useMemo(() =>
        eventTypes.reduce((acc, et) => {
            acc[et.id] = et;
            return acc;
        }, {} as Record<string, EventType>), [eventTypes]);

    const handlePrev = () => {
        if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
        if (view === 'week') setCurrentDate(subWeeks(currentDate, 1));
        if (view === 'day') setCurrentDate(subDays(currentDate, 1));
    };

    const handleNext = () => {
        if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
        if (view === 'week') setCurrentDate(addWeeks(currentDate, 1));
        if (view === 'day') setCurrentDate(addDays(currentDate, 1));
    };

    const handleToday = () => {
        setCurrentDate(new Date());
    };
    
    const handleEventClick = (booking: Booking) => {
        setSelectedBooking(booking);
    };
    
    const handlePrint = () => {
        window.print();
    };


    const Header = () => {
        let title = '';
        if (view === 'month') title = format(currentDate, 'MMMM yyyy');
        if (view === 'week') {
            const start = startOfWeek(currentDate, { weekStartsOn: 1 });
            const end = endOfWeek(currentDate, { weekStartsOn: 1 });
            if (isSameMonth(start, end)) {
                title = `${format(start, 'MMM d')} - ${format(end, 'd, yyyy')}`;
            } else {
                 title = `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
            }
        }
        if (view === 'day') title = format(currentDate, 'EEEE, MMM d, yyyy');
        
        const viewOptions: { value: ViewType, label: string }[] = [
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
        ];

        return (
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="flex items-center gap-4">
                    <div className="flex items-center rounded-md border no-print">
                        <button onClick={handlePrev} className="p-2 text-gray-500 hover:bg-gray-100 rounded-l-md border-r">&lt;</button>
                        <button onClick={handleToday} className="px-4 py-2 text-sm font-medium hover:bg-gray-100 border-r">Today</button>
                        <button onClick={handleNext} className="p-2 text-gray-500 hover:bg-gray-100 rounded-r-md">&gt;</button>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-gray-100 p-1 rounded-md no-print">
                       {viewOptions.map(option => (
                            <button 
                                key={option.value}
                                onClick={() => setView(option.value)}
                                className={`px-3 py-1 text-sm font-medium rounded-md ${view === option.value ? 'bg-white shadow' : 'text-gray-600 hover:bg-white/60'}`}
                            >{option.label}</button>
                       ))}
                    </div>
                     <Button variant="outline" size="sm" onClick={handlePrint} className="no-print">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
                        <span className="ml-2">Print</span>
                    </Button>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full printable-area">
            <Header />
            <div className="flex-grow overflow-auto custom-scrollbar">
                {view === 'week' && <WeekViewComponent currentDate={currentDate} bookings={bookings} onEventClick={handleEventClick} eventTypeMap={eventTypeMap} />}
                {view === 'month' && <MonthViewComponent currentDate={currentDate} bookings={bookings} onEventClick={handleEventClick} eventTypeMap={eventTypeMap} />}
                {view === 'day' && <DayViewComponent currentDate={currentDate} bookings={bookings} onEventClick={handleEventClick} eventTypeMap={eventTypeMap} />}
            </div>
            <BookingPreviewModal
                booking={selectedBooking}
                eventType={selectedBooking ? eventTypeMap[selectedBooking.eventTypeId] : undefined}
                onClose={() => setSelectedBooking(null)}
            />
        </div>
    );
};

// --- HELPER FUNCTIONS FOR RENDERING ---
const getOverlappingGroups = (dayBookings: Booking[]) => {
    if (dayBookings.length === 0) return [];
    const sortedBookings = [...dayBookings].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    const groups: Booking[][] = [];
    let currentGroup: Booking[] = [sortedBookings[0]];

    for (let i = 1; i < sortedBookings.length; i++) {
        const booking = sortedBookings[i];
        const lastInGroup = currentGroup[currentGroup.length - 1];
        if (booking.startTime < lastInGroup.endTime) {
            currentGroup.push(booking);
        } else {
            groups.push(currentGroup);
            currentGroup = [booking];
        }
    }
    groups.push(currentGroup);
    return groups;
};

const renderBookingsForDayColumn = (day: Date, bookings: Booking[], onEventClick: (b: Booking) => void, eventTypeMap: Record<string, EventType>) => {
    const dayBookings = bookings.filter(b => isSameDay(b.startTime, day));
    const overlappingGroups = getOverlappingGroups(dayBookings);

    const positionedBookings = overlappingGroups.flatMap(group => {
        const groupSize = group.length;
        return group.map((booking, index) => ({
            ...booking,
            width: 100 / groupSize,
            left: (100 / groupSize) * index,
        }));
    });

    return positionedBookings.map((booking) => {
        const eventType = eventTypeMap[booking.eventTypeId];
        if (!eventType) return null;

        const startHour = booking.startTime.getHours();
        const startMinute = booking.startTime.getMinutes();
        const endHour = booking.endTime.getHours();
        const endMinute = booking.endTime.getMinutes();
        
        const top = ((startHour - CALENDAR_START_HOUR) * HOUR_HEIGHT_PX) + (startMinute * (HOUR_HEIGHT_PX / 60));
        const durationMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
        const height = durationMinutes * (HOUR_HEIGHT_PX / 60);

        return (
            <div
                key={booking.id}
                className="absolute rounded-lg p-2 text-white text-xs overflow-hidden cursor-pointer hover:opacity-80 transition-opacity z-10 border"
                style={{
                    backgroundColor: eventType.color,
                    borderColor: `${eventType.color}dd`,
                    top: `${top}px`,
                    height: `${height}px`,
                    left: `${booking.left}%`,
                    width: `calc(${booking.width}% - 2px)`,
                    marginLeft: '1px'
                }}
                onClick={() => onEventClick(booking)}
            >
                <p className="font-bold whitespace-nowrap overflow-hidden text-ellipsis">{booking.bookerName}</p>
                <p className="text-xs opacity-90 whitespace-nowrap overflow-hidden text-ellipsis">{eventType.name}</p>
            </div>
        );
    });
};

// --- VIEW COMPONENTS ---
const TimeGrid: React.FC = () => {
    const hours = Array.from({ length: CALENDAR_END_HOUR - CALENDAR_START_HOUR }, (_, i) => i + CALENDAR_START_HOUR);

    return (
        <div className="grid grid-cols-1" style={{ gridTemplateRows: `repeat(${hours.length}, ${HOUR_HEIGHT_PX}px)` }}>
            {hours.map(hour => (
                <div key={`line-${hour}`} className="h-full border-b border-gray-200"></div>
            ))}
        </div>
    );
};

const TimeLabels: React.FC = () => {
    const hours = Array.from({ length: CALENDAR_END_HOUR - CALENDAR_START_HOUR }, (_, i) => i + CALENDAR_START_HOUR);

    return (
        <div className="w-16 text-right pr-2">
            {hours.map(hour => (
                <div key={hour} className="h-[60px] relative text-xs text-gray-400">
                    <span className="absolute -top-2 right-2">{format(addHours(startOfDay(new Date()), hour), 'ha')}</span>
                </div>
            ))}
        </div>
    );
};


const WeekViewComponent: React.FC<{ currentDate: Date, bookings: Booking[], onEventClick: (b: Booking) => void, eventTypeMap: Record<string, EventType> }> = 
({ currentDate, bookings, onEventClick, eventTypeMap }) => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
    const totalGridHeight = (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * HOUR_HEIGHT_PX;
    
    return (
        <div className="flex flex-col">
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 bg-white shadow-sm flex border-b border-gray-200">
                <div className="w-16 border-r border-gray-200"></div> {/* Spacer for time column */}
                {weekDays.map(day => (
                    <div key={day.toString()} className={`flex-1 text-center py-2 border-l border-gray-200 ${isToday(day) ? 'bg-blue-50' : ''}`}>
                        <p className="text-sm text-gray-500">{format(day, 'EEE')}</p>
                        <p className={`text-lg font-semibold ${isToday(day) ? 'text-primary' : ''}`}>{format(day, 'd')}</p>
                    </div>
                ))}
            </div>

            {/* Scrollable Body */}
            <div className="flex">
                <TimeLabels />
                <div className="flex-1 grid grid-cols-7 relative border-l border-gray-200" style={{ height: `${totalGridHeight}px` }}>
                    <div className="col-span-7 row-start-1 absolute inset-0">
                        <TimeGrid />
                    </div>
                    {weekDays.map((day) => (
                        <div key={day.toString()} className="relative border-l border-gray-200">
                             {isToday(day) && <CurrentTimeIndicator />}
                             {renderBookingsForDayColumn(day, bookings, onEventClick, eventTypeMap)}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const DayViewComponent: React.FC<{ currentDate: Date, bookings: Booking[], onEventClick: (b: Booking) => void, eventTypeMap: Record<string, EventType> }> = 
({ currentDate, bookings, onEventClick, eventTypeMap }) => {
    const totalGridHeight = (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * HOUR_HEIGHT_PX;
    
    return (
        <div className="flex flex-col">
            {/* Header is part of the main component, so no need for a sticky header here */}
            <div className="flex">
                <TimeLabels />
                <div className="flex-1 relative border-l border-gray-200" style={{ height: `${totalGridHeight}px` }}>
                    <TimeGrid />
                    <div className="absolute inset-0">
                        {isToday(currentDate) && <CurrentTimeIndicator />}
                        {renderBookingsForDayColumn(currentDate, bookings, onEventClick, eventTypeMap)}
                    </div>
                </div>
            </div>
        </div>
    );
};

const MonthViewComponent: React.FC<{ currentDate: Date, bookings: Booking[], onEventClick: (b: Booking) => void, eventTypeMap: Record<string, EventType> }> = 
({ currentDate, bookings, onEventClick, eventTypeMap }) => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    const weekDayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
        <div className="flex flex-col h-full">
            <div className="grid grid-cols-7 border-b border-gray-200">
                {weekDayNames.map(day => (
                    <div key={day} className="py-2 text-center text-sm font-semibold text-gray-600">{day}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 grid-rows-5 flex-grow">
                {days.map(day => {
                    const dayBookings = bookings
                        .filter(b => isSameDay(b.startTime, day))
                        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
                    
                    return (
                        <div key={day.toString()} className={`relative border-b border-l border-gray-200 p-1 flex flex-col gap-1 ${!isSameMonth(day, currentDate) ? 'bg-gray-50' : ''}`}>
                            <span className={`text-sm ${isToday(day) ? 'font-bold text-white bg-primary rounded-full w-6 h-6 flex items-center justify-center' : 'text-gray-700'}`}>
                                {format(day, 'd')}
                            </span>
                            <div className="flex-grow overflow-y-auto custom-scrollbar">
                                {dayBookings.map(booking => {
                                    const eventType = eventTypeMap[booking.eventTypeId];
                                    return (
                                        <button 
                                            key={booking.id}
                                            onClick={() => onEventClick(booking)}
                                            className="w-full text-left text-xs p-1 rounded mb-1 text-white hover:opacity-80"
                                            style={{ backgroundColor: eventType?.color || '#64748b' }}
                                        >
                                            <span className="font-semibold whitespace-nowrap overflow-hidden text-ellipsis block">{format(booking.startTime, 'p')}</span>
                                            <span className="whitespace-nowrap overflow-hidden text-ellipsis block">{booking.bookerName}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


export default CalendarView;