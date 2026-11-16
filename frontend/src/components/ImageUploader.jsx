import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { UploadCloud, Trash2, RefreshCw, Image as ImageIcon, CheckCircle } from 'lucide-react';

export default function ImageUploader({ invoiceId = null, onImagesChange, initialImages = [] }) {
  const { success, error } = useToast();
  const { refreshMe, setCompany } = useAuth();
  const [images, setImages] = useState(initialImages);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchImages();
  }, [invoiceId]);

  const fetchImages = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/images${invoiceId ? `?invoice_id=${invoiceId}` : ''}`);
      if (res.success) {
        setImages(res.images);
        if (onImagesChange) onImagesChange(res.images);
      }
    } catch (err) {
      console.error('Error fetching images:', err);
    } finally {
      setLoading(false);
    }
  };

  const compressImage = (file, maxWidth = 600, quality = 0.85) => {
    return new Promise((resolve) => {
      if (file.type === 'image/svg+xml') {
        return resolve(file);
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > maxWidth || height > maxWidth) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxWidth) / height);
              height = maxWidth;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob && blob.size < file.size) {
              resolve(new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), { type: 'image/jpeg' }));
            } else {
              resolve(file);
            }
          }, 'image/jpeg', quality);
        };
        img.onerror = () => resolve(file);
        img.src = event.target.result;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side file type validation
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      error('Invalid file format. Please select a JPG, PNG, WEBP, or SVG image.');
      return;
    }

    // Client-side file size validation (10MB)
    if (file.size > 10 * 1024 * 1024) {
      error('File size exceeds 10MB limit.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Auto-compress image to ensure lightning-fast upload & minimal database payload
      const uploadFile = await compressImage(file);

      const formData = new FormData();
      formData.append('image', uploadFile);
      formData.append('slot', '1');
      formData.append('type', 'logo');
      if (invoiceId) {
        formData.append('invoice_id', invoiceId);
      }

      const res = await api.uploadImage(formData, (percent) => {
        setUploadProgress(percent);
      });

      if (res.success) {
        success('Company Logo uploaded successfully!');
        const newPath = res.image?.file_path || res.logo_url;
        if (setCompany && newPath) {
          setCompany(prev => (prev ? { ...prev, logo_url: newPath } : { logo_url: newPath }));
        }
        if (refreshMe) refreshMe();
        await fetchImages();
      }
    } catch (err) {
      error(err.message || 'Image upload failed.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      e.target.value = '';
    }
  };

  const handleDelete = async (imageId) => {
    try {
      const res = await api.delete(`/images/${imageId}`);
      if (res.success) {
        success('Logo image deleted successfully.');
        if (setCompany) {
          setCompany(prev => (prev ? { ...prev, logo_url: '' } : { logo_url: '' }));
        }
        if (refreshMe) refreshMe();
        await fetchImages();
      }
    } catch (err) {
      error(err.message || 'Failed to delete image.');
    }
  };

  const logoImage = images.find(img => img.image_slot === 1) || (images.length > 0 ? images[0] : null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-brand-600" />
            <span>Company Logo / Document Image</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
              Single Image (Logo)
            </span>
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Your official company logo displayed at the top of all invoices, previews, and PDF documents.
          </p>
        </div>
      </div>

      <div className="w-full">
        {/* SINGLE IMAGE SLOT: Company Logo */}
        <div className="relative rounded-2xl border-2 border-dashed border-slate-200 p-6 hover:border-brand-400 transition-colors bg-white">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-600"></span>
              Official Company Logo
            </span>
            {logoImage && (
              <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Logo Uploaded
              </span>
            )}
          </div>

          {logoImage ? (
            <div className="space-y-4">
              <div className="relative h-44 w-full rounded-2xl bg-slate-50/80 border border-slate-200 flex items-center justify-center p-4 overflow-hidden group">
                <img
                  src={logoImage.file_path}
                  alt="Company Logo"
                  className="max-h-full max-w-full object-contain drop-shadow-sm"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2 text-slate-600 truncate max-w-sm">
                  <span className="font-semibold text-slate-800 truncate">{logoImage.file_name}</span>
                  {logoImage.file_size && (
                    <span className="text-[11px] text-slate-400">
                      ({(logoImage.file_size / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer bg-white border border-slate-200 hover:border-brand-300 text-brand-700 font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-brand-50 shadow-sm transition">
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Replace Logo</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => handleDelete(logoImage.id)}
                    className="bg-white border border-slate-200 hover:border-rose-300 text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-rose-50 shadow-sm transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Logo</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              {isUploading ? (
                <div className="h-44 flex flex-col items-center justify-center text-center">
                  <div className="w-full bg-slate-100 rounded-full h-2.5 max-w-xs mb-3 overflow-hidden">
                    <div
                      className="bg-brand-600 h-2.5 rounded-full transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs font-bold text-brand-600">Uploading Logo {uploadProgress}%...</p>
                </div>
              ) : (
                <label className="h-44 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50/80 rounded-xl transition border border-transparent hover:border-slate-100 p-4">
                  <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-3">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold text-brand-700 hover:underline">
                    Click to upload Company Logo
                  </span>
                  <span className="text-xs text-slate-400 mt-1">
                    Supports PNG, JPG, WEBP, SVG (Max 5MB)
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
