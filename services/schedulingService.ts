import type { EventType, Booking, BookingDocument, BookingDetails, BookingDetailsDocument, ColumnConfiguration } from '../types';
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
} from 'firebase/firestore';
import { config } from '../config';


// --- DEFAULT CONFIG for the Records Page columns ---
const DEFAULT_COLUMN_CONFIG: ColumnConfiguration = [
    { key: 'derivedDate', label: 'Date', isVisible: true },
    { key: 'companyName', label: 'Company Name', isVisible: true },
    { key: 'derivedWeekNo', label: 'Week No.', isVisible: true },
    { key: 'derivedSlot', label: 'Slot', isVisible: true },
    { key: 'derivedDay', label: 'Day', isVisible: true },
    { key: 'consultationDoneBy', label: 'Consultation Done By', isVisible: true },
    { key: 'mode', label: 'Mode', isVisible: true },
    { key: 'meetingStatus', label: 'Meeting Status', isVisible: true },
    { key: 'derivedMonth', label: 'Month', isVisible: true },
    { key: 'bookerName', label: 'Client Name', isVisible: true },
    { key: 'designation', label: 'Designation', isVisible: true },
    { key: 'generalizedDesignation', label: 'Generalized Designation', isVisible: true },
    { key: 'bookerPhone', label: 'Phone Number', isVisible: true },
    { key: 'level', label: 'Level', isVisible: false },
    { key: 'capability', label: 'Capability', isVisible: false },
    { key: 'feedbackSent', label: 'Feedback Sent', isVisible: true },
    { key: 'shownInterestInMembership', label: 'Shown Interest in Membership', isVisible: false },
    { key: 'membership', label: 'Membership', isVisible: false },
    { key: 'membershipVerification', label: 'Membership Verification', isVisible: false },
    { key: 'bookerEmail', label: 'Email Id', isVisible: true },
    { key: 'state', label: 'State', isVisible: false },
    { key: 'district', label: 'District', isVisible: false },
    { key: 'womenEntrepreneur', label: 'Women Entrepreneur', isVisible: false },
    { key: 'noOfEmployeesInCompany', label: 'No of Employees in Company', isVisible: false },
    { key: 'noOfAttendants', label: 'No of Attendants', isVisible: false },
    { key: 'sector', label: 'Sector', isVisible: true },
    { key: 'sectorGeneralized', label: 'Sector Generalized', isVisible: false },
    { key: 'operationsPerfomedInBrief', label: 'Operations Perfomed In Brief', isVisible: false },
    { key: 'scale', label: 'Scale', isVisible: false },
    { key: 'challenges', label: 'Challenges', isVisible: false },
    { key: 'manualTasks', label: 'Manual Tasks', isVisible: false },
    { key: 'suggestedTools', label: 'Suggested Tools', isVisible: false },
    { key: 'toolCategories', label: 'Tool Categories', isVisible: false },
    { key: 'aiFamiliarityPre', label: 'AI Familiarity (Pre Consultation)', isVisible: false },
    { key: 'kpi', label: 'KPI', isVisible: false },
    { key: 'aiFamiliarityPost', label: 'AI Familiarty Post Consultation', isVisible: false },
    { key: 'kpiValue', label: 'KPI Value', isVisible: false },
    { key: 'howDidTheyGetToKnow', label: 'How did they get to know about AI Consultation', isVisible: false },
    { key: 'additionalNotes1', label: 'Column 35', isVisible: false },
    { key: 'notesForReport', label: 'Notes for Report', isVisible: true },
    { key: 'followUpRequestStatus', label: 'Follow Up Request Status', isVisible: false },
    { key: 'followUpStatus', label: 'Follow Up (Done / Pending )', isVisible: true },
    { key: 'firefliesLink', label: 'Recording Link', isVisible: false },
];


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
   * [LIVE] Fetches all booking details from Firestore.
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
   * [LIVE] Updates a booking details document in Firestore.
   */
  updateBookingDetails: async (detailsId: string, data: Partial<BookingDetailsDocument>): Promise<void> => {
    const docRef = doc(db, 'bookingDetails', detailsId);
    await updateDoc(docRef, data);
  },

  /**
   * [LIVE] Creates a new booking in Firestore and triggers server-side Google integrations.
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
    
    // Create an empty corresponding bookingDetails document
    const initialDetails: BookingDetailsDocument = {
      companyName: '',
      consultationDoneBy: '',
      designation: '',
      generalizedDesignation: '',
      level: '',
      capability: '',
      feedbackSent: 'Pending',
      shownInterestInMembership: false,
      membership: false,
      membershipVerification: false,
      state: '',
      district: '',
      womenEntrepreneur: false,
      noOfEmployeesInCompany: '',
      noOfAttendants: '',
      sector: '',
      sectorGeneralized: '',
      operationsPerfomedInBrief: '',
      scale: '',
      challenges: '',
      manualTasks: '',
      suggestedTools: '',
      toolCategories: '',
      aiFamiliarityPre: '',
      kpi: '',
      aiFamiliarityPost: '',
      kpiValue: '',
      howDidTheyGetToKnow: '',
      additionalNotes1: '',
      notesForReport: '',
      followUpRequestStatus: 'Not Requested',
      followUpStatus: 'Pending',
      meetingStatus: 'Scheduled',
      firefliesLink: '',
    };

    // Sync custom form answers to specific record fields if linked
    eventType.customFormFields.forEach(field => {
        if (field.linkedRecordField && bookingData.customAnswers?.[field.id]) {
            // This syncs the form answer to the booking details document
            const value = bookingData.customAnswers[field.id];
            // Handle boolean from checkbox
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

        const bookingPayload = { ...newBooking }; // Already contains id, startTime, endTime
        
        try {
            // Use `fetch` to send data to the deployed Google Apps Script URL.
            // This script acts as a secure backend to handle Google API interactions.
            const response = await fetch(appsScriptUrl, {
                method: 'POST',
                mode: 'cors', // Required for cross-origin requests
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8', // Apps Script expects text/plain for POST data
                },
                // Redirect is needed as Apps Script POST responses can be redirects
                redirect: 'follow', 
                body: JSON.stringify({ eventType, bookingData: bookingPayload })
            });

            // The response from a successfully executed Apps Script web app with a text output will be a redirect
            // followed by the actual response. We need to handle this to get the JSON.
            if (response.ok) {
                 const scriptResponse = await response.json();
                 if (scriptResponse.status === 'success' || scriptResponse.status === 'partial_success') {
                    if (scriptResponse.meetingLink) {
                        newBooking.meetingLink = scriptResponse.meetingLink;
                        console.log(`[APPS SCRIPT] Google Meet link received: ${scriptResponse.meetingLink}`);
                    }
                    if (scriptResponse.message) {
                        console.log(`[APPS SCRIPT] Backend message: ${scriptResponse.message}`);
                    }
                    // Log any errors that occurred on the backend for easier debugging
                    if (scriptResponse.errors && scriptResponse.errors.length > 0) {
                        console.error('[APPS SCRIPT] Backend errors occurred:', scriptResponse.errors.join('\n'));
                    }
                } else {
                    console.error('[APPS SCRIPT] Error from backend:', scriptResponse.message, scriptResponse.errors);
                }
            } else {
                 const textResponse = await response.text();
                 console.error('[APPS SCRIPT] Received non-OK response:', response.status, textResponse);
            }
        } catch (error) {
            console.error("[APPS SCRIPT] Network error calling Google Apps Script:", error);
        }
    } else {
         console.log('[SKIPPING] Google Apps Script integration because URL or integration configs are missing.');
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
     // Create a deep copy and remove any undefined values, which are not allowed by Firestore.
     // JSON.stringify omits keys with `undefined` values. This is a critical step for data sanitization.
     const dataToSave = JSON.parse(JSON.stringify(eventTypeData));

     if (dataToSave.id) {
         // Update existing event
         const docId = dataToSave.id;
         const docRef = doc(db, 'eventTypes', docId);
         delete dataToSave.id; // Don't store the id in the document body
         await setDoc(docRef, dataToSave, { merge: true });

         // Reconstruct the full object to return, ensuring it has the ID and link.
         return { ...dataToSave, id: docId, link: `/book/${docId}` } as EventType;
     } else {
         // Create new event
         const newDocRef = doc(collection(db, 'eventTypes'));
         const newId = newDocRef.id;
         
         // `dataToSave` is already clean (no undefined) and has no 'id' property.
         await setDoc(newDocRef, dataToSave);

         // Reconstruct the full object to return, adding the new ID and link.
         return { ...dataToSave, id: newId, link: `/book/${newId}` } as EventType;
     }
  },

  /**
   * [LIVE] Deletes an event type from Firestore.
   * Note: This does not delete associated bookings.
   */
  deleteEventType: async (eventTypeId: string): Promise<void> => {
    const docRef = doc(db, 'eventTypes', eventTypeId);
    await deleteDoc(docRef);
  },

  /**
   * [LIVE] Fetches the column configuration for the Records page.
   * Returns a default configuration if none is found in Firestore.
   */
  getColumnConfiguration: async (): Promise<ColumnConfiguration> => {
    const docRef = doc(db, 'appConfig', 'columnSettings');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        // Basic validation to ensure config is in the expected format
        if (data && Array.isArray(data.config)) {
             return data.config as ColumnConfiguration;
        }
    }
    // If no config exists or it's malformed, return the default
    return DEFAULT_COLUMN_CONFIG;
  },

  /**
   * [LIVE] Saves the column configuration for the Records page to Firestore.
   */
  saveColumnConfiguration: async (config: ColumnConfiguration): Promise<void> => {
    const docRef = doc(db, 'appConfig', 'columnSettings');
    await setDoc(docRef, { config });
  },
};
