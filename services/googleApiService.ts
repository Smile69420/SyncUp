import type { Booking, EventType } from '../types';
import { googleApiConfig } from '../config';

// These values must be set in your environment variables.
// Get them from the Google Cloud Console: https://console.cloud.google.com/
const API_KEY = googleApiConfig.apiKey;
const CLIENT_ID = googleApiConfig.clientId;

// The scopes determine which Google services the user is asked to grant permission for.
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file' // Needed to list and find spreadsheets
].join(' ');

// --- REAL GOOGLE API SERVICE ---
// This service interacts with the live Google APIs.

declare global {
  interface Window {
    gapi: any;
    google: any;
    tokenClient: any;
  }
}

// Helper to load a script dynamically and ensure it's only added once.
const loadScript = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            return resolve();
        }
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
    });
};


let initializationPromise: Promise<void> | null = null;
let tokenClient: any = null;
let _isSignedIn = false;
let _userProfile: any = null;
let _initializationState: 'pending' | 'success' | 'failed' = 'pending';
let _error: Error | null = null;
const subscribers: ((isSignedIn: boolean, profile: any | null, initState: 'pending' | 'success' | 'failed', error: Error | null) => void)[] = [];

const notifySubscribers = () => {
    subscribers.forEach(cb => cb(_isSignedIn, _userProfile, _initializationState, _error));
};

