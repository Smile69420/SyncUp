import React, { useState, useEffect, useRef } from 'react';
import type { EventType } from '../types';
import Button from './ui/Button';

interface FilterDropdownProps {
    label: string;
    options: { value: string; label: string }[];
    selected: string[];
    onChange: (selected: string[]) => void;
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({ label, options, selected, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (value: string) => {
        const newSelected = selected.includes(value)
            ? selected.filter(s => s !== value)
            : [...selected, value];
        onChange(newSelected);
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm text-left flex justify-between items-center"
            >
                <span className="text-slate-700">{label} ({selected.length > 0 ? selected.length : 'All'})</span>
                <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-md shadow-lg max-h-60 overflow-y-auto custom-scrollbar">
                    {options.map(option => (
                        <label key={option.value} className="flex items-center px-3 py-2 hover:bg-slate-50 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selected.includes(option.value)}
                                onChange={() => handleSelect(option.value)}
                                className="h-4 w-4 text-primary rounded border-slate-300 focus:ring-primary"
                            />
                            <span className="ml-2 text-sm text-slate-800">{option.label}</span>
                        </label>
                    ))}
                     {selected.length > 0 && (
                        <div className="border-t p-2">
                             <Button size="sm" variant="outline" onClick={() => onChange([])} className="w-full">Clear selection</Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};


interface RecordsFilterBarProps {
    eventTypes: EventType[];
    onFilterChange: (filters: any) => void;
    onExport: () => void;
    resultsCount: number;
    hideEventTypeFilter?: boolean;
}

const RecordsFilterBar: React.FC<RecordsFilterBarProps> = ({ eventTypes, onFilterChange, onExport, resultsCount, hideEventTypeFilter = false }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
    const [dateRange, setDateRange] = useState('all');

    useEffect(() => {
        const handler = setTimeout(() => {
             onFilterChange({
                searchQuery,
                eventTypes: selectedEventTypes,
                statuses: selectedStatuses,
                dateRange
            });
        }, 300); // Debounce search query
       
        return () => clearTimeout(handler);
    }, [searchQuery, selectedEventTypes, selectedStatuses, dateRange, onFilterChange]);
    
    const statusOptions = [
        { value: 'Scheduled', label: 'Scheduled' },
        { value: 'Completed', label: 'Completed' },
        { value: 'Cancelled', label: 'Cancelled' },
        { value: 'No Show', label: 'No Show' }
    ];

    const eventTypeOptions = eventTypes.map(et => ({ value: et.id, label: et.name }));

    return (
        <div className="p-4 bg-slate-50 border rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <input
                    type="text"
                    placeholder="Search by name, email, company..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className={`w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm ${hideEventTypeFilter ? 'lg:col-span-3' : 'lg:col-span-2'}`}
                />
                {!hideEventTypeFilter && (
                    <FilterDropdown label="Event Type" options={eventTypeOptions} selected={selectedEventTypes} onChange={setSelectedEventTypes} />
                )}
                <FilterDropdown label="Status" options={statusOptions} selected={selectedStatuses} onChange={setSelectedStatuses} />
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
                 <p className="text-sm text-slate-600 font-medium">
                    {resultsCount} {resultsCount === 1 ? 'record' : 'records'} found
                </p>
                <Button onClick={onExport} variant="outline" size="sm" disabled={resultsCount === 0}>
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                    Export CSV
                </Button>
            </div>
        </div>
    );
};

export default RecordsFilterBar;