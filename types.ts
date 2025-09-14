import type { Timestamp } from 'firebase/firestore';

export interface Availability {
  dayOfWeek: number; // 0 for Sunday, 1 for Monday, etc.
  startTime: string; // "HH:mm" format, e.g., "09:00"
  endTime: string;   // "HH:mm" format, e.g., "17:00"
}

export interface TimeRange {
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
}

export interface DateUnavailability {
  date: string; // "YYYY-MM-DD"
  timeRanges: TimeRange[]; // Empty array means whole day is blocked
}

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'textarea' | 'select' | 'radio' | 'checkbox';
  required: boolean;
  options?: string[]; // For select, radio
}

export interface EventType {
  id:string;
  name: string;
  duration: number; // in minutes
  description: string;
  color: string;
  availability: Availability[];
  link: string;
  customFormFields: FormField[];
  imageUrl?: string; // Base64 encoded image for previews
  bufferBefore?: number; // in minutes
  bufferAfter?: number; // in minutes
  unavailability?: Availability[]; // Re-using the same structure for blocked times
  minimumSchedulingNotice?: number; // in minutes
  unavailableDates?: DateUnavailability[];
  bookingHorizonDays?: number; // How many days in the future can this be booked
  mode?: 'online' | 'offline';
  location?: string;
  conferencing?: {
    provider: 'google-meet' | 'custom';
    customLink?: string;
  };
  googleSheetConfig?: {
    sheetId: string;
    sheetName: string;
  };
}

export interface Booking {
  id: string;
  eventTypeId: string;
  startTime: Date;
  endTime: Date;
  bookerName: string;
  bookerEmail: string;
  bookerPhone: string;
  customAnswers?: { [fieldId: string]: string };
  meetingLink?: string; // For dynamically generated links
}

// Represents the data structure as it's stored in Firestore, with Timestamps
export interface BookingDocument extends Omit<Booking, 'id' | 'startTime' | 'endTime'> {
    startTime: Timestamp;
    endTime: Timestamp;
}

export interface TimeSlot {
    startTime: Date;
    endTime: Date;
}