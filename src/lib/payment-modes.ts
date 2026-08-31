import { supabase } from './supabase';

export const defaultPaymentModes = ['cash', 'bank_transfer', 'link', 'wamd', 'checks'];

const arabicAliases: Record<string, string> = {
  'نقد': 'cash',
  'نقدا': 'cash',
  'كاش': 'cash',
  'تحويل بنكي': 'bank_transfer',
  'حواله بنكيه': 'bank_transfer',
  'حوالة بنكية': 'bank_transfer',
  'رابط': 'link',
  'لينك': 'link',
  'ومض': 'wamd',
  'وامض': 'wamd',
  'شيك': 'checks',
  'شيكات': 'checks',
};

const latinAliases: Record<string, string> = {
  'bank transfer': 'bank_transfer',
  'banktransfer': 'bank_transfer',
  'transfer': 'bank_transfer',
  'check': 'checks',
  'cheque': 'checks',
  'cheques': 'checks',
};

/**
 * Maps any stored/selected payment mode onto a single canonical key so the value
 * saved, displayed and reported is always the same one. Arabic spelling variants
 * (separators, diacritics, ya/kaf/alef forms) collapse onto the built-in keys.
 */
export function canonicalPaymentMode(raw: string | null | undefined): string {
  const value = (raw || '').trim();
  if (!value) return 'cash';
  if (defaultPaymentModes.includes(value)) return value;
  if (/[\u0600-\u06FF]/.test(value)) {
    const norm = value
      .replace(/[_\-\s]+/g, ' ')
      .replace(/[\u064B-\u0652\u0670]/g, '')
      .replace(/[ىی]/g, 'ي')
      .replace(/ک/g, 'ك')
      .replace(/[أإآ]/g, 'ا')
      .trim();
    return arabicAliases[norm] || norm;
  }
  const norm = value.toLowerCase();
  return latinAliases[norm] || norm;
}

export function paymentModeLabel(raw: string | null | undefined, t: (key: any) => string): string {
  const key = canonicalPaymentMode(raw);
  return t(key) || key;
}

/** Payment modes for a dropdown: built-in modes plus configured ones, canonical and deduped. */
export async function fetchPaymentModes(): Promise<string[]> {
  const { data } = await supabase.from('payment_modes').select('name').order('name');
  const dbModes = (data || []).map((d: any) => canonicalPaymentMode(d.name));
  return [...new Set([...defaultPaymentModes, ...dbModes])];
}

/** Guarantees the currently selected value is present, so a select can never display another mode. */
export function paymentModeOptions(modes: string[], current: string | null | undefined): string[] {
  const key = canonicalPaymentMode(current);
  return modes.includes(key) ? modes : [key, ...modes];
}
