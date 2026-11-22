import React, { useCallback, useEffect, useId, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { notifyError, notifyResponseError, notifySuccess } from '../lib/notify';
import {
  DEFAULT_FAVICON, DEFAULT_LOGO, EMPTY_WEB_CONFIG, SIGNATORY_TEXT_MAX,
  applyFavicon, isHttpsUrl,
  type WebConfig, type WebConfigKey,
} from '../lib/webConfig';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

type FormValues = Record<WebConfigKey, string>;

interface ImageFieldSpec {
  key: 'logo' | 'favicon' | 'signature';
  label: string;
  help: string;
  // null: there is no bundled image, the receipt simply leaves it out.
  defaultSrc: string | null;
  defaultLabel: string;
}

interface TextFieldSpec {
  key: 'signatoryName' | 'signatoryTitle';
  label: string;
  help: string;
}

const APP_FIELDS: ImageFieldSpec[] = [
  {
    key: 'logo',
    label: 'Logo',
    help: 'Tampil di halaman login dan di kepala email invoice dan receipt.',
    defaultSrc: DEFAULT_LOGO,
    defaultLabel: 'Kosong: memakai logo bawaan ARMJ.',
  },
  {
    key: 'favicon',
    label: 'Favicon',
    help: 'Ikon di tab browser. Pakai gambar persegi PNG atau ICO, minimal 32 x 32 piksel.',
    defaultSrc: DEFAULT_FAVICON,
    defaultLabel: 'Kosong: memakai favicon bawaan ARMJ.',
  },
];

const SIGNATURE_FIELD: ImageFieldSpec = {
  key: 'signature',
  label: 'Tanda Tangan',
  help: 'Gambar tanda tangan di receipt lunas.',
  defaultSrc: null,
  defaultLabel: 'Kosong: receipt dikirim tanpa gambar tanda tangan.',
};

const SIGNATORY_FIELDS: TextFieldSpec[] = [
  {
    key: 'signatoryName',
    label: 'Nama Penandatangan',
    help: 'Dicetak di bawah "Hormat kami," pada receipt. Kosong berarti baris nama tidak dicetak.',
  },
  {
    key: 'signatoryTitle',
    label: 'Jabatan Penandatangan',
    help: 'Dicetak di bawah nama penandatangan. Kosong berarti baris jabatan tidak dicetak.',
  },
];

const URL_KEYS: WebConfigKey[] = ['logo', 'favicon', 'signature'];
const MANAGER_LEVELS = ['superadmin', 'manajemen'];

// Same source as EmployeeManagement. Only a UI hint: PUT /api/web-config enforces the role.
function currentUserCanEdit(): boolean {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return MANAGER_LEVELS.includes(String(user?.level || '').toLowerCase());
  } catch {
    return false;
  }
}
const ALL_KEYS = Object.keys(EMPTY_WEB_CONFIG) as WebConfigKey[];

function toForm(config: WebConfig): FormValues {
  return Object.fromEntries(ALL_KEYS.map((k) => [k, config[k] ?? ''])) as FormValues;
}

function parseConfig(data: unknown): WebConfig {
  const record = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  return Object.fromEntries(
    ALL_KEYS.map((k) => [k, typeof record[k] === 'string' && (record[k] as string).trim() ? (record[k] as string).trim() : null]),
  ) as unknown as WebConfig;
}

function urlError(value: string): string | null {
  if (!value.trim()) return null;
  return isHttpsUrl(value) ? null : 'URL harus diawali https://.';
}

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 read-only:bg-gray-50 read-only:text-gray-700';
const resetButtonClass =
  'self-start shrink-0 min-h-[44px] px-3 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50';

interface ImageFieldProps {
  spec: ImageFieldSpec;
  value: string;
  showError: boolean;
  disabled: boolean;
  readOnly: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
}

