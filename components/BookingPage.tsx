
import React, { useState, useEffect, useMemo } from 'react';
// FIX: Changed to namespace import to fix module resolution issues.
import * as ReactRouterDOM from 'react-router-dom';
import { schedulingService } from '../services/schedulingService';
import type { EventType, Booking, TimeSlot, FormField } from '../types';
import Spinner from './ui/Spinner';
import Button from './ui/Button';
import { 
    format, addDays, startOfDay, addMinutes, isBefore, isSameDay, setHours, setMinutes,
    startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday,
    addMonths, subMonths, isAfter, subMinutes
} from 'date-fns';

// --- Sub-components defined outside the main component to prevent re-creation on render ---

const LeftPanel: React.FC<{ eventType: EventType, timeZone: string }> = ({ eventType, timeZone }) => (
    <div className="md:col-span-1 md:border-r md:pr-8 space-y-4">
        {eventType.imageUrl && (
            <div className="w-full h-40 bg-slate-100 rounded-lg overflow-hidden mb-4">
                <img src={eventType.imageUrl} alt={eventType.name} className="w-full h-full object-cover" />
            </div>
        )}
        <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: eventType.color }}></div>
        <h1 className="text-2xl font-bold">{eventType.name}</h1>
        <p className="text-slate-500 font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block mr-2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 6v6l4 2"/></svg>
            {eventType.duration} minutes
        </p>
        <p className="text-slate-600">{eventType.description}</p>
        <p className="text-sm text-slate-500 pt-4 border-t">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block mr-2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            Timezone: {timeZone}
        </p>
    </div>
);

const Calendar: React.FC<{
    currentMonth: Date;
    setCurrentMonth: (date: Date) => void;
    selectedDate: Date | null;
    setSelectedDate: (date: Date) => void;
    eventType: EventType;
}> = ({ currentMonth, setCurrentMonth, selectedDate, setSelectedDate, eventType }) => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 rounded-full hover:bg-slate-100">&lt;</button>
                <h3 className="font-semibold text-lg">{format(currentMonth, 'MMMM yyyy')}</h3>
                <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-full hover:bg-slate-100">&gt;</button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-sm text-slate-500 mb-2">
                {weekDays.map(day => <div key={day}>{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {days.map(day => {
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const isPast = isBefore(day, startOfDay(new Date())) && !isToday(day);
                    const isCurrentMonth = isSameMonth(day, currentMonth);

                    const lastBookableDate = eventType.bookingHorizonDays
                        ? addDays(startOfDay(new Date()), eventType.bookingHorizonDays)
                        : null;
                    const isBeyondHorizon = lastBookableDate ? isAfter(day, lastBookableDate) : false;

                    const dayStr = format(day, 'yyyy-MM-dd');
                    const dateOverride = eventType.unavailableDates?.find(d => d.date === dayStr);
                    const isDayFullyBlocked = dateOverride && dateOverride.timeRanges.length === 0;
                    const hasAvailability = eventType.availability.some(rule => rule.dayOfWeek === day.getDay()) && !isDayFullyBlocked;

                    const isDisabled = isPast || !isCurrentMonth || !hasAvailability || isBeyondHorizon;
                    
                    let dayClassName = 'w-10 h-10 flex items-center justify-center rounded-full transition-colors font-medium';
                    
                    if (isDisabled) {
                        dayClassName += isCurrentMonth ? ' text-slate-400 cursor-not-allowed' : ' text-slate-300 cursor-not-allowed';
                    } else {
                        dayClassName += ' bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer';
                    }
                    
                    if (isSelected) {
                         dayClassName = 'w-10 h-10 flex items-center justify-center rounded-full transition-colors font-medium bg-primary text-white hover:bg-primary/90';
                    }
                    
                    if (isToday(day) && !isSelected) {
                        dayClassName += ' ring-2 ring-primary';
                    }

                    return (
                         <div key={day.toString()} className="flex justify-center items-center">
                            <button
                                disabled={isDisabled}
                                onClick={() => setSelectedDate(day)}
                                className={dayClassName}
                            >
                                {format(day, 'd')}
                            </button>
                         </div>
                    )
                })}
            </div>
        </div>
    );
};

const DateTimeSelector: React.FC<{
    currentMonth: Date;
    setCurrentMonth: (date: Date) => void;
    selectedDate: Date | null;
    setSelectedDate: (date: Date) => void;
    eventType: EventType;
    availableSlots: TimeSlot[];
    onSlotSelect: (slot: Date) => void;
}> = ({ currentMonth, setCurrentMonth, selectedDate, setSelectedDate, eventType, availableSlots, onSlotSelect }) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[400px]">
        <div>
            <h2 className="text-xl font-semibold mb-4">Select a Date</h2>
            <Calendar
                currentMonth={currentMonth}
                setCurrentMonth={setCurrentMonth}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                eventType={eventType}
            />
        </div>
        <div className="relative">
            {selectedDate && (
                <>
                    <h2 className="text-xl font-semibold mb-4">{format(selectedDate, 'EEEE, LLL d')}</h2>
                    <div className="grid grid-cols-2 gap-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                        {availableSlots.length > 0 ? (
                            availableSlots.map(slot => (
                                <Button
                                    key={slot.startTime.toISOString()}
                                    variant="outline"
                                    onClick={() => onSlotSelect(slot.startTime)}
                                >
                                    {format(slot.startTime, 'p')}
                                </Button>
                            ))
                        ) : (
                            <p className="col-span-2 text-center text-slate-500 mt-8">No available slots for this day.</p>
                        )}
                    </div>
                </>
            )}
        </div>
    </div>
);


