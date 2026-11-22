import React, { useEffect, useState } from 'react';
import { ImageDialog } from './ui/Modal';

interface ImagePreviewProps {
  file: File | null;
  label: string;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ file, label }) => {
  const [showFullImage, setShowFullImage] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // One object URL per file, revoked on change; creating it during render leaked a URL on every re-render.
  useEffect(() => {
    if (!file) {
      setImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!file || !imageUrl) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setShowFullImage(true)}
        aria-label={`Perbesar ${label}`}
        className="relative group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2"
      >
        <img
          src={imageUrl}
          alt={label}
          className="w-24 h-24 object-cover rounded-lg border border-gray-200"
        />
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center">
          <span className="text-white opacity-0 group-hover:opacity-100 text-sm">Klik untuk memperbesar</span>
        </div>
      </button>

      <ImageDialog src={showFullImage ? imageUrl : null} alt={label} caption={label} onClose={() => setShowFullImage(false)} />
    </>
  );
};

export default ImagePreview;
