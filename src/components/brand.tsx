/** Logo de la plateforme : une plume dorée (clin d'œil à l'encre et à l'écriture). */
export function BrandMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className={`shrink-0 ${className}`}>
      <rect width="40" height="40" rx="11" fill="#c9a227" />
      <path d="M28 9c-7 1-13 7-15 15l-2 7 2 .5 2-5c6 0 11-5 13-11-2 1-4 1-6 1 3-2 5-4 6-7.5z" fill="#14213d" />
    </svg>
  );
}
