import type { Booking, EventType } from '../types';

// Define window properties for TypeScript
declare global {
  interface Window {
    gapi: any;
    gapiReadyPromise: Promise<void>;
  }
}

// --- State Management ---
let _isSignedIn = false;
let _userProfile: any = null;
let _initializationState: 'pending' | 'success' | 'failed' = 'pending';
let _error: Error | null = null;
let isInitializing = false;
const subscribers: ((isSignedIn: boolean, profile: any | null, initState: 'pending' | 'success' | 'failed', error: Error | null) => void)[] = [];

const notifySubscribers = () => {
    subscribers.forEach(cb => cb(_isSignedIn, _userProfile, _initializationState, _error));
};

// --- Helper Functions ---
const updateSigninStatus = (isSignedIn: boolean) => {
    _isSignedIn = isSignedIn;
    if (isSignedIn) {
        const profile = window.gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile();
        _userProfile = {
            name: profile.getName(),
            email: profile.getEmail(),
            picture: profile.getImageUrl(),
        };
    } else {
        _userProfile = null;
    }
    notifySubscribers();
};

// --- GOOGLE API SERVICE ---
export const googleApiService = {
    /**
     * Attaches to the GAPI client, which is now initialized globally in index.html.
     * It awaits the `window.gapiReadyPromise` to ensure the client is ready.
     */
    initialize: async (): Promise<void> => {
        if (_initializationState === 'success' || isInitializing) {
            return;
        }

        isInitializing = true;
        _initializationState = 'pending';
        _error = null;
        notifySubscribers();

        try {
            // Wait for the global promise defined and resolved in index.html
            await window.gapiReadyPromise;
            
            console.log('Google API Service successfully connected to pre-initialized GAPI client.');
            _initializationState = 'success';
            
            const authInstance = window.gapi.auth2.getAuthInstance();
            
            // Set up a listener for sign-in state changes
            authInstance.isSignedIn.listen(updateSigninStatus);
            
            // Immediately update with the current sign-in status
            updateSigninStatus(authInstance.isSignedIn.get());
        } catch (error: any) {
            console.error("Google API Service failed to connect to the pre-initialized GAPI client:", error);
            _initializationState = 'failed';
            _error = error instanceof Error ? error : new Error('Failed to attach to Google API. Check console for details.');
        } finally {
            isInitializing = false;
            notifySubscribers();
        }
    },

    subscribe: (callback: (isSignedIn: boolean, profile: any | null, initState: 'pending' | 'success' | 'failed', error: Error | null) => void) => {
        subscribers.push(callback);
        callback(_isSignedIn, _userProfile, _initializationState, _error);
        return () => {
            const index = subscribers.indexOf(callback);
            if (index > -1) subscribers.splice(index, 1);
        };
    },

    getIsSignedIn: () => _isSignedIn,
    getUserProfile: () => _userProfile,

    signIn: async (): Promise<void> => {
        // FIX: Refactored to flatten the conditional logic. This resolves a TypeScript error
        // by making the control flow more explicit: first attempt initialization if needed,
        // then perform a guard check before proceeding.
        if (_initializationState !== 'success') {
             await googleApiService.initialize();
        }

        if (_initializationState !== 'success') {
            throw new Error("Cannot sign in, Google API is not initialized.");
        }

        await window.gapi.auth2.getAuthInstance().signIn();
    },

    signOut: async () => {
        if (_initializationState === 'success' && window.gapi.auth2.getAuthInstance()) {
            await window.gapi.auth2.getAuthInstance().signOut();
        }
        _isSignedIn = false;
        _userProfile = null;
        notifySubscribers();
        console.log('User signed out.');
    },
    
    getSpreadsheets: async (): Promise<{ id: string; name: string }[]> => {
        if (!_isSignedIn) throw new Error("User not authenticated");
        const response = await window.gapi.client.drive.files.list({
            'q': "mimeType='application/vnd.google-apps.spreadsheet'",
            'fields': 'files(id, name)'
        });
        return response.result.files || [];
    },
    
    createSpreadsheet: async (name: string): Promise<{ id: string; name: string }> => {
        if (!_isSignedIn) throw new Error("User not authenticated");
        const response = await window.gapi.client.sheets.spreadsheets.create({
            properties: {
                title: name
            }
        });
        const id = response.result.spreadsheetId;
        return { id, name };
    },
    
    appendToSheet: async(sheetId: string, data: Record<string, any>): Promise<{success: true}> => {
        if (!_isSignedIn) throw new Error("User not authenticated");
        
        const HEADERS = [
            'bookingId', 'eventName', 'startTime', 'endTime', 
            'bookerName', 'bookerEmail', 'bookerPhone', 'meetingLink'
        ];
        
        const customFieldKeys = Object.keys(data).filter(key => !HEADERS.includes(key));
        const allHeaders = [...HEADERS, ...customFieldKeys];
        const values = allHeaders.map(header => data[header] || '');

        const headerCheck = await window.gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: 'A1:A1'
        });
        
        if (!headerCheck.result.values) {
            await window.gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: sheetId,
                range: 'A1',
                valueInputOption: 'USER_ENTERED',
                resource: { values: [allHeaders] }
            });
        }
        
        await window.gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: 'A1',
            valueInputOption: 'USER_ENTERED',
            resource: { values: [values] }
        });

        return { success: true };
    },

    createCalendarEvent: async (booking: Booking, eventType: EventType): Promise<string> => {
        if (!_isSignedIn) throw new Error("User not authenticated");

        const event = {
            'summary': `${eventType.name} with ${booking.bookerName}`,
            'location': eventType.location,
            'description': eventType.description,
            'start': {
                'dateTime': booking.startTime.toISOString(),
                'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            'end': {
                'dateTime': booking.endTime.toISOString(),
                'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            'attendees': [
                {'email': booking.bookerEmail},
            ],
            'conferenceData': {
                'createRequest': {
                    'requestId': `syncup-${booking.id}`,
                    'conferenceSolutionKey': { 'type': 'hangoutsMeet' }
                }
            },
        };

        const response = await window.gapi.client.calendar.events.insert({
            'calendarId': 'primary',
            'resource': event,
            'conferenceDataVersion': 1
        });
        
        return response.result.hangoutLink;
    }
};