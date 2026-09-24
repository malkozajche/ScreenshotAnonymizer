import { useEffect, useMemo, useRef, useState } from "react";
import type { ProposedRedaction } from "@sa/pipeline";
import {
  bakePreview,
  canvasToPngBlob,
  downloadBlob,
  loadImageFile,
} from "./lib/scan";
import { scanImageWithOcr } from "./lib/ocr";

type Step = "upload" | "scanning" | "review";

export default function App() {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string>("");
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [proposals, setProposals] = useState<ProposedRedaction[]>([]);
  const [ocrText, setOcrText] = useState("");
  const [progress, setProgress] = useState({ status: "", value: 0 });
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => {
    const active = proposals.filter((p) => p.action !== "dismiss");
    const critical = active.filter(
      (p) => p.detection.severity === "critical",
    ).length;
    const high = active.filter((p) => p.detection.severity === "high").length;
    return { total: active.length, critical, high, all: proposals.length };
  }, [proposals]);

  useEffect(() => {
    if (!imageEl) return;
    const canvas = bakePreview(imageEl, proposals);
    const url = canvas.toDataURL("image/png");
    setPreviewUrl(url);
  }, [imageEl, proposals]);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setApproved(false);
    setProposals([]);
    setOcrText("");
    setStep("scanning");
    setFileName(file.name || "screenshot.png");

    try {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      const loaded = await loadImageFile(file);
      setObjectUrl(loaded.objectUrl);
      setImageEl(loaded.img);

      const scanned = await scanImageWithOcr(
        loaded.img,
        file.name,
        (status, value) => setProgress({ status, value }),
      );
      setProposals(scanned.proposals);
      setOcrText(scanned.ocrText);
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
      setStep("upload");
    }
  }

  function updateProposal(id: string, patch: Partial<ProposedRedaction>) {
    setApproved(false);
    setProposals((prev) =>
      prev.map((p) =>
        p.detection.id === id
          ? {
              ...p,
              ...patch,
              detection: p.detection,
            }
          : p,
      ),
    );
  }

  async function onDownload() {
    if (!imageEl || !approved) return;
    const canvas = bakePreview(imageEl, proposals);
    const blob = await canvasToPngBlob(canvas);
    const base = fileName.replace(/\.[^.]+$/, "") || "screenshot";
    downloadBlob(blob, `${base}.anonymized.png`);

    const report = {
      fileName,
      approvedAt: new Date().toISOString(),
      detections: proposals.map((p) => ({
        id: p.detection.id,
        category: p.detection.category,
        text: p.detection.text,
        action: p.action,
        replacement: p.replacement,
        severity: p.detection.severity,
      })),
      ocrPreview: ocrText.slice(0, 2000),
    };
    downloadBlob(
      new Blob([JSON.stringify(report, null, 2)], {
        type: "application/json",
      }),
      `${base}.report.json`,
    );
  }

  function reset() {
    setStep("upload");
    setFileName("");
    setImageEl(null);
    setProposals([]);
    setOcrText("");
    setApproved(false);
    setPreviewUrl(null);
    setError(null);
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setObjectUrl(null);
  }

  return (
    <div className="app-shell">
      <header className="brand">
        <div className="brand-mark">
          Screenshot <span>Anonymizer</span>
        </div>
        <p>
          Scan screenshots on this device, blur private regions, and download
          docs-ready images — phone or desktop.
        </p>
      </header>

      {step === "upload" && (
        <section className="panel">
          <div className="upload-zone">
            <strong>Drop a screenshot</strong>
            <p className="hint">
              PNG, JPEG, or WebP. Processing stays in your browser.
            </p>
            <div className="actions">
              <button
                type="button"
                className="btn"
                onClick={() => fileRef.current?.click()}
              >
                Choose file
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => cameraRef.current?.click()}
              >
                Camera / photos
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
          </div>
          {error && (
            <p className="hint" style={{ color: "var(--danger)", marginTop: 12 }}>
              {error}
            </p>
          )}
        </section>
      )}

      {step === "scanning" && (
        <section className="panel">
          <strong>Scanning on-device…</strong>
          <p className="hint" style={{ marginTop: 8 }}>
            {progress.status || "starting"}{" "}
            {progress.value ? `· ${Math.round(progress.value * 100)}%` : ""}
          </p>
          <div
            style={{
              marginTop: 16,
              height: 8,
              borderRadius: 999,
              background: "rgba(16,42,46,0.08)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.round(progress.value * 100)}%`,
                height: "100%",
                background: "var(--accent)",
                transition: "width 0.2s ease",
              }}
            />
          </div>
        </section>
      )}

      {step === "review" && (
        <section className="panel">
          <div className="status-bar">
            <span className="chip ok">{counts.total} active</span>
            {counts.critical > 0 && (
              <span className="chip critical">{counts.critical} critical</span>
            )}
            {counts.high > 0 && (
              <span className="chip high">{counts.high} high</span>
            )}
            <span className="chip">{fileName}</span>
          </div>

          <div className="workspace" style={{ marginTop: 12 }}>
            <div className="preview-wrap">
              {previewUrl ? (
                <img src={previewUrl} alt="Anonymized preview" />
              ) : objectUrl ? (
                <img src={objectUrl} alt="Original screenshot" />
              ) : null}
            </div>

            <div>
              <div className="detection-list">
                {proposals.length === 0 && (
                  <div className="detection-card">
                    <div className="text">
                      No structured PII/secrets found in OCR text. Review the
                      image anyway before approving.
                    </div>
                  </div>
                )}
                {proposals.map((p) => (
                  <article
                    key={p.detection.id}
                    className={`detection-card${p.action === "dismiss" ? " dismissed" : ""}`}
                  >
                    <header>
                      <span className="cat">{p.detection.category}</span>
                      <span className="meta">
                        {p.action === "dismiss" ? "dismissed" : "blur"}
                      </span>
                    </header>
                    <div className="text">{p.detection.text ?? "(region)"}</div>
                    <div className="row-actions">
                      {p.action !== "dismiss" ? (
                        <button
                          type="button"
                          onClick={() =>
                            updateProposal(p.detection.id, {
                              action: "dismiss",
                            })
                          }
                        >
                          Dismiss
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            updateProposal(p.detection.id, {
                              action: "blur",
                            })
                          }
                        >
                          Restore blur
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>

              <div className="footer-actions">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={reset}
                >
                  New upload
                </button>
                <button
                  type="button"
                  className={`btn ${approved ? "secondary" : ""}`}
                  onClick={() => setApproved(true)}
                >
                  {approved ? "Approved" : "Approve"}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={!approved}
                  onClick={() => void onDownload()}
                >
                  Download
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      <p className="privacy">
        On-device by default · detected regions are blurred · install this page
        as an app from your browser menu.
      </p>
    </div>
  );
}
