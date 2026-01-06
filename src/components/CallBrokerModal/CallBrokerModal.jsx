import { useEffect, useMemo, useState } from "react";
import ActiveCall from "../ActiveCall/ActiveCall";
import "./CallBrokerModal.css";

const initialForm = {
  dispatcherName: "",
  origin: "",
  destination: "",
  totalMileage: "",
  deadheadMileage: "",
  pricePerMile: "",
  tolls: "",
  pickupTime: "",
  dropoffTime: "",
  weatherForecast: "",
  mcNumber: "",
  commodity: "",
  strapsOrCover: "unknown",
  brokerPhone: ""
};

const STATE_MAP = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas",
  KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts",
  MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island",
  SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia",
  WI: "Wisconsin", WY: "Wyoming", DC: "Washington, DC"
};

function expandStateAbbrev(cityState) {
  const s = String(cityState || "").trim();
  if (!s) return s;

  // Matches "... , GA" or "... GA" at end (tolerates extra spaces + lowercase)
  const m = s.match(/^(.*?)(?:,\s*|\s+)([A-Za-z]{2})\s*$/);
  if (!m) return s;

  const city = String(m[1] || "").trim();
  const abbr = String(m[2] || "").trim().toUpperCase();
  const full = STATE_MAP[abbr];
  if (!full) return s;

  if (!city) return full; // edge case: user typed only "ga"
  return `${city}, ${full}`;
}

function formatCallSummary(data) {
  const lines = [
    `Truck Voice App – Call Summary`,
    ``,
    `Dispatcher: ${data.dispatcherName || "-"}`,
    `Origin: ${data.origin || "-"}`,
    `Destination: ${data.destination || "-"}`,
    `Total mileage A→B: ${data.totalMileage || "-"}`,
    `Deadhead mileage: ${data.deadheadMileage || "-"}`,
    `Price / mile: ${data.pricePerMile || "-"}`,
    `Tolls: ${data.tolls || "-"}`,
    `Pickup time: ${data.pickupTime || "-"}`,
    `Drop off time: ${data.dropoffTime || "-"}`,
    `Weather forecast: ${data.weatherForecast || "-"}`,
    `MC #: ${data.mcNumber || "-"}`,
    `Commodity: ${data.commodity || "-"}`,
    `Broker phone: ${data.brokerPhone || "-"}`,
    `Straps/Cover: ${data.strapsOrCover || "-"}`
  ];

  return lines.join("\n");
}

// --- NEW: helpers for safe positioning ---
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function getNextSpawnPosition(existingCallsCount) {
  // These should roughly match your .activecall-panel size in CSS
  const PANEL_W = 340;   // adjust if your panel is wider
  const PANEL_H = 350;   // adjust if your panel is taller
  const MARGIN = 12;
  const GAP = 12;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const maxLeft = Math.max(MARGIN, vw - PANEL_W - MARGIN);
  const maxTop = Math.max(MARGIN, vh - PANEL_H - MARGIN);

  const cols = Math.max(1, Math.floor((vw - MARGIN * 2 + GAP) / (PANEL_W + GAP)));
  const rows = Math.max(1, Math.floor((vh - MARGIN * 2 + GAP) / (PANEL_H + GAP)));
  const slots = cols * rows;

  const slotIndex = existingCallsCount % slots;

  const col = slotIndex % cols;
  const row = Math.floor(slotIndex / cols);

  // Base grid position
  let left = MARGIN + col * (PANEL_W + GAP);
  let top = MARGIN + row * (PANEL_H + GAP);

  // If we’ve exceeded visible slots, nudge within the same slot (still clamped)
  const overflowCycles = Math.floor(existingCallsCount / slots);
  const nudge = overflowCycles * 18; // small cascade offset
  left += nudge;
  top += nudge;

  return {
    left: clamp(left, MARGIN, maxLeft),
    top: clamp(top, MARGIN, maxTop)
  };
}

export default function CallBrokerModal({ isOpen = true, onClose, onCall }) {
  const [form, setForm] = useState(initialForm);
  const [activeCalls, setActiveCalls] = useState([]);

  const isClosable = typeof onClose === "function";

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isClosable) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isClosable, onClose]);

  const callSummary = useMemo(() => formatCallSummary(form), [form]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let sanitizedValue = value;

    if (
      name === "totalMileage" ||
      name === "deadheadMileage" ||
      name === "priceStartFrom" ||
      name === "priceDontGoBelow" ||
      name === "pricePerMile"
    ) {
      sanitizedValue = value.replace(/[^0-9.]/g, "");
      const parts = sanitizedValue.split(".");
      if (parts.length > 2) {
        sanitizedValue = parts[0] + "." + parts.slice(1).join("");
      }
      if (parts[1] && parts[1].length > 2) {
        sanitizedValue = parts[0] + "." + parts[1].slice(0, 2);
      }
    } else if (name === "brokerPhone") {
      sanitizedValue = value.replace(/[^0-9+\-\s()]/g, "");
    }

    setForm((prev) => ({ ...prev, [name]: sanitizedValue }));
  };

