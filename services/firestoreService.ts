import type { EventType, Booking, BookingDocument, BookingDetails, BookingDetailsDocument, ColumnConfiguration, ColumnConfig, MergedBooking } from '../types';
import { addMinutes, format } from 'date-fns';
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


// --- DEFAULT PREDEFINED COLUMNS for the Records Page ---
// This serves as the base for generating the first-time column configuration.
const PREDEFINED_COLUMNS: ColumnConfig[] = [
    { key: 'derivedDate', label: 'Date', isVisible: true },
    { key: 'companyName', label: 'Company Name', isVisible: true },
    { key: 'derivedWeekNo', label: 'Week No.', isVisible: true },
    { key: 'derivedSlot', label: 'Slot', isVisible: true },
    { key: 'derivedDay', label: 'Day', isVisible: true },
    { key: 'consultationDoneBy', label: 'Consultation Done By', isVisible: true },
    { key: 'mode', label: 'Mode', isVisible: true },
    { key: 'meetingStatus', label: 'Meeting Status', isVisible: true, type: 'select', options: ['Scheduled', 'Completed', 'Cancelled', 'No Show'] },
    { key: 'derivedMonth', label: 'Month', isVisible: true },
    { key: 'bookerName', label: 'Client Name', isVisible: true },
    { key: 'designation', label: 'Designation', isVisible: true },
    { key: 'generalizedDesignation', label: 'Generalized Designation', isVisible: true },
    { key: 'bookerPhone', label: 'Phone Number', isVisible: true },
    { key: 'level', label: 'Level', isVisible: false },
    { key: 'capability', label: 'Capability', isVisible: false },
    { key: 'feedbackSent', label: 'Feedback Sent', isVisible: true, type: 'select', options: ['Pending', 'Yes', 'No'] },
    { key: 'shownInterestInMembership', label: 'Shown Interest in Membership', isVisible: false, type: 'checkbox' },
    { key: 'membership', label: 'Membership', isVisible: false, type: 'checkbox' },
    { key: 'membershipVerification', label: 'Membership Verification', isVisible: false, type: 'checkbox' },
    { key: 'bookerEmail', label: 'Email Id', isVisible: true },
    { key: 'state', label: 'State', isVisible: false },
    { key: 'district', label: 'District', isVisible: false },
    { key: 'womenEntrepreneur', label: 'Women Entrepreneur', isVisible: false, type: 'checkbox' },
    { key: 'noOfEmployeesInCompany', label: 'No of Employees in Company', isVisible: false },
    { key: 'noOfAttendants', label: 'No of Attendants', isVisible: false },
    { key: 'sector', label: 'Sector', isVisible: true },
    { key: 'sectorGeneralized', label: 'Sector Generalized', isVisible: false },
    { key: 'operationsPerfomedInBrief', label: 'Operations Perfomed In Brief', isVisible: false, type: 'textarea' },
    { key: 'scale', label: 'Scale', isVisible: false },
    { key: 'challenges', label: 'Challenges', isVisible: false, type: 'textarea' },
    { key: 'manualTasks', label: 'Manual Tasks', isVisible: false, type: 'textarea' },
    { key: 'suggestedTools', label: 'Suggested Tools', isVisible: false, type: 'textarea' },
    { key: 'toolCategories', label: 'Tool Categories', isVisible: false },
    { key: 'aiFamiliarityPre', label: 'AI Familiarity (Pre Consultation)', isVisible: false },
    { key: 'kpi', label: 'KPI', isVisible: false },
    { key: 'aiFamiliarityPost', label: 'AI Familiarty Post Consultation', isVisible: false },
    { key: 'kpiValue', label: 'KPI Value', isVisible: false },
    { key: 'howDidTheyGetToKnow', label: 'How did they get to know about AI Consultation', isVisible: false },
    { key: 'additionalNotes1', label: 'Column 35', isVisible: false },
    { key: 'notesForReport', label: 'Notes for Report', isVisible: true, type: 'textarea' },
    { key: 'followUpRequestStatus', label: 'Follow Up Request Status', isVisible: false, type: 'select', options: ['Not Requested', 'Requested', 'Completed'] },
    { key: 'followUpStatus', label: 'Follow Up (Done / Pending )', isVisible: true, type: 'select', options: ['Pending', 'Done'] },
    { key: 'firefliesLink', label: 'Recording Link', isVisible: false, type: 'url' },
];


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

                await fetch(appsScriptUrl, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify(payload)
                });
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
                mode: 'no-cors', // Use no-cors for simple requests to Apps Script
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                redirect: 'follow', 
                body: JSON.stringify({ eventType, bookingData: bookingPayload })
            });

            // With no-cors, we can't read the response, but we can check if the request was sent.
            // A proper implementation for reading the response would require a more complex setup.
            // For now, we'll optimistically assume success if the fetch doesn't throw.
             // We'll update the meeting link on the client side after a delay.
             if (eventType.conferencing?.provider === 'google-meet') {
                setTimeout(async () => {
                    try {
                        const bookingDoc = await getDoc(doc(db, 'bookings', newBooking.id));
                        const updatedBooking = bookingDoc.data();
                        if (updatedBooking?.meetingLink) {
                            console.log(`[APPS SCRIPT] Google Meet link confirmed via Firestore.`);
                        }
                    } catch(e) {
                        console.error("Error confirming meeting link", e)
                    }
                }, 10000); // 10 seconds delay
            }

        } catch (error) {
            console.error("[APPS SCRIPT] Network error calling Google Apps Script:", error);
        }
    }
    
    const appsScriptUpdatePromise = new Promise(resolve => setTimeout(resolve, 5000));
    await appsScriptUpdatePromise;

    // Fetch the potentially updated booking to get the meeting link
     try {
        const updatedDoc = await getDoc(doc(db, 'bookings', newBooking.id));
        if (updatedDoc.exists() && updatedDoc.data().meetingLink) {
            newBooking.meetingLink = updatedDoc.data().meetingLink;
        }
     } catch(e) { console.log("Could not find updated meeting link immediately.")}

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
    });

    // 3. Add the delete operation for the event type itself
    const eventTypeRef = doc(db, 'eventTypes', eventTypeId);
    batch.delete(eventTypeRef);

    // 4. Commit the batch
    await batch.commit();
  },

  /**
   * Fetches the column configuration for the Records page.
   * Returns a default configuration if none is found in Firestore.
   */
  getColumnConfiguration: async (): Promise<ColumnConfiguration> => {
    const docRef = doc(db, 'appConfig', 'columnSettings');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && Array.isArray(data.config)) {
             // Merge with predefined to add new columns if they don't exist
             const savedConfig = data.config as ColumnConfiguration;
             const savedKeys = new Set(savedConfig.map(c => c.key));
             const newColumns = PREDEFINED_COLUMNS.filter(c => !savedKeys.has(c.key));
             return [...savedConfig, ...newColumns];
        }
    }
    // If no config exists, return the default based on predefined fields.
    return PREDEFINED_COLUMNS;
  },

  /**
   * Saves the column configuration for the Records page to Firestore.
   */
  saveColumnConfiguration: async (config: ColumnConfiguration): Promise<void> => {
    const docRef = doc(db, 'appConfig', 'columnSettings');
    await setDoc(docRef, { config });
  },
};