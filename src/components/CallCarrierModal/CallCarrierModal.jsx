// CallCarrierModal.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import ActiveCall from "../ActiveCall/ActiveCall";
import "./CallCarrierModal.css";

const ENTITY_TYPE_OPTIONS = [
  "BROKER",
  "BROKER/IEP",
  "CARRIER",
  "CARRIER/BROKER",
  "CARRIER/BROKER/IEP",
  "CARRIER/CARGO TANK",
  "CARRIER/FREIGHT FORWARDER",
  "CARRIER/FREIGHT FORWARDER/BROKER",
  "CARRIER/IEP",
  "CARRIER/SHIPPER",
  "CARRIER/SHIPPER/BROKER",
  "FREIGHT FORWARDER",
  "FREIGHT FORWARDER/BROKER",
  "IEP",
  "SHIPPER",
  "SHIPPER/BROKER"
];

const DRIVERS_OPTIONS = [
  "Blank",
  "Private(Property)",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "30",
  "31",
  "32",
  "33",
  "34",
  "35",
  "36",
  "37",
  "38",
  "39",
  "40",
  "41",
  "42",
  "43",
  "44",
  "45",
  "46",
  "47",
  "48",
  "49",
  "50",
  "51",
  "52",
  "53",
  "54",
  "55",
  "56",
  "58",
  "59",
  "60",
  "61",
  "62",
  "64",
  "65",
  "66",
  "67",
  "68",
  "70",
  "72",
  "73",
  "74",
  "75",
  "77",
  "78",
  "80",
  "81",
  "83",
  "84",
  "85",
  "88",
  "89",
  "90",
  "92",
  "95",
  "96",
  "97",
  "98",
  "99",
  "100",
  "103",
  "105",
  "112",
  "113",
  "118",
  "119",
  "120",
  "122",
  "128",
  "132",
  "135",
  "140",
  "141",
  "144",
  "145",
  "147",
  "154",
  "155",
  "159",
  "165",
  "171",
  "177",
  "200",
  "203",
  "220",
  "221",
  "230",
  "233",
  "234",
  "235",
  "260",
  "261",
  "302",
  "319",
  "342",
  "422",
  "474",
  "666",
  "2373"
];

const OP_STATES_OPTIONS = [
  "THORIZED FOR BROKER HHG",
  "AUTHORIZED FOR BROKER Property",
  "AUTHORIZED FOR BROKER Property, HHG",
  "AUTHORIZED FOR HHG",
  "AUTHORIZED FOR Passenger",
  "AUTHORIZED FOR Passenger, Property",
  "AUTHORIZED FOR Property",
  "AUTHORIZED FOR Property, HHG",
  "NOT AUTHORIZED",
  "OUT-OF-SERVICE"
];

const initialForm = {
  dispatcherName: "",
  entityType: "",
  usdotNumber: "",
  dateFound: "",
  opStates: "",
  companyName: "",
  mcNumber: "",
  address: "",
  carrierPhoneNumber: "",
  powerUnits: "",
  drivers: "",
  cargoCarried: "",
  categoryType: ""
};

// --- helpers for safe positioning ---
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function getNextSpawnPosition(existingCallsCount) {
  // These should roughly match your .activecall-panel size in CSS
  const PANEL_W = 340; // adjust if your panel is wider
  const PANEL_H = 350; // adjust if your panel is taller
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

  let left = MARGIN + col * (PANEL_W + GAP);
  let top = MARGIN + row * (PANEL_H + GAP);

  // If we’ve exceeded visible slots, nudge within the same slot (still clamped)
  const overflowCycles = Math.floor(existingCallsCount / slots);
  const nudge = overflowCycles * 18;
  left += nudge;
  top += nudge;

  return {
    left: clamp(left, MARGIN, maxLeft),
    top: clamp(top, MARGIN, maxTop)
  };
}

function formatCallSummary(data) {
  const lines = [
    `Truck Voice App – Call Summary`,
    ``,
    `Dispatcher Name: ${data.dispatcherName || "-"}`,
    `Entity Type: ${data.entityType || "-"}`,
    `USDOT Number: ${data.usdotNumber || "-"}`,
    `Date Found: ${data.dateFound || "-"}`,
    `Operating Authority Status (OP STATES): ${data.opStates || "-"}`,
    `Company Name: ${data.companyName || "-"}`,
    `MC Number: ${data.mcNumber || "-"}`,
    `Address: ${data.address || "-"}`,
    `Carrier Phone Number: ${data.carrierPhoneNumber || "-"}`,
    `Power Units: ${data.powerUnits || "-"}`,
    `Drivers: ${data.drivers || "-"}`,
    `Cargo Carried: ${data.cargoCarried || "-"}`,
    `Category Type: ${data.categoryType || "-"}`
  ];

  return lines.join("\n");
}

