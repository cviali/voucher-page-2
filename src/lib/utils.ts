import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | number | Date | null | undefined) {
  if (!date) return 'N/A'
  const d = new Date(date)
  if (isNaN(d.getTime())) return 'N/A'
  return d.toLocaleDateString('en-GB') // DD/MM/YYYY
}

export function formatDateTimeGMT7(date: string | number | Date | null | undefined) {
  if (!date) return 'N/A'
  const d = new Date(date)
  if (isNaN(d.getTime())) return 'N/A'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok'
  }).format(d)
}

export function formatIDR(amount: number | null | undefined) {
  if (amount === null || amount === undefined) return 'Rp 0'
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function getOptimizedImageUrl(url: string | null | undefined, width?: number, quality: number = 75) {
  if (!url) return ''
  if (!width) return url
  
  // If the image is from our own API, we can append resizing parameters
  if (url.includes('/vouchers/image/')) {
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}w=${width}&q=${quality}`
  }
  
  return url
}

export async function resizeImage(file: File, maxWidth: number = 1200, maxHeight: number = 1200): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas to Blob failed'));
            }
          },
          'image/jpeg',
          0.85
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

export const VOUCHER_STATUS_COLORS = {
  claimed: "bg-zinc-800 text-white hover:bg-zinc-900 border-transparent font-bold uppercase",
  redeemed: "bg-zinc-800 text-white hover:bg-zinc-900 border-transparent font-bold uppercase",
  expired: "bg-red-600 text-white hover:bg-red-700 border-transparent font-bold uppercase",
  pending: "bg-amber-500 text-white hover:bg-amber-600 border-transparent font-bold uppercase",
  requested: "bg-amber-500 text-white hover:bg-amber-600 border-transparent font-bold uppercase",
  active: "bg-emerald-600 text-white hover:bg-emerald-700 border-transparent font-bold uppercase",
  available: "bg-zinc-400 text-white hover:bg-zinc-500 border-transparent font-bold uppercase",
} as const;

export type VoucherStatus = keyof typeof VOUCHER_STATUS_COLORS;
