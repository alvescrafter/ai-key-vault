// crypto.js — Core cryptographic operations using Web Crypto API

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

export class CryptoManager {
  constructor() {
    this.key = null;
  }

  // Derive an AES-256-GCM key from a master password + salt
  async deriveKey(masterPassword, salt) {
    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(masterPassword),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      passwordKey,
      { name: ALGORITHM, length: KEY_LENGTH },
      false, // key is NOT extractable
      ['encrypt', 'decrypt']
    );
  }

  // Initialize on first use — generate salt, derive key
  async initialize(masterPassword) {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    this.key = await this.deriveKey(masterPassword, salt);
    return salt;
  }

  // Unlock with existing salt
  async unlock(masterPassword, saltBase64) {
    const salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
    this.key = await this.deriveKey(masterPassword, salt);
  }

  // Encrypt plaintext → base64 string
  async encrypt(plaintext) {
    if (!this.key) throw new Error('Vault is locked');
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encoder = new TextEncoder();
    const encryptedData = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv: iv },
      this.key,
      encoder.encode(plaintext)
    );
    // Prepend IV to ciphertext for storage
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedData), iv.length);
    return btoa(String.fromCharCode(...combined));
  }

  // Decrypt base64 string → plaintext
  async decrypt(encryptedBase64) {
    if (!this.key) throw new Error('Vault is locked');
    const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    const iv = combined.slice(0, IV_LENGTH);
    const ciphertext = combined.slice(IV_LENGTH);
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv: iv },
      this.key,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  }

  // Check if the crypto manager has a derived key
  get isUnlocked() {
    return this.key !== null;
  }
}