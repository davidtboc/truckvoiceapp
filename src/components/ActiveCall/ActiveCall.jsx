// src/components/ActiveCall/ActiveCall.jsx
import { useState, useEffect, useRef } from "react";
import "./ActiveCall.css";

export default function ActiveCall({
  callId,
  onClose,
  brokerName = "GlobalTranz/Afn",
  origin = "Chattanooga, TN",
  destination = "Coeur D'alene, ID",
  rate = "$2.459",
  initialPosition = { top: 100, left: 20 }
}) {
  const [seconds, setSeconds] = useState(0);
  const [isConnecting, setIsConnecting] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const panelRef = useRef(null);

  // Timer + Connecting simulation
  useEffect(() => {
    const connectTimer = setTimeout(() => setIsConnecting(false), 3000);
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      clearTimeout(connectTimer);
      clearInterval(interval);
    };
  }, []);

  const formatTime = (s) => {
    const m = String(Math.floor(s / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return `${m}:${sec}`;
  };

  // Dragging logic
  const handleMouseDown = (e) => {
    // Don't drag if clicking a button
    if (e.target.tagName === "BUTTON") return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - (position.left || 0),
      y: e.clientY - (position.top || 0)
    });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      setPosition({
        left: e.clientX - dragStart.x,
        top: e.clientY - dragStart.y,
        right: "auto"
      });
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
  }, [isDragging, dragStart]);

  return (
    <div
      ref={panelRef}
      className="activecall-panel"
      style={{
        top: position.top,
        left: position.left,
        right: position.right !== undefined ? position.right : "auto",
        cursor: isDragging ? "grabbing" : "move"
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="activecall-content">
        {/* Header */}
        <div className="activecall-header">
          <div className="activecall-title">{brokerName}</div>
          <button onClick={onClose} className="activecall-close-btn" aria-label="End call">
            ×
          </button>
        </div>

        {/* Route */}
        <div className="activecall-route">
          {origin} → {destination}
        </div>

        {/* Rate */}
        <div className="activecall-rate">{rate}</div>

        {/* Timer */}
        <div className="activecall-timer">{formatTime(seconds)}</div>

        {/* Calling / On Call Status Bar */}
        <div className={`activecall-status-bar ${isConnecting ? "connecting" : ""}`}>
          {isConnecting ? "Calling..." : "On Call"}
        </div>

        {/* Show Transcript Toggle */}
        <div className="activecall-transcript-toggle">
          <button
            type="button"
            className="btn btn-link text-muted p-0 d-flex align-items-center gap-1"
            onClick={() => setShowTranscript(!showTranscript)}
          >
            <i className="bi bi-chat-text"></i>
            Show Transcript
            <i className={`bi ${showTranscript ? "bi-chevron-up" : "bi-chevron-down"}`}></i>
          </button>
        </div>

        {/* Transcript Area (collapsible) */}
        {showTranscript && (
          <div className="activecall-transcript-area">
            <small className="text-muted">
              Transcript will appear here in real-time once connected...
            </small>
          </div>
        )}

        {/* Action Buttons */}
        <div className="activecall-buttons">
          <button className="btn btn-primary join-call-btn">
            Join Call
          </button>
          <button className="btn btn-danger end-call-btn" onClick={onClose}>
            End Call
          </button>
        </div>
      </div>
    </div>
  );
}