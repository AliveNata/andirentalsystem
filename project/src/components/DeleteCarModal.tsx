import React from 'react';
import { ConfirmDialog } from './ui/Modal';

interface DeleteCarModalProps {
  carName: string;
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<unknown>;
}

const DeleteCarModal: React.FC<DeleteCarModalProps> = ({ carName, isOpen, onCancel, onConfirm }) => (
  <ConfirmDialog
    open={isOpen}
    onClose={onCancel}
    title="Hapus mobil?"
    description={
      <>
        <span className="font-semibold text-gray-900">{carName}</span> akan dihapus dan tidak tampil lagi di daftar.
      </>
    }
    confirmLabel="Hapus mobil"
    onConfirm={onConfirm}
  />
);

export default DeleteCarModal;
