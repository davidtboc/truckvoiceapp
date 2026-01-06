// src/components/ActiveCall/ActiveCall.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import "./ActiveCall.css";

const SOCKET_URL = "http://localhost:5000";
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// ✅ State abbreviation → full state name (case-insensitive + trims)
const STATE_MAP = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "Washington, DC"
};

function expandStateAbbrev(cityState) {
  const s = String(cityState || "").trim();
  if (!s) return s;

  const m = s.match(/^(.*?)(?:,\s*|\s+)([A-Za-z]{2})\s*$/);
  if (!m) return s;

  const city = String(m[1] || "").trim();
  const abbr = String(m[2] || "").trim().toUpperCase();
  const full = STATE_MAP[abbr];

  if (!full) return s;
  if (!city) return full;

  return `${city}, ${full}`;
}

export default function ActiveCall({
  callId,
  vapiCallId,
  monitorUrl,
  onClose,
  brokerName = "Active Call",
  origin = "Unknown Origin",
  destination = "Unknown Destination",
  rate = "$?.??",
  initialPosition = { top: 100, left: 20 },

  // ✅ optional: if you ever pass it later
  initialControlUrl = null
}) {
  const [seconds, setSeconds] = useState(0);
  const [isConnecting, setIsConnecting] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);

  const [unreadCount, setUnreadCount] = useState(0);
  const [messages, setMessages] = useState([]);

  const [isEndingCall, setIsEndingCall] = useState(false);
  const [isCallEnded, setIsCallEnded] = useState(false);

  // ✅ seed from prop (may be null)
  const [controlUrl, setControlUrl] = useState(initialControlUrl);

  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const panelRef = useRef(null);
  const transcriptRef = useRef(null);

  const lastSeenCountRef = useRef(0);

  const showTranscriptRef = useRef(false);
  useEffect(() => {
    showTranscriptRef.current = showTranscript;
  }, [showTranscript]);

  const seenTurnKeysRef = useRef(new Set());
  const seenLineKeysRef = useRef(new Set());

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ✅ Display route using full state names
  const originDisplay = useMemo(() => expandStateAbbrev(origin), [origin]);
  const destinationDisplay = useMemo(() => expandStateAbbrev(destination), [destination]);

  // Timer — STOP when call ends
  useEffect(() => {
    if (isCallEnded) return;
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isCallEnded]);

  // Poll server for call status so we detect broker hangup even if webhook/event is missed
  useEffect(() => {
    if (!vapiCallId || isCallEnded) return;

    let interval = null;

    const poll = async () => {
      try {
        const res = await fetch(`${SOCKET_URL}/api/vapi-call-status/${vapiCallId}`);
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.success) return;

        if (data.ended) {
          setIsCallEnded(true);
          setIsConnecting(false);
          setIsEndingCall(false);
        }
      } catch {
        // ignore
      }
    };

    poll();
    interval = setInterval(poll, 3000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [vapiCallId, isCallEnded]);

  const normalizeRole = (raw) => {
    const r = String(raw || "").toLowerCase().trim();
    if (["assistant", "ai", "agent", "bot"].includes(r)) return "ai";
    if (["user", "customer", "caller", "human", "broker"].includes(r)) return "broker";
    return null;
  };

  const toDate = (tsLike) => {
    const n = Number(tsLike);
    if (Number.isFinite(n) && n > 0) return new Date(n);
    return new Date(Date.now());
  };

  useEffect(() => {
    if (showTranscriptRef.current) {
      setUnreadCount(0);
      lastSeenCountRef.current = messages.length;
      return;
    }
    const nextUnread = Math.max(0, messages.length - (lastSeenCountRef.current || 0));
    setUnreadCount(nextUnread);
  }, [messages]);

  const extractArtifactTurns = (event) => {
    const msg = event?.message ?? event ?? {};
    const artifact = msg?.artifact ?? event?.artifact ?? null;
    const arr = artifact?.messages;

    if (!Array.isArray(arr) || arr.length === 0) return [];

    const turns = [];

    for (const item of arr) {
      const role = normalizeRole(item?.role);
      const text = String(item?.message ?? item?.content ?? "").trim();
      const time = toDate(item?.time ?? item?.timestamp ?? msg?.timestamp ?? Date.now());

      if (!role || !text) continue;

      const timeMs = time.getTime();
      const key = `${role}|${timeMs}|${text.slice(0, 48)}|${text.slice(-48)}`;

      if (seenTurnKeysRef.current.has(key)) continue;
      seenTurnKeysRef.current.add(key);

      turns.push({ role, text, time });
    }

    return turns;
  };

  const splitTranscriptBlobIntoTurns = (blobText, fallbackTimestamp) => {
    const raw = String(blobText || "").trim();
    if (!raw) return [];

    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const looksLikePrefixed = lines.some((l) =>
      /^(AI|Assistant|User|Broker|Customer)\s*:\s*/i.test(l)
    );

    if (!looksLikePrefixed) {
      return [
        {
          role: "broker",
          text: raw,
          time: toDate(fallbackTimestamp ?? Date.now())
        }
      ];
    }

    const out = [];
    for (const line of lines) {
      const m = line.match(/^(AI|Assistant|User|Broker|Customer)\s*:\s*(.*)$/i);
      if (!m) continue;

      const who = String(m[1] || "").toLowerCase();
      const text = String(m[2] || "").trim();
      if (!text) continue;

      const role = who === "ai" || who === "assistant" ? "ai" : "broker";
      const time = toDate(fallbackTimestamp ?? Date.now());

      const key = `${role}::${text}`;
      if (seenLineKeysRef.current.has(key)) continue;
      seenLineKeysRef.current.add(key);

      out.push({ role, text, time });
    }

    return out;
  };

  const extractTranscriptText = (eventOrPayload) => {
    const msg = eventOrPayload?.message ?? eventOrPayload ?? {};
    return (
      msg?.transcript?.text ??
      msg?.transcript ??
      eventOrPayload?.transcript?.text ??
      eventOrPayload?.transcript ??
      msg?.artifact?.transcript?.text ??
      msg?.artifact?.transcript ??
      eventOrPayload?.artifact?.transcript?.text ??
      eventOrPayload?.artifact?.transcript ??
      eventOrPayload?.text ??
      null
    );
  };

  const extractTimestamp = (eventOrPayload) => {
    const msg = eventOrPayload?.message ?? eventOrPayload ?? {};
    return msg?.timestamp ?? eventOrPayload?.timestamp ?? eventOrPayload?.ts ?? Date.now();
  };

  const extractControlUrl = (eventOrPayload) => {
    const msg = eventOrPayload?.message ?? eventOrPayload ?? {};
    return (
      msg?.call?.monitor?.controlUrl ??
      eventOrPayload?.call?.monitor?.controlUrl ??
      msg?.monitor?.controlUrl ??
      eventOrPayload?.monitor?.controlUrl ??
      null
    );
  };

  const isEndedStatusLike = (s) => {
    const v = String(s || "").toLowerCase().trim();
    return ["ended", "completed", "finished", "canceled", "cancelled", "failed"].includes(v);
  };

  const isEndedEvent = (eventOrPayload) => {
    const msg = eventOrPayload?.message ?? eventOrPayload ?? {};

    const type = String(msg?.type ?? eventOrPayload?.type ?? "").toLowerCase().trim();

    const status = String(
      msg?.call?.status ?? eventOrPayload?.call?.status ?? msg?.status ?? ""
    )
      .toLowerCase()
      .trim();

    if (type.includes("ended") || type.includes("call-ended")) return true;
    if (isEndedStatusLike(status)) return true;

    return false;
  };

  useEffect(() => {
    if (!vapiCallId) return;

    const socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000
    });

    socket.on("connect", () => {
      socket.emit("join", vapiCallId);
    });

    socket.on("vapi_event", (event) => {
      const msg = event?.message ?? event ?? {};
      const type = String(msg?.type ?? event?.type ?? "").toLowerCase();

      const nextControlUrl = extractControlUrl(event);
      if (nextControlUrl && nextControlUrl !== controlUrl) {
        setControlUrl(nextControlUrl);
      }

      if (isEndedEvent(event)) {
        setIsCallEnded(true);
        setIsConnecting(false);
        setIsEndingCall(false);
        return;
      }

      if (
        type.includes("started") ||
        type === "status-update" ||
        type === "conversation-update" ||
        type === "transcript" ||
        type === "speech-update" ||
        type.includes("speech")
      ) {
        setIsConnecting(false);
      }

      const artifactTurns = extractArtifactTurns(event);
      if (artifactTurns.length > 0) {
        setMessages((prev) => [...prev, ...artifactTurns]);
        setIsConnecting(false);
        return;
      }

      const rawText = extractTranscriptText(event);
      const text = String(rawText || "").trim();
      if (!text) return;

      const ts = extractTimestamp(event);
      const turnsFromBlob = splitTranscriptBlobIntoTurns(text, ts);
      if (turnsFromBlob.length === 0) return;

      setMessages((prev) => [...prev, ...turnsFromBlob]);
      setIsConnecting(false);
    });

    socket.on("transcript", (payload) => {
      if (isEndedEvent(payload)) {
        setIsCallEnded(true);
        setIsConnecting(false);
        setIsEndingCall(false);
        return;
      }

      const text = String(payload?.text || "").trim();
      if (!text) return;

      const ts = payload?.ts ?? Date.now();
      const turns = splitTranscriptBlobIntoTurns(text, ts);
      if (turns.length === 0) return;

      setMessages((prev) => [...prev, ...turns]);
      setIsConnecting(false);
    });

    socket.on("reconnect", () => {
      socket.emit("join", vapiCallId);
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vapiCallId]);

  useEffect(() => {
    if (isCallEnded) return;

    const timeout = setTimeout(() => {
      setIsConnecting(false);
    }, 20000);

    return () => clearTimeout(timeout);
  }, [isCallEnded]);

  useEffect(() => {
    if (showTranscript && transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages, showTranscript]);

  const formatTime = (date) => date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const callTime = () => {
    const m = String(Math.floor(seconds / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  const clampToViewport = (pos) => {
    const el = panelRef.current;
    if (!el) return pos;
    const MARGIN = 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = el.getBoundingClientRect();
    const w = rect.width || 360;
    const h = rect.height || 260;
    const maxLeft = Math.max(MARGIN, vw - w - MARGIN);
    const maxTop = Math.max(MARGIN, vh - h - MARGIN);
    return {
      left: clamp(pos.left ?? 0, MARGIN, maxLeft),
      top: clamp(pos.top ?? 0, MARGIN, maxTop)
    };
  };

  useEffect(() => setPosition((p) => clampToViewport(p)), []);

  useEffect(() => {
    const onResize = () => setPosition((p) => clampToViewport(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleMouseDown = (e) => {
    const interactive = e.target.closest("button, a, input, textarea, select, [role='button']");
    if (interactive || e.button !== 0) return;

    const panel = panelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const next = {
        left: e.clientX - dragOffset.x,
        top: e.clientY - dragOffset.y
      };
      setPosition(clampToViewport(next));
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const statusLabel = isCallEnded ? "Call Ended" : isConnecting ? "Calling..." : "In Conversation";
  const statusClass = isCallEnded ? "is-ended" : isConnecting ? "is-calling" : "is-live";

  const toggleTranscript = () => {
    setShowTranscript((prev) => {
      const next = !prev;
      lastSeenCountRef.current = messages.length;
      if (next) setUnreadCount(0);
      if (!next) setUnreadCount(0);
      return next;
    });
  };

  const transcriptCopyText = useMemo(() => {
    if (!messages || messages.length === 0) return "";
    return messages
      .map((m) => `${m.role === "ai" ? "AI Dispatcher" : "Broker"}: ${m.text}`)
      .join("\n");
  }, [messages]);

  const handleCopyTranscript = async () => {
    try {
      if (!transcriptCopyText) return;
      await navigator.clipboard.writeText(transcriptCopyText);
    } catch (err) {
      console.error("Failed to copy transcript:", err);
    }
  };

  // ✅ UPDATED: allow endCall even when controlUrl not available yet (backend will fetch it)
  const endCall = async () => {
    if (isCallEnded || isEndingCall) return false;

    if (!vapiCallId) {
      console.error("End call blocked: vapiCallId not available yet.");
      return false;
    }

    setIsEndingCall(true);

    try {
      const res = await fetch(`${SOCKET_URL}/api/end-vapi-call`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          callId: vapiCallId,
          controlUrl: controlUrl || null
        })
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      const ok = Boolean(res.ok && data?.success === true);

      if (!ok) {
        console.error("End call failed:", {
          status: res.status,
          statusText: res.statusText,
          response: data
        });
        return false;
      }

      if (!isMountedRef.current) return true;

      setIsCallEnded(true);
      setIsConnecting(false);
      return true;
    } catch (err) {
      console.error("End call failed (network/server error):", err);
      return false;
    } finally {
      if (isMountedRef.current) setIsEndingCall(false);
    }
  };

  const handleClose = async () => {
    try {
      await endCall();
    } finally {
      onClose?.();
    }
  };

  return (
    <div
      ref={panelRef}
      className={`activecall-panel ${showTranscript ? "is-expanded" : ""}`}
      style={{
        top: position.top,
        left: position.left,
        cursor: isDragging ? "grabbing" : "move"
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="ac-header">
        <div className="ac-title">{brokerName}</div>
        <button type="button" onClick={handleClose} className="ac-close" aria-label="Close">
          ×
        </button>
      </div>

      <div className="ac-route">
        {originDisplay} → {destinationDisplay}
      </div>

      <div className="ac-meta">
        <div className="ac-rate-pill">{rate}</div>
        <div className="ac-timer">{callTime()}</div>
      </div>

      <div className={`ac-status ${statusClass}`}>{statusLabel}</div>

      <button type="button" className="ac-transcript-toggle" onClick={toggleTranscript}>
        <span className="ac-toggle-left">
          <span className="ac-toggle-icon" aria-hidden="true">
            🎙️
          </span>
          <span className="ac-toggle-text">
            {showTranscript ? "Hide Transcript" : "Show Transcript"}
          </span>
          {!showTranscript && unreadCount > 0 && <span className="ac-unread-badge">{unreadCount}</span>}
        </span>
        <span className="ac-toggle-right" aria-hidden="true">
          <i className={`bi ${showTranscript ? "bi-chevron-up" : "bi-chevron-down"}`} />
        </span>
      </button>

      {showTranscript && (
        <>
          <div className="ac-legend-row">
            <div className="ac-legend">
              <span className="ac-legend-item">
                <span className="ac-dot broker" />
                <span>Broker</span>
              </span>
              <span className="ac-legend-item">
                <span className="ac-dot ai" />
                <span>AI Dispatcher</span>
              </span>
            </div>

            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="ac-copy-btn"
                onClick={handleCopyTranscript}
                disabled={messages.length === 0}
                aria-label="Copy transcript"
                title="Copy transcript"
              >
                <i className="bi bi-clipboard" /> Copy Transcript
              </button>

              <button type="button" className="ac-sound-btn" aria-label="Speaker">
                <i className="bi bi-volume-up-fill" />
              </button>
            </div>
          </div>

          <div className="ac-transcript" ref={transcriptRef}>
            {messages.map((msg, i) => (
              <div key={i} className={`ac-msg ac-msg-${msg.role}`}>
                <div className={`ac-bubble ac-bubble-${msg.role}`}>{msg.text}</div>
                <div className="ac-msg-meta">
                  {msg.role === "broker" ? "Broker" : "AI Dispatcher"}&nbsp;&nbsp;
                  {formatTime(msg.time)}
                </div>
              </div>
            ))}

            {messages.length === 0 && (
              <div className="text-center text-muted small">
                No messages yet — conversation starting...
              </div>
            )}
          </div>
        </>
      )}

      <div className="ac-actions">
        {/* <button
          className="ac-btn ac-btn-join"
          type="button"
          onClick={() => monitorUrl && window.open(monitorUrl, "_blank")}
          disabled={!monitorUrl}
        >
          Join Call
        </button> */}

        <button
          className="ac-btn ac-btn-end"
          type="button"
          onClick={endCall}
          disabled={isCallEnded || isEndingCall || !vapiCallId}
          aria-disabled={isCallEnded || isEndingCall || !vapiCallId}
          title={!vapiCallId ? "Waiting for call id..." : isCallEnded ? "Call already ended" : ""}
        >
          {isCallEnded ? "Call Ended" : isEndingCall ? "Ending..." : "End Call"}
        </button>
      </div>
    </div>
  );
}
