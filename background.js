// background.js — Service worker that coordinates everything

import { SecureVault } from './vault.js';

const vault = new SecureVault();

// Auto-lock alarm name
const AUTO_LOCK_ALARM = 'vault-auto-lock';
const AUTO_LOCK_MINUTES = 30;

// ─── Service Worker Lifecycle ───

// On startup, try to restore vault from session storage
chrome.runtime.onInstalled.addListener(async () => {
  console.log('AI Key Vault installed');
});

// When service worker wakes up, try to restore session
chrome.runtime.onStartup.addListener(async () => {
  await tryRestoreSession();
});

// Listen for alarm-based auto-lock
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === AUTO_LOCK_ALARM) {
    console.log('Auto-locking vault (alarm)');
    await vault.lock();
  }
});

// ─── Message Handling ───

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender) {
  // For most operations, try to restore session if vault is locked
  if (!vault.isUnlocked && message.action !== 'checkSetup' && message.action !== 'setup' && message.action !== 'unlock') {
    const restored = await tryRestoreSession();
    if (!restored && message.action !== 'lock') {
      return { success: false, error: 'Vault is locked', needsUnlock: true };
    }
  }

  switch (message.action) {
    case 'checkSetup': {
      return { isSetup: await vault.isSetup() };
    }

    case 'setup': {
      if (message.password.length < 8) {
        return { success: false, error: 'Password must be at least 8 characters' };
      }
      await vault.setup(message.password);
      resetAutoLockAlarm();
      return { success: true };
    }

    case 'unlock': {
      try {
        const keys = await vault.unlock(message.password);
        resetAutoLockAlarm();
        // Return keys with API values MASKED for the popup UI
        return {
          success: true,
          keys: keys.map(k => ({
            ...k,
            apiKey: undefined,
            maskedKey: maskKey(k.apiKey)
          }))
        };
      } catch (e) {
        return { success: false, error: 'Invalid master password' };
      }
    }

    case 'lock': {
      await vault.lock();
      chrome.alarms.clear(AUTO_LOCK_ALARM);
      return { success: true };
    }

    case 'addKey': {
      try {
        const id = await vault.addKey(
          message.provider,
          message.label,
          message.apiKey,
          message.sitePatterns || []
        );
        resetAutoLockAlarm();
        return { success: true, id };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }

    case 'removeKey': {
      try {
        await vault.removeKey(message.id);
        resetAutoLockAlarm();
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }

    case 'getAllKeys': {
      if (!vault.isUnlocked) {
        return { success: false, error: 'Vault is locked', needsUnlock: true };
      }
      return {
        success: true,
        keys: vault.getAllKeys().map(k => ({
          ...k,
          apiKey: undefined,
          maskedKey: maskKey(k.apiKey)
        })),
        isSessionRestored: vault.isSessionRestored
      };
    }

    // Content script requests keys for the current site
    case 'getKeysForSite': {
      if (!vault.isUnlocked) {
        return { success: false, error: 'Vault is locked', needsUnlock: true };
      }
      const keys = vault.findKeysForSite(message.url);
      return {
        success: true,
        keys: keys.map(k => ({
          id: k.id,
          provider: k.provider,
          label: k.label,
          maskedKey: maskKey(k.apiKey)
        }))
      };
    }

    // Popup requests the FULL key for copying to clipboard
    case 'copyKey': {
      if (!vault.isUnlocked) {
        return { success: false, error: 'Vault is locked', needsUnlock: true };
      }
      resetAutoLockAlarm();
      const allKeys = vault.getAllKeys();
      const keyEntry = allKeys.find(k => k.id === message.keyId);
      if (!keyEntry) return { success: false, error: 'Key not found' };
      return { success: true, apiKey: keyEntry.apiKey, provider: keyEntry.provider };
    }

    // Content script requests the FULL key for injection
    case 'injectKey': {
      if (!vault.isUnlocked) {
        return { success: false, error: 'Vault is locked', needsUnlock: true };
      }
      resetAutoLockAlarm();
      const siteKeys = vault.findKeysForSite(message.url);
      const siteKeyEntry = siteKeys.find(k => k.id === message.keyId);
      if (!siteKeyEntry) return { success: false, error: 'Key not found for this site' };
      return { success: true, apiKey: siteKeyEntry.apiKey, provider: siteKeyEntry.provider };
    }

    // Check vault status (for popup to know if it needs to show unlock screen)
    case 'getStatus': {
      return {
        isSetup: await vault.isSetup(),
        isUnlocked: vault.isUnlocked,
        isSessionRestored: vault.isSessionRestored
      };
    }

    default:
      return { success: false, error: 'Unknown action' };
  }
}

// ─── Command: Toggle vault widget via keyboard shortcut ───

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-vault-widget') {
    // Send message to the active tab's content script to toggle widget
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'toggleWidget' });
      } catch (e) {
        // Content script not loaded on this tab — inject it programmatically
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          // Small delay then send toggle message
          setTimeout(async () => {
            try {
              await chrome.tabs.sendMessage(tab.id, { action: 'toggleWidget' });
            } catch { /* ignore */ }
          }, 200);
        } catch (e2) {
          console.log('Cannot inject content script on this page:', e2.message);
        }
      }
    }
  }
});

// ─── Helper Functions ───

function maskKey(apiKey) {
  if (!apiKey || apiKey.length < 12) return '••••••••';
  return apiKey.slice(0, 8) + '...' + apiKey.slice(-4);
}

function resetAutoLockAlarm() {
  chrome.alarms.clear(AUTO_LOCK_ALARM);
  chrome.alarms.create(AUTO_LOCK_ALARM, { delayInMinutes: AUTO_LOCK_MINUTES });
}

async function tryRestoreSession() {
  if (vault.isUnlocked) return true;
  try {
    const restored = await vault.restoreFromSession();
    if (restored) {
      resetAutoLockAlarm();
    }
    return restored;
  } catch {
    return false;
  }
}