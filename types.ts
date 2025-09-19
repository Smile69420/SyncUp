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
  linkedRecordField?: keyof Omit<BookingDetails, 'id'>;
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

export interface BookingDetails {
    id: string; // Same as booking ID
    companyName?: string;
    consultationDoneBy?: string;
    designation?: string;
    generalizedDesignation?: string;
    level?: string;
    capability?: string;
    feedbackSent?: 'Yes' | 'No' | 'Pending';
    shownInterestInMembership?: boolean;
    membership?: boolean;
    membershipVerification?: boolean;
    state?: string;
    district?: string;
    womenEntrepreneur?: boolean;
    noOfEmployeesInCompany?: string;
    noOfAttendants?: string;
    sector?: string;
    sectorGeneralized?: string;
    operationsPerfomedInBrief?: string;
    scale?: string;
    challenges?: string;
    manualTasks?: string;
    suggestedTools?: string;
    toolCategories?: string;
    aiFamiliarityPre?: string;
    kpi?: string;
    aiFamiliarityPost?: string;
    kpiValue?: string;
    howDidTheyGetToKnow?: string;
    additionalNotes1?: string; // For "Column 35"
    notesForReport?: string;
    followUpRequestStatus?: 'Requested' | 'Not Requested' | 'Completed';
    followUpStatus?: 'Done' | 'Pending';
    meetingStatus?: 'Scheduled' | 'Completed' | 'Cancelled' | 'No Show';
    firefliesLink?: string;
    // New field for user-defined dynamic columns
    customFields?: { [key: string]: string | boolean | number };
}

export type BookingDetailsDocument = Omit<BookingDetails, 'id'>;

export type MergedBooking = Booking & BookingDetails & {
    eventTypeName: string;
    mode: string;
};

// Configuration for a single column in the Records page
export interface ColumnConfig {
  key: keyof MergedBooking | string;
  label: string;
  isVisible: boolean;
  // New properties for dynamic column types
  type?: 'text' | 'textarea' | 'select' | 'checkbox' | 'url';
  options?: string[]; // for 'select' type
  isCustom?: boolean; // Flag to identify user-created columns
}

export type ColumnConfiguration = ColumnConfig[];

export interface CalendarViewProps {
    bookings: MergedBooking[];
    eventTypes: EventType[];
    onEventClick: (booking: MergedBooking) => void;
    onInitiateReschedule?: (booking: MergedBooking) => void;
}

export interface TodaysMeetingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetings: MergedBooking[];
  onViewDetails: (booking: MergedBooking) => void;
}