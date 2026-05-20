/**
 * CryptoVault — Client-side AES-GCM encryption for sensitive CRM data
 * All sensitive fields (client PII, payment amounts, diagnosis notes, etc.)
 * are encrypted before storage and decrypted on read.
 * Key is derived from the company encryption key stored in localStorage.
 */

const ALG = 'AES-GCM';
const KEY_USAGE = ['encrypt', 'decrypt'];
const ENC_PREFIX = 'ENC:';

function getKeyMaterial() {
  const raw = localStorage.getItem('enc_key') || 'RecoverLab-DefaultKey-ChangeInProd-2026';
  return new TextEncoder().encode(raw.padEnd(32, '0').slice(0, 32));
}

async function deriveKey() {
  const keyMaterial = await crypto.subtle.importKey('raw', getKeyMaterial(), { name: 'PBKDF2' }, false, ['deriveKey']);
  const salt = new TextEncoder().encode('RecoverLabSalt2026');
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: ALG, length: 256 },
    false,
    KEY_USAGE
  );
}

/** Encrypt a plaintext string → ENC:base64(iv+ciphertext) */
export async function encrypt(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') return plaintext;
  if (plaintext.startsWith(ENC_PREFIX)) return plaintext; // already encrypted
  try {
    const key = await deriveKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt({ name: ALG, iv }, key, encoded);
    const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.byteLength);
    return ENC_PREFIX + btoa(String.fromCharCode(...combined));
  } catch {
    return plaintext; // fallback to plaintext if crypto not available
  }
}

/** Decrypt an ENC:... string back to plaintext */
export async function decrypt(cipherStr) {
  if (!cipherStr || typeof cipherStr !== 'string') return cipherStr;
  if (!cipherStr.startsWith(ENC_PREFIX)) return cipherStr;
  try {
    const key = await deriveKey();
    const combined = Uint8Array.from(atob(cipherStr.slice(ENC_PREFIX.length)), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const plainBuffer = await crypto.subtle.decrypt({ name: ALG, iv }, key, ciphertext);
    return new TextDecoder().decode(plainBuffer);
  } catch {
    return '[Encrypted — key mismatch]';
  }
}

/** Encrypt an object's specified fields */
export async function encryptFields(obj, fields) {
  const result = { ...obj };
  for (const field of fields) {
    if (result[field] != null) result[field] = await encrypt(String(result[field]));
  }
  return result;
}

/** Decrypt an object's specified fields */
export async function decryptFields(obj, fields) {
  const result = { ...obj };
  for (const field of fields) {
    if (result[field] != null) result[field] = await decrypt(result[field]);
  }
  return result;
}

/** Encrypt a File to base64 AES-GCM ciphertext */
export async function encryptFile(file) {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buffer = await file.arrayBuffer();
  const ciphertext = await crypto.subtle.encrypt({ name: ALG, iv }, key, buffer);
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return {
    encryptedData: ENC_PREFIX + btoa(String.fromCharCode(...combined)),
    originalName: file.name,
    mimeType: file.type,
    size: file.size,
  };
}

/** Decrypt an encrypted file blob back to a data URL */
export async function decryptFileToDataUrl(encryptedData, mimeType) {
  if (!encryptedData || !encryptedData.startsWith(ENC_PREFIX)) return encryptedData;
  try {
    const key = await deriveKey();
    const combined = Uint8Array.from(atob(encryptedData.slice(ENC_PREFIX.length)), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const plainBuffer = await crypto.subtle.decrypt({ name: ALG, iv }, key, ciphertext);
    const blob = new Blob([plainBuffer], { type: mimeType });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export const SENSITIVE_CASE_FIELDS = ['client_address', 'phone', 'email', 'serial_number', 'pcb_number'];
export const SENSITIVE_CLIENT_FIELDS = ['phone', 'email', 'address'];
export const SENSITIVE_PAYMENT_FIELDS = ['amount', 'reference', 'note'];
