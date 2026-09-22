export interface FlightProvider {
  id: string;
  name: string;
  price: number;
  currency: string;
  bookingUrl: string;
}

export interface FlightDeal {
  id: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  stops: number;
  carrierName: string;
  carrierCode: string;
  cheapestPrice: number;
  currency: string;
  bookingUrl: string;
  providers: FlightProvider[];
}
