import React, { useState, useEffect } from 'react';
import type { EventType, Availability, FormField, DateUnavailability } from '../types';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { format } from 'date-fns';
import Select from './ui/Select';
import { firestoreService } from '../services/firestoreService';

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

const bookingDetailsFields: { key: string, label: string }[] = [
    { key: 'companyName', label: 'Company Name' },
    { key: 'consultationDoneBy', label: 'Consultation Done By' },
    { key: 'designation', label: 'Designation' },
    { key: 'generalizedDesignation', label: 'Generalized Designation' },
    { key: 'level', label: 'Level' },
    { key: 'capability', label: 'Capability' },
    { key: 'feedbackSent', label: 'Feedback Sent' },
    { key: 'shownInterestInMembership', label: 'Shown Interest in Membership' },
    { key: 'membership', label: 'Membership' },
    { key: 'membershipVerification', label: 'Membership Verification' },
    { key: 'state', label: 'State' },
    { key: 'district', label: 'District' },
    { key: 'womenEntrepreneur', label: 'Women Entrepreneur' },
    { key: 'noOfEmployeesInCompany', label: 'No of Employees in Company' },
    { key: 'noOfAttendants', label: 'No of Attendants' },
    { key: 'sector', label: 'Sector' },
    { key: 'sectorGeneralized', label: 'Sector Generalized' },
    { key: 'operationsPerfomedInBrief', label: 'Operations Perfomed In Brief' },
    { key: 'scale', label: 'Scale' },
    { key: 'challenges', label: 'Challenges' },
    { key: 'manualTasks', label: 'Manual Tasks' },
    { key: 'suggestedTools', label: 'Suggested Tools' },
    { key: 'toolCategories', label: 'Tool Categories' },
    { key: 'aiFamiliarityPre', label: 'AI Familiarity (Pre)' },
    { key: 'kpi', label: 'KPI' },
    { key: 'aiFamiliarityPost', label: 'AI Familiarity (Post)' },
    { key: 'kpiValue', label: 'KPI Value' },
    { key: 'howDidTheyGetToKnow', label: 'How did they get to know' },
    { key: 'additionalNotes1', label: 'Additional Notes 1' },
    { key: 'notesForReport', label: 'Notes for Report' },
    { key: 'followUpRequestStatus', label: 'Follow Up Request Status' },
    { key: 'followUpStatus', label: 'Follow Up Status' },
    { key: 'meetingDone', label: 'Meeting Done' },
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

    const handleDelete = async () => {
        if (!eventType || !eventType.id || !onDelete) return;

        if (window.confirm(`Are you sure you want to delete the "${eventType.name}" event type? This action cannot be undone, but existing bookings will be preserved.`)) {
            try {
                await firestoreService.deleteEventType(eventType.id);
                onDelete(); // This will close the modal and refresh the dashboard
            } catch (error) {
                console.error("Failed to delete event type:", error);
                alert("Could not delete the event type. Please try again.");
            }
        }
    };

    const TabButton = ({ tab, children }: { tab: typeof activeTab, children: React.ReactNode }) => (
         <button 
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === tab ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100'}`}
        >
            {children}
        </button>
    );

    const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm text-slate-900";

    return (
        <Modal title={eventType ? 'Edit Event Type' : 'Create Event Type'} onClose={onClose}>
            <div className="space-y-6">
                <div className="border-b border-slate-200">
                    <nav className="flex space-x-2" aria-label="Tabs">
                        <TabButton tab="details">Event Details</TabButton>
                        <TabButton tab="availability">Availability</TabButton>
                        <TabButton tab="questions">Custom Questions</TabButton>
                        <TabButton tab="integrations">Integrations</TabButton>
                    </nav>
                </div>
                
                <div className="min-h-[400px]">
                    {activeTab === 'details' && (
                         <div className="space-y-4 animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="name" className="block text-sm font-medium text-slate-700">Event Name</label>
                                    <input type="text" id="name" value={name} onChange={e => setName(e.target.value)} className={inputClasses}/>
                                </div>
                                <div>
                                    <label htmlFor="duration" className="block text-sm font-medium text-slate-700">Duration (minutes)</label>
                                    <input type="number" id="duration" value={duration} onChange={e => setDuration(parseInt(e.target.value))} className={inputClasses}/>
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
                                        Deleting this event type cannot be undone. All existing bookings for this event type will be preserved, but you will no longer be able to accept new bookings for it.
                                    </p>
                                    <Button variant="outline" onClick={handleDelete} className="!border-red-500 !text-red-600 hover:!bg-red-50">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        Delete this event type
                                    </Button>
                                </div>
                            )}
                        </div>
                     )}

                    {activeTab === 'questions' && (
                         <div className="animate-fade-in">
                            <div className="space-y-4 bg-slate-50 p-4 rounded-md max-h-[400px] overflow-y-auto custom-scrollbar">
                                {customFormFields.map(field => (
                                    <div key={field.id} className="p-4 border rounded-lg bg-white shadow-sm space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <input type="text" value={field.label} onChange={e => updateFormField(field.id, 'label', e.target.value)} placeholder="Question Label" className={`${inputClasses} md:col-span-2`} />
                                            <Select value={field.type} onChange={e => updateFormField(field.id, 'type', e.target.value)}>
                                                <option value="text">Text</option>
                                                <option value="email">Email</option>
                                                <option value="textarea">Text Area</option>
                                                <option value="select">Select (Dropdown)</option>
                                                <option value="radio">Radio Buttons</option>
                                                <option value="checkbox">Checkbox</option>
                                            </Select>
                                        </div>

                                        {(field.type === 'select' || field.type === 'radio') && (
                                            <div className="pl-4 border-l-2 border-slate-200">
                                                <h4 className="text-sm font-medium text-slate-600 mb-2">Options</h4>
                                                <div className="space-y-2">
                                                    {field.options?.map((option, index) => (
                                                        <div key={index} className="flex items-center gap-2">
                                                            <input type="text" value={option} onChange={(e) => handleOptionChange(field.id, index, e.target.value)} className={`${inputClasses} flex-grow`} />
                                                            <button onClick={() => removeOption(field.id, index)} className="text-slate-400 hover:text-red-500 p-1">
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <Button variant="outline" size="sm" onClick={() => addOption(field.id)}>+ Add Option</Button>
                                                </div>
                                            </div>
                                        )}
                                        
                                        <div className="mt-2">
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Sync to Record Field</label>
                                             <Select
                                                value={field.linkedRecordField || ''}
                                                onChange={e => updateFormField(field.id, 'linkedRecordField', e.target.value || undefined)}
                                            >
                                                <option value="">-- Don't Sync --</option>
                                                {bookingDetailsFields.map(f => (
                                                    <option key={f.key} value={f.key}>{f.label}</option>
                                                ))}
                                            </Select>
                                        </div>

                                        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                                            <div className="flex items-center gap-2">
                                                <input type="checkbox" checked={field.required} onChange={e => updateFormField(field.id, 'required', e.target.checked)} id={`required-${field.id}`} className="h-4 w-4 text-primary rounded border-slate-300"/>
                                                <label htmlFor={`required-${field.id}`} className="text-sm font-medium text-slate-700">Required</label>
                                            </div>
                                            <button onClick={() => removeFormField(field.id)} className="text-sm font-medium text-red-600 hover:text-red-800">Remove</button>
                                        </div>
                                    </div>
                                ))}
                                <Button onClick={addFormField} className="w-full" variant="outline">+ Add Question</Button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'availability' && (
                         <div className="space-y-4 animate-fade-in max-h-[450px] overflow-y-auto custom-scrollbar pr-2">
                            <div>
                                <h3 className="text-lg font-medium text-slate-800 mb-2">Scheduling Rules</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-md">
                                    <PresetSelector
                                        label="Min. notice"
                                        value={minimumSchedulingNotice}
                                        onChange={setMinimumSchedulingNotice}
                                        options={noticeOptions}
                                        unit="minutes"
                                        inputClasses={inputClasses}
                                    />
                                    <PresetSelector
                                        label="Booking horizon"
                                        value={bookingHorizonDays}
                                        onChange={setBookingHorizonDays}
                                        options={horizonOptions}
                                        unit="days"
                                        inputClasses={inputClasses}
                                    />
                                     <PresetSelector
                                        label="Buffer before"
                                        value={bufferBefore}
                                        onChange={setBufferBefore}
                                        options={bufferOptions}
                                        unit="minutes"
                                        inputClasses={inputClasses}
                                    />
                                     <PresetSelector
                                        label="Buffer after"
                                        value={bufferAfter}
                                        onChange={setBufferAfter}
                                        options={bufferOptions}
                                        unit="minutes"
                                        inputClasses={inputClasses}
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <h3 className="text-lg font-medium text-slate-800 mb-2">Weekly Hours</h3>
                                {weekDays.map((day, index) => {
                                    const rule = availability.find(r => r.dayOfWeek === index);
                                    return (
                                        <div key={day} className="grid grid-cols-[auto_1fr_auto_1fr] md:grid-cols-[auto_100px_1fr_auto_1fr] items-center gap-x-3 p-2 rounded-md hover:bg-slate-50">
                                            <input type="checkbox" checked={!!rule} onChange={() => toggleDayAvailability(index)} className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"/>
                                            <span className="font-medium text-slate-700">{day}</span>
                                            {rule ? (
                                                <>
                                                    <Select value={rule.startTime} onChange={(e) => handleAvailabilityChange(index, 'startTime', e.target.value)}>
                                                        {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                                                    </Select>
                                                    <span className="text-slate-500 text-center">-</span>
                                                    <Select value={rule.endTime} onChange={(e) => handleAvailabilityChange(index, 'endTime', e.target.value)}>
                                                        {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                                                    </Select>
                                                </>
                                            ) : (
                                                <span className="col-span-3 text-slate-400 text-sm">Unavailable</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div>
                                <h3 className="text-lg font-medium text-slate-800 mb-2">Recurring Unavailable Times</h3>
                                <div className="space-y-2 bg-slate-50 p-4 rounded-md">
                                    {unavailability.map((slot, index) => (
                                        <div key={index} className="grid grid-cols-[1fr,1fr,auto,1fr,auto] items-center gap-2">
                                            <Select value={slot.dayOfWeek} onChange={e => handleUnavailabilityChange(index, 'dayOfWeek', parseInt(e.target.value))}>
                                                {weekDays.map((day, dayIndex) => <option key={dayIndex} value={dayIndex}>{day}</option>)}
                                            </Select>
                                            <Select value={slot.startTime} onChange={e => handleUnavailabilityChange(index, 'startTime', e.target.value)}>
                                                {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                                            </Select>
                                            <span className="text-slate-500 text-center">-</span>
                                            <Select value={slot.endTime} onChange={e => handleUnavailabilityChange(index, 'endTime', e.target.value)}>
                                                {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                                            </Select>
                                            <button onClick={() => removeUnavailabilitySlot(index)} className="text-slate-400 hover:text-red-500 p-1">
                                                 <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                            </button>
                                        </div>
                                    ))}
                                    <Button variant="outline" size="sm" onClick={addUnavailabilitySlot}>+ Add recurring time</Button>
                                </div>
                            </div>

                             <div>
                                <h3 className="text-lg font-medium text-slate-800 mb-2">Date Overrides / Specific Unavailability</h3>
                                <div className="space-y-2 bg-slate-50 p-4 rounded-md">
                                    {unavailableDates.map((override, index) => (
                                        <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr,auto,1fr,auto] items-center gap-2 p-2 border border-slate-200 rounded bg-white">
                                           <input type="date" value={override.date} onChange={e => handleDateOverrideChange(index, e.target.value)} className={inputClasses} />
                                           
                                           <div className="flex items-center justify-center gap-2">
                                                <input type="checkbox" id={`all-day-${index}`} checked={override.timeRanges.length === 0} onChange={() => toggleDateOverrideAllDay(index)} className="h-4 w-4 text-primary rounded border-slate-300"/>
                                                <label htmlFor={`all-day-${index}`} className="text-sm font-medium text-slate-700">All day</label>
                                            </div>

                                           {override.timeRanges.length > 0 && (
                                                <>
                                                    <Select value={override.timeRanges[0].startTime} onChange={e => handleDateOverrideTimeChange(index, 'startTime', e.target.value)}>
                                                        {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                                                    </Select>
                                                    <span className="text-slate-500 text-center">-</span>
                                                    <Select value={override.timeRanges[0].endTime} onChange={e => handleDateOverrideTimeChange(index, 'endTime', e.target.value)}>
                                                        {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                                                    </Select>
                                                </>
                                           )}
                                            <button onClick={() => removeDateOverride(index)} className="text-slate-400 hover:text-red-500 p-1">
                                                 <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                            </button