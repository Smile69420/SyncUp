import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { EventType, MergedBooking, CalendarViewProps } from '../types';
import {
    format, startOfWeek, endOfWeek, addDays, subDays, eachDayOfInterval, isSameDay, startOfDay, addHours,
    startOfMonth, endOfMonth, isSameMonth, isToday, addMonths, subMonths, getDay,
    getHours, getMinutes, isPast,
    // FIX: Import 'addWeeks' from date-fns to support week navigation.
    addWeeks
} from 'date-fns';
import Button from './ui/Button';

// --- CONFIGURATION ---
const CALENDAR_START_HOUR = 8;
const CALENDAR_END_HOUR = 19;
const HOUR_HEIGHT_PX = 60;
const MONTH_VIEW_MAX_EVENTS = 2;

// FIX: Define the ViewType to be used for calendar state management.
type ViewType = 'day' | 'week' | 'month';

// --- UTILITY & HELPER FUNCTIONS ---
const getOverlappingGroups = (dayBookings: MergedBooking[]) => {
    // ... (This function remains complex, no major changes needed, but ensure it works with the new data)
    if (dayBookings.length === 0) return [];
    const sortedBookings = [...dayBookings].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    const groups: MergedBooking[][] = [];
    let currentGroup: MergedBooking[] = [sortedBookings[0]];

    for (let i = 1; i < sortedBookings.length; i++) {
        const booking = sortedBookings[i];
        // Find the last end time in the current group
        const groupEndTime = Math.max(...currentGroup.map(b => b.endTime.getTime()));
        if (booking.startTime.getTime() < groupEndTime) {
            currentGroup.push(booking);
        } else {
            groups.push(currentGroup);
            currentGroup = [booking];
        }
    }
    groups.push(currentGroup);
    return groups;
};

// Function to determine text color based on background luminance
const getTextColorForBackground = (hexColor: string): string => {
    if (!hexColor) return '#ffffff';
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#333333' : '#ffffff';
};


// --- UI SUB-COMPONENTS ---

const CurrentTimeIndicator: React.FC = () => {
    // ... (No major changes, works as is)
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
        updatePosition();
        const intervalId = window.setInterval(updatePosition, 60000);
        return () => clearInterval(intervalId);
    }, []);

    if (topPosition < 0) return null;

    return (
        <div className="absolute w-full z-20 pointer-events-none" style={{ top: `${topPosition}px` }}>
            <div className="relative h-px bg-red-500">
                <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-red-500 border-2 border-white"></div>
            </div>
        </div>
    );
};

const TimeGrid: React.FC = () => {
    const hours = Array.from({ length: CALENDAR_END_HOUR - CALENDAR_START_HOUR }, (_, i) => i + CALENDAR_START_HOUR);
    return (
        <div className="grid grid-cols-1 col-start-1 col-end-2 row-start-1" style={{ gridTemplateRows: `repeat(${hours.length}, ${HOUR_HEIGHT_PX}px)` }}>
            {hours.map(hour => (
                <div key={`line-${hour}`} className="h-full border-b border-slate-200"></div>
            ))}
        </div>
    );
};

const TimeLabels: React.FC = () => {
    const hours = Array.from({ length: CALENDAR_END_HOUR - CALENDAR_START_HOUR }, (_, i) => i + CALENDAR_START_HOUR);
    return (
        <div className="w-16 text-right pr-2 shrink-0">
            {hours.map(hour => (
                <div key={hour} className="h-[60px] relative text-xs text-slate-400">
                    <span className="absolute -top-2 right-2">{format(addHours(startOfDay(new Date()), hour), 'ha')}</span>
                </div>
            ))}
        </div>
    );
};