const ImageField: React.FC<ImageFieldProps> = ({ spec, value, showError, disabled, readOnly, onChange, onBlur }) => {
  const id = useId();
  // Remembering the failed URL (not a flag) resets the warning as soon as the admin edits it.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const trimmed = value.trim();
  const error = urlError(value);
  const usable = trimmed !== '' && !error;
  const broken = usable && failedSrc === trimmed;
  const previewSrc = usable && !broken ? trimmed : spec.defaultSrc;

  let status: string;
  if (!trimmed) status = spec.defaultLabel;
  else if (error) status = '';
  else if (broken) {
    status = spec.defaultSrc
      ? 'Gambar dari URL ini tidak bisa dimuat. Selama begitu, yang tampil gambar bawaan.'
      : 'Gambar dari URL ini tidak bisa dimuat. Periksa URL-nya, receipt akan menampilkan gambar rusak.';
  } else status = '';

  const describedBy = [`${id}-help`, status ? `${id}-status` : '', showError && error ? `${id}-error` : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex gap-4">
      <div
        className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
        aria-hidden="true"
      >
        {previewSrc ? (
          <img
            key={previewSrc}
            src={previewSrc}
            alt=""
            className={spec.key === 'favicon' ? 'h-8 w-8 object-contain' : 'h-full w-full object-contain p-1'}
            onError={() => {
              if (previewSrc === trimmed) setFailedSrc(trimmed);
            }}
          />
        ) : (
          <span className="text-xs text-gray-600">Tidak ada</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">
          {spec.label}
        </label>
        <p id={`${id}-help`} className="mb-2 text-sm text-gray-600">
          {spec.help}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={id}
            type="url"
            inputMode="url"
            value={value}
            disabled={disabled}
            readOnly={readOnly}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder={readOnly ? undefined : 'https://'}
            aria-invalid={showError && error ? true : undefined}
            aria-describedby={describedBy}
            className={`${inputClass} min-h-[44px] ${showError && error ? 'border-red-600' : ''}`}
          />
          {!readOnly && (
            <button
              type="button"
              onClick={() => onChange('')}
              disabled={disabled || !trimmed}
              aria-label={`Pakai ${spec.label.toLowerCase()} bawaan`}
              className={resetButtonClass}
            >
              Pakai bawaan
            </button>
          )}
        </div>
        {showError && error && (
          <p id={`${id}-error`} className="mt-1 text-sm text-red-700">
            {error}
          </p>
        )}
        {status && (
          <p id={`${id}-status`} className={`mt-1 text-sm ${broken ? 'text-amber-800' : 'text-gray-600'}`}>
            {status}
          </p>
        )}
      </div>
    </div>
  );
};

interface TextFieldProps {
  spec: TextFieldSpec;
  value: string;
  disabled: boolean;
  readOnly: boolean;
  onChange: (value: string) => void;
}

const TextField: React.FC<TextFieldProps> = ({ spec, value, disabled, readOnly, onChange }) => {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {spec.label}
      </label>
      <p id={`${id}-help`} className="mb-2 text-sm text-gray-600">
        {spec.help}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          type="text"
          value={value}
          maxLength={SIGNATORY_TEXT_MAX}
          disabled={disabled}
          readOnly={readOnly}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={`${id}-help`}
          className={`${inputClass} min-h-[44px]`}
        />
        {!readOnly && (
          <button
            type="button"
            onClick={() => onChange('')}
            disabled={disabled || !value.trim()}
            aria-label={`Kosongkan ${spec.label.toLowerCase()}`}
            className={resetButtonClass}
          >
            Pakai bawaan
          </button>
        )}
      </div>
    </div>
  );
};

const WebConfigSettings: React.FC = () => {
  const [saved, setSaved] = useState<WebConfig>(EMPTY_WEB_CONFIG);
  const [form, setForm] = useState<FormValues>(toForm(EMPTY_WEB_CONFIG));
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [isSaving, setIsSaving] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<WebConfigKey, boolean>>>({});
  const [canEdit] = useState(currentUserCanEdit);

  const load = useCallback(async () => {
    setLoadState('loading');
    try {
      const res = await fetch(`${API_BASE_URL}/web-config`);
      if (!res.ok) throw new Error(`web-config ${res.status}`);
      const config = parseConfig(await res.json());
      setSaved(config);
      setForm(toForm(config));
      setTouched({});
      setLoadState('ready');
    } catch (err) {
      console.error('Gagal ambil pengaturan web:', err);
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const changedKeys = ALL_KEYS.filter((k) => form[k].trim() !== (saved[k] ?? ''));
  const dirty = changedKeys.length > 0;
  const disabled = loadState !== 'ready' || isSaving;

  const setField = (key: WebConfigKey, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const touch = (key: WebConfigKey) => setTouched((prev) => ({ ...prev, [key]: true }));

  const handleSave = async () => {
    const invalid = URL_KEYS.filter((k) => urlError(form[k]));
    if (invalid.length > 0) {
      setTouched((prev) => ({ ...prev, ...Object.fromEntries(invalid.map((k) => [k, true])) }));
      toast.error('Pengaturan web belum disimpan. Perbaiki URL yang ditandai merah.');
      return;
    }
    if (!dirty) return;

    // Only changed keys go out, so a field another admin just saved is not overwritten.
    const body = Object.fromEntries(changedKeys.map((k) => [k, form[k].trim()]));
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/web-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        await notifyResponseError(res, 'Pengaturan web gagal disimpan');
        return;
      }
      const data = await res.json();
      const config = parseConfig(data?.config);
      setSaved(config);
      setForm(toForm(config));
      setTouched({});
      void applyFavicon(config.favicon);
      if (data?.changed > 0) notifySuccess('Pengaturan web berhasil disimpan.');
      else toast('Tidak ada perubahan pada pengaturan web.');
    } catch (err) {
      console.error('Gagal simpan pengaturan web:', err);
      notifyError(err, 'Pengaturan web gagal disimpan');
    } finally {
      setIsSaving(false);
    }
  };

  const imageField = (spec: ImageFieldSpec) => (
    <ImageField
      key={spec.key}
      spec={spec}
      value={form[spec.key]}
      showError={Boolean(touched[spec.key])}
      disabled={disabled}
      readOnly={!canEdit}
      onChange={(value) => setField(spec.key, value)}
      onBlur={() => touch(spec.key)}
    />
  );

  return (
    <section aria-labelledby="web-config-title" className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-6 sm:mb-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-pink-100 rounded-lg">
          <ImageIcon className="w-5 h-5 text-pink-600" aria-hidden="true" />
        </div>
        <div>
          <h2 id="web-config-title" className="text-xl font-semibold text-gray-900">Pengaturan Web</h2>
          <p className="text-gray-600">
            Logo dan favicon aplikasi, serta tanda tangan dan penandatangan di receipt lunas. Kolom kosong memakai bawaan.
          </p>
        </div>
      </div>

      {loadState === 'error' ? (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-red-800">
            Pengaturan web gagal dimuat. Periksa koneksi ke server, lalu muat ulang.
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="min-h-[44px] shrink-0 rounded-lg border border-red-300 bg-white px-4 text-sm font-medium text-red-800 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          >
            Muat ulang
          </button>
        </div>
      ) : (
        <div aria-busy={loadState === 'loading' || undefined}>
          {loadState === 'loading' && (
            <p className="mb-4 text-sm text-gray-600">Memuat pengaturan web...</p>
          )}

          <fieldset className="space-y-6">
            <legend className="mb-4 text-base font-semibold text-gray-900">Tampilan aplikasi</legend>
            {APP_FIELDS.map(imageField)}
          </fieldset>

          <div className="mt-8 border-t border-gray-200 pt-6">
          <fieldset className="space-y-6">
            <legend className="mb-4 text-base font-semibold text-gray-900">Receipt lunas</legend>
            {imageField(SIGNATURE_FIELD)}
            <div className="grid gap-6 md:grid-cols-2">
              {SIGNATORY_FIELDS.map((spec) => (
                <TextField
                  key={spec.key}
                  spec={spec}
                  value={form[spec.key]}
                  disabled={disabled}
                  readOnly={!canEdit}
                  onChange={(value) => setField(spec.key, value)}
                />
              ))}
            </div>
          </fieldset>
          </div>

          {!canEdit ? (
            <p className="mt-8 text-sm text-gray-600">
              Hanya akun manajemen dan superadmin yang bisa mengubah pengaturan web.
            </p>
          ) : (
          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <p aria-live="polite" className="text-sm text-gray-600 sm:mr-auto">
              {dirty && !isSaving ? 'Ada perubahan yang belum disimpan.' : ''}
            </p>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={disabled || !dirty}
              aria-busy={isSaving || undefined}
              className="min-h-[44px] rounded-lg bg-orange-700 px-5 font-semibold text-white hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan Web'}
            </button>
          </div>
          )}
        </div>
      )}
    </section>
  );
};

export default WebConfigSettings;
