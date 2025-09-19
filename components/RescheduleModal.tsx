import React, { useState, useMemo } from 'react';
import type { EventType, MergedBooking, TimeSlot, Booking } from '../types';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Spinner from './ui/Spinner';
import { 
    format, addDays, startOfDay, addMinutes, isBefore, isSameDay, setHours, setMinutes,
    startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday,
    addMonths, subMonths, isAfter, subMinutes
} from 'date-fns';

interface RescheduleModalProps {
    booking: MergedBooking;
    eventType: EventType;
    allBookings: Booking[];
    onClose: () => void;
    onSave: (newStartTime: Date) => void;
}

const RescheduleModal: React.FC<RescheduleModalProps> = ({ booking, eventType, allBookings, onClose, onSave }) => {
    const [currentMonth, setCurrentMonth] = useState(booking.startTime);
    const [selectedDate, setSelectedDate] = useState<Date | null>(booking.startTime);
    const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const availableSlots = useMemo((): TimeSlot[] => {
        if (!eventType || !selectedDate) return [];
        
        // Exclude the current booking being rescheduled from conflict checks
        const otherBookings = allBookings.filter(b => b.id !== booking.id);

        const dayOfWeek = selectedDate.getDay();
        const earliestBookableTime = addMinutes(new Date(), eventType.minimumSchedulingNotice || 0);

        const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
        const dateOverride = eventType.unavailableDates?.find(d => d.date === selectedDateStr);
        if (dateOverride && dateOverride.timeRanges.length === 0) return [];

        const availabilityRule = eventType.availability.find(rule => rule.dayOfWeek === dayOfWeek);
        if (!availabilityRule) return [];

        const slots: TimeSlot[] = [];
        const duration = eventType.duration;
        const bufferBefore = eventType.bufferBefore || 0;
        const bufferAfter = eventType.bufferAfter || 0;

        const dayUnavailability = eventType.unavailability?.filter(u => u.dayOfWeek === dayOfWeek) || [];
        const unavailabilityIntervals = dayUnavailability.map(u => ({
            start: setMinutes(setHours(startOfDay(selectedDate), parseInt(u.startTime.split(':')[0])), parseInt(u.startTime.split(':')[1])),
            end: setMinutes(setHours(startOfDay(selectedDate), parseInt(u.endTime.split(':')[0])), parseInt(u.endTime.split(':')[1]))
        }));
        
        if (dateOverride) {
             dateOverride.timeRanges.forEach(range => {
                unavailabilityIntervals.push({
                    start: setMinutes(setHours(startOfDay(selectedDate), parseInt(range.startTime.split(':')[0])), parseInt(range.startTime.split(':')[1])),
                    end: setMinutes(setHours(startOfDay(selectedDate), parseInt(range.endTime.split(':')[0])), parseInt(range.endTime.split(':')[1]))
                });
            });
        }
        
        const bufferedBookingIntervals = otherBookings
            .filter(b => isSameDay(b.startTime, selectedDate))
            .map(b => ({
                start: subMinutes(b.startTime, bufferBefore),
                end: addMinutes(b.endTime, bufferAfter)
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
            if (isBefore(slotStart, earliestBookableTime)) isAvailable = false;

            if (isAvailable) {
                for (const interval of [...unavailabilityIntervals, ...bufferedBookingIntervals]) {
                    if (isBefore(slotStart, interval.end) && isBefore(interval.start, slotEnd)) {
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
    }, [eventType, selectedDate, allBookings, booking.id]);
    
    const handleSave = async () => {
        if (!selectedSlot) return;
        setIsSaving(true);
        await onSave(selectedSlot);
        setIsSaving(false);
    };

    return (
        <Modal title={`Reschedule: ${eventType.name}`} onClose={onClose}>
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[400px]">
                    {/* Calendar */}
                    <div>
                         <div className="flex items-center justify-between mb-4">
                            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 rounded-full hover:bg-slate-100">&lt;</button>
                            <h3 className="font-semibold">{format(currentMonth, 'MMMM yyyy')}</h3>
                            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-full hover:bg-slate-100">&gt;</button>
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-center text-sm text-slate-500 mb-2">
                            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i}>{d}</div>)}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {eachDayOfInterval({ start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 }) }).map(day => {
                                const isSelected = selectedDate && isSameDay(day, selectedDate);
                                const isPast = isBefore(day, startOfDay(new Date())) && !isToday(day);
                                const isDisabled = isPast || !isSameMonth(day, currentMonth);
                                return (
                                    <div key={day.toString()} className="flex justify-center items-center">
                                        <button
                                            disabled={isDisabled}
                                            onClick={() => { setSelectedDate(day); setSelectedSlot(null); }}
                                            className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors font-medium ${isDisabled ? 'text-slate-300 cursor-not-allowed' : isSelected ? 'bg-primary text-white' : 'hover:bg-primary/10'}`}
                                        >
                                            {format(day, 'd')}
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                    {/* Time Slots */}
                    <div className="relative">
                        {selectedDate && (
                            <>
                                <h3 className="font-semibold text-center mb-4">{format(selectedDate, 'EEEE, LLL d')}</h3>
                                <div className="grid grid-cols-2 gap-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                                    {availableSlots.length > 0 ? (
                                        availableSlots.map(slot => (
                                            <Button
                                                key={slot.startTime.toISOString()}
                                                variant={selectedSlot && isSameDay(slot.startTime, selectedSlot) && slot.startTime.getTime() === selectedSlot.getTime() ? 'primary' : 'outline'}
                                                onClick={() => setSelectedSlot(slot.startTime)}
                                            >
                                                {format(slot.startTime, 'p')}
                                            </Button>
                                        ))
                                    ) : (
                                        <p className="col-span-2 text-center text-slate-500 mt-8">No available slots.</p>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                    <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
                    <Button onClick={handleSave} disabled={!selectedSlot || isSaving}>
                        {isSaving ? <Spinner size="sm" /> : 'Confirm Reschedule'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default RescheduleModal;
