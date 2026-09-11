type P = { className?: string };

export function Star({ className = "h-4 w-4", filled = true }: P & { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 28 28"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 2}
      aria-hidden="true"
    >
      <path d="M12.701 3.908c.532-1.078 2.069-1.078 2.6 0l2.692 5.452l6.017.875c1.19.173 1.664 1.634.804 2.473l-4.355 4.244l1.028 5.993c.204 1.185-1.04 2.088-2.103 1.529l-5.382-2.83l-5.382 2.83c-1.064.559-2.307-.344-2.104-1.529l1.028-5.993l-4.355-4.244c-.86-.839-.385-2.3.804-2.473l6.017-.875z" />
    </svg>
  );
}

export function Stars({
  value,
  className = "h-4 w-4",
  color = "text-accent",
}: {
  value: number;
  className?: string;
  color?: string;
}) {
  return (
    <span className={`inline-flex gap-0.5 ${color}`} aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={className} filled={i <= Math.round(value)} />
      ))}
    </span>
  );
}

export function Check({ className = "h-4 w-4" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function Box({ className = "h-4 w-4" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="m21 8-9-5-9 5 9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  );
}

export function Storefront({ className = "h-4 w-4" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9 4 4h16l1 5" />
      <path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
      <path d="M5 11v9h14v-9" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}

export function Search({ className = "h-5 w-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function User({ className = "h-5 w-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

export function Cart({ className = "h-5 w-5" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 6h15l-1.5 8h-12L5 3H2" />
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
    </svg>
  );
}

export function Truck({ className = "h-6 w-6" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h11v10H3z" />
      <path d="M14 9h4l3 3v4h-7" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  );
}

export function Gift({ className = "h-6 w-6" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="8" width="18" height="4" />
      <path d="M5 12v9h14v-9" />
      <path d="M12 8v13" />
      <path d="M12 8c-2-4-6-4-6-1s4 1 6 1Zm0 0c2-4 6-4 6-1s-4 1-6 1Z" />
    </svg>
  );
}

export function Menu({ className = "h-6 w-6" }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

const cards: Record<string, { bg: string; text: string; label: string }> = {
  Mastercard: { bg: "#000000", text: "#ffffff", label: "MC" },
  Visa: { bg: "#1a1f71", text: "#ffffff", label: "VISA" },
  "Diners Club": { bg: "#0079be", text: "#ffffff", label: "DC" },
  Discover: { bg: "#f68121", text: "#ffffff", label: "DISC" },
  "American Express": { bg: "#2e77bc", text: "#ffffff", label: "AMEX" },
};

export function PaymentIcon({ name }: { name: string }) {
  const c = cards[name] ?? { bg: "#333333", text: "#ffffff", label: name.slice(0, 4).toUpperCase() };
  return (
    <svg viewBox="0 0 38 24" className="h-6 w-[38px] rounded-[3px]" role="img" aria-label={name}>
      <rect width="38" height="24" rx="3" fill={c.bg} />
      {name === "Mastercard" ? (
        <>
          <circle cx="15" cy="12" r="6" fill="#eb001b" />
          <circle cx="23" cy="12" r="6" fill="#f79e1b" fillOpacity="0.9" />
        </>
      ) : (
        <text x="19" y="15.5" textAnchor="middle" fontSize="8" fontWeight="700" fontFamily="Arial, sans-serif" fill={c.text}>
          {c.label}
        </text>
      )}
    </svg>
  );
}
