import React, { useState } from 'react';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import {
  MarriedCustomerForm,
  SingleCustomerForm,
  CorporateCustomerForm,
  ForeignerCustomerForm,
  ReorderCustomerForm
} from '../types';

interface FileInputProps {
  label: string;
  onChange: (file: File | null) => void;
  required?: boolean;
}

const MAX_FILE_SIZE_MB = 1;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'application/pdf'];
const ALLOWED_FILE_EXTENSIONS = ['.jpg', '.jpeg', '.pdf'];

const FileInput: React.FC<FileInputProps> = ({ label, onChange, required = true }) => {
  const [errorMessage, setErrorMessage] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    
    if (file) {
      // Check file size
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setErrorMessage(`Ukuran file melebihi ${MAX_FILE_SIZE_MB}MB. Silakan upload file yang lebih kecil.`);
        e.target.value = '';
        onChange(null);
        return;
      }

      // Check file type
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        setErrorMessage('Format file tidak sesuai. Hanya file JPG, JPEG, atau PDF yang diperbolehkan.');
        e.target.value = '';
        onChange(null);
        return;
      }
    }

    setErrorMessage('');
    onChange(file);
  };

  return (
    <div className="col-span-2">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="space-y-2">
        <input
          type="file"
          onChange={handleFileChange}
          className={`w-full rounded-lg border px-4 py-2 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 ${
            errorMessage ? 'border-red-500' : 'border-gray-300'
          }`}
          required={required}
          accept={ALLOWED_FILE_EXTENSIONS.join(',')}
        />
        <p className="text-xs text-gray-500">
          Format yang diperbolehkan: JPG, JPEG, PDF. Maksimal ukuran file: {MAX_FILE_SIZE_MB}MB
        </p>
        {errorMessage && (
          <p className="text-sm text-red-500">{errorMessage}</p>
        )}
      </div>
    </div>
  );
};

interface CommonFormProps<T> {
  title: string;
  data: T;
  onChange: (data: T) => void;
  children?: React.ReactNode;
}

const CommonForm = <T,>({ title, data, onChange, children }: CommonFormProps<T>) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <h3 className="col-span-2 text-xl font-semibold">{title}</h3>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Nama Anda <span className="text-red-500">*</span>
      </label>
      <input
        type="text"
        value={(data as any).name}
        onChange={(e) => {
          console.log('SET name:', e.target.value);
          onChange({ ...data, name: e.target.value });
        }}
        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
        required
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Nomor Whatsapp Anda <span className="text-red-500">*</span>
      </label>
      <PhoneInput
        country={'id'}
        value={(data as any).whatsapp}
        onChange={(phone) => {
          console.log('SET whatsapp:', phone);
          onChange({ ...data, whatsapp: phone });
        }}
        enableAreaCodes
        enableSearch
        placeholder="8123456789"
        inputClass="!w-full !rounded-lg !py-2.5 !px-4 !pl-14 !text-sm !border !border-gray-300 !h-[42px] !leading-5"
        containerClass="!w-full !h-[42px]"
        buttonClass="!bg-white border-r border-gray-300 !h-[42px]"
        inputProps={{
          name: 'whatsapp',
          required: true,
          autoFocus: false,
        }}
      />
    </div>
    <div className="col-span-2">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Alamat Tempat Tinggal Anda <span className="text-red-500">*</span>
      </label>
      <textarea
        value={(data as any).address}
        onChange={(e) => {
          console.log('SET address:', e.target.value);
          onChange({ ...data, address: e.target.value });
        }}
        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
        rows={3}
        required
      />
    </div>
    {children}
  </div>
);

