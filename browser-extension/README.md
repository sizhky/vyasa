# Vyasa Link Previews

1. Open `chrome://extensions` and enable **Developer mode**.
2. Select **Load unpacked** and choose this `browser-extension` directory.
3. Reload Vyasa, then Cmd-hover an external link to open its preview.
4. Hold Cmd while hovering a link inside that webpage to open another preview; use Ctrl on Windows/Linux.
5. Press Escape while focused inside an external webpage to close its preview; test reopening and ordinary clicks too.

Chrome needs website access to inject the content script into external frames.
The extension sends the hovered link URL and label to its parent frame only during a trusted Cmd/Ctrl gesture.
It has no server, storage, or background process; Vyasa accepts messages only from its own preview frames.
Sites that block iframe embedding remain blocked; use **Open in new tab** for those pages.
Links inside a webpage's own nested iframes are not supported by this initial version.

After changing the extension, select **Reload** on its Chrome extension card and reload Vyasa.
Both gesture orders work: hold Cmd/Ctrl before hovering, or hover first and then press Cmd/Ctrl.
Nested previews retain their source link rectangle for the origin warp, updating it during iframe scrolling and resizing.
Run the event regression check from the repository root with `node browser-extension/test.mjs`.
Reference: [Chrome's unpacked extension installation](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked).
