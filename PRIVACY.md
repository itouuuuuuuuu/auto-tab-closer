# Privacy Policy

Auto Tab Closer runs entirely inside your browser.

- It does **not** send any data to external servers.
- It does **not** include analytics, tracking, or advertising.
- Favicons shown in the popup come from Chrome's local favicon cache (the `favicon` permission); no request is made to the original site.
- It reads tab metadata (URL, title, last-accessed time, pinned/audible/active state) only to decide which tabs to close.
- It stores the following data locally using `chrome.storage`:
  - Your settings (threshold, whitelist, tab-group exclusion) in `chrome.storage.sync`, so Chrome can sync them between your own devices.
  - The pause toggle, a list of recently auto-closed tabs (URL, title, time closed; capped at 100 entries), and a badge counter in `chrome.storage.local`.

You can clear the recently-closed list at any time from the popup, and uninstalling the extension removes all stored data.
