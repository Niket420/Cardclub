import clsx from "clsx";
import { Bot } from "lucide-react";

const GRADIENTS = [
  "from-rose-400 to-pink-600",
  "from-amber-300 to-orange-500",
  "from-emerald-300 to-teal-600",
  "from-sky-300 to-blue-600",
  "from-violet-300 to-purple-600",
  "from-lime-300 to-green-600",
  "from-fuchsia-300 to-fuchsia-600",
  "from-cyan-300 to-sky-600",
  "from-orange-300 to-red-500",
  "from-indigo-300 to-indigo-600",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function Avatar({ name, id, bot, size = 40, className }: { name: string; id: string; bot?: boolean; size?: number; className?: string }) {
  const g = GRADIENTS[hash(id) % GRADIENTS.length];
  return (
    <div
      className={clsx("relative flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-display font-bold text-ink-950 ring-2 ring-black/30", g, className)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials(name)}
      {bot && (
        <span className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-ink-800 text-ink-200 ring-2 ring-ink-900" style={{ width: size * 0.42, height: size * 0.42 }}>
          <Bot style={{ width: size * 0.27, height: size * 0.27 }} />
        </span>
      )}
    </div>
  );
}
