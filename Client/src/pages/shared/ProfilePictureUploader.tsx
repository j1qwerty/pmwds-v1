import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Cropper, { type Area } from "react-easy-crop";

const SUPPORTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MIN_DIM = 64;
const MAX_DIM = 8192;

interface ProfilePictureUploaderProps {
  userId: string;
  token: string;
  disabled?: boolean;
  onUpload: (file: File) => Promise<void>;
}

type EditorState = {
  file: File;
  url: string;
  zoom: number;
  rotate: number;
  crop: { x: number; y: number };
  croppedAreaPixels: Area | null;
};

export function ProfilePictureUploader({ userId, token, disabled, onUpload }: ProfilePictureUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (editor?.url) URL.revokeObjectURL(editor.url);
    };
  }, [editor?.url]);

  useEffect(() => {
    if (editor) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [editor]);

  const openEditor = async (file: File | undefined) => {
    if (!file || disabled || !token || !userId) return;
    setError("");

    if (!SUPPORTED_TYPES.includes(file.type)) {
      setError("Select a PNG, JPEG, or WebP image.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("Image must be under 5 MiB.");
      return;
    }

    try {
      const image = await loadImage(file);
      if (
        image.naturalWidth < MIN_DIM ||
        image.naturalHeight < MIN_DIM ||
        image.naturalWidth > MAX_DIM ||
        image.naturalHeight > MAX_DIM
      ) {
        setError(`Image must be between ${MIN_DIM}×${MIN_DIM} and ${MAX_DIM}×${MAX_DIM} pixels.`);
        return;
      }
    } catch {
      setError("Could not read image file.");
      return;
    }

    if (editor?.url) URL.revokeObjectURL(editor.url);
    setEditor({
      file,
      url: URL.createObjectURL(file),
      zoom: 1,
      rotate: 0,
      crop: { x: 0, y: 0 },
      croppedAreaPixels: null,
    });
    if (inputRef.current) inputRef.current.value = "";
  };

  const closeEditor = () => {
    if (editor?.url) URL.revokeObjectURL(editor.url);
    setEditor(null);
    setBusy(false);
  };

  const save = async () => {
    if (!editor) return;
    setBusy(true);
    setError("");
    try {
      const compressed = await cropAndCompress(editor);
      await onUpload(compressed);
      closeEditor();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to upload image.");
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => openEditor(event.target.files?.[0])}
      />
      
      <button
        type="button"
        disabled={busy || disabled}
        onClick={() => inputRef.current?.click()}
        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
            Uploading...
          </span>
        ) : (
          "Upload"
        )}
      </button>
      
      {error && (
        <span className="max-w-40 text-[10px] text-red-500 flex items-center gap-1">
          <span className="material-symbols-outlined text-xs">error</span>
          {error}
        </span>
      )}

      {editor && createPortal(
        <ProfilePictureEditorModal
          editor={editor}
          busy={busy}
          onClose={closeEditor}
          onSave={save}
          onEditorChange={setEditor}
        />,
        document.body,
      )}
    </div>
  );
}

interface ProfilePictureEditorModalProps {
  editor: EditorState;
  busy: boolean;
  onClose: () => void;
  onSave: () => void;
  onEditorChange: (updater: (prev: EditorState | null) => EditorState | null) => void;
}

