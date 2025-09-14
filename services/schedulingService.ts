import type { EventType, Booking, BookingDocument } from '../types';
import { addMinutes, format } from 'date-fns';
import { googleApiService } from './googleApiService';
import { db } from './firebaseService';
import {
    collection,
    getDocs,
    getDoc,
    doc,
    addDoc,
    setDoc,
    updateDoc,
} from 'firebase/firestore';


// --- SERVICE LOGIC using Firebase Firestore ---

export const schedulingService = {
  /**
   * [LIVE] Fetches event types from the Firestore database.
   */
  getEventTypes: async (): Promise<EventType[]> => {
    const eventTypesCollection = collection(db, 'eventTypes');
    const querySnapshot = await getDocs(eventTypesCollection);
    return querySnapshot.docs.map(doc => {
        // FIX: Explicitly cast the document data to an object to resolve spread operator error.
        // Also, derive the `link` property to ensure it's always present.
        const data = doc.data() as Omit<EventType, 'id' | 'link'>;
        return {
            id: doc.id,
            ...data,
            link: `/book/${doc.id}`,
        } as EventType;
    });
  },

  /**
   * [LIVE] Fetches a single event type by its ID from Firestore.
   */
  getEventTypeById: async (id: string): Promise<EventType | undefined> => {
     const docRef = doc(db, 'eventTypes', id);
     const docSnap = await getDoc(docRef);
     if (docSnap.exists()) {
        // FIX: Explicitly cast the document data to an object to resolve spread operator error.
        // Also, derive the `link` property to ensure it's always present.
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
   * [LIVE] Fetches all bookings from the Firestore database.
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
   * [LIVE] Creates a new booking in Firestore and triggers Google integrations.
   */
  createBooking: async (bookingData: Omit<Booking, 'id' | 'endTime'>): Promise<Booking> => {
    const eventType = await schedulingService.getEventTypeById(bookingData.eventTypeId);
    if (!eventType) {
      throw new Error("Event type not found");
    }
    
    const endTime = addMinutes(bookingData.startTime, eventType.duration);

    // Prepare data with correct Date objects for Firestore conversion
    const bookingToCreate = {
        ...bookingData,
        endTime: endTime,
    };
    
    const docRef = await addDoc(collection(db, 'bookings'), bookingToCreate);
    
    let newBooking: Booking = {
        ...bookingToCreate,
        id: docRef.id,
    };

    // --- LIVE INTEGRATIONS ---
    if (googleApiService.getIsSignedIn()) {
        // 1. Google Meet Link Generation
        if (eventType.mode === 'online' && eventType.conferencing?.provider === 'google-meet') {
            try {
                const meetingLink = await googleApiService.createCalendarEvent(newBooking, eventType);
                newBooking.meetingLink = meetingLink;
                console.log(`[LIVE] Google Meet link created: ${meetingLink}`);
            } catch (error) {
                console.error("[LIVE] Failed to create Google Meet link:", error);
            }
        }
        
        // 2. Google Sheet Sync
        if (eventType.googleSheetConfig?.sheetId) {
            console.log(`[LIVE] Syncing booking ${newBooking.id} to Google Sheet: ${eventType.googleSheetConfig.sheetName} (${eventType.googleSheetConfig.sheetId})`);
            const dataToSync = {
                bookingId: newBooking.id,
                eventName: eventType.name,
                startTime: newBooking.startTime.toISOString(),
                endTime: newBooking.endTime.toISOString(),
                bookerName: newBooking.bookerName,
                bookerEmail: newBooking.bookerEmail,
                bookerPhone: newBooking.bookerPhone,
                meetingLink: newBooking.meetingLink || eventType.conferencing?.customLink || '',
                ...newBooking.customAnswers,
            };
            try {
                await googleApiService.appendToSheet(eventType.googleSheetConfig.sheetId, dataToSync);
                console.log('[LIVE] Data payload synced to sheet:', dataToSync);
            } catch(error) {
                console.error("[LIVE] Failed to sync to Google Sheet:", error);
            }
        }
    } else {
         console.log('[SKIPPING] Google integrations because user is not signed in.');
    }
    
    // If a meeting link was generated, update the booking in Firestore
    if (newBooking.meetingLink) {
        await updateDoc(doc(db, 'bookings', newBooking.id), {
            meetingLink: newBooking.meetingLink
        });
    }

    // 3. Email Confirmation (Simulation)
    console.log(`[SIMULATING] Sending confirmation email to ${newBooking.bookerEmail}`);
    let emailBody = `Your booking for ${eventType.name} is confirmed for ${format(newBooking.startTime, 'PPPP p')}.`;
    if (eventType.mode === 'online') {
        const link = newBooking.meetingLink || eventType.conferencing?.customLink;
        emailBody += `\nMeeting Link: ${link || 'Link will be sent separately.'}`;
    } else if (eventType.mode === 'offline' && eventType.location) {
        emailBody += `\nLocation: ${eventType.location}`;
    }
    console.log('[SIMULATING] Email Body:', emailBody);
    
    return newBooking;
  },

  /**
   * [LIVE] Saves an event type (creates or updates) to Firestore.
   */
  saveEventType: async (eventTypeData: Omit<EventType, 'id' | 'link'> & { id?: string }): Promise<EventType> => {
     if (eventTypeData.id) {
         // Update existing event
         const docRef = doc(db, 'eventTypes', eventTypeData.id);
         const dataToUpdate = { ...eventTypeData };
         delete dataToUpdate.id; // Don't store the id in the document body
         await setDoc(docRef, dataToUpdate, { merge: true });
         return { ...eventTypeData, link: `/book/${eventTypeData.id}` } as EventType;
     } else {
         // Create new event
         const newDocRef = doc(collection(db, 'eventTypes'));
         const newId = newDocRef.id;
         
         const newEventType: EventType = {
             ...(eventTypeData as Omit<EventType, 'id' | 'link'>), // Cast to remove id property from type
             id: newId,
             link: `/book/${newId}`,
         };
         
         const dataToSave = { ...newEventType };
         delete dataToSave.id; // Don't store id in the document body
         
         await setDoc(newDocRef, dataToSave);
         return newEventType;
     }
  }
};
