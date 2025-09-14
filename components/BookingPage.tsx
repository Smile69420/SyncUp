import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { schedulingService } from '../services/schedulingService';
import type { EventType, Booking, TimeSlot, FormField } from '../types';
import Spinner from './ui/Spinner';
import Button from './ui/Button';
import { 
    format, addDays, startOfDay, addMinutes, isBefore, isSameDay, setHours, setMinutes,
    startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday,
    addMonths, subMonths, isAfter, subMinutes
} from 'date-fns';
import { enUS } from 'date-fns/locale';

const BookingPage: React.FC = () => {
    const { eventTypeId } = useParams<{ eventTypeId: string }>();
    const navigate = useNavigate();

    const [eventType, setEventType] = useState<EventType | null>(null);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
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
                    setBookings(allBookings.filter(b => b.eventTypeId === eventTypeId).map(b => ({...b, startTime: new Date(b.startTime), endTime: new Date(b.endTime)})));
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
    
    const renderFormField = (field: FormField) => {
        const commonClasses = `mt-1 block w-full px-3 py-2 bg-white border ${formErrors[field.id] ? 'border-red-500' : 'border-slate-300'} rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm text-slate-900`;
        // ... (rest of the function is the same)
        switch (field.type) {
            case 'textarea':
                return <textarea id={field.id} value={customAnswers[field.id]} onChange={e => handleCustomAnswerChange(field.id, e.target.value)} rows={3} className={commonClasses} />;
            case 'select':
                return (
                    <select id={field.id} value={customAnswers[field.id]} onChange={e => handleCustomAnswerChange(field.id, e.target.value)} className={commonClasses}>
                        <option value="">Select an option</option>
                        {field.options?.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                );
            case 'radio':
                return (
                    <div className={`mt-2 p-3 rounded-md border bg-slate-50 ${formErrors[field.id] ? 'border-red-500' : 'border-slate-200'}`}>
                        {field.options?.map(option => (
                            <div key={option} className="flex items-center my-1">
                                <input type="radio" id={`${field.id}-${option}`} name={field.id} value={option} checked={customAnswers[field.id] === option} onChange={e => handleCustomAnswerChange(field.id, e.target.value)} className="h-4 w-4 text-primary focus:ring-primary border-slate-300"/>
                                <label htmlFor={`${field.id}-${option}`} className="ml-2 block text-sm text-slate-900">{option}</label>
                            </div>
                        ))}
                    </div>
                );
             case 'checkbox':
                return (
                    <div className="flex items-center mt-2">
                        <input type="checkbox" id={field.id} checked={customAnswers[field.id] === 'true'} onChange={e => handleCustomAnswerChange(field.id, e.target.checked)} className={`h-4 w-4 text-primary focus:ring-primary ${formErrors[field.id] ? 'border-red-500' : 'border-slate-300'} rounded`} />
                        <label htmlFor={field.id} className="ml-2 block text-sm text-slate-900">{field.label} {field.required && '*'}</label>
                    </div>
                );
            case 'text':
            case 'email':
            default:
                return <input type={field.type} id={field.id} value={customAnswers[field.id]} onChange={e => handleCustomAnswerChange(field.id, e.target.value)} className={commonClasses} />;
        }
    };


    if (loading) return <div className="flex justify-center items-center h-96"><Spinner /></div>;
    if (!eventType) return <div className="text-center text-red-500">Event type not found.</div>;
    
    const Calendar = () => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const calendarStart = startOfWeek(monthStart);
        const calendarEnd = endOfWeek(monthEnd);
        const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
        const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        return (
            <div>
                 <div className="flex items-center justify-between mb-4">
                    <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 rounded-full hover:bg-slate-100">&lt;</button>
                    <h3 className="font-semibold text-lg">{format(currentMonth, 'MMMM yyyy')}</h3>
                    <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-full hover:bg-slate-100">&gt;</button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-sm text-slate-500">
                    {weekDays.map(day => <div key={day}>{day}</div>)}
                </div>
                 <div className="grid grid-cols-7 gap-1 mt-2">
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

                        let dayClassName = 'w-10 h-10 rounded-full transition-colors';

                        if (!isCurrentMonth) {
                            dayClassName += ' text-slate-300 cursor-not-allowed';
                        } else if (isPast || isBeyondHorizon) {
                            dayClassName += ' text-slate-400 cursor-not-allowed';
                        } else if (hasAvailability) {
                            dayClassName += ' bg-green-100 text-green-800 hover:bg-green-200';
                        } else { // Unavailable future date within horizon
                            dayClassName += ' bg-red-100 text-red-800 cursor-not-allowed';
                        }

                        if (isSelected) {
                            dayClassName = 'w-10 h-10 rounded-full transition-colors bg-primary text-white hover:bg-primary/90';
                        } else if (isToday(day)) {
                            dayClassName += ' border border-primary';
                        }
                        
                        return (
                             <button
                                key={day.toString()}
                                disabled={isDisabled}
                                onClick={() => setSelectedDate(day)}
                                className={dayClassName}
                            >
                                {format(day, 'd')}
                            </button>
                        )
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-4xl mx-auto bg-card p-4 sm:p-6 md:p-8 rounded-lg shadow-xl grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Panel: Event Info */}
            <div className="md:col-span-1 md:border-r md:pr-6">
                 <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: eventType.color }}></div>
                <h1 className="text-2xl font-bold mt-4">{eventType.name}</h1>
                <p className="text-slate-500 mt-2">{eventType.duration} minutes</p>
                <p className="mt-4 text-slate-600">{eventType.description}</p>
                <p className="mt-4 text-sm text-slate-500">Timezone: {timeZone}</p>
                 {selectedSlot && (
                     <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <h3 className="font-semibold text-slate-800">Selected Time:</h3>
                        <p className="text-primary font-bold">{format(selectedSlot, 'PPPP p')}</p>
                     </div>
                 )}
            </div>
            
            {/* Right Panel: Booking Flow */}
            <div className="md:col-span-2">
                {!selectedSlot ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div>
                             <h2 className="text-xl font-semibold mb-2">Select a Date</h2>
                             <Calendar />
                        </div>
                        <div className="relative">
                            {selectedDate && (
                                <>
                                 <h2 className="text-xl font-semibold mb-2">{format(selectedDate, 'EEEE, LLL d')}</h2>
                                <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto custom-scrollbar pr-2">
                                    {availableSlots.length > 0 ? (
                                        availableSlots.map(slot => (
                                            <Button 
                                                key={slot.startTime.toISOString()}
                                                variant="outline"
                                                onClick={() => setSelectedSlot(slot.startTime)}
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
                ) : (
                    <div>
                         <h2 className="text-xl font-semibold">Enter Your Details</h2>
                         <div className="space-y-4 mt-4">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-slate-700">Name *</label>
                                <input type="text" id="name" value={name} onChange={e => setName(e.target.value)} className={`mt-1 block w-full px-3 py-2 bg-white border ${formErrors.name ? 'border-red-500' : 'border-slate-300'} rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm text-slate-900`}/>
                                {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
                            </div>
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email *</label>
                                <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} className={`mt-1 block w-full px-3 py-2 bg-white border ${formErrors.email ? 'border-red-500' : 'border-slate-300'} rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm text-slate-900`}/>
                                 {formErrors.email && <p className="text-xs text-red-500 mt-1">{formErrors.email}</p>}
                            </div>
                            <div>
                                <label htmlFor="phone" className="block text-sm font-medium text-slate-700">Phone Number *</label>
                                <input type="tel" id="phone" value={phone} onChange={e => setPhone(e.target.value)} className={`mt-1 block w-full px-3 py-2 bg-white border ${formErrors.phone ? 'border-red-500' : 'border-slate-300'} rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm text-slate-900`}/>
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
                                 <Button onClick={handleConfirmBooking} disabled={isBooking} className="w-full">
                                    {isBooking ? <Spinner size="sm" /> : 'Confirm Booking'}
                                </Button>
                                 <Button variant="outline" onClick={() => setSelectedSlot(null)} className="w-full">Back</Button>
                            </div>
                         </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BookingPage;
