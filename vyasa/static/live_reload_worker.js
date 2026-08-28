// One live-reload stream shared by every tab of this origin.
//
// Each tab used to open its own EventSource on /_vyasa/reload. Over HTTP/1.1 a
// browser allows only six connections per origin, and an SSE stream holds one
// for its whole life, so six open tabs stalled every later request to the
// server before it left the browser. Every tab watches the same files, so one
// stream is enough: this worker owns it and fans each change out over the
// ports. The browser terminates the worker once its last tab is gone, which
// closes the stream.
//
// Tabs fall back to their own stream unless this worker reports `ready`, so a
// worker that cannot reach the network costs headroom, never live reload.

const RECONNECT_PROBE_DELAY_MS = 1000;

const ports = new Set();
let source = null;
let connected = false;
let probing = false;

const broadcast = (message) => {
  for (const port of ports) {
    try {
      port.postMessage(message);
    } catch (error) {
      ports.delete(port);
    }
  }
};

// The server went away. EventSource retries on its own; poll until the server
// answers again, then tell every tab to reload so it picks up the new build.
const probeUntilServerReturns = () => {
  if (probing) return;
  probing = true;
  setTimeout(() => {
    fetch("/", { cache: "no-store" })
      .then(() => broadcast({ type: "reload" }))
      .catch(() => {})
      .finally(() => {
        probing = false;
      });
  }, RECONNECT_PROBE_DELAY_MS);
};

const connect = () => {
  if (source) return;
  source = new EventSource("/_vyasa/reload");
  source.onopen = () => {
    connected = true;
    broadcast({ type: "ready" });
  };
  source.addEventListener("refresh", (event) => {
    broadcast({ type: "refresh", data: event.data || "{}" });
  });
  source.addEventListener("reload", () => broadcast({ type: "reload" }));
  source.onerror = () => {
    connected = false;
    probeUntilServerReturns();
  };
};

self.onconnect = (event) => {
  const port = event.ports[0];
  ports.add(port);
  port.onmessage = (message) => {
    if (message.data !== "close") return;
    ports.delete(port);
    if (ports.size === 0) {
      source?.close();
      source = null;
      connected = false;
    }
  };
  port.start();
  connect();
  // A tab joining an already-open stream never sees onopen fire.
  if (connected) port.postMessage({ type: "ready" });
};
