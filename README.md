# 🔐 AI Key Vault — Chrome Extension

Securely store and copy your AI API keys with AES-256-GCM encryption. Keys are encrypted with a master password that is never stored — only you can unlock them.

## ✨ Features

- **AES-256-GCM Encryption** — Keys are encrypted at rest using a master password derived via PBKDF2 (100,000 iterations)
- **Master Password** — Never stored; only a salt is persisted. Keys can only be decrypted when you unlock the vault
- **📋 One-Click Copy** — Copy any API key to your clipboard directly from the popup
- **Auto-Lock** — Vault automatically locks after 30 minutes of inactivity
- **Session Persistence** — Unlocked vault survives service worker restarts within the same browser session
- **Floating Widget** — Appears on known AI sites with matching keys — click to copy instantly
- **Keyboard Shortcut** — Press `Ctrl+Shift+K` (or `Cmd+Shift+K` on Mac) to toggle the vault widget on any page
- **Smart Fallback** — On AI sites, tries to auto-fill input fields; falls back to clipboard copy

---

## 🚀 Installation (Easiest Method)

### Step 1 — Download

1. Go to the [GitHub repository](https://github.com/alvescrafter/ai-key-vault) and click the green **Code** button
2. Select **Download ZIP**
3. Extract the ZIP file to a folder on your computer (e.g., your Desktop)

> 💡 **Tip:** Remember where you extract it — Chrome needs the folder to stay in place while the extension is installed. Don't delete it!

### Step 2 — Install in Chrome

1. Open Chrome and type **`chrome://extensions`** in the address bar, then press Enter
2. Turn on **Developer mode** (toggle switch in the top-right corner)
3. Click **Load unpacked** (top-left button)
4. Select the extracted folder (the one containing `manifest.json`)
5. The 🔐 **AI Key Vault** icon will appear in your extensions toolbar

> ⚠️ **Important:** The folder must stay where it is. If you move or delete it, the extension will stop working.

### Step 3 — Pin the Extension

1. Click the **puzzle piece** icon in Chrome's toolbar (top-right)
2. Find **AI Key Vault** in the list
3. Click the **pin** icon to keep it visible in your toolbar

---

## 📖 How to Use

### First Time Setup

1. Click the 🔐 AI Key Vault icon in your toolbar
2. Enter a **master password** (minimum 8 characters) and confirm it
3. Your vault is now created — remember this password, it cannot be recovered!

### Adding API Keys

1. Unlock the vault with your master password
2. Click **"+ Add Key"**
3. Select a **provider** (OpenAI, Anthropic, Google, Groq, DeepSeek, or Custom)
4. Enter a **label** (e.g., "My OpenAI Key")
5. Paste your **API key**
6. Optionally customize the **site patterns** for auto-detection (defaults are provided)
7. Click **"Save Key"**

### Copying a Key

1. Open the vault popup (click the 🔐 icon in your toolbar)
2. Find the key you want
3. Click the **📋 Copy** button — the key is copied to your clipboard
4. Paste it wherever you need it (`Ctrl+V` / `Cmd+V`)

### Using on AI Sites

1. Navigate to a supported AI site (e.g., chat.openai.com)
2. The vault widget will appear automatically if you have matching keys
3. Click a key to **copy it to your clipboard**
4. Paste it into the site's API key field

### Keyboard Shortcut

Press **`Ctrl+Shift+K`** (or **`Cmd+Shift+K`** on Mac) on any page to toggle the vault widget.

---

## 🔒 Security Model

| Layer | Protection |
|-------|-----------|
| **At rest** | AES-256-GCM encryption with PBKDF2-derived key (100K iterations, random salt) |
| **Master password** | Never stored; only the salt is persisted in `chrome.storage.local` |
| **In memory** | Decrypted keys held in service worker memory; cleared on lock or SW termination |
| **Session** | Decrypted keys cached in `chrome.storage.session` (in-memory, cleared on browser restart) |
| **Clipboard** | Keys are copied to clipboard — the most reliable and secure method available |

### Security Notes

- Your **master password is never stored** — if you forget it, there is no recovery
- Keys are **encrypted at rest** — even if someone accesses your Chrome storage, they can't read your keys without the master password
- The vault **auto-locks after 30 minutes** of inactivity
- **Closing the browser** clears the session — you'll need to re-enter your master password next time

---

## 🌐 Supported Sites

| Site | Provider | Behavior |
|------|----------|----------|
| chat.openai.com | OpenAI | Widget appears, copy to clipboard |
| platform.openai.com | OpenAI | Widget appears, copy to clipboard |
| console.anthropic.com | Anthropic | Widget appears, copy to clipboard |
| aistudio.google.com | Google | Widget appears, copy to clipboard |
| console.groq.com | Groq | Widget appears, copy to clipboard |
| platform.deepseek.com | DeepSeek | Widget appears, copy to clipboard |

---

## 📁 File Structure

```
├── manifest.json          — Extension manifest (MV3)
├── background.js          — Service worker: message routing, auto-lock, session restore
├── crypto.js              — AES-256-GCM encryption engine (Web Crypto API)
├── vault.js               — Secure storage layer (encrypt/decrypt/persist)
├── content.js             — Site detection, floating widget, key copy
├── popup.html             — Extension popup UI
├── popup.js               — Popup interaction logic
├── generate-icons.js      — Icon generation script (run once)
├── icons/
│   ├── icon16.png         — 16×16 toolbar icon
│   ├── icon48.png         — 48×48 extension page icon
│   ├── icon128.png        — 128×128 Chrome Web Store icon
│   └── icon.svg           — Source SVG for icons
└── README.md              — This file
```

## 🔧 Permissions Explained

| Permission | Why |
|-----------|-----|
| `storage` | Store encrypted vault data and session state |
| `activeTab` | Inject content script on-demand via keyboard shortcut |
| `scripting` | Programmatically inject content.js on non-matched sites |
| `alarms` | Auto-lock vault after 30 minutes of inactivity |
| `host_permissions` | Access to known AI sites for content script injection |

## 🛠️ Development

### Regenerating Icons

```bash
node generate-icons.js
```

### Testing

1. Load the extension in Chrome (`chrome://extensions` → Load unpacked)
2. Open the popup → create a master password
3. Add an API key
4. Click the 📋 Copy button — verify the key is copied to clipboard
5. Navigate to a supported AI site — verify the widget appears
6. Test the lock/unlock cycle
7. Test service worker restart (wait ~30s, then interact with popup)

---

## ❓ FAQ

**Q: What happens if I forget my master password?**
A: There is no recovery mechanism. Your keys are encrypted with your master password — if you forget it, you'll need to set up a new vault and re-add your keys.

**Q: Can I move the extension folder after installing?**
A: No — Chrome loads the extension from the folder you selected. If you move or delete it, the extension will break. Keep it in a permanent location.

**Q: Are my keys sent to any server?**
A: No. All encryption and decryption happens locally in your browser. No data ever leaves your device.

**Q: Why does the extension need access to AI sites?**
A: The `host_permissions` allow the content script to detect when you're on a supported AI site and show the vault widget. The extension only runs on the specific sites listed above.

**Q: What happens when I close Chrome?**
A: The vault is automatically locked. Your encrypted keys are safely stored, but you'll need to re-enter your master password next time.

## License

MIT