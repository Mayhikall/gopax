"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  BrainCircuit,
  CalendarDays,
  Camera,
  Check,
  ImagePlus,
  LockKeyhole,
  LoaderCircle,
  MapPin,
  ScanLine,
  Ticket,
  Upload,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ErrorState, pathFor } from "@/components/common";
import { useSession } from "@/features/auth/session-provider";
import { errorMessage } from "@/lib/api";

export function UploadProof({ demo = false }: { demo?: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const cameraStream = useRef<MediaStream | null>(null);
  const cameraRequest = useRef(0);
  const inFlight = useRef(false);
  const { api, user } = useSession();
  const cache = useQueryClient();
  const router = useRouter();
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(
    () => () => {
      cameraRequest.current++;
      cameraStream.current?.getTracks().forEach((track) => track.stop());
      cameraStream.current = null;
    },
    [],
  );

  function selectFile(next?: File) {
    if (busy || !next) return;
    setError("");
    if (!next.size)
      return setError("This file is empty. Choose a JPG or PNG image.");
    const isJpegOrPng =
      ["image/jpeg", "image/png"].includes(next.type) ||
      (/\.(jpe?g|png)$/i.test(next.name) && (!next.type || next.type.startsWith("image/")));
    if (!isJpegOrPng)
      return setError(
        "Choose a JPG or PNG image. PDF files are not supported.",
      );
    if (next.size > 10 * 1024 * 1024)
      return setError("This image is too large. Choose a file up to 10 MiB.");
    setFile(next);
  }

  const closeCamera = useCallback(() => {
    cameraRequest.current++;
    cameraStream.current?.getTracks().forEach((track) => track.stop());
    cameraStream.current = null;
    if (video.current) video.current.srcObject = null;
    setCameraOpen(false);
    setCameraReady(false);
    setCameraStarting(false);
  }, []);

  useEffect(() => {
    if (!cameraOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCamera();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [cameraOpen, closeCamera]);

  function handleTakePhoto() {
    if (busy) return;
    const isMobile =
      typeof navigator !== "undefined" &&
      (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 0 &&
          window.matchMedia("(pointer: coarse)").matches));
    if (isMobile) {
      camera.current?.click();
    } else {
      void openCamera();
    }
  }

  async function openCamera() {
    if (busy || cameraStarting) return;
    setError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      camera.current?.click();
      return;
    }

    const requestId = ++cameraRequest.current;
    setCameraStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      if (requestId !== cameraRequest.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      cameraStream.current = stream;
      setCameraOpen(true);
    } catch (cause) {
      const cameraError = cause as DOMException;
      setError(
        cameraError.name === "NotAllowedError"
          ? "Camera access was blocked. Allow camera permission or choose an image instead."
          : "We couldn't open the camera. Check that it is available, then try again.",
      );
    } finally {
      if (requestId === cameraRequest.current) setCameraStarting(false);
    }
  }

  function capturePhoto() {
    const currentVideo = video.current;
    if (
      !currentVideo ||
      !cameraReady ||
      !currentVideo.videoWidth ||
      !currentVideo.videoHeight
    )
      return;

    const maxDimension = 2400;
    const scale = Math.min(
      1,
      maxDimension /
        Math.max(currentVideo.videoWidth, currentVideo.videoHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(currentVideo.videoWidth * scale);
    canvas.height = Math.round(currentVideo.videoHeight * scale);
    canvas
      .getContext("2d")
      ?.drawImage(currentVideo, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("We couldn't capture this photo. Please try again.");
          return;
        }
        selectFile(
          new File([blob], `trip-proof-${Date.now()}.jpg`, {
            type: "image/jpeg",
          }),
        );
        closeCamera();
      },
      "image/jpeg",
      0.9,
    );
  }

  async function submit() {
    if (!file || inFlight.current) return;
    if (demo) {
      router.push(pathFor("/trips/demo-train", true));
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    const proof = new FormData();
    proof.append("proof", file);
    try {
      const result = await api<{
        trip: { id: string };
        processingError?: { code: string; message: string };
      }>("/trips", {
        method: "POST",
        body: proof,
        signal: AbortSignal.timeout(180_000),
      });
      if (result.processingError)
        cache.setQueryData(
          ["processing-error", user?.id, result.trip.id],
          result.processingError,
        );
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["trips", user?.id] }),
        cache.invalidateQueries({ queryKey: ["impact", user?.id] }),
      ]);
      router.push(`/trips/${encodeURIComponent(result.trip.id)}`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Add a trip"
        description="Save your travel proof to see the route, impact, and reward assessment."
        back={pathFor("/trips", demo)}
      />
      <div className="upload-layout">
        <section className="surface upload-panel" aria-busy={busy}>
          <h2>Upload a ticket or receipt</h2>
          <p className="subtle">
            We’ll read the route and estimate your trip’s carbon impact.
          </p>
          <input
            ref={picker}
            className="sr-only"
            tabIndex={-1}
            type="file"
            accept="image/jpeg,image/png"
            aria-label="Choose a ticket image"
            disabled={busy}
            onChange={(event) => {
              selectFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <input
            ref={camera}
            className="sr-only"
            tabIndex={-1}
            type="file"
            accept="image/*"
            capture="environment"
            aria-label="Take a photo of your ticket"
            disabled={busy}
            onChange={(event) => {
              selectFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <div
            className={`upload-zone ${dragging ? "dragging" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              if (!busy) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (event.dataTransfer.files.length > 1)
                setError("Upload one ticket image at a time.");
              else selectFile(event.dataTransfer.files[0]);
            }}
          >
            {busy ? (
              <div
                className="ai-extraction-state"
                role="status"
                aria-live="polite"
              >
                <span className="ai-extraction-icon" aria-hidden="true">
                  <BrainCircuit size={34} />
                  <ScanLine size={18} />
                </span>
                <span className="eyebrow">AI trip assistant</span>
                <h3>Extracting your trip details</h3>
                <p>
                  We’re reading your proof and checking the information needed
                  to calculate its carbon impact.
                </p>
                <div className="ai-extraction-progress" aria-hidden="true">
                  <span />
                </div>
                <div className="ai-extraction-fields" aria-hidden="true">
                  <span>
                    <MapPin size={15} /> Route
                  </span>
                  <span>
                    <CalendarDays size={15} /> Travel date
                  </span>
                  <span>
                    <Ticket size={15} /> Transport
                  </span>
                </div>
                <small>Please keep this page open for a moment.</small>
              </div>
            ) : file && preview ? (
              <>
                <img
                  className="proof-preview"
                  src={preview}
                  alt="Selected travel proof"
                />
                <div className="file-info">
                  <ImagePlus size={19} />
                  <span>
                    <strong>{file.name}</strong>
                    <small>
                      {(file.size / 1024 / 1024).toFixed(2)} MiB · Ready to
                      verify
                    </small>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove selected file"
                    disabled={busy}
                    onClick={() => {
                      setFile(null);
                      setError("");
                    }}
                  >
                    <X size={18} />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <span className="upload-illustration">
                  <Ticket size={38} />
                </span>
                <h3>Add your travel proof</h3>
                <p>Drop your ticket here, or choose a file below.</p>
                <span className="subtle">JPG or PNG · Up to 10 MiB</span>
              </>
            )}
          </div>
          <div className="upload-actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => picker.current?.click()}
            >
              <Upload size={17} />
              {file ? "Replace file" : "Choose file"}
            </Button>
            <Button
              variant="outline"
              disabled={busy || cameraStarting}
              onClick={handleTakePhoto}
            >
              {cameraStarting ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Camera size={17} />
              )}
              {cameraStarting ? "Opening camera…" : "Take photo"}
            </Button>
          </div>
          {cameraOpen &&
            createPortal(
            <div className="camera-backdrop">
              <section
                className="camera-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="camera-title"
              >
                <div className="camera-dialog-heading">
                  <div>
                    <span className="eyebrow">Travel proof</span>
                    <h2 id="camera-title">Take a clear photo</h2>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Close camera"
                    autoFocus
                    onClick={closeCamera}
                  >
                    <X size={20} />
                  </Button>
                </div>
                <div className="camera-viewport">
                  <video
                    ref={(node) => {
                      video.current = node;
                      if (node && cameraStream.current) {
                        node.srcObject = cameraStream.current;
                        void node
                          .play()
                          .catch(() => setCameraReady(false));
                      }
                    }}
                    autoPlay
                    muted
                    playsInline
                    onLoadedMetadata={() => setCameraReady(true)}
                  />
                  <span className="camera-guide" aria-hidden="true" />
                  {!cameraReady && (
                    <span className="camera-loading" role="status">
                      <LoaderCircle className="spin" size={22} /> Preparing
                      camera…
                    </span>
                  )}
                </div>
                <p>Keep the full ticket inside the frame and make text readable.</p>
                <div className="camera-actions">
                  <Button variant="outline" onClick={closeCamera}>
                    Cancel
                  </Button>
                  <Button disabled={!cameraReady} onClick={capturePhoto}>
                    <Camera size={18} /> Capture photo
                  </Button>
                </div>
              </section>
            </div>,
              document.body,
            )}
          <p className="privacy-note">
            <LockKeyhole size={14} /> Your proof stays on this device until you
            submit it.
          </p>
          {error && (
            <div className="section-spacer">
              <ErrorState message={error} />
              <p className="subtle">
                If submission was interrupted, your trip may have been saved.{" "}
                <Link className="inline-link" href={pathFor("/trips", demo)}>
                  Check your trips
                </Link>{" "}
                before uploading again.
              </p>
            </div>
          )}
          <Button
            className="full-width verify-button"
            disabled={!file || busy}
            onClick={submit}
          >
            {busy ? (
              <>
                <LoaderCircle className="spin" size={18} /> Extracting trip
                data…
              </>
            ) : demo ? (
              "Preview sample result"
            ) : (
              "Verify trip"
            )}
          </Button>
          <p className="subtle">
            {busy
              ? "AI is extracting your route, date, and transport details."
              : demo
                ? "Preview uses a sample trip; your image will not be uploaded."
                : "After submission, your proof is stored privately."}
          </p>
        </section>
        <aside className="upload-guide">
          <span className="eyebrow">Before you upload</span>
          <h2>
            Keep the details
            <br />
            in the picture.
          </h2>
          <ul>
            {[
              "Origin and destination are visible",
              "Travel date is clear and readable",
              "The full ticket or receipt is included",
            ].map((text) => (
              <li key={text}>
                <Check size={17} />
                {text}
              </li>
            ))}
          </ul>
          <div className="guide-divider" />
          <h3>What happens next</h3>
          <ol>
            <li>
              <span>01</span>Upload your travel proof
            </li>
            <li>
              <span>02</span>Understand your estimated CO₂
            </li>
            <li>
              <span>03</span>Claim rewards on eligible trips
            </li>
          </ol>
          <p>
            Bus, train, car, motorcycle, or airplane. Every category can be
            assessed.
          </p>
        </aside>
      </div>
    </>
  );
}