/**
 * SearchableSelect (Bootstrap-friendly)
 * - Has a search bar at the top of the dropdown
 * - Dropdown is scrollable and capped in height
 * - If no options match, user can still keep their typed value (saved)
 */
function SearchableSelect({
  label,
  name,
  value,
  onValueChange,
  options = [],
  placeholder = "Select or type…",
  required = false
}) {
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value ?? "");

  useEffect(() => {
    setQuery(value ?? "");
  }, [value]);

  useEffect(() => {
    if (!open) return;

    const onDocMouseDown = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) {
        // closing should preserve typed value
        onValueChange(name, query);
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open, name, query, onValueChange]);

  const normalizedOptions = (options || []).map((o) => String(o));
  const q = String(query || "");
  const qLower = q.trim().toLowerCase();

  const filtered = qLower
    ? normalizedOptions.filter((opt) => opt.toLowerCase().includes(qLower))
    : normalizedOptions;

  const hasExact = q.trim()
    ? normalizedOptions.some((opt) => opt.toLowerCase() === qLower)
    : false;

  const commitValue = (v) => {
    onValueChange(name, v);
    setQuery(v);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onValueChange(name, query);
      setOpen(false);
      return;
    }

    if (e.key === "Enter") {
      // Enter should commit typed value even if not in list
      e.preventDefault();
      onValueChange(name, query);
      setOpen(false);
    }
  };

  return (
    <div className="tv-select" ref={wrapRef}>
      <label className="form-label">
        {label} {required ? <span className="text-danger">*</span> : null}
      </label>

      <button
        type="button"
        className={`form-control tv-select-trigger ${open ? "is-open" : ""}`}
        onClick={() => setOpen((s) => !s)}
        aria-expanded={open}
      >
        <span className={`tv-select-trigger-text ${value ? "" : "is-placeholder"}`}>
          {value ? value : placeholder}
        </span>
        <i className={`bi bi-chevron-${open ? "up" : "down"} tv-select-chevron`} />
      </button>

      {open ? (
        <div className="tv-select-menu shadow">
          <div className="tv-select-search">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              className="tv-select-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search or type a custom value…"
              autoFocus
            />
          </div>

          <div className="tv-select-options" role="listbox">
            {/* If user typed something and it isn't in options, offer a quick "use value" row */}
            {q.trim() && !hasExact ? (
              <button
                type="button"
                className="tv-select-option tv-select-option-custom"
                onClick={() => commitValue(q)}
              >
                Use “{q}”
              </button>
            ) : null}

            {filtered.length ? (
              filtered.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`tv-select-option ${opt === value ? "is-selected" : ""}`}
                  onClick={() => commitValue(opt)}
                >
                  <span>{opt}</span>
                  {opt === value ? <i className="bi bi-check2" aria-hidden="true" /> : null}
                </button>
              ))
            ) : (
              <div className="tv-select-empty">
                No matches. Press <kbd>Enter</kbd> to save “{q}”.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function CallCarrierModal({ isOpen = true, onClose, onCall }) {
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

    if (name === "carrierPhoneNumber") {
      sanitizedValue = value.replace(/[^0-9+\-\s()]/g, "");
    }

    setForm((prev) => ({ ...prev, [name]: sanitizedValue }));
  };

  const setFieldValue = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

 const handleCall = async () => {
  if (!form.dispatcherName.trim()) {
    alert("Dispatcher name is required.");
    return;
  }

  if (!form.carrierPhoneNumber.trim()) {
    alert("Carrier phone number is required.");
    return;
  }

  // Create the UI card immediately (Dialing...) so it feels responsive
  const localId = Date.now();

  setActiveCalls((prev) => {
    const spawnPos = getNextSpawnPosition(prev.length);

    const title =
      form.companyName?.trim() ||
      (form.mcNumber ? `MC ${form.mcNumber}` : "") ||
      (form.usdotNumber ? `USDOT ${form.usdotNumber}` : "") ||
      "Active Call";

    // Build a minimal, always-useful meta line
    const metaParts = [];

    if (form.mcNumber?.trim()) metaParts.push(`MC ${form.mcNumber.trim()}`);
    if (form.usdotNumber?.trim()) metaParts.push(`USDOT ${form.usdotNumber.trim()}`);
    if (form.powerUnits?.trim()) metaParts.push(`PU: ${form.powerUnits.trim()}`);
    if (form.drivers?.trim() && form.drivers !== "Blank")
      metaParts.push(`Drivers: ${form.drivers.trim()}`);
    if (form.cargoCarried?.trim()) metaParts.push(form.cargoCarried.trim());

    const meta = metaParts.length ? metaParts.join(" • ") : "Carrier onboarding call";

    // Optional route-like line (only shows if you actually have these)
    const subLeft = form.address?.trim() || "";
    const subRight = form.categoryType?.trim() || "";

    const newCall = {
      id: localId,
      carrierName: title,
      phone: form.carrierPhoneNumber || "(???) ???-????",
      meta,
      origin: subLeft,
      destination: subRight,
      position: spawnPos,
      status: "Dialing..."
    };

    return [...prev, newCall];
  });

  // Format phone to E.164
  let formattedPhone = form.carrierPhoneNumber.trim();
  if (!formattedPhone.startsWith("+")) {
    formattedPhone = "+1" + formattedPhone.replace(/\D/g, "");
  }

  const payloadForm = { ...form };

  try {
    const res = await fetch("/api/start-vapi-call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carrierPhone: formattedPhone, formData: payloadForm })
    });

    const data = await res.json();

    if (data.success) {
      setActiveCalls((prev) =>
        prev.map((c) => {
          if (c.id !== localId) return c;
          return {
            ...c,
            vapiCallId: data.callId,
            monitorUrl: data.monitorUrl || null,
            status: "Ringing..."
          };
        })
      );

      console.log("Call started:", data.callId);
    } else {
      alert("Call failed: " + data.error);
      setActiveCalls((prev) => prev.filter((c) => c.id !== localId));
    }
  } catch (err) {
    console.error(err);
    alert("Network error starting call");
    setActiveCalls((prev) => prev.filter((c) => c.id !== localId));
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
                    Call Carrier Details
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
                Enter carrier details for a clean, consistent call.
              </div>

              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label">
                    Dispatcher Name <span className="text-danger">*</span>
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

                <div className="col-12 col-md-6">
                  <SearchableSelect
                    label="Entity Type"
                    name="entityType"
                    value={form.entityType}
                    onValueChange={setFieldValue}
                    options={ENTITY_TYPE_OPTIONS}
                    placeholder="Select or type entity type…"
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label">USDOT Number</label>
                  <input
                    name="usdotNumber"
                    value={form.usdotNumber}
                    onChange={handleChange}
                    className="form-control"
                    placeholder="e.g., 1234567"
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label">Date Found</label>
                  <input
                    name="dateFound"
                    value={form.dateFound}
                    onChange={handleChange}
                    className="form-control"
                    placeholder="e.g., 2026-01-07"
                  />
                </div>

                <div className="col-12">
                  <SearchableSelect
                    label="Operating Authority Status (OP STATES)"
                    name="opStates"
                    value={form.opStates}
                    onValueChange={setFieldValue}
                    options={OP_STATES_OPTIONS}
                    placeholder="Select or type OP status…"
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label">Company Name</label>
                  <input
                    name="companyName"
                    value={form.companyName}
                    onChange={handleChange}
                    className="form-control"
                    placeholder="e.g., ABC Logistics LLC"
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label">MC Number</label>
                  <input
                    name="mcNumber"
                    value={form.mcNumber}
                    onChange={handleChange}
                    className="form-control"
                    placeholder="e.g., 123456"
                  />
                </div>

                <div className="col-12">
                  <label className="form-label">Address</label>
                  <input
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    className="form-control"
                    placeholder="Street, City, State, Zip"
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label">
                    Carrier Phone Number <span className="text-danger">*</span>
                  </label>
                  <div className="input-group">
                    <span className="input-group-text">
                      <i className="bi bi-telephone-fill" />
                    </span>
                    <input
                      name="carrierPhoneNumber"
                      value={form.carrierPhoneNumber}
                      onChange={handleChange}
                      className="form-control"
                      placeholder="e.g., (555) 123-4567"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                    />
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label">Power Units</label>
                  <input
                    name="powerUnits"
                    value={form.powerUnits}
                    onChange={handleChange}
                    className="form-control"
                    placeholder="e.g., 12"
                  />
                </div>

                <div className="col-12 col-md-6">
                  <SearchableSelect
                    label="Drivers"
                    name="drivers"
                    value={form.drivers}
                    onValueChange={setFieldValue}
                    options={DRIVERS_OPTIONS}
                    placeholder="Select or type drivers…"
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label">Cargo Carried</label>
                  <input
                    name="cargoCarried"
                    value={form.cargoCarried}
                    onChange={handleChange}
                    className="form-control"
                    placeholder="e.g., General Freight"
                  />
                </div>

                <div className="col-12">
                  <label className="form-label">Category Type</label>
                  <input
                    name="categoryType"
                    value={form.categoryType}
                    onChange={handleChange}
                    className="form-control"
                    placeholder="e.g., Carrier / Broker / Shipper…"
                  />
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
      {activeCalls.map((call) => (
        <ActiveCall
          key={call.id}
          callId={call.id}
          vapiCallId={call.vapiCallId}
          monitorUrl={call.monitorUrl}
          onClose={() => closeCall(call.id)}
          carrierName={call.carrierName}
          phone={call.phone}
          meta={call.meta}
          origin={call.origin}
          destination={call.destination}
          initialPosition={call.position}
        />
      ))}
    </>
  );
}
