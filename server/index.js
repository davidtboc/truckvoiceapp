// index.js
require("dotenv").config();
const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

// Toggle verbose logs with: DEBUG=1 (and VAPI_WEBHOOK_DEBUG=1 for full webhook payload)
const DEBUG = process.env.DEBUG === "1";

const ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

// --------------------
// CORS (HTTP routes)
// --------------------
// NOTE: Do NOT add app.options("*") or app.options("/*") in Express 5.
// cors() middleware will handle preflight automatically.
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow server-to-server / curl (no Origin header)
      if (!origin) return cb(null, true);

      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);

      // If you want to allow all during dev, uncomment:
      // return cb(null, true);

      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false
  })
);

// --------------------
// Middleware
// --------------------
// Vapi webhooks sometimes come in with a non-standard Content-Type.
// This ensures we still parse JSON for that route.
app.use("/webhook/vapi", express.json({ type: "*/*" }));
app.use(express.json());

// --------------------
// Socket.io (websocket)
// --------------------
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  if (DEBUG) console.log("[socket] connected:", socket.id);

  socket.on("join", (room) => {
    socket.join(room);
    if (DEBUG) console.log(`[socket] ${socket.id} joined room ${room}`);
  });

  socket.on("disconnect", () => {
    if (DEBUG) console.log("[socket] disconnected:", socket.id);
  });
});

// --------------------
// Helpers
// --------------------
function getEventType(body) {
  return (
    body?.type ||
    body?.event ||
    body?.message?.type ||
    body?.data?.type ||
    body?.data?.event ||
    "unknown"
  );
}

function extractCallId(body) {
  return (
    body?.callId ||
    body?.call?.id ||
    body?.id ||
    body?.data?.callId ||
    body?.data?.call?.id ||
    body?.message?.callId ||
    body?.message?.call?.id ||
    null
  );
}

function extractTranscriptText(body) {
  return (
    body?.transcript?.text ||
    body?.transcript ||
    body?.data?.transcript?.text ||
    body?.data?.transcript ||
    body?.message?.transcript?.text ||
    body?.message?.transcript ||
    body?.artifact?.transcript?.text ||
    body?.artifact?.transcript ||
    null
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeControlUrl(url) {
  if (!url) return null;
  const s = String(url).trim();
  // Sometimes docs show <https://...>; if your payload ever contains brackets, strip them.
  return s.replace(/^<|>$/g, "");
}

function isRetryableStatus(status) {
  return status === 502 || status === 503 || status === 504;
}

async function postEndCallWithRetries(controlUrl) {
  const url = normalizeControlUrl(controlUrl);

  // A few quick retries handles transient 502/503/504
  const attempts = [{ wait: 0 }, { wait: 350 }, { wait: 900 }, { wait: 1800 }];

  let last = null;

  for (let i = 0; i < attempts.length; i++) {
    if (attempts[i].wait) await sleep(attempts[i].wait);

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Vapi docs: End Call => { "type": "end-call" }
        body: JSON.stringify({ type: "end-call" })
      });

      const text = await resp.text().catch(() => "");
      last = { ok: resp.ok, status: resp.status, text };

      if (resp.ok) return { ok: true, status: resp.status, text };

      // If it’s retryable, loop
      if (isRetryableStatus(resp.status)) continue;

      // Non-retryable failure
      return { ok: false, status: resp.status, text };
    } catch (err) {
      last = { ok: false, status: 0, text: err?.message || "fetch failed" };
      // network errors: retry next attempt
      continue;
    }
  }

  return last || { ok: false, status: 0, text: "unknown failure" };
}

