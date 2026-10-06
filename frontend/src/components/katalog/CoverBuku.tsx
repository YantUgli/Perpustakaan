type Props = { coverUrl: string | null; className?: string };

/**
 * Cover judul dari `cover_url` API (`GET /katalog/judul/{id}/cover`, path dari DB). Tanpa cover → gambar
 * pengganti (OQ-10), bukan gambar rusak. Dekoratif: judul selalu tampil sebagai teks di sebelahnya.
 */
export function CoverBuku({ coverUrl, className = "" }: Props) {
  if (coverUrl) {
    // Preseden admin/judul: next/image tidak dipakai untuk cover dari API.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={coverUrl} alt="" className={`rounded object-cover ${className}`} />;
  }
  return (
    <div
      aria-hidden="true"
      data-cover="pengganti"
      className={`flex items-center justify-center rounded border border-line bg-navy/5 ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="w-1/3 max-w-10 text-gold"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5Z" />
        <path d="M12 6.5V19.5" />
      </svg>
    </div>
  );
}
