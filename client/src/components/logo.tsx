export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" role="img" aria-label="ADD SmartRegnskab logo">
      <rect width="32" height="32" rx="7" fill="currentColor" />
      <rect x="1" y="1" width="30" height="30" rx="6" stroke="white" strokeOpacity="0.14" />

      <path d="M11 5.5h7.5L23 10v13.5H11V5.5Z" fill="white" />
      <path d="M18.5 5.5V10H23" fill="#DCEBE5" />
      <path d="M13.5 10.5h3.2M13.5 13h6.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      <path d="M14 20v-2M17 20v-4M20 20v-6" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />

      <rect x="5.5" y="16" width="8.5" height="10" rx="2.1" fill="white" stroke="currentColor" strokeWidth="0.8" />
      <rect x="7.2" y="17.7" width="5.1" height="2.1" rx="0.55" fill="currentColor" opacity="0.85" />
      <path d="M7.5 22h.6M10 22h.6M12 22h.6M7.5 24h.6M10 24h.6M12 24h.6" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />

      <path d="M14.5 26.1c5.5-.7 9.4-4.1 11.2-9.2" stroke="#9CDD3F" strokeWidth="2.2" strokeLinecap="round" />
      <path d="m23.9 16.7 3.5-3.2.4 4.8-3.9-1.6Z" fill="#9CDD3F" />
    </svg>
  );
}