interface BookingFormProps {
    eventType: EventType;
    selectedSlot: Date;
    name: string;
    onNameChange: (val: string) => void;
    email: string;
    onEmailChange: (val: string) => void;
    phone: string;
    onPhoneChange: (val: string) => void;
    customAnswers: { [key: string]: string };
    onCustomAnswerChange: (fieldId: string, value: string | boolean) => void;
    formErrors: { [key: string]: string };
    isBooking: boolean;
    onConfirm: () => void;
    onBack: () => void;
}

const BookingForm: React.FC<BookingFormProps> = ({
    eventType,
    selectedSlot,
    name,
    onNameChange,
    email,
    onEmailChange,
    phone,
    onPhoneChange,
    customAnswers,
    onCustomAnswerChange,
    formErrors,
    isBooking,
    onConfirm,
    onBack,
}) => {
    const renderFormField = (field: FormField) => {
        const commonClasses = `mt-1 block w-full px-3 py-2 bg-white border ${formErrors[field.id] ? 'border-red-500' : 'border-slate-300'} rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm text-slate-900`;
        switch (field.type) {
            case 'textarea':
                return <textarea id={field.id} value={customAnswers[field.id]} onChange={e => onCustomAnswerChange(field.id, e.target.value)} rows={3} className={commonClasses} />;
            case 'select':
                return (
                    <select id={field.id} value={customAnswers[field.id]} onChange={e => onCustomAnswerChange(field.id, e.target.value)} className={commonClasses}>
                        <option value="">Select an option</option>
                        {field.options?.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                );
            case 'radio':
                return (
                    <div className={`mt-2 p-3 rounded-md border bg-slate-50 ${formErrors[field.id] ? 'border-red-500' : 'border-slate-200'}`}>
                        {field.options?.map(option => (
                            <div key={option} className="flex items-center my-1">
                                <input type="radio" id={`${field.id}-${option}`} name={field.id} value={option} checked={customAnswers[field.id] === option} onChange={e => onCustomAnswerChange(field.id, e.target.value)} className="h-4 w-4 text-primary focus:ring-primary border-slate-300"/>
                                <label htmlFor={`${field.id}-${option}`} className="ml-2 block text-sm text-slate-900">{option}</label>
                            </div>
                        ))}
                    </div>
                );
             case 'checkbox':
                return (
                    <div className="flex items-center mt-2">
                        <input type="checkbox" id={field.id} checked={customAnswers[field.id] === 'true'} onChange={e => onCustomAnswerChange(field.id, e.target.checked)} className={`h-4 w-4 text-primary focus:ring-primary ${formErrors[field.id] ? 'border-red-500' : 'border-slate-300'} rounded`} />
                        <label htmlFor={field.id} className="ml-2 block text-sm text-slate-900">{field.label} {field.required && '*'}</label>
                    </div>
                );
            case 'text':
            case 'email':
            default:
                return <input type={field.type} id={field.id} value={customAnswers[field.id]} onChange={e => onCustomAnswerChange(field.id, e.target.value)} className={commonClasses} />;
        }
    };

    return (
        <div>
            <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <h3 className="font-semibold text-slate-800">Selected Time:</h3>
                <p className="text-primary font-bold text-lg">{format(selectedSlot, 'PPPP p')}</p>
            </div>
            <h2 className="text-xl font-semibold">Enter Your Details</h2>
            <div className="space-y-4 mt-4">
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-slate-700">Name *</label>
                    <input type="text" id="name" value={name} onChange={e => onNameChange(e.target.value)} className={`mt-1 block w-full px-3 py-2 bg-white border ${formErrors.name ? 'border-red-500' : 'border-slate-300'} rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm text-slate-900`}/>
                    {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
                </div>
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email *</label>
                    <input type="email" id="email" value={email} onChange={e => onEmailChange(e.target.value)} className={`mt-1 block w-full px-3 py-2 bg-white border ${formErrors.email ? 'border-red-500' : 'border-slate-300'} rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm text-slate-900`}/>
                    {formErrors.email && <p className="text-xs text-red-500 mt-1">{formErrors.email}</p>}
                </div>
                <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-slate-700">Phone Number *</label>
                    <input type="tel" id="phone" value={phone} onChange={e => onPhoneChange(e.target.value)} className={`mt-1 block w-full px-3 py-2 bg-white border ${formErrors.phone ? 'border-red-500' : 'border-slate-300'} rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm text-slate-900`}/>
                    {formErrors.phone && <p className="text-xs text-red-500 mt-1">{formErrors.phone}</p>}
                </div>
                {eventType.customFormFields.map(field => (
                    <div key={field.id}>
                        {field.type !== 'checkbox' && (
                             <label htmlFor={field.id} className="block text-sm font-medium text-slate-700">{field.label} {field.required && '*'}</label>
                        )}
                       {renderFormField(field)}
                        {formErrors[field.id] && <p className="text-xs text-red-500 mt-1">{formErrors[field.id]}</p>}
                    </div>
                ))}
                <div className="flex items-center space-x-4 pt-2">
                     <Button onClick={onConfirm} disabled={isBooking} className="w-full">
                        {isBooking ? <Spinner size="sm" /> : 'Confirm Booking'}
                    </Button>
                     <Button variant="outline" onClick={onBack} className="w-full">Back</Button>
                </div>
            </div>
        </div>
    );
};


const BookingPage: React.FC = () => {
    const { eventTypeId } = ReactRouterDOM.useParams<{ eventTypeId: string }>();
    const navigate = ReactRouterDOM.useNavigate();

    const [eventType, setEventType] = useState<EventType | null>(null);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
    const [view, setView] = useState<'date' | 'form'>('date');
    
    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [customAnswers, setCustomAnswers] = useState<{ [key: string]: string }>({});
    const [isBooking, setIsBooking] = useState(false);
    const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        const fetchData = async () => {
            if (!eventTypeId) return;
            setLoading(true);
            try {
                const [type, allBookings] = await Promise.all([
                    schedulingService.getEventTypeById(eventTypeId),
                    schedulingService.getBookings()
                ]);
                if (type) {
                    setEventType(type);
                    // BUG FIX: Use ALL bookings to determine availability, not just for this event type.
                    // Any booking makes the user unavailable for all event types at that time.
                    setBookings(allBookings.map(b => ({...b, startTime: new Date(b.startTime), endTime: new Date(b.endTime)})));
                    const initialAnswers: { [key: string]: string } = {};
                    type.customFormFields.forEach(field => {
                        initialAnswers[field.id] = field.type === 'checkbox' ? 'false' : '';
                    });
                    setCustomAnswers(initialAnswers);
                }
            } catch (error) {
                console.error("Failed to fetch booking page data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [eventTypeId]);
    
    // Effect to update meta tags for rich link previews
    useEffect(() => {
        if (eventType) {
            document.title = eventType.name;
            document.querySelector('meta[property="og:title"]')?.setAttribute('content', eventType.name);
            document.querySelector('meta[property="og:description"]')?.setAttribute('content', eventType.description);
            document.querySelector('meta[property="og:url"]')?.setAttribute('content', window.location.href);
            if(eventType.imageUrl) {
                 document.querySelector('meta[property="og:image"]')?.setAttribute('content', eventType.imageUrl);
            }
        }
        
        // Cleanup function to reset meta tags on component unmount
        return () => {
            document.title = 'SyncUp: Team Scheduler';
            document.querySelector('meta[property="og:title"]')?.setAttribute('content', 'SyncUp: Team Scheduler');
            document.querySelector('meta[property="og:description"]')?.setAttribute('content', 'A modern scheduling application for seamless team coordination.');
            document.querySelector('meta[property="og:image"]')?.setAttribute('content', '');
            document.querySelector('meta[property="og:url"]')?.setAttribute('content', '');
        }
    }, [eventType]);

    const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

    const availableSlots = useMemo((): TimeSlot[] => {
        if (!eventType || !selectedDate) return [];

        const dayOfWeek = selectedDate.getDay();
        const earliestBookableTime = addMinutes(new Date(), eventType.minimumSchedulingNotice || 0);

        // Check for date-specific overrides first
        const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
        const dateOverride = eventType.unavailableDates?.find(d => d.date === selectedDateStr);
        if (dateOverride && dateOverride.timeRanges.length === 0) {
            return []; // Entire day is blocked
        }

        const availabilityRule = eventType.availability.find(rule => rule.dayOfWeek === dayOfWeek);
        if (!availabilityRule) return [];

        const slots: TimeSlot[] = [];
        const duration = eventType.duration;
        const bufferBefore = eventType.bufferBefore || 0;
        const bufferAfter = eventType.bufferAfter || 0;

        // Combine weekly unavailability with date-specific unavailability
        const dayUnavailability = eventType.unavailability?.filter(u => u.dayOfWeek === dayOfWeek) || [];
        const unavailabilityIntervals = dayUnavailability.map(u => {
            const [startH, startM] = u.startTime.split(':').map(Number);
            const [endH, endM] = u.endTime.split(':').map(Number);
            return {
                start: setMinutes(setHours(startOfDay(selectedDate), startH), startM),
                end: setMinutes(setHours(startOfDay(selectedDate), endH), endM)
            };
        });
        if (dateOverride) {
            dateOverride.timeRanges.forEach(range => {
                const [startH, startM] = range.startTime.split(':').map(Number);
                const [endH, endM] = range.endTime.split(':').map(Number);
                unavailabilityIntervals.push({
                    start: setMinutes(setHours(startOfDay(selectedDate), startH), startM),
                    end: setMinutes(setHours(startOfDay(selectedDate), endH), endM),
                });
            });
        }

        const bufferedBookingIntervals = bookings
            .filter(b => isSameDay(b.startTime, selectedDate))
            .map(booking => ({
                start: subMinutes(booking.startTime, bufferBefore),
                end: addMinutes(booking.endTime, bufferAfter)
            }));

        const [startH, startM] = availabilityRule.startTime.split(':').map(Number);
        const [endH, endM] = availabilityRule.endTime.split(':').map(Number);
        
        let currentTime = setMinutes(setHours(startOfDay(selectedDate), startH), startM);
        const availabilityEnd = setMinutes(setHours(startOfDay(selectedDate), endH), endM);

        while (isBefore(currentTime, availabilityEnd)) {
            const slotStart = new Date(currentTime);
            const slotEnd = addMinutes(slotStart, duration);

            if (isAfter(slotEnd, availabilityEnd)) break;

            let isAvailable = true;

            if (isBefore(slotStart, earliestBookableTime)) {
                isAvailable = false;
            }

            if (isAvailable) {
                for (const interval of unavailabilityIntervals) {
                    if (isBefore(slotStart, interval.end) && isBefore(interval.start, slotEnd)) {
                        isAvailable = false;
                        break;
                    }
                }
            }

            if (isAvailable) {
                const bufferedSlotStart = subMinutes(slotStart, bufferBefore);
                const bufferedSlotEnd = addMinutes(slotEnd, bufferAfter);

                for (const interval of bufferedBookingIntervals) {
                    if (isBefore(bufferedSlotStart, interval.end) && isBefore(interval.start, bufferedSlotEnd)) {
                        isAvailable = false;
                        break;
                    }
                }
            }

            if (isAvailable) {
                slots.push({ startTime: slotStart, endTime: slotEnd });
            }
            
            currentTime = addMinutes(currentTime, 15);
        }
        return slots;
    }, [eventType, selectedDate, bookings]);
    
    const handleCustomAnswerChange = (fieldId: string, value: string | boolean) => {
        setCustomAnswers(prev => ({ ...prev, [fieldId]: String(value) }));
        if(formErrors[fieldId]) {
            setFormErrors(prev => { const newErrors = {...prev}; delete newErrors[fieldId]; return newErrors; })
        }
    };
    
    const validateForm = () => {
        const errors: { [key: string]: string } = {};
        if (!name) errors.name = "Name is required.";
        if (!email) errors.email = "Email is required.";
        else if (!/\S+@\S+\.\S+/.test(email)) errors.email = "Email is invalid.";
        if (!phone) errors.phone = "Phone number is required.";


        eventType?.customFormFields.forEach(field => {
            if (field.required) {
                if(field.type === 'checkbox' && customAnswers[field.id] !== 'true') {
                    errors[field.id] = `${field.label} is required.`;
                } else if (field.type !== 'checkbox' && !customAnswers[field.id]) {
                    errors[field.id] = `${field.label} is required.`;
                }
            }
        });
        
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };


    const handleConfirmBooking = async () => {
        if (!eventTypeId || !selectedSlot || !validateForm()) return;
        setIsBooking(true);
        try {
            const newBooking = await schedulingService.createBooking({
                eventTypeId: eventTypeId,
                startTime: selectedSlot,
                bookerName: name,
                bookerEmail: email,
                bookerPhone: phone,
                customAnswers: customAnswers,
            });
            navigate('/confirmed', { state: { booking: newBooking, eventType } });
        } catch (error) {
            console.error("Failed to create booking:", error);
            alert("There was an error creating your booking. Please try again.");
        } finally {
            setIsBooking(false);
        }
    };

    if (loading) return <div className="flex justify-center items-center h-screen"><Spinner /></div>;
    if (!eventType) return <div className="text-center text-red-500 p-8">Event type not found.</div>;
    
    return (
        <div className="min-h-screen bg-white md:bg-background flex justify-center items-center p-0 md:p-4">
            <div className="w-full max-w-4xl bg-card p-4 sm:p-6 md:p-8 rounded-none md:rounded-lg md:shadow-xl grid grid-cols-1 md:grid-cols-3 gap-8">
                <LeftPanel eventType={eventType} timeZone={timeZone} />
                
                <div className="md:col-span-2 relative overflow-hidden" style={{minHeight: '450px'}}>
                    {/* Date/Time Selector View */}
                    <div className={`w-full h-full transition-transform duration-300 ease-in-out transform ${view === 'date' ? 'translate-x-0' : '-translate-x-full'}`}>
                       <DateTimeSelector
                           currentMonth={currentMonth}
                           setCurrentMonth={setCurrentMonth}
                           selectedDate={selectedDate}
                           setSelectedDate={setSelectedDate}
                           eventType={eventType}
                           availableSlots={availableSlots}
                           onSlotSelect={(slot) => {
                               setSelectedSlot(slot);
                               setView('form');
                           }}
                       />
                    </div>

                    {/* Form View */}
                    <div className={`absolute top-0 left-0 w-full h-full transition-transform duration-300 ease-in-out transform ${view === 'form' ? 'translate-x-0' : 'translate-x-full'}`}>
                       {selectedSlot && (
                           <BookingForm
                               eventType={eventType}
                               selectedSlot={selectedSlot}
                               name={name}
                               onNameChange={setName}
                               email={email}
                               onEmailChange={setEmail}
                               phone={phone}
                               onPhoneChange={setPhone}
                               customAnswers={customAnswers}
                               onCustomAnswerChange={handleCustomAnswerChange}
                               formErrors={formErrors}
                               isBooking={isBooking}
                               onConfirm={handleConfirmBooking}
                               onBack={() => setView('date')}
                           />
                       )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BookingPage;