// Married
export const MarriedForm: React.FC<{ data: MarriedCustomerForm; onChange: (data: MarriedCustomerForm) => void }> = ({ data, onChange }) => (
  <CommonForm title="Formulir Khusus Pemesanan yang Sudah Menikah" data={data} onChange={onChange}>
    <FileInput label="Upload KTP Anda" onChange={(file) => onChange({ ...data, ktpFile: file })} />
    <FileInput label="Upload SIM A Anda" onChange={(file) => onChange({ ...data, simFile: file })} required={false} />  
    <FileInput label="Upload KTP Suami / Istri" onChange={(file) => onChange({ ...data, spouseKtpFile: file })} />
    <FileInput label="Upload KK Anda" onChange={(file) => onChange({ ...data, kkFile: file })} />
    <FileInput label="Upload ID Card Kerja / Surat Usaha Anda" onChange={(file) => onChange({ ...data, workIdFile: file })} />
    <FileInput label="Upload Foto Tempat Tinggal (Tampak Depan) Anda" onChange={(file) => onChange({ ...data, housePhotoFile: file })} required={false} />
    <FileInput label="Upload Tiket Transportasi Anda" onChange={(file) => onChange({ ...data, ticketFile: file })} required={false} />
    <FileInput label="Upload Tiket Booking Hotel Anda" onChange={(file) => onChange({ ...data, ticketHotelFile: file })} required={false} />
    <FileInput label="Upload Verification Video Call (Screenshot Tampak Wajah Customer)" onChange={(file) => onChange({ ...data, verificationVideoFile: file })}  />
    <FileInput label="Persyaratan Optional" onChange={(file) => onChange({ ...data, optionalRequirementFile: file })} required={false} />
  </CommonForm>
);

// Single
export const SingleForm: React.FC<{ data: SingleCustomerForm; onChange: (data: SingleCustomerForm) => void }> = ({ data, onChange }) => (
  <CommonForm title="Formulir Khusus Pemesanan yang Belum Menikah" data={data} onChange={onChange}>
    <FileInput label="Upload KTP Anda" onChange={(file) => onChange({ ...data, ktpFile: file })} required={true} />
    <FileInput label="Upload SIM A Anda" onChange={(file) => onChange({ ...data, simFile: file })} required={false} />
    <FileInput label="Upload KTP Orang Tua Anda" onChange={(file) => onChange({ ...data, parentKtpFile: file })} />
    <FileInput label="Upload KK Anda" onChange={(file) => onChange({ ...data, kkFile: file })} />
    <FileInput label="Upload ID Card Kerja / Kartu Mahasiswa / Surat Usaha Anda" onChange={(file) => onChange({ ...data, workOrStudentIdFile: file })} />
    <FileInput label="Upload Foto Tempat Tinggal (Tampak Depan) Anda" onChange={(file) => onChange({ ...data, housePhotoFile: file })} required={false} />
    <FileInput label="Upload Tiket Transportasi Anda" onChange={(file) => onChange({ ...data, ticketFile: file })} required={false} />
    <FileInput label="Upload Tiket Booking Hotel Anda" onChange={(file) => onChange({ ...data, ticketHotelFile: file })} required={false} />
    <FileInput label="Upload Verification Video Call (Screenshot Tampak Wajah Customer)" onChange={(file) => onChange({ ...data, verificationVideoFile: file })} />  
    <FileInput label="Persyaratan Optional" onChange={(file) => onChange({ ...data, optionalRequirementFile: file })} required={false} />
  </CommonForm>
);

