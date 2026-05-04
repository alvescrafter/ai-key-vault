// popup.js — Extension popup logic

let isNewVault = false;
let isSessionRestored = false;

// ─── Initialize popup ───
async function init() {
  const response = await chrome.runtime.sendMessage({ action: 'checkSetup' });
  isNewVault = !response.isSetup;

  if (isNewVault) {
    document.getElementById('confirm-password').style.display = 'block';
    document.getElementById('auth-btn').textContent = 'Create Vault';
  }

  // Check if vault is already unlocked (e.g., from session restore)
  const status = await chrome.runtime.sendMessage({ action: 'getStatus' });
  if (status.isUnlocked) {
    isSessionRestored = status.isSessionRestored;
    const keysRes = await chrome.runtime.sendMessage({ action: 'getAllKeys' });
    if (keysRes.success) {
      showVault(keysRes.keys, status.isSessionRestored);
    }
  }
}

// ─── Auth form submission ───
document.getElementById('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = document.getElementById('master-password').value;
  const errorEl = document.getElementById('auth-error');
  errorEl.textContent = '';

  if (isNewVault) {
    const confirm = document.getElementById('confirm-password').value;
    if (password !== confirm) {
      errorEl.textContent = 'Passwords do not match';
      return;
    }
    if (password.length < 8) {
      errorEl.textContent = 'Password must be at least 8 characters';
      return;
    }
    const res = await chrome.runtime.sendMessage({ action: 'setup', password });
    if (res.success) {
      showVault([], false);
    } else {
      errorEl.textContent = res.error || 'Failed to create vault';
    }
  } else {
    const res = await chrome.runtime.sendMessage({ action: 'unlock', password });
    if (res.success) {
      isSessionRestored = false; // Fresh unlock, not session restored
      showVault(res.keys, false);
    } else {
      errorEl.textContent = res.error || 'Failed to unlock';
    }
  }
});

// ─── Lock button ───
document.getElementById('lock-btn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ action: 'lock' });
  document.getElementById('vault-section').style.display = 'none';
  document.getElementById('add-form').classList.remove('visible');
  document.getElementById('auth-section').style.display = 'block';
  document.getElementById('master-password').value = '';
  document.getElementById('confirm-password').value = '';
  document.getElementById('auth-error').textContent = '';
});

// ─── Add key button ───
document.getElementById('add-key-btn').addEventListener('click', () => {
  if (isSessionRestored) {
    // Warn that changes require full unlock
    document.getElementById('add-warning').textContent =
      '⚠️ Vault was restored from session. Re-enter your master password to make changes.';
    document.getElementById('add-warning').style.display = 'block';
  }
  document.getElementById('add-form').classList.add('visible');
  document.getElementById('add-key-btn').style.display = 'none';
});

document.getElementById('cancel-add-btn').addEventListener('click', () => {
  document.getElementById('add-form').classList.remove('visible');
  document.getElementById('add-key-btn').style.display = 'block';
  document.getElementById('add-error').textContent = '';
  document.getElementById('add-warning').style.display = 'none';
});

// ─── Save key ───
document.getElementById('save-key-btn').addEventListener('click', async () => {
  const provider = document.getElementById('key-provider').value;
  const label = document.getElementById('key-label').value || `${provider.charAt(0).toUpperCase() + provider.slice(1)} Key`;
  const apiKey = document.getElementById('key-value').value;
  const sitesRaw = document.getElementById('key-sites').value;
  const sitePatterns = sitesRaw
    ? sitesRaw.split(',').map(s => s.trim()).filter(Boolean)
    : [getDefaultSite(provider)];

  const errorEl = document.getElementById('add-error');
  if (!apiKey) { errorEl.textContent = 'API key is required'; return; }

  const res = await chrome.runtime.sendMessage({
    action: 'addKey',
    provider,
    label,
    apiKey,
    sitePatterns
  });

  if (res.success) {
    document.getElementById('add-form').classList.remove('visible');
    document.getElementById('add-key-btn').style.display = 'block';
    document.getElementById('key-label').value = '';
    document.getElementById('key-value').value = '';
    document.getElementById('key-sites').value = '';
    document.getElementById('add-error').textContent = '';
    document.getElementById('add-warning').style.display = 'none';
    // Refresh key list
    const keysRes = await chrome.runtime.sendMessage({ action: 'getAllKeys' });
    if (keysRes.success) renderKeys(keysRes.keys);
  } else {
    errorEl.textContent = res.error || 'Failed to add key';
  }
});

// ─── Default site patterns per provider ───
function getDefaultSite(provider) {
  const defaults = {
    openai: 'chat.openai.com',
    anthropic: 'console.anthropic.com',
    google: 'aistudio.google.com',
    groq: 'console.groq.com',
    deepseek: 'platform.deepseek.com'
  };
  return defaults[provider] || '';
}

// ─── Show vault after unlock ───
function showVault(keys = [], sessionRestored = false) {
  isSessionRestored = sessionRestored;
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('vault-section').style.display = 'block';

  const sessionBadge = document.getElementById('session-badge');
  if (sessionRestored) {
    sessionBadge.style.display = 'inline-block';
    sessionBadge.title = 'Vault restored from session. Re-enter password to make changes.';
  } else {
    sessionBadge.style.display = 'none';
  }

  renderKeys(keys);
}

// ─── Render key list ───
function renderKeys(keys) {
  const list = document.getElementById('keys-list');
  if (keys.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:#666;padding:20px;">No keys yet. Add one!</div>';
    return;
  }
  list.innerHTML = keys.map(k => `
    <div class="key-card">
      <div class="label">${escapeHtml(k.label)}</div>
      <div class="meta">
        <span class="tag">${escapeHtml(k.provider)}</span>
        <span class="tag">${escapeHtml(k.maskedKey)}</span>
      </div>
      <div class="meta">${(k.sitePatterns || []).map(s => escapeHtml(s)).join(', ')}</div>
      <div class="actions">
        <button class="btn btn-primary btn-small copy-btn" data-id="${k.id}">📋 Copy</button>
        <button class="btn btn-danger btn-small" data-id="${k.id}" data-action="delete">Delete</button>
      </div>
    </div>
  `).join('');

  // Wire up copy buttons
  list.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const originalText = btn.textContent;
      btn.textContent = 'Copying...';
      btn.disabled = true;
      const res = await chrome.runtime.sendMessage({ action: 'copyKey', keyId: btn.dataset.id });
      if (res.success) {
        try {
          await navigator.clipboard.writeText(res.apiKey);
          btn.textContent = '✅ Copied!';
          setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 1500);
        } catch {
          btn.textContent = '❌ Failed';
          setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 1500);
        }
      } else {
        btn.textContent = '❌ ' + (res.error || 'Error');
        setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 1500);
      }
    });
  });

  // Wire up delete buttons
  list.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Delete this key?')) {
        await chrome.runtime.sendMessage({ action: 'removeKey', id: btn.dataset.id });
        const res = await chrome.runtime.sendMessage({ action: 'getAllKeys' });
        if (res.success) renderKeys(res.keys);
      }
    });
  });
}

// ─── Escape HTML to prevent XSS ───
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Auto-fill site patterns when provider changes ───
document.getElementById('key-provider').addEventListener('change', (e) => {
  const sitesInput = document.getElementById('key-sites');
  const defaultSite = getDefaultSite(e.target.value);
  if (defaultSite && !sitesInput.value) {
    sitesInput.placeholder = defaultSite;
  }
});

// Run init
init();