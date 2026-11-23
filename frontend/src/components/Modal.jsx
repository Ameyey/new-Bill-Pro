import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-xl' }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && onClose) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`relative bg-white rounded-2xl shadow-2xl border border-slate-100 w-full ${maxWidth} my-auto z-10 flex flex-col max-h-[90vh] overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0 bg-white">
            <h3 className="text-base font-bold text-slate-800">{title}</h3>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
        <div className="p-3 sm:p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>,
    document.body
  );
}
