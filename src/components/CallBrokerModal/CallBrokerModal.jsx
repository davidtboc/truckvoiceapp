import { useEffect, useMemo, useState } from "react";
import ActiveCall from "../ActiveCall/ActiveCall";
import "./CallBrokerModal.css";

const initialForm = {
  totalMileage: "",
  priceStartFrom: "",
  priceDontGoBelow: "",
  tolls: "",
  pickupTime: "",
  dropoffTime: "",
  pricePerMile: "",
  weatherForecast: "",
  mcNumber: "",
  commodity: "",
  strapsOrCover: "unknown",
  deadheadMileage: "",
  brokerPhone: ""
};

function formatCallSummary(data) {
  const lines = [
    `Truck Voice App – Call Summary`,
    ``,
    `Total mileage A→B: ${data.totalMileage || "-"}`,
    `Deadhead mileage: ${data.deadheadMileage || "-"}`,
    `Price start from: ${data.priceStartFrom || "-"}`,
    `Price don't go below: ${data.priceDontGoBelow || "-"}`,
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

export default function CallBrokerModal({
  isOpen = true,
  onClose,
  onCall
}) {
  const [form, setForm] = useState(initialForm);
  const [activeCalls, setActiveCalls] = useState([]); // Holds all active call windows

  const isClosable = typeof onClose === "function";

  // Lock body scroll while modal open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Close on ESC
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
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Create a new active call window
  const handleCall = () => {
    const newCall = {
      id: Date.now(), // Unique ID for each call
      brokerName: form.mcNumber ? `Broker ${form.mcNumber}` : "Active Call",
      origin: "Chattanooga, TN",
      destination: "Coeur D'alene, ID",
      rate: form.pricePerMile ? `$${form.pricePerMile}/mi` : "$2.459",
      phone: form.brokerPhone || "(555) 123-4567"
    };

    setActiveCalls((prev) => [...prev, newCall]);
  };

  // Remove a specific call by ID
  const closeCall = (id) => {
    setActiveCalls((prev) => prev.filter((call) => call.id !== id));
  };

  // Calculate starting position: left side first, then right
  const getInitialPosition = (index) => {
    const panelHeight = 460; // Approx height + gap
    const gap = 20;
    const maxPerSide = Math.floor((window.innerHeight - 120) / panelHeight);

    if (index < maxPerSide) {
      return { top: 100 + index * panelHeight, left: 20 };
    } else {
      const rightIndex = index - maxPerSide;
      return { top: 100 + rightIndex * panelHeight, right: 20 };
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop for main modal */}
      <div className="tv-backdrop" />

      {/* Main Call Broker Modal */}
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
                      placeholder="e.g., 842"
                      inputMode="numeric"
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
                      placeholder="e.g., 48"
                      inputMode="numeric"
                    />
                    <span className="input-group-text">mi</span>
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label">Price start from</label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input
                      name="priceStartFrom"
                      value={form.priceStartFrom}
                      onChange={handleChange}
                      className="form-control"
                      placeholder="e.g., 1800"
                      inputMode="decimal"
                    />
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label">Price don’t go below</label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input
                      name="priceDontGoBelow"
                      value={form.priceDontGoBelow}
                      onChange={handleChange}
                      className="form-control"
                      placeholder="e.g., 1600"
                      inputMode="decimal"
                    />
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

                {/* Weather */}
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

                {/* MC # */}
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
                      placeholder="e.g., 123456"
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
                  <label className="form-label">Broker phone number</label>
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

      {/* Render ALL active floating call windows */}
      {activeCalls.map((call, index) => (
        <ActiveCall
          key={call.id}
          callId={call.id}
          onClose={() => closeCall(call.id)}
          brokerName={call.brokerName}
          origin={call.origin}
          destination={call.destination}
          rate={call.rate}
          phone={call.phone}
          initialPosition={getInitialPosition(index)}
        />
      ))}
    </>
  );
}