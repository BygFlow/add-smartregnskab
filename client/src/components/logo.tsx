export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-label="ADD SmartDrift Clean logo">
      <rect width="32" height="32" rx="7" fill="currentColor" />
      <path
        d="M9 12.5c0-1.4 1.1-2.5 2.5-2.5h9c1.4 0 2.5 1.1 2.5 2.5v0c0 .55-.45 1-1 1H10c-.55 0-1-.45-1-1z"
        fill="white"
        opacity="0.95"
      />
      <path
        d="M10 15.5h12v7c0 1.1-.9 2-2 2H12c-1.1 0-2-.9-2-2v-7z"
        fill="white"
        opacity="0.8"
      />
      <circle cx="16" cy="19" r="1.5" fill="currentColor" />
    </svg>
  );
}
