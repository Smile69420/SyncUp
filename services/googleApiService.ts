import type { Booking, EventType } from '../types';
import { googleApiConfig } from '../config';

// Define window properties for TypeScript
declare global {
  interface Window {
    gapi: any;
    google: any; // The new GIS library
  }
}

// --- State Management ---
let _isSignedIn = false;
let _userProfile: any = null;
let _initializationState: 'pending' | 'success' | 'failed' = 'pending';
let _error: Error | null = null;
const subscribers: ((isSignedIn: boolean, profile: any | null, initState: 'pending' | 'success' | 'failed', error: Error | null) => void)[] = [];

let _tokenClient: any = null;
let _accessToken: string | null = null;
let _initPromise: Promise<void> | null = null;

const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';

const notifySubscribers = () => {
    subscribers.forEach(cb => cb(_isSignedIn, _userProfile, _initializationState, _error));
};

const fetchUserProfile = async () => {
    if (!_accessToken) return;
    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { 'Authorization': `Bearer ${_accessToken}` }
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch user profile: ${response.statusText}`);
        }
        const profile = await response.json();
        _userProfile = {
            name: profile.name,
            email: profile.email,
            picture: profile.picture,
        };
        _isSignedIn = true;
        notifySubscribers();
    } catch (error) {
        console.error("Error fetching user profile:", error);
        _isSignedIn = false;
        _userProfile = null;
        notifySubscribers();
    }
};

// --- GOOGLE API SERVICE ---
export const googleApiService = {
    /**
     * Initializes the Google Identity Services (GIS) token client and the GAPI client for API access.
     * This is now the correct, modern way to handle Google authentication.
     */
    initialize: (): Promise<void> => {
        if (_initPromise) {
            return _initPromise;
        }

        _initPromise = new Promise((resolve, reject) => {
            const checkGisReady = () => {
                if (window.google && window.gapi) {
                    _initializationState = 'pending';
                    notifySubscribers();
                    
                    try {
                        // 1. Initialize GIS token client for authentication
                        _tokenClient = window.google.accounts.oauth2.initTokenClient({
                            client_id: googleApiConfig.clientId,
                            scope: SCOPES,
                            callback: async (tokenResponse: any) => {
                                if (tokenResponse.error) {
                                    console.error("Token response error:", tokenResponse.error);
                                    _error = new Error(`Google Auth Error: ${tokenResponse.error_description || tokenResponse.error}`);
                                    notifySubscribers();
                                    return;
                                }
                                _accessToken = tokenResponse.access_token;
                                window.gapi.client.setToken({ access_token: _accessToken });
                                await fetchUserProfile();
                            },
                        });

                        // 2. Initialize GAPI client for making API calls
                        window.gapi.load('client', () => {
                            window.gapi.client.init({
                                apiKey: googleApiConfig.apiKey,
                                discoveryDocs: [
                                    'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
                                    'https://www.googleapis.com/discovery/v1/apis/sheets/v4/rest',
                                    'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
                                ],
                            }).then(() => {
                                _initializationState = 'success';
                                _error = null;
                                notifySubscribers();
                                console.log('Google API Service initialized successfully.');
                                resolve();
                            }).catch((error: any) => {
                                console.error("GAPI Client Init Error:", error);
                                const errorMsg = error.details || "Failed to initialize GAPI client. Check API key and discovery docs.";
                                _initializationState = 'failed';
                                _error = new Error(errorMsg);
                                notifySubscribers();
                                reject(_error);
                            });
                        });
                    } catch (error: any) {
                         console.error("Google Service Init Error:", error);
                         _initializationState = 'failed';
                         _error = new Error("Failed to initialize Google services. The 'google' or 'gapi' objects may not be available.");
                         notifySubscribers();
                         reject(_error);
                    }
                } else {
                    setTimeout(checkGisReady, 100); // Poll until the GSI script is loaded
                }
            };
            checkGisReady();
        });
        
        return _initPromise;
    },

    subscribe: (callback: (isSignedIn: boolean, profile: any | null, initState: 'pending' | 'success' | 'failed', error: Error | null) => void) => {
        subscribers.push(callback);
        // Immediately invoke with current state
        callback(_isSignedIn, _userProfile, _initializationState, _error);
        return () => { // Return an unsubscribe function
            const index = subscribers.indexOf(callback);
            if (index > -1) subscribers.splice(index, 1);
        };
    },

    getIsSignedIn: () => _isSignedIn,
    getUserProfile: () => _userProfile,

    signIn: async (): Promise<void> => {
        if (_initializationState !== 'success' && !_initPromise) {
            await googleApiService.initialize();
        } else if (_initPromise) {
            await _initPromise;
        }

        if (_initializationState !== 'success' || !_tokenClient) {
            throw new Error("Cannot sign in, Google API service is not initialized or failed to initialize.");
        }
        
        // If there's an existing valid token, GIS may not show a popup.
        // If not, it will prompt the user to sign in and consent.
        _tokenClient.requestAccessToken({ prompt: '' });
    },

    signOut: async () => {
        if (_accessToken) {
            window.google.accounts.oauth2.revoke(_accessToken, () => {});
        }
        window.gapi.client.setToken(null);
        _accessToken = null;
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