// Corporate
export const CorporateForm: React.FC<{ data: CorporateCustomerForm; onChange: (data: CorporateCustomerForm) => void }> = ({ data, onChange }) => (
  <CommonForm title="Formulir Khusus Pemesanan Operasional Perusahaan" data={data} onChange={onChange}>
    <FileInput label="Upload KTP Anda" onChange={(file) => onChange({ ...data, ktpFile: file })} />
    <FileInput label="Upload SIM A Anda" onChange={(file) => onChange({ ...data, simFile: file })} required={false} />
    <div className="col-span-2">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Alamat Tempat Tinggal Perusahaan <span className="text-red-500">*</span>
      </label>
      <textarea
        value={data.companyAddress}
        onChange={(e) => onChange({ ...data, companyAddress: e.target.value })}
        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
        rows={3}
        required
      />
    </div>
    <FileInput label="Upload KTP Pribadi (Penanggung Jawab)" onChange={(file) => onChange({ ...data, picKtpFile: file })} />
    <FileInput label="Upload KK (Penanggung Jawab)" onChange={(file) => onChange({ ...data, picKkFile: file })} />
    <FileInput label="Upload NPWP Perusahaan" onChange={(file) => onChange({ ...data, companyNpwpFile: file })} />
    <FileInput label="Upload SIUP Perusahaan" onChange={(file) => onChange({ ...data, companySiupFile: file })} required={false} />
    <FileInput label="Upload NIB Perusahaan" onChange={(file) => onChange({ ...data, companyNibFile: file })} required={false} />
    <FileInput label="Upload Foto Perusahaan (Tampak Depan)" onChange={(file) => onChange({ ...data, companyPhotoFile: file })} />
    <FileInput label="Upload Tiket Transportasi Anda" onChange={(file) => onChange({ ...data, ticketFile: file })} required={false} />
    <FileInput label="Upload Tiket Booking Hotel Anda" onChange={(file) => onChange({ ...data, ticketHotelFile: file })} required={false} />
    <FileInput label="Upload Verification Video Call (Screenshot Tampak Wajah Customer)" onChange={(file) => onChange({ ...data, verificationVideoFile: file })} />
    <FileInput label="Persyaratan Optional" onChange={(file) => onChange({ ...data, optionalRequirementFile: file })} required={false} />
  </CommonForm>
);

// Foreigner
export const ForeignerForm: React.FC<{ data: ForeignerCustomerForm; onChange: (data: ForeignerCustomerForm) => void }> = ({ data, onChange }) => (
  <CommonForm title="Formulir Khusus Pemesanan yang Berwarganegaraan Asing" data={data} onChange={onChange}>
    <FileInput label="Upload Kartu Identitas Diri Anda" onChange={(file) => onChange({ ...data, personalIdFile: file })} required={false} />
    <FileInput label="Upload Passport Anda" onChange={(file) => onChange({ ...data, passportFile: file })} />
    <FileInput label="Upload SIM A Anda" onChange={(file) => onChange({ ...data, simFile: file })} required={false} />  
    <FileInput label="Upload KITAS / KITAP Anda" onChange={(file) => onChange({ ...data, kitasKitapFile: file })} required={false} />
    <FileInput label="Upload ID Card Kerja / Surat Usaha Anda" onChange={(file) => onChange({ ...data, workIdFile: file })}  />
    <FileInput label="Upload Visa Anda" onChange={(file) => onChange({ ...data, visaFile: file })} required={false} />
    <FileInput label="Upload Dokumen Menikah Anda" onChange={(file) => onChange({ ...data, marriageDocFile: file })} required={false} />
    <FileInput label="Upload Foto Tempat Tinggal (Tampak Depan)" onChange={(file) => onChange({ ...data, housePhotoFile: file })} required={false} />
    <FileInput label="Upload Tiket Perjalanan Anda" onChange={(file) => onChange({ ...data, ticketFile: file })} />
    <FileInput label="Upload Tiket Booking Hotel Anda" onChange={(file) => onChange({ ...data, ticketHotelFile: file })} required={false} />
    <FileInput label="Upload Verification Video Call (Screenshot Tampak Wajah Customer)" onChange={(file) => onChange({ ...data, verificationVideoFile: file })}  />
    <FileInput label="Persyaratan Optional" onChange={(file) => onChange({ ...data, optionalRequirementFile: file })} required={false} />
  </CommonForm>
);

// Reorder
export const ReorderForm: React.FC<{ data: ReorderCustomerForm; onChange: (data: ReorderCustomerForm) => void }> = ({ data, onChange }) => (
  <CommonForm title="Formulir khusus pemesan yang melakukan order kembali" data={data} onChange={onChange}>
    {/* Tidak ada file input tambahan */}
  </CommonForm>
);