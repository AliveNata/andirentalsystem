import React, { useState } from 'react';
import { X } from 'lucide-react';

interface ImagePreviewProps {
  file: File | null;
  label: string;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ file, label }) => {
  const [showFullImage, setShowFullImage] = useState(false);

  if (!file) return null;

  const imageUrl = URL.createObjectURL(file);

  return (
    <>
      <div className="relative group cursor-pointer" onClick={() => setShowFullImage(true)}>
        <img
          src={imageUrl}
          alt={label}
          className="w-24 h-24 object-cover rounded-lg border border-gray-200"
        />
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center">
          <span className="text-white opacity-0 group-hover:opacity-100 text-sm">Klik untuk memperbesar</span>
        </div>
      </div>

      {showFullImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-4xl w-full">
            <button
              onClick={() => setShowFullImage(false)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
            >
              <X size={24} />
            </button>
            <img
              src={imageUrl}
              alt={label}
              className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
            />
            <p className="text-white text-center mt-2">{label}</p>
          </div>
        </div>
      )}
    </>
  );
};

export default ImagePreview;