import { computeTotals, type Totals } from './lib/pricing.mjs';

export interface CustomerForm {
  email: string;
  rentalDuration: '' | 'daily' | 'monthly';
  rangeRent: number;
  carType: string;
  needsTrip: boolean;
  needsDriver: boolean;
  needsDelivery: boolean;
  needsPickup: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  purpose: string;
  identityType: 'married' | 'single' | 'corporate' | 'foreigner' | 'reorder';
  tripFee: number;
  driverFee: number;
  deliveryFee: number;
  pickupFee: number;
  deposit: number;
  discount: number;
}

export interface AuthState {
  isAuthenticated: boolean;
  username: string;
}

export interface MarriedCustomerForm {
  name: string;
  whatsapp: string;
  address: string;
  ktpFile: File | null;
  simFile: File | null;
  spouseKtpFile: File | null;
  kkFile: File | null;
  workIdFile: File | null;
  housePhotoFile: File | null;
  ticketFile: File | null;
  ticketHotelFile: File | null;
  verificationVideoFile: File | null;
  optionalRequirementFile: File | null;
}

export interface SingleCustomerForm {
  name: string;
  whatsapp: string;
  address: string;
  ktpFile: File | null;
  simFile: File | null;
  parentKtpFile: File | null;
  kkFile: File | null;
  workOrStudentIdFile: File | null;
  housePhotoFile: File | null;
  ticketFile: File | null;
  ticketHotelFile: File | null;
  verificationVideoFile: File | null;
  optionalRequirementFile: File | null;
}

export interface CorporateCustomerForm {
  name: string;
  whatsapp: string;
  address: string;
  ktpFile: File | null;
  simFile: File | null;
  companyAddress: string;
  picKtpFile: File | null;
  picKkFile: File | null;
  companyNpwpFile: File | null;
  companySiupFile: File | null;
  companyNibFile: File | null;
  companyPhotoFile: File | null;
  ticketFile: File | null;
  ticketHotelFile: File | null;
  verificationVideoFile: File | null;
  optionalRequirementFile: File | null;
}

export interface ForeignerCustomerForm {
  name: string;
  whatsapp: string;
  address: string;
  personalIdFile: File | null;
  passportFile: File | null;
  simFile: File | null;
  kitasKitapFile: File | null;
  workIdFile: File | null;
  marriageDocFile: File | null;
  visaFile: File | null;
  housePhotoFile: File | null;
  ticketFile: File | null;
  ticketHotelFile: File | null;
  verificationVideoFile: File | null;
  optionalRequirementFile: File | null;
}

export interface ReorderCustomerForm {
  name: string;
  whatsapp: string;
  address: string;
}

export interface Car {
  id: number;
  name: string;
  brand: string;
  type: string;
  transmission: string;
  fuel: string;
  seats: number;
  daily_rate: number;
  monthly_rate: number;
  quantity: number;
  image: string;
}

export interface CarRate {
  id?: number | string;
  value: string;
  label: string;
  daily_rate: number | string;
  monthly_rate: number | string;
}

export type BookingAmounts = Pick<
  CustomerForm,
  | 'carType' | 'rangeRent' | 'deposit' | 'discount'
  | 'needsTrip' | 'needsDriver' | 'needsDelivery' | 'needsPickup'
  | 'tripFee' | 'driverFee' | 'deliveryFee' | 'pickupFee'
> & { rentalDuration: string };

export interface BookingEstimate {
  label: string;
  rate: number;
  durationLabel: string;
  totals: Totals;
  discountPercentage: number;
}

// Fee selects can yield NaN from parseInt(''), and computeTotals throws on NaN.
const amount = (n: number) => (Number.isFinite(n) ? n : 0);

export function estimateBooking(form: BookingAmounts, carRates: CarRate[]): BookingEstimate | null {
  const car = carRates.find((c) => c.value === form.carType);
  if (!car || !form.rangeRent || form.rangeRent <= 0) return null;

  const isDaily = form.rentalDuration === 'daily';
  const rate = Number(isDaily ? car.daily_rate : car.monthly_rate);
  const rentalCost = rate * form.rangeRent;
  if (!Number.isFinite(rentalCost)) return null;

  const totals = computeTotals({
    rental_cost: rentalCost,
    deposit: amount(form.deposit),
    discount: amount(form.discount),
    needs_trip: form.needsTrip,
    needs_driver: form.needsDriver,
    needs_delivery: form.needsDelivery,
    needs_pickup: form.needsPickup,
    trip_fee: amount(form.tripFee),
    driver_fee: amount(form.driverFee),
    delivery_fee: amount(form.deliveryFee),
    pickup_fee: amount(form.pickupFee),
  });

  return {
    label: car.label,
    rate,
    durationLabel: isDaily ? 'hari' : 'bulan',
    totals,
    discountPercentage: totals.rental_cost > 0 ? (totals.discount_applied / totals.rental_cost) * 100 : 0,
  };
}

export const DOCUMENT_LABELS: Record<string, string> = {
  kkFile: 'Kartu Keluarga',
  simFile: 'SIM',
  parentKtpFile: 'KTP Orang Tua',
  housePhotoFile: 'Foto Rumah',
  workOrStudentIdFile: 'ID Kerja / Kartu Mahasiswa / Surat Usaha',
  spouseKtpFile: 'KTP Suami / Istri',
  ktpFile: 'KTP',
  workIdFile: 'ID Kerja',
  picKtpFile: 'KTP PIC',
  picKkFile: 'KK PIC',
  companyNpwpFile: 'NPWP Perusahaan',
  companySiupFile: 'SIUP Perusahaan',
  companyNibFile: 'NIB Perusahaan',
  companyPhotoFile: 'Foto Perusahaan',
  passportFile: 'Paspor',
  personalIdFile: 'Kartu Identitas Diri',
  kitasKitapFile: 'KITAS / KITAP',
  marriageDocFile: 'Dokumen Menikah',
  visaFile: 'Visa',
  ticketFile: 'Tiket Perjalanan',
  ticketHotelFile: 'Tiket Booking Hotel',
  verificationVideoFile: 'Verification Video Call',
  optionalRequirementFile: 'Persyaratan Optional',
};

export function isPdfFile(name?: string | null): boolean {
  return !!name && /\.pdf$/i.test(name);
}

// Like responseMessage in sessionGuard, plus the upload `field` and validation `fields` from the K spec.
// Reads a clone because the session guard may read the same body.
export async function readServerError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.clone().json();
    const message = typeof body?.message === 'string' && body.message ? body.message : fallback;
    const field = typeof body?.field === 'string' ? body.field : null;
    if (field) return `${message} (${DOCUMENT_LABELS[field] ?? field})`;
    if (Array.isArray(body?.fields) && body.fields.length > 0) {
      return `${message} Periksa: ${body.fields.join(', ')}.`;
    }
    return message;
  } catch {
    return fallback;
  }
}