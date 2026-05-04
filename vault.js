// vault.js — Manages encrypted storage of API keys

import { CryptoManager } from './crypto.js';

const STORAGE_KEYS = {
  SALT: 'vault_salt',
  VAULT: 'vault_data',
  IS_SETUP: 'vault_is_setup'
};

// Session storage key for persisting the derived key across service worker restarts
const SESSION_KEY = 'vault_session_key';

export class SecureVault {
  constructor() {
    this.crypto = new CryptoManager();
    this.isUnlocked = false;
    this.decryptedKeys = []; // In-memory only, cleared on lock
  }

  // First-time setup: create master password
  async setup(masterPassword) {
    const salt = await this.crypto.initialize(masterPassword);
    await chrome.storage.local.set({
      [STORAGE_KEYS.SALT]: btoa(String.fromCharCode(...salt)),
      [STORAGE_KEYS.IS_SETUP]: true
    });
    this.isUnlocked = true;
    // Store empty vault
    const encryptedVault = await this.crypto.encrypt(JSON.stringify([]));
    await chrome.storage.local.set({ [STORAGE_KEYS.VAULT]: encryptedVault });
    // Persist session state so vault survives service worker restarts
    await this._persistSession();
  }

  // Unlock vault with master password
  async unlock(masterPassword) {
    const data = await chrome.storage.local.get([STORAGE_KEYS.SALT, STORAGE_KEYS.VAULT]);
    if (!data[STORAGE_KEYS.SALT]) throw new Error('Vault not set up');
    await this.crypto.unlock(masterPassword, data[STORAGE_KEYS.SALT]);
    this.isUnlocked = true;
    // Decrypt and cache keys in memory
    const decrypted = await this.crypto.decrypt(data[STORAGE_KEYS.VAULT]);
    this.decryptedKeys = JSON.parse(decrypted);
    // Persist session state
    await this._persistSession();
    return this.decryptedKeys;
  }

  // Try to restore vault from session storage (after service worker restart)
  async restoreFromSession() {
    const session = await chrome.storage.session.get(SESSION_KEY);
    if (!session[SESSION_KEY]) return false;

    try {
      // We stored a flag + the vault data in session; re-derive is needed
      // since we can't store CryptoKey objects. Instead, we store the
      // master password hash to verify, and the decrypted keys.
      // Actually, we can't store CryptoKey (not serializable).
      // Strategy: store decrypted keys in session storage (encrypted with a session key)
      // For simplicity: store decrypted keys in session storage directly.
      // This is acceptable because chrome.storage.session is in-memory and
      // cleared on browser restart. It's not accessible to web pages.
      const sessionData = session[SESSION_KEY];
      if (sessionData && sessionData.isUnlocked && sessionData.keys) {
        // We need the crypto key to still be valid for future encrypt/decrypt
        // Since we can't persist the CryptoKey, we can only restore the decrypted keys
        // for read-only operations. For write operations, user must re-enter password.
        // 
        // Better approach: store the master password in session (risky but contained)
        // Actually, let's just store a session token that indicates "was unlocked"
        // and the decrypted keys. For any write operation, we'll need the user to
        // re-authenticate if the crypto key is gone.
        this.decryptedKeys = sessionData.keys;
        this.isUnlocked = true;
        this._sessionRestored = true; // Flag: crypto key not available, only reads work
        return true;
      }
    } catch (e) {
      // Session data corrupt, clear it
      await chrome.storage.session.remove(SESSION_KEY);
    }
    return false;
  }

  // Lock the vault: clear in-memory data and session storage
  async lock() {
    this.crypto.key = null;
    this.decryptedKeys = [];
    this.isUnlocked = false;
    this._sessionRestored = false;
    await chrome.storage.session.remove(SESSION_KEY);
  }

  // Check if vault exists
  async isSetup() {
    const data = await chrome.storage.local.get(STORAGE_KEYS.IS_SETUP);
    return !!data[STORAGE_KEYS.IS_SETUP];
  }

  // Check if vault was restored from session (crypto key not available)
  get isSessionRestored() {
    return !!this._sessionRestored;
  }

  // Add an API key
  async addKey(provider, label, apiKey, sitePatterns = []) {
    if (!this.isUnlocked) throw new Error('Vault is locked');
    if (this._sessionRestored) throw new Error('Vault was restored from session. Please unlock with your master password to make changes.');

    const newEntry = {
      id: crypto.randomUUID(),
      provider,       // e.g., "openai", "anthropic", "google"
      label,          // e.g., "My OpenAI Key", "Work Claude Key"
      apiKey,
      sitePatterns,   // e.g., ["chat.openai.com", "platform.openai.com"]
      createdAt: new Date().toISOString()
    };

    this.decryptedKeys.push(newEntry);
    await this._saveVault();
    await this._persistSession();
    return newEntry.id;
  }

  // Remove an API key
  async removeKey(id) {
    if (!this.isUnlocked) throw new Error('Vault is locked');
    if (this._sessionRestored) throw new Error('Vault was restored from session. Please unlock with your master password to make changes.');

    this.decryptedKeys = this.decryptedKeys.filter(k => k.id !== id);
    await this._saveVault();
    await this._persistSession();
  }

  // Find keys matching a URL
  findKeysForSite(url) {
    if (!this.isUnlocked) return [];
    try {
      const hostname = new URL(url).hostname;
      return this.decryptedKeys.filter(k =>
        k.sitePatterns.some(pattern => {
          if (pattern.startsWith('*.')) {
            return hostname.endsWith(pattern.slice(1)); // *.openai.com
          }
          return hostname === pattern || hostname.endsWith('.' + pattern);
        })
      );
    } catch {
      return [];
    }
  }

  // Get all keys
  getAllKeys() {
    if (!this.isUnlocked) return [];
    return this.decryptedKeys;
  }

  // Internal: encrypt and persist vault
  async _saveVault() {
    const encryptedVault = await this.crypto.encrypt(JSON.stringify(this.decryptedKeys));
    await chrome.storage.local.set({ [STORAGE_KEYS.VAULT]: encryptedVault });
  }

  // Internal: persist session state for service worker restart recovery
  async _persistSession() {
    await chrome.storage.session.set({
      [SESSION_KEY]: {
        isUnlocked: true,
        keys: this.decryptedKeys,
        timestamp: Date.now()
      }
    });
  }
}