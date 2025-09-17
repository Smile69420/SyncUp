import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Sector } from 'recharts';
import { firestoreService } from '../services/firestoreService';
import type { Booking, EventType } from '../types';
import Spinner from './ui/Spinner';
import Card from './ui/Card';
import Select from './ui/Select';
import { format, getHours, subDays, startOfMonth, isAfter } from 'date-fns';

const renderActiveShape = (props: any) => {
  const RADIAN = Math.PI / 180;
  const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const sx = cx + (outerRadius + 10) * cos;
  const sy = cy + (outerRadius + 10) * sin;
  const mx = cx + (outerRadius + 30) * cos;
  const my = cy + (outerRadius + 30) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 22;
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';

  return (
    <g>
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill}>
        {payload.name}
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 6}
        outerRadius={outerRadius + 10}
        fill={fill}
      />
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#333">{`${value} Bookings`}</text>
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="#999">
        {`(Rate ${(percent * 100).toFixed(2)}%)`}
      </text>
    </g>
  );
};

const MultiSelectEventType: React.FC<{
    eventTypes: EventType[];
    selectedIds: string[];
    onChange: (ids: string[]) => void;
}> = ({ eventTypes, selectedIds, onChange }) => {
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

    const handleSelect = (id: string) => {
        const newSelectedIds = selectedIds.includes(id)
            ? selectedIds.filter(selectedId => selectedId !== id)
            : [...selectedIds, id];
        onChange(newSelectedIds);
    };

    return (
        <div className="relative w-full md:w-64" ref={wrapperRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full text-left px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm text-slate-900 flex justify-between items-center"
            >
                <span>{selectedIds.length === 0 ? 'All Event Types' : `${selectedIds.length} types selected`}</span>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {eventTypes.map(et => (
                        <label key={et.id} className="flex items-center px-3 py-2 hover:bg-slate-50 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selectedIds.includes(et.id)}
                                onChange={() => handleSelect(et.id)}
                                className="h-4 w-4 text-primary rounded border-slate-300 focus:ring-primary"
                            />
                            <span className="ml-2 text-sm text-slate-800">{et.name}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
};


const Analytics: React.FC = () => {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [eventTypes, setEventTypes] = useState<EventType[]>([]);
    const [loading, setLoading] = useState(true);
    const [pieActiveIndex, setPieActiveIndex] = useState(0);

    // Filter states
    const [dateRange, setDateRange] = useState('all'); // 'all', '7d', '30d', 'month'
    const [selectedEventTypeIds, setSelectedEventTypeIds] = useState<string[]>([]);


    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [books, types] = await Promise.all([
                    firestoreService.getBookings(),
                    firestoreService.getEventTypes(),
                ]);
                setBookings(books.map(b => ({...b, startTime: new Date(b.startTime), endTime: new Date(b.endTime)})));
                setEventTypes(types);
            } catch (error) {
                console.error("Failed to fetch analytics data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);
    
    const filteredBookings = useMemo(() => {
        let bookingsToFilter = bookings;

        // Date range filter
        const now = new Date();
        if (dateRange === '7d') {
            bookingsToFilter = bookingsToFilter.filter(b => isAfter(b.startTime, subDays(now, 7)));
        } else if (dateRange === '30d') {
            bookingsToFilter = bookingsToFilter.filter(b => isAfter(b.startTime, subDays(now, 30)));
        } else if (dateRange === 'month') {
            const startOfThisMonth = startOfMonth(now);
            bookingsToFilter = bookingsToFilter.filter(b => isAfter(b.startTime, startOfThisMonth));
        }

        // Event type filter
        if (selectedEventTypeIds.length > 0) {
            bookingsToFilter = bookingsToFilter.filter(b => selectedEventTypeIds.includes(b.eventTypeId));
        }

        return bookingsToFilter;
    }, [bookings, dateRange, selectedEventTypeIds]);


    const eventTypeMap = useMemo(() =>
        eventTypes.reduce((acc, et) => {
            acc[et.id] = et;
            return acc;
        }, {} as Record<string, EventType>), [eventTypes]);

    const bookingsPerDay = useMemo(() => {
        const counts: { [key: string]: number } = {};
        filteredBookings.forEach(booking => {
            const day = format(booking.startTime, 'yyyy-MM-dd');
            counts[day] = (counts[day] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [filteredBookings]);
    
    const popularBookingTimes = useMemo(() => {
        const hourCounts = Array(24).fill(0);
        filteredBookings.forEach(booking => {
            const hour = getHours(booking.startTime);
            hourCounts[hour]++;
        });
        return hourCounts.map((count, hour) => ({
            name: `${hour}:00`,
            count,
        })).filter(item => item.count > 0);
    }, [filteredBookings]);

    const bookingsByEventType = useMemo(() => {
        const counts: { [key: string]: number } = {};
        filteredBookings.forEach(booking => {
            const eventTypeName = eventTypeMap[booking.eventTypeId]?.name || 'Unknown';
            counts[eventTypeName] = (counts[eventTypeName] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [filteredBookings, eventTypeMap]);

    const eventTypeColors = useMemo(() => {
        return eventTypes.map(et => et.color);
    }, [eventTypes]);

    if (loading) {
        return <div className="flex justify-center items-center h-96"><Spinner /></div>;
    }

    return (
        <div className="container mx-auto space-y-8">
            <h1 className="text-3xl font-bold">Analytics</h1>
             <Card>
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    <h2 className="text-xl font-semibold">Filters</h2>
                    <div className="flex-grow flex flex-col md:flex-row gap-4 items-center w-full md:w-auto">
                         <Select value={dateRange} onChange={e => setDateRange(e.target.value)} className="w-full md:w-48">
                            <option value="all">All Time</option>
                            <option value="7d">Last 7 Days</option>
                            <option value="30d">Last 30 Days</option>
                            <option value="month">This Month</option>
                        </Select>
                        <MultiSelectEventType 
                            eventTypes={eventTypes} 
                            selectedIds={selectedEventTypeIds}
                            onChange={setSelectedEventTypeIds}
                        />
                    </div>
                </div>
            </Card>

             <Card>
                <h2 className="text-xl font-semibold mb-4">Key Metrics</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-3xl font-bold text-primary">{filteredBookings.length}</p>
                        <p className="text-sm text-gray-500">Total Bookings</p>
                    </div>
                     <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-3xl font-bold text-primary">{eventTypes.length}</p>
                        <p className="text-sm text-gray-500">Event Types</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-3xl font-bold text-primary">{bookingsPerDay.length}</p>
                        <p className="text-sm text-gray-500">Active Days</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-3xl font-bold text-primary">
                            {filteredBookings.length > 0 ? (filteredBookings.reduce((sum, b) => sum + (eventTypes.find(et => et.id === b.eventTypeId)?.duration || 0), 0) / 60).toFixed(1) : 0}
                        </p>
                        <p className="text-sm text-gray-500">Total Hours Booked</p>
                    </div>
                </div>
            </Card>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card>
                    <h2 className="text-xl font-semibold mb-4">Bookings by Event Type</h2>
                     <div className="h-80">
                         {bookingsByEventType.length > 0 ? (
                             <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie 
                                        {...{ activeIndex: pieActiveIndex } as any}
                                        activeShape={renderActiveShape}
                                        data={bookingsByEventType} 
                                        cx="50%" 
                                        cy="50%" 
                                        innerRadius={60}
                                        outerRadius={80}
                                        dataKey="value"
                                        onMouseEnter={(_, index) => setPieActiveIndex(index)}
                                    >
                                        {bookingsByEventType.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={eventTypeColors[index % eventTypeColors.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                         ) : (
                             <div className="flex items-center justify-center h-full text-gray-500">No data for selected filters.</div>
                         )}
                    </div>
                </Card>
                 <Card>
                    <h2 className="text-xl font-semibold mb-4">Popular Booking Times</h2>
                    <div className="h-80">
                        {popularBookingTimes.length > 0 ? (
                             <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={popularBookingTimes} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis allowDecimals={false} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="count" fill="#0ea5e9" name="Bookings" />
                                </BarChart>
                            </ResponsiveContainer>
                         ) : (
                             <div className="flex items-center justify-center h-full text-gray-500">No data for selected filters.</div>
                         )}
                    </div>
                </Card>
            </div>
            <Card>
                <h2 className="text-xl font-semibold mb-4">Bookings per Day</h2>
                <div className="h-80">
                     {bookingsPerDay.length > 0 ? (
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={bookingsPerDay} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="count" fill="#4f46e5" name="Bookings" />
                            </BarChart>
                        </ResponsiveContainer>
                      ) : (
                         <div className="flex items-center justify-center h-full text-gray-500">No data for selected filters.</div>
                     )}
                </div>
            </Card>
        </div>
    );
};

export default Analytics;