"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  Check,
  ImagePlus,
  LockKeyhole,
  LoaderCircle,
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
  const picker = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
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
  function selectFile(next?: File) {
    if (busy || !next) return;
    setError("");
    if (!next.size)
      return setError("This file is empty. Choose a JPG or PNG image.");
    if (!["image/jpeg", "image/png"].includes(next.type))
      return setError(
        "Choose a JPG or PNG image. PDF files are not supported.",
      );
    if (next.size > 10 * 1024 * 1024)
      return setError("This image is too large. Choose a file up to 10 MiB.");
    setFile(next);
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
        description="A ticket today. A little more insight tomorrow."
        back={pathFor("/trips", demo)}
      />
      <div className="upload-layout">
        <section className="surface upload-panel">
          <h2>Upload a ticket or receipt</h2>
          <p className="subtle">
            We’ll read the route and estimate your trip’s carbon impact.
          </p>
          <input
            ref={picker}
            className="sr-only"
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
            type="file"
            accept="image/jpeg,image/png"
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
            {file && preview ? (
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
                <h3>Your journey starts here</h3>
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
              disabled={busy}
              onClick={() => camera.current?.click()}
            >
              <Camera size={17} /> Take photo
            </Button>
          </div>
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
                <LoaderCircle className="spin" size={18} /> Checking your trip
                proof…
              </>
            ) : demo ? (
              "Preview sample result"
            ) : (
              "Verify trip"
            )}
          </Button>
          <p className="subtle" role="status">
            {busy
              ? "Verification may take a moment. Your proof is being checked."
              : demo
                ? "Preview uses a sample trip; your image will not be uploaded."
                : "After submission, your proof is stored privately."}
          </p>
        </section>
        <aside className="upload-guide">
          <span className="eyebrow">A good ticket goes a long way</span>
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
          <h3>One journey. Three little steps.</h3>
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
