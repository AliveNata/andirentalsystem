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