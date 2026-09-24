"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError, Restaurant } from "@/lib/api";

export default function EditarComercioPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .getRestaurant(params.id)
      .then(setRestaurant)
      .catch(() => setError("No se pudo cargar este comercio."))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function handleFileSelected(target: "logo_url" | "cover_photo_url", file: File | undefined) {
    if (!file || !restaurant) return;
    setError(null);
    const setUploading = target === "logo_url" ? setUploadingLogo : setUploadingCover;
    setUploading(true);
    try {
      const { url } = await api.uploadImage(file);
      const updated = await api.updateRestaurant(restaurant.id, { [target]: url });
      setRestaurant(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo subir la imagen.");
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-400">Cargando…</p>;
  if (!restaurant) return <p className="text-sm text-red-600">{error || "Comercio no encontrado."}</p>;

  return (
    <div className="max-w-xl">
      <button onClick={() => router.back()} className="text-sm text-slate-500 hover:text-slate-800 mb-4">
        ← Volver
      </button>

      <h1 className="text-2xl font-semibold text-slate-900 mb-1">{restaurant.name}</h1>
      <p className="text-sm text-slate-500 mb-6">{restaurant.address_line}</p>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <section className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
        <h2 className="font-medium text-slate-900 mb-3">Foto de portada</h2>
        <div className="h-32 bg-slate-100 rounded-lg overflow-hidden mb-3 flex items-center justify-center">
          {restaurant.cover_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={restaurant.cover_photo_url} alt="Portada" className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl">🖼️</span>
          )}
        </div>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleFileSelected("cover_photo_url", e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => coverInputRef.current?.click()}
          disabled={uploadingCover}
          className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {uploadingCover ? "Subiendo…" : restaurant.cover_photo_url ? "Cambiar foto de portada" : "Subir foto de portada"}
        </button>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-medium text-slate-900 mb-3">Logo</h2>
        <div className="w-20 h-20 rounded-full bg-slate-100 overflow-hidden mb-3 flex items-center justify-center">
          {restaurant.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={restaurant.logo_url} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl">🏪</span>
          )}
        </div>
        <input
          ref={logoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleFileSelected("logo_url", e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => logoInputRef.current?.click()}
          disabled={uploadingLogo}
          className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {uploadingLogo ? "Subiendo…" : restaurant.logo_url ? "Cambiar logo" : "Subir logo"}
        </button>
      </section>
    </div>
  );
}
