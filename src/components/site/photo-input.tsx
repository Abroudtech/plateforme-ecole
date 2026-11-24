"use client";

/* eslint-disable @next/next/no-img-element -- aperçu local de la photo choisie */
import { useEffect, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";

/**
 * Choix d'une photo, réduite dans le téléphone ou l'ordinateur avant l'envoi
 * (une photo de téléphone de 5 Mo devient environ 300 Ko) : l'envoi est
 * rapide et la page vitrine s'affiche vite.
 */
export function PhotoInput({ label, maxSize = 1600, keepTransparency = false }: { label: string; maxSize?: number; keepTransparency?: boolean }) {
  const [preview, setPreview] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  // Après un envoi réussi, le formulaire est vidé : on retire aussi l'aperçu.
  useEffect(() => {
    const form = ref.current?.form;
    const clear = () => setPreview(null);
    form?.addEventListener("reset", clear);
    return () => form?.removeEventListener("reset", clear);
  }, []);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return setPreview(null);
    try {
      const resized = await resize(file, maxSize, keepTransparency);
      const dt = new DataTransfer();
      dt.items.add(resized);
      input.files = dt.files;
      setPreview(URL.createObjectURL(resized));
    } catch {
      // Le navigateur ne sait pas lire ce format : on envoie le fichier tel quel
      // (le serveur refusera proprement s'il n'est pas accepté).
      setPreview(null);
    }
  }

  return (
    <label className="flex cursor-pointer flex-col gap-2 text-sm font-medium">
      <span className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 hover:border-gold-500">
        {preview ? (
          <img src={preview} alt="" className="h-14 w-14 rounded-lg object-cover" />
        ) : (
          <span className="grid h-14 w-14 place-items-center rounded-lg bg-white text-slate-500 ring-1 ring-slate-200">
            <ImagePlus size={22} aria-hidden />
          </span>
        )}
        <span>{label}</span>
      </span>
      <input ref={ref} type="file" name="photo" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" required onChange={onChange} className="sr-only" />
    </label>
  );
}

async function resize(file: File, maxSize: number, keepTransparency: boolean): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("canvas");
  if (!keepTransparency) {
    g.fillStyle = "#fff";
    g.fillRect(0, 0, width, height);
  }
  g.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const type = keepTransparency ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  if (!blob) throw new Error("blob");
  const base = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${base}.${keepTransparency ? "png" : "jpg"}`, { type });
}
