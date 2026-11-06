/**
 * Persian typography and formatting utilities.
 */

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\d/g, (d) => PERSIAN_DIGITS[parseInt(d, 10)]);
}

export function formatRial(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '۰ ریال';
  const formatted = new Intl.NumberFormat('fa-IR').format(amount);
  return `${formatted} ریال`;
}

export function formatToman(amountIrr: number | null | undefined): string {
  if (amountIrr === null || amountIrr === undefined) return '۰ تومان';
  const toman = Math.floor(amountIrr / 10);
  const formatted = new Intl.NumberFormat('fa-IR').format(toman);
  return `${formatted} تومان`;
}

export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '۰ بایت';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت', 'ترابایت'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
  return `${toPersianDigits(val)} ${sizes[i]}`;
}