const handleCall = async () => {
  if (!form.dispatcherName.trim()) {
    alert("Dispatcher name is required.");
    return;
  }

  if (!form.brokerPhone.trim()) {
    alert("Broker phone number is required.");
    return;
  }

  setActiveCalls((prev) => {
    const spawnPos = getNextSpawnPosition(prev.length);
    const newCall = {
      id: Date.now(),
      brokerName: form.mcNumber ? `Broker ${form.mcNumber}` : "Active Call",
      origin: form.origin || "Unknown Origin",
      destination: form.destination || "Unknown Destination",
      rate: form.pricePerMile ? `$${form.pricePerMile}/mi` : "$?.??",
      phone: form.brokerPhone || "(???) ???-????",
      position: spawnPos,
      status: "Dialing..."
    };
    return [...prev, newCall];
  });

  // Format phone to E.164
  let formattedPhone = form.brokerPhone.trim();
  if (!formattedPhone.startsWith("+")) {
    formattedPhone = "+1" + formattedPhone.replace(/\D/g, "");
  }

  // ✅ NEW: include spoken-friendly origin/destination
  const payloadForm = {
    ...form,
    origin: String(form.origin || "").trim(),
    destination: String(form.destination || "").trim(),
    originSpoken: expandStateAbbrev(form.origin),
    destinationSpoken: expandStateAbbrev(form.destination)
  };

  try {
    const res = await fetch("/api/start-vapi-call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brokerPhone: formattedPhone, formData: payloadForm })
    });

    const data = await res.json();

    if (data.success) {
      setActiveCalls((prev) => {
        const updated = [...prev];
        updated[updated.length - 1].vapiCallId = data.callId;
        updated[updated.length - 1].monitorUrl = data.monitorUrl || null;
        updated[updated.length - 1].status = "Ringing...";
        return updated;
      });

      console.log("Call started:", data.callId);
    } else {
      alert("Call failed: " + data.error);
    }
  } catch (err) {
    console.error(err);
    alert("Network error starting call");
  }
};


  const closeCall = (id) => {
    setActiveCalls((prev) => prev.filter((call) => call.id !== id));
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="tv-backdrop" />


      <div
        className="modal show d-block"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tvModalTitle"
      >
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable tv-modal-dialog">
          <div className="modal-content border-0 shadow-lg tv-modal-content">
            {/* Header */}
            <div className="modal-header border-0 pb-0">
              <div className="d-flex align-items-center gap-2">
                <div className="tv-app-badge">
                  <i className="bi bi-truck-front-fill" aria-hidden="true" />
                </div>
                <div>
                  <div className="small text-secondary">Truck Voice App</div>
                  <h5 className="modal-title mb-0" id="tvModalTitle">
                    Call Broker Details
                  </h5>
                </div>
              </div>
              {isClosable ? (
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={onClose}
                />
              ) : null}
            </div>

            {/* Body */}
            <div className="modal-body pt-3">
              <div className="alert alert-light border tv-hint">
                Fill out the route + pricing details so your call is confident and consistent.
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label">
                  Dispatcher name <span className="text-danger">*</span>
                </label>
                <input
                  name="dispatcherName"
                  value={form.dispatcherName}
                  onChange={handleChange}
                  className="form-control"
                  placeholder="e.g., Rob"
                  required
                />
              </div>
            <div className="row g-3">
                <div className="col-12 col-md-6">
                <label className="form-label">Origin</label>
                <input
                    name="origin"
                    value={form.origin}
                    onChange={handleChange}
                    className="form-control"
                    placeholder="e.g., Chattanooga, TN"
                />
                </div>
                <div className="col-12 col-md-6">
                <label className="form-label">Destination</label>
                <input
                    name="destination"
                    value={form.destination}
                    onChange={handleChange}
                    className="form-control"
                    placeholder="e.g., Coeur D'alene, ID"
                />
                </div>                
            </div>
              <div className="row g-3">
                {/* Total mileage */}
                <div className="col-12 col-md-6">
                  <label className="form-label">Total mileage (A → B)</label>
                  <div className="input-group">
                    <span className="input-group-text">
                      <i className="bi bi-signpost-split" />
                    </span>
                    <input
                      name="totalMileage"
                      value={form.totalMileage}
                      onChange={handleChange}
                      className="form-control"
                      placeholder="e.g., 842.5"
                      inputMode="decimal"
                    />
                    <span className="input-group-text">mi</span>
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label">Deadhead mileage (to pickup)</label>
                  <div className="input-group">
                    <span className="input-group-text">
                      <i className="bi bi-geo-alt" />
                    </span>
                    <input
                      name="deadheadMileage"
                      value={form.deadheadMileage}
                      onChange={handleChange}
                      className="form-control"
                      placeholder="e.g., 48.3"
                      inputMode="decimal"
                    />
                    <span className="input-group-text">mi</span>
                  </div>
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label">Price / mile</label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input
                      name="pricePerMile"
                      value={form.pricePerMile}
                      onChange={handleChange}
                      className="form-control"
                      placeholder="e.g., 2.25"
                      inputMode="decimal"
                    />
                    <span className="input-group-text">/ mi</span>
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label">Tolls in the route</label>
                  <input
                    name="tolls"
                    value={form.tolls}
                    onChange={handleChange}
                    className="form-control"
                    placeholder="e.g., Yes – $38 estimated"
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label">Pick up time</label>
                  <input
                    name="pickupTime"
                    value={form.pickupTime}
                    onChange={handleChange}
                    className="form-control"
                    placeholder="e.g., Mon 8:00 AM – 11:00 AM"
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label">Drop off time</label>
                  <input
                    name="dropoffTime"
                    value={form.dropoffTime}
                    onChange={handleChange}
                    className="form-control"
                    placeholder="e.g., Tue by 5:00 PM"
                  />
                </div>

                <div className="col-12">
                  <label className="form-label">Weather forecast (route)</label>
                  <textarea
                    name="weatherForecast"
                    value={form.weatherForecast}
                    onChange={handleChange}
                    className="form-control"
                    rows={2}
                    placeholder="e.g., Light rain near OKC; windy in TX panhandle; clear on arrival"
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label">MC #</label>
                  <div className="input-group">
                    <span className="input-group-text">
                      <i className="bi bi-hash" />
                    </span>
                    <input
                      name="mcNumber"
                      value={form.mcNumber}
                      onChange={handleChange}
                      className="form-control"
                      placeholder="e.g., MC-123456 or MX12345"
                    />
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label">Commodity being transported</label>
                  <input
                    name="commodity"
                    value={form.commodity}
                    onChange={handleChange}
                    className="form-control"
                    placeholder="e.g., Dry goods / Produce / Steel"
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label">
                    Broker phone number <span className="text-danger">*</span>
                  </label>
                  <div className="input-group">
                    <span className="input-group-text">
                      <i className="bi bi-telephone-fill" />
                    </span>
                    <input
                      name="brokerPhone"
                      value={form.brokerPhone}
                      onChange={handleChange}
                      className="form-control"
                      placeholder="e.g., (555) 123-4567"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                    />
                  </div>
                </div>

                <div className="col-12">
                  <label className="form-label">Needs straps or cover?</label>
                  <div className="d-flex flex-wrap gap-2">
                    <input
                      type="radio"
                      className="btn-check"
                      name="strapsOrCover"
                      id="socYes"
                      value="yes"
                      checked={form.strapsOrCover === "yes"}
                      onChange={handleChange}
                    />
                    <label className="btn btn-outline-primary" htmlFor="socYes">
                      Yes
                    </label>

                    <input
                      type="radio"
                      className="btn-check"
                      name="strapsOrCover"
                      id="socNo"
                      value="no"
                      checked={form.strapsOrCover === "no"}
                      onChange={handleChange}
                    />
                    <label className="btn btn-outline-primary" htmlFor="socNo">
                      No
                    </label>

                    <input
                      type="radio"
                      className="btn-check"
                      name="strapsOrCover"
                      id="socUnknown"
                      value="unknown"
                      checked={form.strapsOrCover === "unknown"}
                      onChange={handleChange}
                    />
                    <label className="btn btn-outline-secondary" htmlFor="socUnknown">
                      Not sure
                    </label>
                  </div>
                </div>

                <div className="col-12">
                  <div className="card border-0 tv-preview">
                    <div className="card-body">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <div className="fw-semibold">Preview (what you’ll say)</div>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => navigator.clipboard?.writeText(callSummary)}
                        >
                          <i className="bi bi-clipboard me-1" />
                          Copy
                        </button>
                      </div>
                      <pre className="tv-pre mb-0">{callSummary}</pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="modal-footer border-0 pt-0">
              {isClosable ? (
                <button className="btn btn-outline-secondary" onClick={onClose}>
                  Cancel
                </button>
              ) : null}
              <button className="btn btn-primary px-4" onClick={handleCall}>
                <i className="bi bi-telephone-fill me-2" />
                Call
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Render all active call windows */}
      {activeCalls.map((call) => (
        <ActiveCall
        key={call.id}
        callId={call.id}
        vapiCallId={call.vapiCallId}
        monitorUrl={call.monitorUrl}
        onClose={() => closeCall(call.id)}
        brokerName={call.brokerName}
        origin={call.origin}
        destination={call.destination}
        rate={call.rate}
        phone={call.phone}
        initialPosition={call.position}
        />
      ))}
    </>
  );
}