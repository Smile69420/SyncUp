import React, { useState, useEffect } from 'react';
import type { EventType, Availability, FormField, DateUnavailability, Booking, MergedBooking } from '../types';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { format } from 'date-fns';
import Select from './ui/Select';
import { firestoreService } from '../services/firestoreService';
import DeleteConfirmationModal from './DeleteConfirmationModal';

interface EventTypeEditorProps {
    eventType: EventType | null;
    onClose: () => void;
    onSave: (data: Omit<EventType, 'id' | 'link'> & { id?: string }) => void;
    onDelete?: () => void;
}

const weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const timeOptions = Array.from({ length: 48 }, (_, i) => {
    const totalMinutes = i * 30;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const formattedHours = hours.toString().padStart(2, '0');
    const formattedMinutes = minutes.toString().padStart(2, '0');
    return `${formattedHours}:${formattedMinutes}`;
});

const noticeOptions = [
    { label: '30 minutes', value: 30 },
    { label: '1 hour', value: 60 },
    { label: '4 hours', value: 240 },
    { label: '12 hours', value: 720 },
    { label: '24 hours', value: 1440 },
    { label: 'Custom', value: 'custom' },
];

const horizonOptions = [
    { label: '7 days', value: 7 },
    { label: '14 days', value: 14 },
    { label: '30 days', value: 30 },
    { label: '60 days', value: 60 },
    { label: '90 days', value: 90 },
    { label: 'Custom', value: 'custom' },
];

const bufferOptions = [
    { label: 'None', value: 0 },
    { label: '5 minutes', value: 5 },
    { label: '10 minutes', value: 10 },
    { label: '15 minutes', value: 15 },
    { label: '30 minutes', value: 30 },
    { label: 'Custom', value: 'custom' },
];

