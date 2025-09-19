import type { EventType, Booking, BookingDocument, BookingDetails, BookingDetailsDocument, MergedBooking } from '../types';
import { addMinutes, isWithinInterval, subDays } from 'date-fns';
import { db } from './firebaseService';
import {
    collection,
    getDocs,
    getDoc,
    doc,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    writeBatch,
} from 'firebase/firestore';
import { config } from '../config';


// --- SERVICE LOGIC using Firebase Firestore ---

export const firestoreService = {
  getEventTypes: async (): Promise<EventType[]> => {
    const eventTypesCollection = collection(db, 'eventTypes');
    const querySnapshot = await getDocs(eventTypesCollection);
    return querySnapshot.docs.map(doc => {
        const data = doc.data() as Omit<EventType, 'id' | 'link'>;
        return { id: doc.id, ...data, link: `/book/${doc.id}` } as EventType;
    });
  },

  getEventTypeById: async (id: string): Promise<EventType | undefined> => {
     const docRef = doc(db, 'eventTypes', id);
     const docSnap = await getDoc(docRef);
     if (docSnap.exists()) {
        const data = docSnap.data() as Omit<EventType, 'id' | 'link'>;
        return { id: docSnap.id, ...data, link: `/book/${docSnap.id}` } as EventType;
     }
     return undefined;
  },
  
  getBookings: async (): Promise<Booking[]> => {
    const bookingsCollection = collection(db, 'bookings');
    const querySnapshot = await getDocs(bookingsCollection);
    return querySnapshot.docs.map(doc => {
        const data = doc.data() as BookingDocument;
        return { id: doc.id, ...data, startTime: data.startTime.toDate(), endTime: data.endTime.toDate() };
    });
  },

  getBookingsForEventType: async (eventTypeId: string): Promise<Booking[]> => {
    const q = query(collection(db, 'bookings'), where("eventTypeId", "==", eventTypeId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
        const data = doc.data() as BookingDocument;
        return { id: doc.id, ...data, startTime: data.startTime.toDate(), endTime: data.endTime.toDate() };
    });
  },

  getBookingDetails: async (): Promise<BookingDetails[]> => {
    const detailsCollection = collection(db, 'bookingDetails');
    const querySnapshot = await getDocs(detailsCollection);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BookingDetails));
  },

  updateBookingDetails: async (bookingId: string, data: Partial<BookingDetailsDocument>, eventTypeId?: string): Promise<void> => {
    const docRef = doc(db, 'bookingDetails', bookingId);
    await updateDoc(docRef, data);

    if (data.meetingStatus && eventTypeId && config.appsScriptUrl) {
        try {
            const eventType = await firestoreService.getEventTypeById(eventTypeId);
            if (eventType?.googleSheetConfig) {
                const payload = {
                    action: 'updateStatus',
                    bookingId: bookingId,
                    newStatus: data.meetingStatus,
                    sheetId: eventType.googleSheetConfig.sheetId,
                    sheetName: eventType.googleSheetConfig.sheetName,
                };
                const response = await fetch(config.appsScriptUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify(payload)
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`[APPS SCRIPT DIAGNOSTICS] URL: ${config.appsScriptUrl}, Status: ${response.status}, Response: ${errorText}`);
                    throw new Error(`Google Sheets status update failed. See console for details.`);
                }
                console.log(`[APPS SCRIPT] Sent status update for booking ${bookingId}`);
            }
        } catch (error) {
            console.error("[APPS SCRIPT] Critical error during status update:", error);
            throw error;
        }
    }
  },

  createBooking: async (bookingData: Omit<Booking, 'id' | 'endTime'>): Promise<Booking> => {
    const eventType = await firestoreService.getEventTypeById(bookingData.eventTypeId);
    if (!eventType) throw new Error("Event type not found");
    
    const endTime = addMinutes(bookingData.startTime, eventType.duration);
    const bookingToCreate = { ...bookingData, endTime };
    
    const docRef = await addDoc(collection(db, 'bookings'), bookingToCreate);
    const newBookingId = docRef.id;

    const initialDetails: BookingDetailsDocument = { meetingStatus: 'Scheduled' };
    eventType.customFormFields.forEach(field => {
        if (field.linkedRecordField && bookingData.customAnswers?.[field.id]) {
            const value = bookingData.customAnswers[field.id];
            (initialDetails as any)[field.linkedRecordField] = field.type === 'checkbox' ? value === 'true' : value;
        }
    });
    await setDoc(doc(db, 'bookingDetails', newBookingId), initialDetails);

    let newBooking: Booking = { ...bookingToCreate, id: newBookingId };

    if (config.appsScriptUrl && (eventType.googleSheetConfig || eventType.mode === 'online')) {
        console.log(`[APPS SCRIPT] Sending booking data...`);
        try {
            const response = await fetch(config.appsScriptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ eventType, bookingData: { ...newBooking } })
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[APPS SCRIPT DIAGNOSTICS] URL: ${config.appsScriptUrl}, Status: ${response.status}, Response: ${errorText}`);
                throw new Error(`Google service integration failed. See console for details.`);
            }
            const responseData = await response.json();
            console.log('[APPS SCRIPT] Response received:', responseData);
            if (responseData.status === 'success' && responseData.meetingLink) {
                newBooking.meetingLink = responseData.meetingLink;
            }
        } catch (error) {
            console.error("[APPS SCRIPT] Critical error calling Google Apps Script:", error);
            alert("Booking successful, but Google integration failed. Please check your email for confirmation. Error: " + (error as Error).message);
        }
    }
    return newBooking;
  },

  saveEventType: async (eventTypeData: Omit<EventType, 'id' | 'link'> & { id?: string }): Promise<EventType> => {
     const dataToSave = JSON.parse(JSON.stringify(eventTypeData));
     if (dataToSave.id) {
         const { id, ...rest } = dataToSave;
         await setDoc(doc(db, 'eventTypes', id), rest, { merge: true });
         return { ...rest, id, link: `/book/${id}` } as EventType;
     } else {
         const newDocRef = await addDoc(collection(db, 'eventTypes'), dataToSave);
         return { ...dataToSave, id: newDocRef.id, link: `/book/${newDocRef.id}` } as EventType;
     }
  },
  
  deleteBooking: async (bookingId: string, eventTypeId: string): Promise<void> => {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'bookings', bookingId));
    batch.delete(doc(db, 'bookingDetails', bookingId));
    await batch.commit();

    if (!config.appsScriptUrl) return;
    try {
        const eventType = await firestoreService.getEventTypeById(eventTypeId);
        const payload = {
            action: 'deleteBooking',
            bookingId,
            sheetId: eventType?.googleSheetConfig?.sheetId,
            sheetName: eventType?.googleSheetConfig?.sheetName,
        };
        const response = await fetch(config.appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[APPS SCRIPT DIAGNOSTICS] URL: ${config.appsScriptUrl}, Status: ${response.status}, Response: ${errorText}`);
            throw new Error(`Google service delete failed. See console for details.`);
        }
        console.log(`[APPS SCRIPT] Sent delete request for booking ${bookingId}`);
    } catch (error) {
        console.error("[APPS SCRIPT] Critical error during delete:", error);
        throw error;
    }
  },

  deleteMultipleBookings: async (bookingIds: string[], bookingToEventTypeMap: { [bookingId: string]: string }): Promise<void> => {
    const batch = writeBatch(db);
    bookingIds.forEach(id => {
        batch.delete(doc(db, 'bookings', id));
        batch.delete(doc(db, 'bookingDetails', id));
    });
    await batch.commit();

    if (!config.appsScriptUrl) return;
    try {
        const allEventTypes = await firestoreService.getEventTypes();
        const eventTypeMap = new Map(allEventTypes.map(et => [et.id, et]));
        const payload = {
            action: 'deleteMultipleBookings',
            bookings: bookingIds.map(id => {
                const eventTypeId = bookingToEventTypeMap[id];
                const eventType = eventTypeMap.get(eventTypeId);
                return {
                    bookingId: id,
                    sheetId: eventType?.googleSheetConfig?.sheetId,
                    sheetName: eventType?.googleSheetConfig?.sheetName,
                };
            }),
        };
        const response = await fetch(config.appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[APPS SCRIPT DIAGNOSTICS] URL: ${config.appsScriptUrl}, Status: ${response.status}, Response: ${errorText}`);
            throw new Error(`Google service multi-delete failed. See console for details.`);
        }
    } catch (error) {
        console.error("[APPS SCRIPT] Critical error during multi-delete:", error);
        throw error;
    }
},

  rescheduleBooking: async (bookingId: string, eventTypeId: string, newStartTime: Date): Promise<void> => {
    const eventType = await firestoreService.getEventTypeById(eventTypeId);
    if (!eventType) throw new Error("Event type not found for rescheduling.");

    const newEndTime = addMinutes(newStartTime, eventType.duration);
    await updateDoc(doc(db, 'bookings', bookingId), { startTime: newStartTime, endTime: newEndTime });
    
    if (!config.appsScriptUrl) return;
    try {
        const payload = {
            action: 'rescheduleBooking',
            bookingId,
            newStartTime: newStartTime.toISOString(),
            newEndTime: newEndTime.toISOString(),
            sheetId: eventType.googleSheetConfig?.sheetId,
            sheetName: eventType.googleSheetConfig?.sheetName,
        };
        const response = await fetch(config.appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[APPS SCRIPT DIAGNOSTICS] URL: ${config.appsScriptUrl}, Status: ${response.status}, Response: ${errorText}`);
            throw new Error(`Google service reschedule failed. See console for details.`);
        }
    } catch (error) {
        console.error("[APPS SCRIPT] Critical error during reschedule:", error);
        throw error;
    }
},

  deleteEventTypeAndBookings: async (eventTypeId: string): Promise<void> => {
    const batch = writeBatch(db);
    const associatedBookings = await firestoreService.getBookingsForEventType(eventTypeId);

    associatedBookings.forEach(booking => {
        batch.delete(doc(db, 'bookings', booking.id));
        batch.delete(doc(db, 'bookingDetails', booking.id));
    });

    batch.delete(doc(db, 'eventTypes', eventTypeId));
    await batch.commit();
  },
  
  filterBookings: (bookings: MergedBooking[], filters: any): MergedBooking[] => {
    let data = bookings;
    const { dateRange, searchQuery, eventTypes, statuses } = filters;

    if (dateRange !== 'all') {
        const now = new Date();
        const rangeStart = subDays(now, parseInt(dateRange));
        data = data.filter(item => isWithinInterval(item.startTime, { start: rangeStart, end: now }));
    }

    if (searchQuery) {
        const lowercasedQuery = searchQuery.toLowerCase();
        data = data.filter(item =>
            item.bookerName?.toLowerCase().includes(lowercasedQuery) ||
            item.bookerEmail?.toLowerCase().includes(lowercasedQuery) ||
            item.companyName?.toLowerCase().includes(lowercasedQuery)
        );
    }

    if (eventTypes.length > 0) {
        data = data.filter(item => eventTypes.includes(item.eventTypeId));
    }

    if (statuses.length > 0) {
        data = data.filter(item => statuses.includes(item.meetingStatus || 'Scheduled'));
    }

    return data;
  },
};