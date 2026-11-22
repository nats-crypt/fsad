// ===== DOMAIN TYPES =====

export type Role = 'PASSENGER' | 'STAFF' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  role: Role;
  fullName?: string;
}

export interface Airport {
  code: string;
  city: string;
  name?: string;
  country?: string;
}

export interface Aircraft {
  id: string;
  registration: string;
  model: string;
  capacity: number;
  status: string;
}

export interface Seat {
  id: string;
  seatNo: string;
  cabinClass: 'FIRST' | 'BUSINESS' | 'ECONOMY';
  status: 'AVAILABLE' | 'BOOKED' | 'HELD';
  fare?: number;
}

export interface Flight {
  id: string;
  flightNo: string;
  origin: Airport;
  destination: Airport;
  aircraft: { model: string };
  departAt: string;
  arriveAt: string;
  baseFare: number;
  capacity: number;
  seatsBooked: number;
  seatsLeft: number;
  status: 'SCHEDULED' | 'DEPARTED' | 'ARRIVED' | 'CANCELLED';
  seats?: Seat[];
}

export interface Passenger {
  fullName: string;
  phone?: string;
  preferences?: {
    meal?: string;
    seatPref?: string;
    assistance?: string;
  };
}

export interface Booking {
  id: string;
  pnr: string;
  flightId: string;
  flight: Flight;
  seat: Seat;
  farePaid: number;
  status: 'CONFIRMED' | 'CANCELLED';
  createdAt: string;
  cancelledAt?: string;
  passenger?: Passenger;
  payment?: {
    amount: number;
    status: string;
    method: string;
    cardLast4?: string;
  };
}

export interface Ticket {
  id: string;
  bookingId: string;
  pnr: string;
  issuedAt: string;
  flight: Flight;
  seat: Seat;
  passenger: Passenger;
  farePaid: number;
  pdfUrl?: string;
}

export interface Employee {
  id: string;
  empCode: string;
  fullName: string;
  designation: string;
  dutyArea?: string;
  salary: number;
  contact?: string;
  userId?: string;
}

export interface CrewAssignment {
  id: string;
  flightId: string;
  employeeId: string;
  employee: Employee;
  flight?: Flight;
  role: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employee?: Employee;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: string;
}

export interface DutyReport {
  id: string;
  employeeId: string;
  employee?: Employee;
  dutyArea: string;
  startAt: string;
  endAt?: string;
}

export interface OptimizerResult {
  flightId: string;
  flightNo: string;
  predictedLoadFactor: number;
  recommendedCrew: number;
  flag: 'OVER' | 'UNDER' | 'OK';
  rationale: string;
}

export interface FareForecast {
  trend: 'RISING' | 'STEADY' | 'FALLING';
  advice: 'BOOK_NOW' | 'WAIT';
  confidence: number;
}

export interface ReportSeries {
  label: string;
  value: number;
}

export interface Report {
  summary: Record<string, unknown>;
  series: ReportSeries[];
}

export type ReportType =
  | 'revenue'
  | 'flights'
  | 'reservations'
  | 'cancellations'
  | 'aircraft'
  | 'salary'
  | 'employees'
  | 'attendance'
  | 'performance';

// ===== PAYMENT TYPES =====

export interface PaymentOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId?: string;
  provider: 'razorpay' | 'mock';
}

export interface MockCard {
  number: string;
  expiry: string;
  cvv: string;
}

// ===== SEARCH TYPES =====

export interface SearchParams {
  origin?: string;
  destination?: string;
  date?: string;
  pax?: number;
  nlQuery?: string;
}

export interface ParsedSearch {
  origin?: string;
  destination?: string;
  dateFrom?: string;
  dateTo?: string;
  timeOfDay?: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';
  sort?: 'CHEAPEST' | 'FASTEST' | 'EARLIEST';
}