export const googleApiService = {
    /**
     * Loads GAPI/GIS scripts dynamically and initializes the clients.
     * This method is idempotent, using a singleton promise to ensure it only runs once.
     */
    initialize: (): Promise<void> => {
        if (initializationPromise) {
            return initializationPromise;
        }
        
        _initializationState = 'pending';
        _error = null;
        notifySubscribers();

        initializationPromise = (async () => {
            try {
                // 1. Dynamically load the Google API and Identity Services scripts.
                // This gives us full control over the loading process.
                await Promise.all([
                    loadScript('https://apis.google.com/js/api.js'),
                    loadScript('https://accounts.google.com/gsi/client')
                ]);
                
                // 2. Load the specific GAPI modules (client:oauth2) required for our operations.
                await new Promise<void>((resolve, reject) => {
                    window.gapi.load('client:oauth2', {
                        callback: resolve,
                        onerror: (err: any) => reject(new Error(`Failed to load GAPI modules: ${JSON.stringify(err)}`)),
                        timeout: 30000,
                        ontimeout: () => reject(new Error('GAPI module loading timed out after 30 seconds.')),
                    });
                });

                // 3. Initialize the GAPI client with API key and discovery docs.
                await window.gapi.client.init({
                    apiKey: API_KEY,
                    discoveryDocs: [
                        'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
                        'https://www.googleapis.com/discovery/v1/apis/sheets/v4/rest',
                        'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
                    ],
                });
                console.log('GAPI client initialized.');

                // 4. Initialize the GIS client for OAuth2 token management.
                tokenClient = window.google.accounts.oauth2.initTokenClient({
                    client_id: CLIENT_ID,
                    scope: SCOPES,
                    callback: async (tokenResponse: any) => {
                        if (tokenResponse.error) {
                            console.error('OAuth Error:', tokenResponse.error);
                            _isSignedIn = false;
                            _userProfile = null;
                            notifySubscribers();
                            return;
                        }
                        window.gapi.client.setToken(tokenResponse);
                        _isSignedIn = true;
                        try {
                            const response = await window.gapi.client.oauth2.userinfo.get();
                            _userProfile = response.result;
                        } catch (e) {
                             console.error("Could not fetch user profile", e);
                             _userProfile = {}; // Keep user signed in but with no profile info on error
                        }
                        notifySubscribers();
                    },
                });
                console.log('GIS client initialized.');
                console.log('Google API Service fully initialized.');
                _initializationState = 'success';
                notifySubscribers();
            } catch (error: any) {
                console.error("Google API Service initialization failed:", error);
                // Invalidate the promise so initialization can be retried on a subsequent call.
                initializationPromise = null;
                _initializationState = 'failed';
                _error = error;
                notifySubscribers();
                // Re-throw to allow callers to handle the failure.
                throw error;
            }
        })();

        return initializationPromise;
    },

    /**
     * Subscribes a component to authentication state changes.
     * @param callback - The function to call when the auth state changes.
     * @returns An unsubscribe function.
     */
    subscribe: (callback: (isSignedIn: boolean, profile: any | null, initState: 'pending' | 'success' | 'failed', error: Error | null) => void) => {
        subscribers.push(callback);
        // Immediately notify the new subscriber with the current state
        callback(_isSignedIn, _userProfile, _initializationState, _error);
        return () => {
            const index = subscribers.indexOf(callback);
            if (index > -1) {
                subscribers.splice(index, 1);
            }
        };
    },

    getIsSignedIn: () => _isSignedIn,
    getUserProfile: () => _userProfile,

    /**
     * Prompts the user to sign in and grant permissions.
     */
    signIn: async (): Promise<void> => {
        await googleApiService.initialize().catch(() => {}); // Error is handled internally, no need to throw here
        if (_initializationState !== 'success' || !tokenClient) {
            throw new Error("Google API Service is not initialized or failed to initialize.");
        }
        // Prompt the user to select an account and grant access.
        // The callback in `initialize` will handle the token response.
        tokenClient.requestAccessToken({ prompt: 'consent' });
    },

    /**
     * Signs the user out.
     */
    signOut: async () => {
        const token = window.gapi?.client?.getToken();
        if (token !== null) {
            window.google.accounts.oauth2.revoke(token.access_token, () => {
                window.gapi.client.setToken(null);
                _isSignedIn = false;
                _userProfile = null;
                notifySubscribers();
                console.log('User signed out.');
            });
        } else {
             _isSignedIn = false;
             _userProfile = null;
             notifySubscribers();
        }
    },
    
    /**
     * Fetches a list of spreadsheets from the user's Google Drive.
     */
    getSpreadsheets: async (): Promise<{ id: string; name: string }[]> => {
        await googleApiService.initialize();
        if (!_isSignedIn) throw new Error("User not authenticated");
        const response = await window.gapi.client.drive.files.list({
            'q': "mimeType='application/vnd.google-apps.spreadsheet'",
            'fields': 'files(id, name)'
        });
        return response.result.files || [];
    },
    
    /**
     * Creates a new Google Sheet.
     */
    createSpreadsheet: async (name: string): Promise<{ id: string; name: string }> => {
        await googleApiService.initialize();
        if (!_isSignedIn) throw new Error("User not authenticated");
        const response = await window.gapi.client.sheets.spreadsheets.create({
            properties: {
                title: name
            }
        });
        const id = response.result.spreadsheetId;
        return { id, name };
    },
    
    /**
     * Appends a row of data to a specific Google Sheet.
     */
    appendToSheet: async(sheetId: string, data: Record<string, any>): Promise<{success: true}> => {
        await googleApiService.initialize();
        if (!_isSignedIn) throw new Error("User not authenticated");
        
        // Define a consistent order for headers and corresponding data extraction
        const HEADERS = [
            'bookingId', 'eventName', 'startTime', 'endTime', 
            'bookerName', 'bookerEmail', 'bookerPhone', 'meetingLink'
        ];
        
        const customFieldKeys = Object.keys(data).filter(key => !HEADERS.includes(key));
        const allHeaders = [...HEADERS, ...customFieldKeys];

        const values = allHeaders.map(header => data[header] || '');

        // Check if sheet is empty. If so, add headers first.
        const headerCheck = await window.gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: 'A1:A1'
        });
        
        if (!headerCheck.result.values) {
             // Sheet is empty, write headers
            await window.gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: sheetId,
                range: 'A1',
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [allHeaders]
                }
            });
        }
        
        await window.gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: 'A1', // Appending to a range of A1 will find the next empty row
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [values]
            }
        });

        return { success: true };
    },

    /**
     * Creates a Google Calendar event and generates a Google Meet link.
     */
    createCalendarEvent: async (booking: Booking, eventType: EventType): Promise<string> => {
        await googleApiService.initialize();
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
            // This is the key part that creates the Google Meet link
            'conferenceData': {
                'createRequest': {
                    'requestId': `syncup-${booking.id}`,
                    'conferenceSolutionKey': {
                        'type': 'hangoutsMeet'
                    }
                }
            },
        };

        const response = await window.gapi.client.calendar.events.insert({
            'calendarId': 'primary',
            'resource': event,
            'conferenceDataVersion': 1 // This must be set to 1
        });
        
        return response.result.hangoutLink;
    }
};