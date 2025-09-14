import React, { useState, useMemo } from 'react';
import type { Booking, EventType } from '../types';
import {
    format, startOfWeek, endOfWeek, addDays, subDays, eachDayOfInterval, isSameDay, startOfDay, addHours,
    startOfMonth, endOfMonth, isSameMonth, isToday, addMonths, subMonths, addWeeks, subWeeks, getDay,
} from 'date-fns';
import Button from './ui/Button';
import BookingPreviewModal from './BookingPreviewModal';

interface CalendarViewProps {
    bookings: Booking[];
    eventTypes: EventType[];
}

type ViewType = 'month' | 'week' | 'day';

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

        // Assuming calendar starts at 6 AM
        const top = (startHour - 6) * 60 + startMinute;
        const height = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);

        return (
            <div
                key={booking.id}
                className="absolute rounded-lg p-2 text-white text-xs overflow-hidden cursor-pointer hover:opacity-80 transition-opacity z-10"
                style={{
                    backgroundColor: eventType.color,
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
const TimeGrid: React.FC<{ dayCount: number }> = ({ dayCount }) => {
    const hours = Array.from({ length: 18 }, (_, i) => i + 6); // 6 AM to 11 PM

    return (
        <div className="grid grid-cols-1" style={{ gridTemplateRows: 'repeat(18, 60px)' }}>
            {/* Time labels column */}
            <div className="col-start-1 col-end-2 row-start-1" style={{ gridRowEnd: hours.length + 1 }}>
                {hours.map(hour => (
                    <div key={hour} className="h-[60px] relative text-right pr-2 text-xs text-gray-400">
                        <span className="absolute -top-3 right-2">{format(addHours(startOfDay(new Date()), hour), 'ha')}</span>
                    </div>
                ))}
            </div>

            {/* Grid lines */}
            <div className="col-start-2 row-start-1 grid grid-cols-1 divide-y divide-gray-200" style={{ gridRowEnd: hours.length + 1, gridColumnEnd: dayCount + 2 }}>
                {hours.map(hour => (
                    <div key={`line-${hour}`} className="h-[60px]"></div>
                ))}
            </div>
        </div>
    );
};


const WeekViewComponent: React.FC<{ currentDate: Date, bookings: Booking[], onEventClick: (b: Booking) => void, eventTypeMap: Record<string, EventType> }> = 
({ currentDate, bookings, onEventClick, eventTypeMap }) => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
    
    return (
        <div className="relative">
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 bg-white grid grid-cols-[4rem_repeat(7,minmax(0,1fr))] border-b border-gray-200">
                <div className="w-16 border-r"></div> {/* Spacer for time column */}
                {weekDays.map(day => (
                    <div key={day.toString()} className={`text-center py-2 border-l border-gray-200 ${isToday(day) ? 'bg-blue-50' : ''}`}>
                        <p className="text-sm text-gray-500">{format(day, 'EEE')}</p>
                        <p className={`text-lg font-semibold ${isToday(day) ? 'text-primary' : ''}`}>{format(day, 'd')}</p>
                    </div>
                ))}
            </div>

            {/* Scrollable Body */}
            <div className="grid grid-cols-[4rem_repeat(7,minmax(0,1fr))]">
                 {/* Background Grid */}
                <div className="col-start-1 col-end-9 row-start-1">
                    <TimeGrid dayCount={7} />
                </div>
                
                {/* Event Columns */}
                {weekDays.map((day) => (
                    <div key={day.toString()} className="relative border-l border-gray-200 h-[1080px]">
                        {renderBookingsForDayColumn(day, bookings, onEventClick, eventTypeMap)}
                    </div>
                ))}
            </div>
        </div>
    );
};

const DayViewComponent: React.FC<{ currentDate: Date, bookings: Booking[], onEventClick: (b: Booking) => void, eventTypeMap: Record<string, EventType> }> = 
({ currentDate, bookings, onEventClick, eventTypeMap }) => {
    return (
        <div className="relative">
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 bg-white grid grid-cols-[4rem_1fr] border-b border-gray-200">
                <div className="w-16 border-r"></div> {/* Spacer */}
                <div className={`text-center py-2 border-l border-gray-200 ${isToday(currentDate) ? 'bg-blue-50' : ''}`}>
                    {/* The date is already in the main header, so this can be simpler or removed */}
                </div>
            </div>

            {/* Scrollable Body */}
            <div className="grid grid-cols-[4rem_1fr]">
                 {/* Background Grid */}
                <div className="col-start-1 col-end-3 row-start-1">
                    <TimeGrid dayCount={1} />
                </div>
                
                {/* Event Column */}
                <div className="relative border-l border-gray-200 h-[1080px]">
                    {renderBookingsForDayColumn(currentDate, bookings, onEventClick, eventTypeMap)}
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