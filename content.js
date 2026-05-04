// content.js — Detects AI sites and injects API keys

(function () {
  'use strict';

  // ─── Configuration: Known AI Sites ───
  const AI_SITES = {
    'chat.openai.com': {
      name: 'ChatGPT',
      provider: 'openai',
      selectors: {
        apiKeyInput: 'input[name="api-key"], #api-key-input, [data-testid="api-key-input"]',
        genericInput: 'input[type="password"], input[placeholder*="API" i], input[placeholder*="key" i]'
      }
    },
    'platform.openai.com': {
      name: 'OpenAI Platform',
      provider: 'openai',
      selectors: {
        apiKeyInput: 'input[name="key"], #api-key, input[placeholder*="API key" i]'
      }
    },
    'console.anthropic.com': {
      name: 'Anthropic Console',
      provider: 'anthropic',
      selectors: {
        apiKeyInput: 'input[name="apiKey"], input[placeholder*="API" i]'
      }
    },
    'aistudio.google.com': {
      name: 'Google AI Studio',
      provider: 'google',
      selectors: {
        apiKeyInput: 'input[name="apiKey"], input[placeholder*="API key" i]'
      }
    },
    'console.groq.com': {
      name: 'Groq Console',
      provider: 'groq',
      selectors: {
        apiKeyInput: 'input[name="apiKey"], input[placeholder*="API" i]'
      }
    },
    'platform.deepseek.com': {
      name: 'DeepSeek Platform',
      provider: 'deepseek',
      selectors: {
        apiKeyInput: 'input[name="apiKey"], input[placeholder*="API" i]'
      }
    }
  };

  let floatingWidget = null;
  let matchedKeys = [];

  // ─── Check if current site is a known AI site ───
  function getCurrentSite() {
    const hostname = window.location.hostname;
    for (const [pattern, config] of Object.entries(AI_SITES)) {
      if (hostname === pattern || hostname.endsWith('.' + pattern)) {
        return config;
      }
    }
    return null;
  }

  // ─── Ask background for keys for this site ───
  async function fetchKeysForSite() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getKeysForSite',
        url: window.location.href
      });
      if (response.success) {
        matchedKeys = response.keys;
      }
      return response;
    } catch (e) {
      console.error('AI Key Vault: Failed to fetch keys:', e);
      return { success: false, error: e.message };
    }
  }

  // ─── Request full key for injection ───
  async function getFullKey(keyId) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'injectKey',
        url: window.location.href,
        keyId: keyId
      });
      return response;
    } catch (e) {
      console.error('AI Key Vault: Failed to get key:', e);
      return { success: false, error: e.message };
    }
  }

  // ─── Create floating widget ───
  function createWidget(keys, isLocked = false) {
    removeWidget();

    const widget = document.createElement('div');
    widget.id = 'ai-key-vault-widget';
    widget.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483647;
      background: #1a1a2e;
      border: 1px solid #16213e;
      border-radius: 12px;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #e0e0e0;
      min-width: 280px;
      max-width: 340px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      font-size: 14px;
    `;

    if (isLocked) {
      widget.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <span style="font-weight:600; font-size:15px;">🔐 AI Key Vault</span>
          <button id="ai-vault-close" style="background:none;border:none;color:#888;cursor:pointer;font-size:18px;">✕</button>
        </div>
        <div style="text-align:center; padding: 12px;">
          <div style="font-size:24px; margin-bottom:8px;">🔒</div>
          <div style="color:#e0e0e0; font-weight:600; margin-bottom:4px;">Vault is locked</div>
          <div style="color:#888; font-size:12px;">Open the extension popup to unlock your vault</div>
        </div>
      `;
    } else if (keys.length === 0) {
      widget.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <span style="font-weight:600; font-size:15px;">🔐 AI Key Vault</span>
          <button id="ai-vault-close" style="background:none;border:none;color:#888;cursor:pointer;font-size:18px;">✕</button>
        </div>
        <div style="text-align:center; padding: 8px;">
          <div style="font-size:18px; margin-bottom:4px;">🔐</div>
          <div style="color:#aaa;">No keys configured for this site</div>
          <div style="color:#666; font-size:12px; margin-top:4px;">
            Add site patterns in your vault settings
          </div>
        </div>
      `;
    } else {
      let keyButtons = keys.map(k => `
        <button data-key-id="${k.id}" class="ai-vault-key-btn" style="
          width: 100%;
          padding: 10px 12px;
          margin: 6px 0;
          background: #16213e;
          border: 1px solid #0f3460;
          border-radius: 8px;
          color: #e0e0e0;
          cursor: pointer;
          text-align: left;
          font-size: 13px;
          transition: background 0.2s;
        ">
          <div style="font-weight:600;">${escapeHtml(k.label)}</div>
          <div style="color:#888; font-size:11px; margin-top:2px;">
            ${escapeHtml(k.provider)} · ${escapeHtml(k.maskedKey)}
          </div>
        </button>
      `).join('');

      widget.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <span style="font-weight:600; font-size:15px;">🔐 AI Key Vault</span>
          <button id="ai-vault-close" style="background:none;border:none;color:#888;cursor:pointer;font-size:18px;">✕</button>
        </div>
        <div style="color:#aaa; font-size:12px; margin-bottom:8px;">Select a key to copy:</div>
        ${keyButtons}
        <div style="color:#555; font-size:10px; margin-top:8px; text-align:center;">
          ⚠️ Key will be copied to your clipboard
        </div>
      `;
    }

    document.body.appendChild(widget);
    floatingWidget = widget;

    // Wire up close button
    const closeBtn = widget.querySelector('#ai-vault-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        removeWidget();
      });
    }

    // Wire up key buttons
    widget.querySelectorAll('.ai-vault-key-btn').forEach(btn => {
      btn.addEventListener('mouseover', () => {
        btn.style.background = '#0f3460';
      });
      btn.addEventListener('mouseout', () => {
        btn.style.background = '#16213e';
      });
      btn.addEventListener('click', async () => {
        const keyId = btn.dataset.keyId;
        btn.textContent = 'Copying...';
        btn.disabled = true;
        const result = await getFullKey(keyId);
        if (result.success) {
          await injectKeyIntoPage(result.apiKey, result.provider);
          removeWidget();
        } else {
          btn.textContent = 'Error: ' + (result.error || 'Failed');
          btn.disabled = false;
          setTimeout(() => {
            btn.innerHTML = btn.dataset.originalContent || 'Retry';
          }, 2000);
        }
      });
    });
  }

  // ─── Remove the floating widget ───
  function removeWidget() {
    if (floatingWidget) {
      floatingWidget.remove();
      floatingWidget = null;
    }
  }

  // ─── Inject the key into the page (clipboard-first) ───
  async function injectKeyIntoPage(apiKey, provider) {
    // Primary method: copy to clipboard — most reliable across all sites
    try {
      await navigator.clipboard.writeText(apiKey);
      showNotification('📋 Key copied to clipboard — paste it into the input field');
      return;
    } catch {
      // Fallback: try to find and fill an input field
      const site = getCurrentSite();
      if (site) {
        const selectors = Object.values(site.selectors).join(', ');
        const input = document.querySelector(selectors);
        if (input) {
          fillInput(input, apiKey);
          showNotification(`✅ Key injected for ${site.name}`);
          return;
        }
      }
      showNotification('⚠️ Could not copy or inject key');
    }
  }

  // ─── Fill an input field and trigger React/Vue change events ───
  function fillInput(element, value) {
    // Use the native input value setter to bypass React's synthetic events
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ).set;
    nativeInputValueSetter.call(element, value);

    // Dispatch events that React, Vue, Angular, etc. listen for
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  }

  // ─── Show a brief notification ───
  function showNotification(message) {
    const notif = document.createElement('div');
    notif.style.cssText = `
      position: fixed; bottom: 80px; right: 20px; z-index: 2147483647;
      background: #1a1a2e; color: #e0e0e0; padding: 12px 20px;
      border-radius: 8px; font-family: sans-serif; font-size: 14px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      transition: opacity 0.3s;
    `;
    notif.textContent = message;
    document.body.appendChild(notif);
    setTimeout(() => { notif.style.opacity = '0'; }, 2500);
    setTimeout(() => notif.remove(), 3000);
  }

  // ─── Escape HTML to prevent XSS ───
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ─── Auto-inject: show widget if on a known site ───
  async function init() {
    const site = getCurrentSite();
    if (!site) return; // Not a known AI site

    const response = await fetchKeysForSite();
    if (response.success) {
      createWidget(response.keys);
    } else if (response.needsUnlock) {
      // Vault is locked — show locked state
      createWidget([], true);
    } else {
      // Other error — don't show widget
      console.log('AI Key Vault: Could not fetch keys:', response.error);
    }
  }

  // ─── Keyboard shortcut: Ctrl+Shift+K (handled via commands API) ───
  // Listen for toggle message from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleWidget') {
      if (floatingWidget) {
        removeWidget();
      } else {
        init();
      }
      sendResponse({ success: true });
    }
    return true;
  });

  // ─── Also support Ctrl+Shift+K directly as a fallback ───
  document.addEventListener('keydown', async (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'K') {
      e.preventDefault();
      if (floatingWidget) {
        removeWidget();
      } else {
        await init();
      }
    }
  });

  // Run after page loads
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();