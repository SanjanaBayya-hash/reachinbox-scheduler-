export function Avatar({ src, name }: { src: string | null; name: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} className="h-8 w-8 rounded-full object-cover" />;
  }
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">
      {initials}
    </div>
  );
}