function ProfilePictureEditorModal({ editor, busy, onClose, onSave, onEditorChange }: ProfilePictureEditorModalProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative w-[480px] h-[580px] rounded-2xl border border-green-300/60 bg-green-200 shadow-2xl shadow-black/20 animate-[modalIn_0.3s_ease] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-green-300/50 px-6 py-4 shrink-0">
          <div>
            <h3 className="text-base font-bold text-green-900">Edit Profile Picture</h3>
            <p className="text-xs text-green-700 mt-0.5">
              Crop, rotate, zoom, then upload
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl p-2 text-green-600 hover:bg-green-300 hover:text-green-800 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="flex-1 px-6 py-4 overflow-y-auto">
          <div className="relative mx-auto size-56 overflow-hidden rounded-2xl bg-green-100 shadow-inner ring-1 ring-green-300">
            <Cropper
              image={editor.url}
              crop={editor.crop}
              zoom={editor.zoom}
              rotation={editor.rotate}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={(crop) => onEditorChange((current) => current && { ...current, crop })}
              onZoomChange={(zoom) => onEditorChange((current) => current && { ...current, zoom })}
              onRotationChange={(rotate) => onEditorChange((current) => current && { ...current, rotate })}
              onCropComplete={(_, croppedAreaPixels) =>
                onEditorChange((current) => current && { ...current, croppedAreaPixels })
              }
            />
          </div>

          <div className="mt-4 grid gap-3">
            <Control label="Zoom" value={`${editor.zoom.toFixed(2)}x`}>
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={editor.zoom}
                onChange={(event) =>
                  onEditorChange((current) => current && { ...current, zoom: Number(event.target.value) })
                }
                className="w-full h-2 rounded-lg appearance-none bg-green-300 cursor-pointer accent-green-700 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-green-700 [&::-webkit-slider-thumb]:shadow-sm"
              />
            </Control>
            
            <Control label="Rotate" value={`${editor.rotate}°`}>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onEditorChange((current) => current && { ...current, rotate: current.rotate - 90 })}
                  disabled={busy}
                  className="rounded-lg border border-green-300 p-2 text-green-700 hover:bg-green-300 hover:border-green-400 transition-all disabled:opacity-50"
                  title="Rotate left 90°"
                >
                  <span className="material-symbols-outlined text-lg">rotate_left</span>
                </button>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={editor.rotate}
                  onChange={(event) =>
                    onEditorChange((current) => current && { ...current, rotate: Number(event.target.value) })
                  }
                  className="flex-1 h-2 rounded-lg appearance-none bg-green-300 cursor-pointer accent-green-700 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-green-700 [&::-webkit-slider-thumb]:shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => onEditorChange((current) => current && { ...current, rotate: current.rotate + 90 })}
                  disabled={busy}
                  className="rounded-lg border border-green-300 p-2 text-green-700 hover:bg-green-300 hover:border-green-400 transition-all disabled:opacity-50"
                  title="Rotate right 90°"
                >
                  <span className="material-symbols-outlined text-lg">rotate_right</span>
                </button>
              </div>
            </Control>
          </div>

          <div className="mt-3 p-2 rounded-lg bg-green-100 border border-green-300/50">
            <p className="text-[10px] text-green-700 text-center">
              The image will be cropped to a circle and compressed to 512×512px WebP format
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-green-300/50 px-6 py-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-green-300 bg-green-100 px-4 py-2.5 text-sm font-semibold text-green-800 hover:bg-green-300 hover:border-green-400 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-green-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-800 hover:shadow-lg hover:shadow-green-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy && (
              <span className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            )}
            {busy ? "Saving..." : "Save Picture"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

function Control({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="flex items-center justify-between text-xs font-semibold text-slate-600">
        {label}
        <span className="font-mono text-[11px] text-slate-400">{value}</span>
      </span>
      {children}
    </label>
  );
}

async function cropAndCompress(editor: EditorState): Promise<File> {
  const image = await loadImage(editor.file);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing is not available.");

  const crop = editor.croppedAreaPixels ?? {
    x: 0,
    y: 0,
    width: image.width,
    height: image.height,
  };

  const rotated = await createRotatedImage(image, editor.rotate);

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.beginPath();
  context.arc(256, 256, 256, 0, Math.PI * 2);
  context.clip();
  context.drawImage(
    rotated,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  context.restore();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
  if (!blob) throw new Error("Could not process image.");
  return new File([blob], "profile-picture.webp", { type: "image/webp" });
}

async function createRotatedImage(image: HTMLImageElement, rotation: number): Promise<HTMLCanvasElement> {
  const radians = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const width = image.width;
  const height = image.height;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * cos + height * sin);
  canvas.height = Math.round(width * sin + height * cos);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing is not available.");
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(radians);
  context.drawImage(image, -width / 2, -height / 2);
  return canvas;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image."));
    };
    image.src = url;
  });
}