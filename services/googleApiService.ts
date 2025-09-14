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
// It requires the gapi and gis scripts to be loaded in index.html.

declare global {
  interface Window {
    gapi: any;
    google: any;
    tokenClient: any;
  }
}

let gapiReady = false;
let gisReady = false;
let tokenClient: any = null;
let _isSignedIn = false;
let _userProfile: any = null;
const subscribers: ((isSignedIn: boolean, profile: any | null) => void)[] = [];

const notifySubscribers = () => {
    subscribers.forEach(cb => cb(_isSignedIn, _userProfile));
};

export const googleApiService = {
    /**
     * Loads the GAPI and GIS clients and initializes them.
     * Should be called once when the application starts.
     */
    initialize: () => {
        const gapiScript = document.querySelector('script[src="https://apis.google.com/js/api.js"]') as HTMLScriptElement;
        const gisScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]') as HTMLScriptElement;

        gapiScript.onload = () => {
            window.gapi.load('client', () => {
                window.gapi.client.init({
                    apiKey: API_KEY,
                    discoveryDocs: [
                        'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
                        'https://www.googleapis.com/discovery/v1/apis/sheets/v4/rest',
                        'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
                    ],
                }).then(() => {
                    gapiReady = true;
                    console.log('GAPI client initialized.');
                }).catch((e: any) => console.error("Error initializing GAPI client", e));
            });
        };

        gisScript.onload = () => {
            tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: async (tokenResponse: any) => {
                    if (tokenResponse.error) {
                        console.error('OAuth Error:', tokenResponse.error);
                        return;
                    }
                    window.gapi.client.setToken(tokenResponse);
                    _isSignedIn = true;
                    // Fetch user profile
                    try {
                        const profile = await window.gapi.client.oauth2.userinfo.get();
                        _userProfile = {
                            email: profile.result.email,
                            name: profile.result.name,
                            picture: profile.result.picture,
                        };
                    } catch (e) {
                         console.error("Could not fetch user profile", e);
                         _userProfile = {};
                    }
                    
                    notifySubscribers();
                },
            });
            gisReady = true;
            console.log('GIS client initialized.');
        };
    },

    /**
     * Subscribes a component to authentication state changes.
     * @param callback - The function to call when the auth state changes.
     * @returns An unsubscribe function.
     */
    subscribe: (callback: (isSignedIn: boolean, profile: any | null) => void) => {
        subscribers.push(callback);
        // Immediately notify the new subscriber with the current state
        callback(_isSignedIn, _userProfile);
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
        if (!gapiReady || !gisReady) {
            alert('Google API scripts are not ready yet. Please try again in a moment.');
            return;
        }
        return new Promise((resolve, reject) => {
            // Prompt the user to select an account and grant access
            tokenClient.requestAccessToken({ prompt: 'consent' });
            // The callback in `initialize` will handle the result.
            // We can't easily resolve this promise with the result here,
            // so we rely on the subscription model for UI updates.
            resolve();
        });
    },

    /**
     * Signs the user out.
     */
    signOut: () => {
        const token = window.gapi.client.getToken();
        if (token !== null) {
            window.google.accounts.oauth2.revoke(token.access_token, () => {
                window.gapi.client.setToken(null);
                _isSignedIn = false;
                _userProfile = null;
                notifySubscribers();
                console.log('User signed out.');
            });
        }
    },
    
    /**
     * Fetches a list of spreadsheets from the user's Google Drive.
     */
    getSpreadsheets: async (): Promise<{ id: string; name: string }[]> => {
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