async function getVapiCallStatus(callId) {
  // This requires VAPI_API_KEY in your server/.env
  const key = process.env.VAPI_API_KEY;
  if (!key) return { ok: false, status: 0, json: null, error: "Missing VAPI_API_KEY" };

  const resp = await fetch(`https://api.vapi.ai/call/${callId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    }
  });

  const json = await resp.json().catch(() => null);
  return { ok: resp.ok, status: resp.status, json };
}

function isEndedStatus(statusLike) {
  const s = String(statusLike || "").toLowerCase();
  return s === "ended" || s === "completed" || s === "finished";
}

// --------------------
// Webhook: Vapi events
// --------------------
app.post("/webhook/vapi", (req, res) => {
  const body = req.body || {};
  const eventType = getEventType(body);
  const callId = extractCallId(body);

  if (!callId) {
    if (DEBUG) console.log("[vapi:webhook] missing callId, skipping emit");
    return res.status(200).send("OK");
  }

  if (DEBUG) console.log(`[vapi:webhook] event=${eventType} callId=${callId}`);

  if (process.env.VAPI_WEBHOOK_DEBUG === "1") {
    console.log("[vapi:webhook] payload:", JSON.stringify(body, null, 2));
  }

  io.to(callId).emit("vapi_event", body);

  const transcriptText = extractTranscriptText(body);
  if (transcriptText) {
    io.to(callId).emit("transcript", {
      callId,
      text: transcriptText,
      eventType,
      ts: Date.now()
    });
  }

  res.status(200).send("OK");
});

// --------------------
// Start Vapi outbound call
// --------------------
app.post("/api/start-vapi-call", async (req, res) => {
  // ✅ renamed to carrierPhone (frontend now sends carrierPhone)
  const { carrierPhone, formData } = req.body || {};

  if (!carrierPhone) {
    return res.status(400).json({ success: false, error: "Missing carrierPhone" });
  }

  // ✅ UPDATED: use CallCarrierModal fields
  const variableValues = {
    dispatcherName: formData?.dispatcherName || "Dispatcher",

    entityType: formData?.entityType || "-",
    usdotNumber: formData?.usdotNumber || "-",
    dateFound: formData?.dateFound || "-",
    opStates: formData?.opStates || "-",
    companyName: formData?.companyName || "-",
    mcNumber: formData?.mcNumber || "-",
    address: formData?.address || "-",
    carrierPhoneNumber: formData?.carrierPhoneNumber || "-",
    powerUnits: formData?.powerUnits || "-",
    drivers: formData?.drivers || "-",
    cargoCarried: formData?.cargoCarried || "-",
    categoryType: formData?.categoryType || "-"
  };

  try {
    const response = await fetch("https://api.vapi.ai/call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "outboundPhoneCall",
        assistantId: process.env.VAPI_ASSISTANT_ID,
        phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
        customer: { number: carrierPhone },
        maxDurationSeconds: 3600,
        assistantOverrides: { variableValues }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || `Vapi error: ${response.status}`);
    }

    res.json({
      success: true,
      callId: data.id,
      monitorUrl: data.monitorUrl || null
    });
  } catch (error) {
    console.error("[vapi] start call error:", error);
    res.status(500).json({ success: false, error: error?.message || "Failed to start call" });
  }
});

// --------------------
// End call (server-to-server)
// --------------------
app.post("/api/end-vapi-call", async (req, res) => {
  try {
    const { callId, controlUrl } = req.body || {};

    let url = normalizeControlUrl(controlUrl);

    // ✅ If controlUrl missing, fetch it from Vapi using callId
    if (!url) {
      if (!callId) {
        return res.status(400).json({ success: false, error: "Missing callId and controlUrl" });
      }

      const check = await getVapiCallStatus(callId);
      const fetched =
        check?.json?.monitor?.controlUrl ||
        check?.json?.call?.monitor?.controlUrl ||
        check?.json?.monitorUrl || // fallback (not always a controlUrl)
        null;

      url = normalizeControlUrl(fetched);

      if (DEBUG) console.log("[vapi:end] fetched controlUrl:", url);

      if (!url) {
        return res.status(400).json({
          success: false,
          error: "Missing controlUrl (not present on call yet). Try again in 1-2 seconds.",
          callId,
          hint: "controlUrl often appears after call starts; frontend can retry."
        });
      }
    }

    if (DEBUG) console.log(`[vapi:end] callId=${callId || "(none)"} controlUrl=${url}`);

    // 1) Send end-call to controlUrl (with retries for transient 502/503/504)
    const endResp = await postEndCallWithRetries(url);

    if (!endResp?.ok) {
      return res.status(endResp.status || 502).json({
        success: false,
        error: "Vapi controlUrl end-call failed",
        status: endResp.status || 0,
        body: endResp.text || ""
      });
    }

    // 2) Confirm ended (best effort)
    if (callId && process.env.VAPI_API_KEY) {
      for (let i = 0; i < 8; i++) {
        await sleep(1000);
        const check = await getVapiCallStatus(callId);
        const status = check?.json?.status;

        if (DEBUG) console.log("[vapi:end] status check:", { ok: check.ok, status });

        if (check.ok && isEndedStatus(status)) {
          return res.json({ success: true, callId, confirmed: true, status });
        }
      }
      return res.json({ success: true, callId, confirmed: false });
    }

    return res.json({ success: true, callId: callId || null, confirmed: false });
  } catch (err) {
    console.error("[vapi:end] server error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// --------------------
// Get call status (server-to-server)
// --------------------
app.get("/api/vapi-call-status/:callId", async (req, res) => {
  try {
    const { callId } = req.params;

    if (!callId) {
      return res.status(400).json({ success: false, error: "Missing callId" });
    }

    const check = await getVapiCallStatus(callId);

    if (!check.ok) {
      return res.status(check.status || 500).json({
        success: false,
        error: "Failed to fetch call status",
        status: check.status || 0,
        body: check.json || null
      });
    }

    const status = check?.json?.status || null;
    const ended = isEndedStatus(status);

    return res.json({
      success: true,
      callId,
      status,
      ended
    });
  } catch (err) {
    console.error("[vapi:status] server error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// --------------------
// Production serving
// --------------------
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../dist")));
  // Express 5 catch-all:
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, "../dist", "index.html"));
  });
}

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