const MonthViewPopover: React.FC<{
    state: { day: Date, element: HTMLElement } | null,
    onClose: () => void,
    bookings: MergedBooking[],
    onEventClick: (b: MergedBooking) => void,
    eventTypeMap: Record<string, EventType>
}> = ({ state, onClose, bookings, onEventClick, eventTypeMap }) => {
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);
    
    if (!state) return null;

    const { top, left, width, height } = state.element.getBoundingClientRect();
    const popoverStyle: React.CSSProperties = {
        position: 'absolute',
        top: `${top + height}px`,
        left: `${left + width / 2}px`,
        transform: 'translateX(-50%)',
    };

    const dayBookings = bookings
        .filter(b => isSameDay(b.startTime, state.day))
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    return (
        <div ref={popoverRef} style={popoverStyle} className="fixed z-30 mt-1 w-64 bg-white rounded-lg shadow-2xl border border-slate-200 p-2 animate-fade-in no-print">
            <h3 className="font-semibold text-sm mb-2 px-2">{format(state.day, 'MMM d')}</h3>
            <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1">
                 {dayBookings.map(booking => {
                    const eventType = eventTypeMap[booking.eventTypeId];
                    return (
                        <button 
                            key={booking.id}
                            onClick={() => { onEventClick(booking); onClose(); }}
                            className="w-full text-left text-xs p-2 rounded hover:bg-slate-100"
                        >
                            <div className="flex items-center">
                                <div className="w-2 h-2 rounded-full mr-2 shrink-0" style={{ backgroundColor: eventType?.color || '#64748b' }}></div>
                                <div className="flex-grow">
                                    <p className="font-semibold text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis">{booking.bookerName}</p>
                                    <p className="text-slate-500">{format(booking.startTime, 'p')}</p>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

// --- RENDER LOGIC COMPONENTS ---

const renderBookingsForDayColumn = (day: Date, bookings: MergedBooking[], onEventClick: (b: MergedBooking) => void, eventTypeMap: Record<string, EventType>) => {
    const dayBookings = bookings.filter(b => isSameDay(b.startTime, day));
    const overlappingGroups = getOverlappingGroups(dayBookings);

    return overlappingGroups.flatMap((group) => {
        const groupConflicts = group.map((booking, i) => {
            const conflicts = [i];
            for(let j = i + 1; j < group.length; j++) {
                if(group[j].startTime < booking.endTime) {
                    conflicts.push(j);
                }
            }
            return conflicts;
        });

        return group.map((booking, index) => {
            const eventType = eventTypeMap[booking.eventTypeId];
            if (!eventType) return null;

            const startHour = getHours(booking.startTime);
            const startMinute = getMinutes(booking.startTime);
            const endHour = getHours(booking.endTime);
            const endMinute = getMinutes(booking.endTime);
            
            const top = ((startHour - CALENDAR_START_HOUR) * HOUR_HEIGHT_PX) + (startMinute * (HOUR_HEIGHT_PX / 60));
            const durationMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
            const height = durationMinutes * (HOUR_HEIGHT_PX / 60) - 2; // -2 for a small gap
            
            const maxConflicts = Math.max(...groupConflicts[index].map(i => groupConflicts[i].length));
            const width = 100 / maxConflicts;
            const left = (groupConflicts[index].indexOf(index)) * width;

            const isPastEvent = isPast(booking.endTime);
            const isCompleted = booking.meetingStatus === 'Completed';
            const eventClasses = `absolute rounded p-2 text-xs overflow-hidden cursor-pointer hover:opacity-80 transition-all duration-200 z-10 border-l-4 print-event ${isPastEvent && !isCompleted ? 'opacity-60' : ''}`;
            
            const textColor = getTextColorForBackground(eventType.color);

            return (
                <div
                    key={booking.id}
                    className={eventClasses}
                    style={{
                        backgroundColor: `${eventType.color}20`,
                        borderLeftColor: eventType.color,
                        top: `${top}px`,
                        height: `${height}px`,
                        left: `${left}%`,
                        width: `calc(${width}% - 2px)`,
                        color: isPastEvent ? '#64748b' : '#1e293b',
                        // CSS Vars for printing
                        '--event-color-light': `${eventType.color}20`,
                        '--event-color-dark': eventType.color,
                        '--event-text-color': '#1e293b'
                    } as React.CSSProperties}
                    onClick={() => onEventClick(booking)}
                >
                    <p className="font-bold whitespace-nowrap overflow-hidden text-ellipsis">
                        {isCompleted && '✅ '}
                        {booking.bookerName}
                    </p>
                    <p className="opacity-80 whitespace-nowrap overflow-hidden text-ellipsis">{eventType.name}</p>
                </div>
            );
        });
    });
};

const WeekDayHeader: React.FC<{ day: Date }> = ({ day }) => (
    <div className={`text-center py-2 border-l border-slate-200 ${isToday(day) ? 'bg-blue-50' : ''}`}>
        <p className="text-sm text-slate-500 md:block hidden">{format(day, 'EEEE')}</p>
        <p className="text-sm text-slate-500 md:hidden">{format(day, 'EEE')}</p>
        <p className={`text-lg md:text-2xl font-semibold ${isToday(day) ? 'text-primary' : ''}`}>{format(day, 'd')}</p>
    </div>
);


// --- MAIN VIEW COMPONENTS ---

const DayView: React.FC<{ currentDate: Date, bookings: MergedBooking[], onEventClick: (b: MergedBooking) => void, eventTypeMap: Record<string, EventType> }> = 
({ currentDate, bookings, onEventClick, eventTypeMap }) => {
    const totalGridHeight = (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * HOUR_HEIGHT_PX;
    
    return (
        <div className="flex">
            <TimeLabels />
            <div className="flex-1 relative border-l border-slate-200" style={{ height: `${totalGridHeight}px` }}>
                <TimeGrid />
                <div className="absolute inset-0">
                    {isToday(currentDate) && <CurrentTimeIndicator />}
                    {renderBookingsForDayColumn(currentDate, bookings, onEventClick, eventTypeMap)}
                </div>
            </div>
        </div>
    );
};

const WeekView: React.FC<{ currentDate: Date, bookings: MergedBooking[], onEventClick: (b: MergedBooking) => void, eventTypeMap: Record<string, EventType> }> = 
({ currentDate, bookings, onEventClick, eventTypeMap }) => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
    const totalGridHeight = (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * HOUR_HEIGHT_PX;
    
    return (
        <div className="flex flex-col">
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 bg-white shadow-sm flex border-b border-slate-200">
                <div className="w-16 border-r border-slate-200 shrink-0"></div> {/* Spacer */}
                <div className="grid grid-cols-7 flex-grow">
                    {weekDays.map(day => <WeekDayHeader key={day.toString()} day={day} />)}
                </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex">
                <TimeLabels />
                <div className="flex-1 grid grid-cols-7 relative" style={{ height: `${totalGridHeight}px` }}>
                    <div className="col-span-7 row-start-1 absolute inset-0 pointer-events-none">
                        <TimeGrid />
                    </div>
                    {weekDays.map((day) => (
                        <div key={day.toString()} className="relative border-l border-slate-200">
                             {isToday(day) && <CurrentTimeIndicator />}
                             {renderBookingsForDayColumn(day, bookings, onEventClick, eventTypeMap)}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};


const MonthView: React.FC<{ 
    currentDate: Date, 
    bookings: MergedBooking[], 
    onEventClick: (b: MergedBooking) => void, 
    eventTypeMap: Record<string, EventType>,
    onOpenPopover: (day: Date, element: HTMLElement) => void
}> = ({ currentDate, bookings, onEventClick, eventTypeMap, onOpenPopover }) => {
    const monthStart = startOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: calendarStart, end: addDays(calendarStart, 41) }); // 6 weeks
    const weekDayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
        <div className="flex flex-col h-full">
            <div className="grid grid-cols-7 border-b border-slate-200 sticky top-0 bg-white z-10">
                {weekDayNames.map(day => (
                    <div key={day} className="py-2 text-center text-sm font-semibold text-slate-600">{day}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 grid-rows-6 flex-grow">
                {days.map((day, index) => {
                    const dayBookings = bookings
                        .filter(b => isSameDay(b.startTime, day))
                        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
                    
                    const eventsToShow = dayBookings.slice(0, MONTH_VIEW_MAX_EVENTS);
                    const hiddenEventsCount = dayBookings.length - MONTH_VIEW_MAX_EVENTS;

                    return (
                        <div key={day.toString()} className={`relative border-b border-l border-slate-200 p-1 flex flex-col gap-1 ${!isSameMonth(day, currentDate) ? 'bg-slate-50' : 'bg-white'}`}>
                            <span className={`text-sm self-start mb-1 ${isToday(day) ? 'font-bold text-white bg-primary rounded-full w-6 h-6 flex items-center justify-center' : 'text-slate-700'}`}>
                                {format(day, 'd')}
                            </span>
                            <div className="flex-grow overflow-y-auto space-y-1">
                                {eventsToShow.map(booking => {
                                    const eventType = eventTypeMap[booking.eventTypeId];
                                    const isCompleted = booking.meetingStatus === 'Completed';
                                    return (
                                        <button 
                                            key={booking.id}
                                            onClick={() => onEventClick(booking)}
                                            className={`w-full text-left text-xs p-1 rounded text-white hover:opacity-80 truncate print-month-event ${isPast(booking.endTime) && !isCompleted ? 'opacity-60' : ''}`}
                                            style={{ 
                                                backgroundColor: eventType?.color || '#64748b',
                                                '--event-color-dark': eventType?.color || '#64748b'
                                            } as React.CSSProperties}
                                            title={`${format(booking.startTime, 'p')} - ${booking.bookerName}`}
                                        >
                                            <span className="font-semibold whitespace-nowrap overflow-hidden text-ellipsis block">{format(booking.startTime, 'p')}</span>
                                            <span className="whitespace-nowrap overflow-hidden text-ellipsis block">
                                                {isCompleted && '✅ '}
                                                {booking.bookerName}
                                            </span>
                                        </button>
                                    );
                                })}
                                {hiddenEventsCount > 0 && (
                                    <button 
                                      className="text-xs font-semibold text-slate-600 hover:underline w-full text-left p-1"
                                      onClick={(e) => onOpenPopover(day, e.currentTarget)}
                                    >
                                        + {hiddenEventsCount} more
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


// --- MAIN CALENDAR COMPONENT ---

const CalendarView: React.FC<CalendarViewProps> = ({ bookings, eventTypes, onEventClick }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<ViewType>('week');
    const [popoverState, setPopoverState] = useState<{ day: Date; element: HTMLElement } | null>(null);

    const eventTypeMap = useMemo(() =>
        eventTypes.reduce((acc, et) => ({...acc, [et.id]: et }), {} as Record<string, EventType>), 
        [eventTypes]
    );

    const navigate = (direction: 'prev' | 'next' | 'today') => {
        if (direction === 'today') return setCurrentDate(new Date());
        const modifier = direction === 'prev' ? -1 : 1;
        if (view === 'month') setCurrentDate(addMonths(currentDate, modifier));
        if (view === 'week') setCurrentDate(addWeeks(currentDate, modifier));
        if (view === 'day') setCurrentDate(addDays(currentDate, modifier));
    };

    const handlePrint = () => window.print();

    const title = useMemo(() => {
        if (view === 'month') return format(currentDate, 'MMMM yyyy');
        if (view === 'week') {
            const start = startOfWeek(currentDate, { weekStartsOn: 1 });
            const end = endOfWeek(currentDate, { weekStartsOn: 1 });
            return isSameMonth(start, end)
                ? `${format(start, 'MMM d')} - ${format(end, 'd, yyyy')}`
                : `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
        }
        return format(currentDate, 'EEEE, MMM d, yyyy');
    }, [view, currentDate]);
    
    const viewOptions: { value: ViewType, label: string }[] = [
        { value: 'day', label: 'Day' },
        { value: 'week', label: 'Week' },
        { value: 'month', label: 'Month' },
    ];

    return (
        <div className="flex flex-col h-full printable-area">
             <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-slate-200 no-print">
                <div className="flex items-center gap-4">
                    <div className="flex items-center rounded-md border bg-white shadow-sm">
                        <button onClick={() => navigate('prev')} className="p-2 text-slate-500 hover:bg-slate-100 rounded-l-md border-r"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
                        <button onClick={() => navigate('today')} className="px-4 py-2 text-sm font-medium hover:bg-slate-100 border-r">Today</button>
                        <button onClick={() => navigate('next')} className="p-2 text-slate-500 hover:bg-slate-100 rounded-r-md"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
                    </div>
                    <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-slate-100 p-1 rounded-lg">
                       {viewOptions.map(option => (
                            <button 
                                key={option.value}
                                onClick={() => setView(option.value)}
                                className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${view === option.value ? 'bg-white shadow' : 'text-slate-600 hover:bg-white/60'}`}
                            >{option.label}</button>
                       ))}
                    </div>
                     <Button variant="outline" size="sm" onClick={handlePrint}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
                        <span className="ml-2 hidden sm:inline">Print</span>
                    </Button>
                </div>
            </div>
            
            <div className="flex-grow overflow-auto custom-scrollbar">
                {view === 'week' && <WeekView currentDate={currentDate} bookings={bookings} onEventClick={onEventClick} eventTypeMap={eventTypeMap} />}
                {view === 'month' && <MonthView currentDate={currentDate} bookings={bookings} onEventClick={onEventClick} eventTypeMap={eventTypeMap} onOpenPopover={(day, el) => setPopoverState({day, element: el})} />}
                {view === 'day' && <DayView currentDate={currentDate} bookings={bookings} onEventClick={onEventClick} eventTypeMap={eventTypeMap} />}
            </div>
            
            <MonthViewPopover 
                state={popoverState}
                onClose={() => setPopoverState(null)}
                bookings={bookings}
                onEventClick={onEventClick}
                eventTypeMap={eventTypeMap}
            />
        </div>
    );
};

export default CalendarView;