const PresetSelector = ({ label, value, onChange, options, unit, inputClasses }) => {
    const isCustom = !options.some(opt => opt.value === value);

    const handleSelectChange = (e) => {
        const selected = e.target.value;
        if (selected === 'custom') {
            const lastPreset = options[options.length - 2]?.value ?? 0;
            onChange(lastPreset);
        } else {
            onChange(Number(selected));
        }
    };

    return (
        <div>
            <label className="block text-sm font-medium text-slate-700">{label}</label>
            <div className="flex items-center gap-2 mt-1">
                <div className={isCustom ? "flex-shrink" : "w-full"}>
                    <Select value={isCustom ? 'custom' : value} onChange={handleSelectChange}>
                        {options.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </Select>
                </div>
                {isCustom && (
                    <div className="relative flex-grow">
                        <input
                            type="number"
                            value={value}
                            onChange={e => onChange(e.target.value ? parseInt(e.target.value, 10) : 0)}
                            className={`${inputClasses} pr-16`}
                            min="0"
                        />
                        <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm text-slate-500">{unit}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

// Helper function to resize and convert image to a compressed Base64 string
const processImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 600;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                
                // Get data URL as JPEG for compression, with 80% quality
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                resolve(dataUrl);
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
};


const EventTypeEditor: React.FC<EventTypeEditorProps> = ({ eventType, onClose, onSave, onDelete }) => {
    const [name, setName] = useState('');
    const [duration, setDuration] = useState(30);
    const [description, setDescription] = useState('');
    const [color, setColor] = useState('#4f46e5');
    const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
    const [mode, setMode] = useState<'online' | 'offline'>('online');
    const [location, setLocation] = useState('');
    const [conferencing, setConferencing] = useState<EventType['conferencing']>({ provider: 'google-meet' });
    const [sheetId, setSheetId] = useState('');
    const [sheetName, setSheetName] = useState('');
    const [availability, setAvailability] = useState<Availability[]>([]);
    const [bufferBefore, setBufferBefore] = useState(0);
    const [bufferAfter, setBufferAfter] = useState(0);
    const [unavailability, setUnavailability] = useState<Availability[]>([]);
    const [minimumSchedulingNotice, setMinimumSchedulingNotice] = useState(60);
    const [unavailableDates, setUnavailableDates] = useState<DateUnavailability[]>([]);
    const [bookingHorizonDays, setBookingHorizonDays] = useState(30);
    const [customFormFields, setCustomFormFields] = useState<FormField[]>([]);
    const [activeTab, setActiveTab] = useState<'details' | 'availability' | 'questions' | 'integrations'>('details');

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [bookingsToDelete, setBookingsToDelete] = useState<Booking[] | null>(null);


    useEffect(() => {
        if (eventType) {
            setName(eventType.name);
            setDuration(eventType.duration);
            setDescription(eventType.description);
            setColor(eventType.color);
            setImageUrl(eventType.imageUrl);
            setMode(eventType.mode || 'online');
            setLocation(eventType.location || '');
            setConferencing(eventType.conferencing || { provider: 'google-meet' });
            setAvailability(eventType.availability);
            setBufferBefore(eventType.bufferBefore || 0);
            setBufferAfter(eventType.bufferAfter || 0);
            setUnavailability(eventType.unavailability || []);
            setMinimumSchedulingNotice(eventType.minimumSchedulingNotice || 60);
            setUnavailableDates(eventType.unavailableDates || []);
            setBookingHorizonDays(eventType.bookingHorizonDays || 30);
            setCustomFormFields(eventType.customFormFields || []);
            setSheetId(eventType.googleSheetConfig?.sheetId || '');
            setSheetName(eventType.googleSheetConfig?.sheetName || '');
        } else {
             setName('New Event');
             setDuration(30);
             setDescription('');
             setImageUrl(undefined);
             setMode('online');
             setLocation('5th Floor, MCCIA SB Road, Pune');
             setConferencing({ provider: 'google-meet' });
             setBufferBefore(0);
             setBufferAfter(0);
             setUnavailability([]);
             setMinimumSchedulingNotice(60);
             setUnavailableDates([]);
             setBookingHorizonDays(30);
             setCustomFormFields([]);
             setSheetId('');
             setSheetName('');
             setAvailability([
                { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
                { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
                { dayOfWeek: 3, startTime: '09:00', endTime: '17:00' },
                { dayOfWeek: 4, startTime: '09:00', endTime: '17:00' },
                { dayOfWeek: 5, startTime: '09:00', endTime: '17:00' },
            ]);
        }
    }, [eventType]);

    const handleAvailabilityChange = (dayIndex: number, field: 'startTime' | 'endTime', value: string) => {
        const updatedAvailability = [...availability];
        const existingRule = updatedAvailability.find(rule => rule.dayOfWeek === dayIndex);
        if (existingRule) {
            existingRule[field] = value;
            setAvailability(updatedAvailability);
        }
    };
    
    const toggleDayAvailability = (dayIndex: number) => {
        const isEnabled = availability.some(rule => rule.dayOfWeek === dayIndex);
        if (isEnabled) {
            setAvailability(availability.filter(rule => rule.dayOfWeek !== dayIndex));
        } else {
            setAvailability([...availability, { dayOfWeek: dayIndex, startTime: '09:00', endTime: '17:00' }]);
        }
    };
    
    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            try {
                const base64Image = await processImage(file);
                setImageUrl(base64Image);
            } catch (error) {
                console.error("Error processing image:", error);
                alert("There was an error processing your image. Please try another one.");
            }
        }
    };

    const addUnavailabilitySlot = () => {
        setUnavailability([...unavailability, { dayOfWeek: 1, startTime: '12:00', endTime: '13:00'}]);
    }
    const removeUnavailabilitySlot = (index: number) => {
        setUnavailability(unavailability.filter((_, i) => i !== index));
    }
    const handleUnavailabilityChange = (index: number, field: 'dayOfWeek' | 'startTime' | 'endTime', value: string | number) => {
        const updated = [...unavailability];
        updated[index] = {...updated[index], [field]: value};
        setUnavailability(updated);
    }
    
    const addDateOverride = () => {
        setUnavailableDates([...unavailableDates, { date: format(new Date(), 'yyyy-MM-dd'), timeRanges: [] }]);
    };
    const removeDateOverride = (index: number) => {
        setUnavailableDates(unavailableDates.filter((_, i) => i !== index));
    };
    const handleDateOverrideChange = (index: number, newDate: string) => {
        const updated = [...unavailableDates];
        updated[index].date = newDate;
        setUnavailableDates(updated);
    };
    const toggleDateOverrideAllDay = (index: number) => {
        const updated = [...unavailableDates];
        const isAllDay = updated[index].timeRanges.length === 0;
        updated[index].timeRanges = isAllDay ? [{ startTime: '09:00', endTime: '17:00' }] : [];
        setUnavailableDates(updated);
    };
    const handleDateOverrideTimeChange = (index: number, field: 'startTime' | 'endTime', value: string) => {
        const updated = [...unavailableDates];
        if (updated[index].timeRanges.length === 0) {
             updated[index].timeRanges = [{ startTime: '09:00', endTime: '17:00' }];
        }
        updated[index].timeRanges[0][field] = value;
        setUnavailableDates(updated);
    };

    const addFormField = () => {
        const newField: FormField = {
            id: `field-${Date.now()}`,
            label: 'New Question',
            type: 'text',
            required: false,
            options: [],
        };
        setCustomFormFields([...customFormFields, newField]);
    };

    const updateFormField = (id: string, prop: keyof FormField, value: any) => {
        setCustomFormFields(customFormFields.map(field => {
            if (field.id === id) {
                 const updatedField = { ...field, [prop]: value };
                 if (prop === 'type' && (value !== 'select' && value !== 'radio')) {
                    delete updatedField.options;
                 } else if (prop === 'type' && (value === 'select' || value === 'radio') && !updatedField.options) {
                    updatedField.options = ['Option 1'];
                 }
                 return updatedField;
            }
            return field;
        }));
    };

    const removeFormField = (id: string) => {
        setCustomFormFields(customFormFields.filter(field => field.id !== id));
    };
    
    const handleOptionChange = (fieldId: string, optionIndex: number, value: string) => {
        setCustomFormFields(customFormFields.map(field => {
            if (field.id === fieldId) {
                const newOptions = [...(field.options || [])];
                newOptions[optionIndex] = value;
                return { ...field, options: newOptions };
            }
            return field;
        }));
    };

    const addOption = (fieldId: string) => {
         setCustomFormFields(customFormFields.map(field => {
            if (field.id === fieldId) {
                const newOptions = [...(field.options || []), `Option ${(field.options?.length || 0) + 1}`];
                return { ...field, options: newOptions };
            }
            return field;
        }));
    };

    const removeOption = (fieldId: string, optionIndex: number) => {
        setCustomFormFields(customFormFields.map(field => {
            if (field.id === fieldId) {
                const newOptions = (field.options || []).filter((_, index) => index !== optionIndex);
                return { ...field, options: newOptions };
            }
            return field;
        }));
    };

    const handleSaveClick = () => {
        const dataToSave = {
            name,
            duration,
            description,
            color,
            imageUrl,
            mode,
            location,
            conferencing,
            googleSheetConfig: sheetId.trim() && sheetName.trim() ? { sheetId: sheetId.trim(), sheetName: sheetName.trim() } : undefined,
            availability,
            bufferBefore,
            bufferAfter,
            unavailability,
            minimumSchedulingNotice,
            unavailableDates,
            bookingHorizonDays,
            customFormFields,
            ...(eventType && { id: eventType.id }),
        };
        onSave(dataToSave);
    };

    const handleDeleteClick = async () => {
        if (!eventType || !eventType.id) return;
        setBookingsToDelete(null); // Show loading state in modal
        setIsDeleteModalOpen(true);
        const associatedBookings = await firestoreService.getBookingsForEventType(eventType.id);
        setBookingsToDelete(associatedBookings);
    };
    
    const handleConfirmDelete = async () => {
        if (!eventType || !eventType.id || !onDelete) return;
        try {
            await firestoreService.deleteEventTypeAndBookings(eventType.id);
            setIsDeleteModalOpen(false);
            onDelete();
        } catch (error) {
            console.error("Failed to delete event type and bookings:", error);
            alert("Could not complete deletion. Please try again.");
        }
    };

    const NavItem = ({ tab, children, icon }) => (
        <button
            onClick={() => setActiveTab(tab)}
            className={`w-full flex items-center text-left px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab ? 'bg-primary/10 text-primary' : 'hover:bg-slate-100 text-slate-600'
            }`}
        >
            {icon}
            <span className="ml-3">{children}</span>
        </button>
    );

    const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm text-slate-900";

    return (
        <>
        <Modal title={eventType ? 'Edit Event Type' : 'Create Event Type'} onClose={onClose} size="5xl">
            <div className="flex flex-col md:flex-row gap-8">
                {/* Left Nav */}
                <div className="md:w-1/4 space-y-1 border-b md:border-b-0 md:border-r md:pr-6 pb-4 md:pb-0">
                    <NavItem tab="details" icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>}>
                        Event Details
                    </NavItem>
                    <NavItem tab="availability" icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>}>
                        Availability
                    </NavItem>
                    <NavItem tab="questions" icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}>
                        Booking Form
                    </NavItem>
                    <NavItem tab="integrations" icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>}>
                        Integrations
                    </NavItem>
                </div>

                {/* Right Content */}
                <div className="md:w-3/4 min-h-[450px]">
                    {activeTab === 'details' && (
                         <div className="space-y-6 animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                <div>
                                    <label htmlFor="name" className="block text-sm font-medium text-slate-700">Event Name</label>
                                    <input type="text" id="name" value={name} onChange={e => setName(e.target.value)} className={inputClasses}/>
                                </div>
                                <div>
                                    <label htmlFor="duration" className="block text-sm font-medium text-slate-700">Duration (minutes)</label>
                                    <input type="number" id="duration" value={duration} onChange={e => setDuration(parseInt(e.target.value) || 0)} className={inputClasses}/>
                                </div>
                                <div className="md:col-span-2">
                                    <label htmlFor="description" className="block text-sm font-medium text-slate-700">Description</label>
                                    <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} rows={3} className={inputClasses}/>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700">Preview Image</label>
                                    <div className="mt-1 flex items-center gap-4">
                                        <div className="w-32 h-20 bg-slate-100 rounded-md flex items-center justify-center border">
                                             {imageUrl ? (
                                                <img src={imageUrl} alt="Preview" className="w-full h-full object-cover rounded-md"/>
                                             ) : (
                                                <span className="text-xs text-slate-500">No Image</span>
                                             )}
                                        </div>
                                        <div className="flex-grow">
                                             <input type="file" id="image-upload" accept="image/png, image/jpeg" onChange={handleImageUpload} className="hidden"/>
                                             <Button variant="outline" size="sm" onClick={() => document.getElementById('image-upload')?.click()}>Upload Image</Button>
                                             {imageUrl && <Button variant="outline" size="sm" onClick={() => setImageUrl(undefined)} className="ml-2">Remove</Button>}
                                             <p className="text-xs text-slate-500 mt-2">Recommended: 800x400px. Used for link previews.</p>
                                        </div>
                                    </div>
                                </div>
                                 <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700">Meeting Mode</label>
                                    <div className="flex items-center gap-4 mt-2">
                                        <label className="flex items-center">
                                            <input type="radio" value="online" checked={mode === 'online'} onChange={() => setMode('online')} className="h-4 w-4 text-primary focus:ring-primary border-slate-300"/>
                                            <span className="ml-2 text-sm text-slate-900">Online</span>
                                        </label>
                                        <label className="flex items-center">
                                            <input type="radio" value="offline" checked={mode === 'offline'} onChange={() => setMode('offline')} className="h-4 w-4 text-primary focus:ring-primary border-slate-300"/>
                                            <span className="ml-2 text-sm text-slate-900">Offline</span>
                                        </label>
                                    </div>
                                </div>

                                {mode === 'online' && (
                                    <div className="md:col-span-2">
                                        <label htmlFor="conferencing" className="block text-sm font-medium text-slate-700">Conferencing</label>
                                        <Select 
                                            id="conferencing" 
                                            value={conferencing?.provider} 
                                            onChange={e => {
                                                const provider = e.target.value as 'google-meet' | 'custom';
                                                setConferencing(prev => ({ ...prev, provider }));
                                            }}
                                        >
                                            <option value="google-meet">Google Meet (auto-create link)</option>
                                            <option value="custom">Custom Link</option>
                                        </Select>
                                        {conferencing?.provider === 'custom' && (
                                            <input 
                                                type="url" 
                                                value={conferencing.customLink || ''} 
                                                onChange={e => setConferencing(prev => ({ ...prev, customLink: e.target.value }))}
                                                placeholder="https://your-meeting-link.com" 
                                                className={`${inputClasses} mt-2`}
                                            />
                                        )}
                                    </div>
                                )}
                                {mode === 'offline' && (
                                    <div className="md:col-span-2">
                                        <label htmlFor="location" className="block text-sm font-medium text-slate-700">Location</label>
                                        <input type="text" id="location" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g., Office Address" className={inputClasses}/>
                                    </div>
                                )}
                                
                                <div>
                                    <label htmlFor="color" className="block text-sm font-medium text-slate-700">Event Color</label>
                                    <input type="color" id="color" value={color} onChange={e => setColor(e.target.value)} className="mt-1 block w-full h-10 px-1 py-1 border border-slate-300 rounded-md shadow-sm"/>
                                </div>
                            </div>
                        </div>
                    )}
                    
                     {activeTab === 'integrations' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="p-4 border rounded-lg bg-white shadow-sm">
                                <div className="flex items-start gap-4">
                                     <img src="https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png" alt="Google logo" className="w-16 h-auto pt-1" />
                                    <div>
                                        <h3 className="text-lg font-semibold">Google Integration</h3>
                                        <p className="text-sm text-slate-600">
                                            Enable Google Meet link generation and Google Sheets sync by deploying the provided Google Apps Script.
                                            Once deployed, your app will automatically handle these integrations.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 border rounded-lg bg-white shadow-sm">
                                 <h3 className="text-lg font-semibold">Google Sheets Sync</h3>
                                 <p className="text-sm text-slate-600 mb-4">Automatically add new bookings as rows in a Google Sheet. Enter the Sheet ID and Sheet Name below.</p>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     <div>
                                         <label htmlFor="sheetId" className="block text-sm font-medium text-slate-700">Google Sheet ID</label>
                                         <input 
                                            type="text" 
                                            id="sheetId" 
                                            value={sheetId} 
                                            onChange={e => setSheetId(e.target.value)} 
                                            className={inputClasses} 
                                            placeholder="e.g., 1aBcDeFgHiJkLmNoPqRsTuVwXyZ" 
                                        />
                                        <p className="text-xs text-slate-500 mt-1">Found in your Google Sheet URL.</p>
                                     </div>
                                      <div>
                                         <label htmlFor="sheetName" className="block text-sm font-medium text-slate-700">Sheet Name (Tab Name)</label>
                                         <input 
                                            type="text" 
                                            id="sheetName" 
                                            value={sheetName} 
                                            onChange={e => setSheetName(e.target.value)} 
                                            className={inputClasses} 
                                            placeholder="e.g., Bookings" 
                                        />
                                        <p className="text-xs text-slate-500 mt-1">The exact name of the tab in your sheet.</p>
                                     </div>
                                 </div>
                            </div>

                            {eventType && (
                                <div className="mt-8 pt-6 border-t border-red-200">
                                    <h3 className="text-lg font-semibold text-red-700">Danger Zone</h3>
                                    <p className="text-sm text-slate-600 mt-1 mb-4">
                                        Deleting this event type cannot be undone. All existing bookings for this event type will also be permanently deleted.
                                    </p>
                                    <Button variant="outline" onClick={handleDeleteClick} className="!border-red-500 !text-red-600 hover:!bg-red-50">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                                        Delete Event Type
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {activeTab === 'availability' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <PresetSelector label="Minimum Scheduling Notice" value={minimumSchedulingNotice} onChange={setMinimumSchedulingNotice} options={noticeOptions} unit="minutes" inputClasses={inputClasses} />
                                <PresetSelector label="Booking Horizon" value={bookingHorizonDays} onChange={setBookingHorizonDays} options={horizonOptions} unit="days" inputClasses={inputClasses} />
                                <PresetSelector label="Buffer Before Event" value={bufferBefore} onChange={setBufferBefore} options={bufferOptions} unit="minutes" inputClasses={inputClasses} />
                                <PresetSelector label="Buffer After Event" value={bufferAfter} onChange={setBufferAfter} options={bufferOptions} unit="minutes" inputClasses={inputClasses} />
                            </div>

                             <div className="pt-4">
                                <h3 className="text-lg font-semibold">Weekly Availability</h3>
                                <p className="text-sm text-slate-600">Set the hours you’re available for this event type.</p>
                                <div className="space-y-3 mt-4">
                                    {weekDays.map((day, index) => {
                                        const isEnabled = availability.some(rule => rule.dayOfWeek === index);
                                        const rule = availability.find(r => r.dayOfWeek === index);
                                        return (
                                            <div key={day} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                                                <div className="flex items-center">
                                                    <input type="checkbox" checked={isEnabled} onChange={() => toggleDayAvailability(index)} className="h-4 w-4 text-primary rounded border-slate-300 focus:ring-primary"/>
                                                    <label className="ml-2 font-medium">{day}</label>
                                                </div>
                                                {isEnabled ? (
                                                    <div className="col-span-3 flex items-center gap-2">
                                                        <Select value={rule?.startTime} onChange={e => handleAvailabilityChange(index, 'startTime', e.target.value)} className="w-full">
                                                            {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                                                        </Select>
                                                        <span>-</span>
                                                        <Select value={rule?.endTime} onChange={e => handleAvailabilityChange(index, 'endTime', e.target.value)} className="w-full">
                                                            {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                                                        </Select>
                                                    </div>
                                                ) : (
                                                    <div className="col-span-3 text-sm text-slate-500">Unavailable</div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            <div className="pt-4">
                                <h3 className="text-lg font-semibold">Weekly Unavailability</h3>
                                <p className="text-sm text-slate-600">Block out specific recurring times (e.g., lunch breaks).</p>
                                 <div className="space-y-3 mt-4">
                                     {unavailability.map((slot, index) => (
                                         <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                                             <Select value={slot.dayOfWeek} onChange={e => handleUnavailabilityChange(index, 'dayOfWeek', parseInt(e.target.value))} className="md:col-span-1">
                                                {weekDays.map((day, dIndex) => <option key={dIndex} value={dIndex}>{day}</option>)}
                                             </Select>
                                             <div className="md:col-span-2 flex items-center gap-2">
                                                 <Select value={slot.startTime} onChange={e => handleUnavailabilityChange(index, 'startTime', e.target.value)} className="w-full">
                                                    {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                                                 </Select>
                                                 <span>-</span>
                                                 <Select value={slot.endTime} onChange={e => handleUnavailabilityChange(index, 'endTime', e.target.value)} className="w-full">
                                                    {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                                                 </Select>
                                             </div>
                                             <Button variant="outline" size="sm" onClick={() => removeUnavailabilitySlot(index)}>Remove</Button>
                                         </div>
                                     ))}
                                 </div>
                                <Button onClick={addUnavailabilitySlot} className="mt-2">+ Add Slot</Button>
                            </div>
                            
                             <div className="pt-4">
                                <h3 className="text-lg font-semibold">Date Overrides</h3>
                                <p className="text-sm text-slate-600">Block off specific dates for this event type.</p>
                                <div className="space-y-3 mt-4">
                                     {unavailableDates.map((override, index) => (
                                         <div key={index} className="p-3 bg-slate-50 rounded-md border">
                                            <div className="flex items-center justify-between">
                                                <input type="date" value={override.date} onChange={e => handleDateOverrideChange(index, e.target.value)} className={inputClasses + " w-auto"}/>
                                                <Button variant="outline" size="sm" onClick={() => removeDateOverride(index)}>Remove</Button>
                                            </div>
                                             <div className="flex items-center mt-3">
                                                 <input type="checkbox" id={`all-day-${index}`} checked={override.timeRanges.length === 0} onChange={() => toggleDateOverrideAllDay(index)} className="h-4 w-4 text-primary rounded border-slate-300 focus:ring-primary"/>
                                                 <label htmlFor={`all-day-${index}`} className="ml-2 text-sm font-medium">Block off all day</label>
                                             </div>
                                             {override.timeRanges.length > 0 && (
                                                <div className="flex items-center gap-2 mt-2">
                                                     <Select value={override.timeRanges[0].startTime} onChange={e => handleDateOverrideTimeChange(index, 'startTime', e.target.value)} className="w-full">
                                                        {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                                                     </Select>
                                                     <span>-</span>
                                                     <Select value={override.timeRanges[0].endTime} onChange={e => handleDateOverrideTimeChange(index, 'endTime', e.target.value)} className="w-full">
                                                        {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                                                     </Select>
                                                </div>
                                             )}
                                         </div>
                                     ))}
                                </div>
                                 <Button onClick={addDateOverride} className="mt-2">+ Add Override</Button>
                            </div>
                        </div>
                    )}
                    
                    {activeTab === 'questions' && (
                        <div className="space-y-4 animate-fade-in">
                             <h3 className="text-lg font-semibold">Custom Questions</h3>
                             <p className="text-sm text-slate-600">Add questions to your booking form.</p>
                             <div className="space-y-4">
                                {customFormFields.map((field, index) => (
                                    <div key={field.id} className="p-4 border rounded-lg bg-slate-50">
                                         <div className="flex justify-between items-start">
                                            <div className="flex-grow pr-4">
                                                <label className="block text-sm font-medium text-slate-700">Question {index + 1}</label>
                                                <input type="text" value={field.label} onChange={e => updateFormField(field.id, 'label', e.target.value)} className={inputClasses} />
                                            </div>
                                            <Button variant="outline" size="sm" onClick={() => removeFormField(field.id)}>Delete</Button>
                                        </div>
                                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                            <Select value={field.type} onChange={e => updateFormField(field.id, 'type', e.target.value)}>
                                                <option value="text">Text Input</option>
                                                <option value="textarea">Text Area</option>
                                                <option value="email">Email</option>
                                                <option value="select">Dropdown</option>
                                                <option value="radio">Radio Buttons</option>
                                                <option value="checkbox">Checkbox</option>
                                            </Select>
                                            <div className="flex items-center">
                                                <input type="checkbox" id={`req-${field.id}`} checked={field.required} onChange={e => updateFormField(field.id, 'required', e.target.checked)} className="h-4 w-4 text-primary rounded border-slate-300 focus:ring-primary"/>
                                                <label htmlFor={`req-${field.id}`} className="ml-2 text-sm font-medium">Required</label>
                                            </div>
                                        </div>
                                        {(field.type === 'select' || field.type === 'radio') && (
                                            <div className="mt-3">
                                                <label className="block text-sm font-medium text-slate-700">Options</label>
                                                <div className="space-y-2 mt-1">
                                                    {(field.options || []).map((option, optIndex) => (
                                                        <div key={optIndex} className="flex items-center gap-2">
                                                            <input type="text" value={option} onChange={e => handleOptionChange(field.id, optIndex, e.target.value)} className={`${inputClasses} flex-grow`} />
                                                            <button onClick={() => removeOption(field.id, optIndex)} className="text-slate-400 hover:text-red-500">
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                                <Button size="sm" variant="outline" onClick={() => addOption(field.id)} className="mt-2">+ Add Option</Button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                             </div>
                             <Button onClick={addFormField}>+ Add New Question</Button>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex justify-end space-x-3 pt-6 mt-6 border-t border-slate-200">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button onClick={handleSaveClick}>Save</Button>
            </div>
        </Modal>

        {isDeleteModalOpen && eventType && (
             <DeleteConfirmationModal
                eventType={eventType}
                associatedBookings={bookingsToDelete}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirmDelete={handleConfirmDelete}
            />
        )}
        </>
    );
};

export default EventTypeEditor;