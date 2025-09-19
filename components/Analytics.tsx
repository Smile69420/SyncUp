import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Sector } from 'recharts';
import { firestoreService } from '../services/firestoreService';
import type { Booking, EventType, BookingDetails } from '../types';
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
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} className="font-semibold">
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
        {`(Rate ${(percent * 100).toFixed(1)}%)`}
      </text>
    </g>
  );
};

const KpiCard: React.FC<{ title: string; value: string | number; description?: string }> = ({ title, value, description }) => (
    <div className="bg-slate-50 p-4 rounded-lg">
        <p className="text-sm text-slate-500 font-medium">{title}</p>
        <p className="text-3xl font-bold text-primary mt-1">{value}</p>
        {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
    </div>
);

const Analytics: React.FC = () => {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [bookingDetails, setBookingDetails] = useState<BookingDetails[]>([]);
    const [eventTypes, setEventTypes] = useState<EventType[]>([]);
    const [loading, setLoading] = useState(true);
    const [pieActiveIndex, setPieActiveIndex] = useState(0);

    const [dateRange, setDateRange] = useState('all');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [books, types, details] = await Promise.all([
                    firestoreService.getBookings(),
                    firestoreService.getEventTypes(),
                    firestoreService.getBookingDetails(),
                ]);
                setBookings(books.map(b => ({...b, startTime: new Date(b.startTime), endTime: new Date(b.endTime)})));
                setEventTypes(types);
                setBookingDetails(details);
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
        const now = new Date();
        if (dateRange === '7d') {
            bookingsToFilter = bookingsToFilter.filter(b => isAfter(b.startTime, subDays(now, 7)));
        } else if (dateRange === '30d') {
            bookingsToFilter = bookingsToFilter.filter(b => isAfter(b.startTime, subDays(now, 30)));
        } else if (dateRange === 'month') {
            const startOfThisMonth = startOfMonth(now);
            bookingsToFilter = bookingsToFilter.filter(b => isAfter(b.startTime, startOfThisMonth));
        }
        return bookingsToFilter;
    }, [bookings, dateRange]);

    const analyticsData = useMemo(() => {
        const detailsMap = new Map(bookingDetails.map(d => [d.id, d]));
        const enrichedBookings = filteredBookings.map(b => ({
            ...b,
            details: detailsMap.get(b.id)
        }));

        const total = enrichedBookings.length;
        const completed = enrichedBookings.filter(b => b.details?.meetingStatus === 'Completed').length;
        const noShows = enrichedBookings.filter(b => b.details?.meetingStatus === 'No Show').length;
        const completionRate = (completed + noShows) > 0 ? (completed / (completed + noShows) * 100) : 0;
        
        return {
            totalBookings: total,
            completionRate: `${completionRate.toFixed(1)}%`,
            completedMeetings: completed,
            followUpsDone: enrichedBookings.filter(b => b.details?.followUpStatus === 'Done').length,
        };
    }, [filteredBookings, bookingDetails]);

    const eventTypeMap = useMemo(() => eventTypes.reduce((acc, et) => ({...acc, [et.id]: et }), {} as Record<string, EventType>), [eventTypes]);

    const popularBookingTimes = useMemo(() => {
        const hourCounts = Array(24).fill(0);
        filteredBookings.forEach(booking => hourCounts[getHours(booking.startTime)]++);
        return hourCounts.map((count, hour) => ({ name: `${hour}:00`, count })).filter(item => item.count > 0);
    }, [filteredBookings]);

    const bookingsByEventType = useMemo(() => {
        const counts = filteredBookings.reduce((acc, booking) => {
            const name = eventTypeMap[booking.eventTypeId]?.name || 'Unknown';
            acc[name] = (acc[name] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [filteredBookings, eventTypeMap]);

    const meetingStatusData = useMemo(() => {
        const detailsMap = new Map(bookingDetails.map(d => [d.id, d]));
        const statusCounts = filteredBookings.reduce((acc, booking) => {
            const status = detailsMap.get(booking.id)?.meetingStatus || 'Scheduled';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        return Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
    }, [filteredBookings, bookingDetails]);

    const followUpStatusData = useMemo(() => {
        const detailsMap = new Map(bookingDetails.map(d => [d.id, d]));
        const statusCounts = filteredBookings.reduce((acc, booking) => {
            const status = detailsMap.get(booking.id)?.followUpStatus;
            if (status) { // Only count if a status is set
                 acc[status] = (acc[status] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);
        return Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
    }, [filteredBookings, bookingDetails]);

    const PIE_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

    if (loading) {
        return <div className="flex justify-center items-center h-96"><Spinner /></div>;
    }

    return (
        <div className="container mx-auto space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-3xl font-bold">Analytics</h1>
                <div className="w-full md:w-auto">
                    <Select value={dateRange} onChange={e => setDateRange(e.target.value)} className="w-full md:w-48">
                        <option value="all">All Time</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                        <option value="month">This Month</option>
                    </Select>
                </div>
            </div>

             <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <KpiCard title="Total Bookings" value={analyticsData.totalBookings} description="Based on current filters" />
                <KpiCard title="Completion Rate" value={analyticsData.completionRate} description="Completed / (Completed + No Shows)" />
                <KpiCard title="Meetings Completed" value={analyticsData.completedMeetings} />
                <KpiCard title="Follow-ups Done" value={analyticsData.followUpsDone} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <Card>
                    <h2 className="text-xl font-semibold mb-4">Meeting Status Breakdown</h2>
                    <div className="h-80">
                         {meetingStatusData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={meetingStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" paddingAngle={5}>
                                        {meetingStatusData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                         ) : <div className="flex items-center justify-center h-full text-gray-500">No data for selected filters.</div>}
                    </div>
                </Card>
                 <Card>
                    <h2 className="text-xl font-semibold mb-4">Follow-up Status</h2>
                    <div className="h-80">
                         {followUpStatusData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={followUpStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" paddingAngle={5}>
                                        {followUpStatusData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                         ) : <div className="flex items-center justify-center h-full text-gray-500">No data for selected filters.</div>}
                    </div>
                </Card>
            </div>
            
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
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                         ) : <div className="flex items-center justify-center h-full text-gray-500">No data available.</div>}
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
                                    <Bar dataKey="count" fill="#0ea5e9" name="Bookings" />
                                </BarChart>
                            </ResponsiveContainer>
                         ) : <div className="flex items-center justify-center h-full text-gray-500">No data for selected filters.</div>}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default Analytics;