import type { EventType, Booking, BookingDocument, BookingDetails, BookingDetailsDocument, ColumnConfiguration } from '../types';
import { addMinutes } from 'date-fns';
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
  /**
   * Fetches event types from the Firestore database.
   */
  getEventTypes: async (): Promise<EventType[]> => {
    const eventTypesCollection = collection(db, 'eventTypes');
    const querySnapshot = await getDocs(eventTypesCollection);
    return querySnapshot.docs.map(doc => {
        const data = doc.data() as Omit<EventType, 'id' | 'link'>;
        return {
            id: doc.id,
            ...data,
            link: `/book/${doc.id}`,
        } as EventType;
    });
  },

  /**
   * Fetches a single event type by its ID from Firestore.
   */
  getEventTypeById: async (id: string): Promise<EventType | undefined> => {
     const docRef = doc(db, 'eventTypes', id);
     const docSnap = await getDoc(docRef);
     if (docSnap.exists()) {
        const data = docSnap.data() as Omit<EventType, 'id' | 'link'>;
        return { 
            id: docSnap.id, 
            ...data,
            link: `/book/${docSnap.id}`,
        } as EventType;
     }
     return undefined;
  },
  
  /**
   * Fetches all bookings from the Firestore database.
   */
  getBookings: async (): Promise<Booking[]> => {
    const bookingsCollection = collection(db, 'bookings');
    const querySnapshot = await getDocs(bookingsCollection);
    return querySnapshot.docs.map(doc => {
        const data = doc.data() as BookingDocument;
        return {
            id: doc.id,
            ...data,
            startTime: data.startTime.toDate(),
            endTime: data.endTime.toDate(),
        };
    });
  },

  /**
   * Fetches all bookings associated with a specific event type.
   */
  getBookingsForEventType: async (eventTypeId: string): Promise<Booking[]> => {
    const bookingsCollection = collection(db, 'bookings');
    const q = query(bookingsCollection, where("eventTypeId", "==", eventTypeId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
        const data = doc.data() as BookingDocument;
        return {
            id: doc.id,
            ...data,
            startTime: data.startTime.toDate(),
            endTime: data.endTime.toDate(),
        };
    });
  },

  /**
   * Fetches all booking details from Firestore.
   */
  getBookingDetails: async (): Promise<BookingDetails[]> => {
    const detailsCollection = collection(db, 'bookingDetails');
    const querySnapshot = await getDocs(detailsCollection);
    return querySnapshot.docs.map(doc => {
        const data = doc.data() as BookingDetailsDocument;
        return {
            id: doc.id,
            ...data
        } as BookingDetails;
    });
  },

  /**
   * Updates a booking details document in Firestore and syncs status changes to Google Sheets.
   */
  updateBookingDetails: async (bookingId: string, data: Partial<BookingDetailsDocument>, eventTypeId?: string): Promise<void> => {
    const docRef = doc(db, 'bookingDetails', bookingId);
    await updateDoc(docRef, data);

    // If meetingStatus was updated, sync to Google Sheet
    if (data.meetingStatus && eventTypeId) {
        const appsScriptUrl = config.appsScriptUrl;
        if (!appsScriptUrl) return;

        try {
            const eventType = await firestoreService.getEventTypeById(eventTypeId);
            if (eventType && eventType.googleSheetConfig?.sheetId && eventType.googleSheetConfig?.sheetName) {
                const payload = {
                    action: 'updateStatus',
                    bookingId: bookingId,
                    newStatus: data.meetingStatus,
                    sheetId: eventType.googleSheetConfig.sheetId,
                    sheetName: eventType.googleSheetConfig.sheetName,
                };

                const response = await fetch(appsScriptUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify(payload)
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Apps Script error: ${response.statusText} - ${errorText}`);
                }
                console.log(`[APPS SCRIPT] Sent status update for booking ${bookingId}`);
            }
        } catch (error) {
            console.error("[APPS SCRIPT] Failed to send status update:", error);
        }
    }
  },

  /**
   * Creates a new booking in Firestore and triggers server-side Google integrations.
   */
  createBooking: async (bookingData: Omit<Booking, 'id' | 'endTime'>): Promise<Booking> => {
    const eventType = await firestoreService.getEventTypeById(bookingData.eventTypeId);
    if (!eventType) {
      throw new Error("Event type not found");
    }
    
    const endTime = addMinutes(bookingData.startTime, eventType.duration);

    const bookingToCreate = {
        ...bookingData,
        endTime: endTime,
    };
    
    const docRef = await addDoc(collection(db, 'bookings'), bookingToCreate);
    
    const initialDetails: BookingDetailsDocument = {
      meetingStatus: 'Scheduled',
      customFields: {},
    };

    // Sync custom form answers to specific record fields if linked
    eventType.customFormFields.forEach(field => {
        if (field.linkedRecordField && bookingData.customAnswers?.[field.id]) {
            const value = bookingData.customAnswers[field.id];
            if (field.type === 'checkbox') {
                 (initialDetails as any)[field.linkedRecordField] = value === 'true';
            } else {
                 (initialDetails as any)[field.linkedRecordField] = value;
            }
        }
    });

    await setDoc(doc(db, 'bookingDetails', docRef.id), initialDetails);

    let newBooking: Booking = {
        ...bookingToCreate,
        id: docRef.id,
    };

    // --- SERVER-SIDE INTEGRATIONS VIA GOOGLE APPS SCRIPT ---
    const appsScriptUrl = config.appsScriptUrl;
    if (appsScriptUrl && (eventType.googleSheetConfig?.sheetId || (eventType.mode === 'online' && eventType.conferencing?.provider === 'google-meet'))) {
        console.log(`[APPS SCRIPT] Sending booking data...`);

        const bookingPayload = { ...newBooking };
        
        try {
            const response = await fetch(appsScriptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify({ eventType, bookingData: bookingPayload })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Apps Script error: ${response.statusText} - ${errorText}`);
            }

            const responseData = await response.json();
            console.log('[APPS SCRIPT] Response received:', responseData);

            if (responseData.status === 'success' && responseData.meetingLink) {
                newBooking.meetingLink = responseData.meetingLink;
            }
        } catch (error) {
            console.error("[APPS SCRIPT] Error calling Google Apps Script:", error);
            // Let the user know the booking was made but integration might have failed.
            alert("Your booking was successful, but there was an issue with a Google integration (Calendar or Sheets). Please check your email for a confirmation. Error: " + (error as Error).message);
        }
    }

    return newBooking;
  },

  /**
   * Saves an event type (creates or updates) to Firestore.
   */
  saveEventType: async (eventTypeData: Omit<EventType, 'id' | 'link'> & { id?: string }): Promise<EventType> => {
     const dataToSave = JSON.parse(JSON.stringify(eventTypeData));

     if (dataToSave.id) {
         const docId = dataToSave.id;
         const docRef = doc(db, 'eventTypes', docId);
         delete dataToSave.id;
         await setDoc(docRef, dataToSave, { merge: true });
         return { ...dataToSave, id: docId, link: `/book/${docId}` } as EventType;
     } else {
         const newDocRef = doc(collection(db, 'eventTypes'));
         const newId = newDocRef.id;
         await setDoc(newDocRef, dataToSave);
         return { ...dataToSave, id: newId, link: `/book/${newId}` } as EventType;
     }
  },
  
  /**
   * Deletes a booking and its details from Firestore and triggers deletion in integrated services.
   */
  deleteBooking: async (bookingId: string, eventTypeId: string): Promise<void> => {
    const batch = writeBatch(db);

    const bookingRef = doc(db, 'bookings', bookingId);
    const detailsRef = doc(db, 'bookingDetails', bookingId);

    batch.delete(bookingRef);
    batch.delete(detailsRef);

    await batch.commit();

    const appsScriptUrl = config.appsScriptUrl;
    if (!appsScriptUrl) return;

    try {
        const eventType = await firestoreService.getEventTypeById(eventTypeId);
        const payload: { action: string; bookingId: string; sheetId?: string; sheetName?: string } = {
            action: 'deleteBooking',
            bookingId: bookingId,
        };

        if (eventType && eventType.googleSheetConfig?.sheetId) {
            payload.sheetId = eventType.googleSheetConfig.sheetId;
            payload.sheetName = eventType.googleSheetConfig.sheetName;
        }
        
        const response = await fetch(appsScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Apps Script error: ${response.statusText} - ${errorText}`);
        }
        console.log(`[APPS SCRIPT] Sent delete request for booking ${bookingId}`);
    } catch (error) {
        console.error("[APPS SCRIPT] Failed to send delete request:", error);
        // Don't rethrow, the primary deletion from Firestore succeeded.
    }
  },

  /**
   * Deletes an event type and all its associated bookings and booking details atomically.
   */
  deleteEventTypeAndBookings: async (eventTypeId: string): Promise<void> => {
    const batch = writeBatch(db);

    // 1. Find all associated bookings
    const associatedBookings = await firestoreService.getBookingsForEventType(eventTypeId);

    // 2. Add delete operations for each booking and its details to the batch
    associatedBookings.forEach(booking => {
        const bookingRef = doc(db, 'bookings', booking.id);
        const detailsRef = doc(db, 'bookingDetails', booking.id);
        batch.delete(bookingRef);
        batch.delete(detailsRef);
        // Note: This does not trigger individual deletions in Google services.
        // That would require iterating and calling the apps script for each, which could be slow.
        // The calendar events will remain but the app will no longer see them.
    });

    // 3. Add the delete operation for the event type itself
    const eventTypeRef = doc(db, 'eventTypes', eventTypeId);
    batch.delete(eventTypeRef);

    // 4. Commit the batch
    await batch.commit();
  },
};