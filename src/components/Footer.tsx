"use client";

import Link from "next/link";

const FOOTER_LINKS = [
  { href: "https://github.com/patrickrb/nextlog", label: "GitHub", external: true },
  { href: "/awards", label: "Awards" },
  { href: "/stats", label: "Stats" },
  { href: "/lotw", label: "LoTW" },
  { href: "https://ks3ckc.radio", label: "ks3ckc.radio", external: true },
];

export default function Footer() {
  return (
    <footer className="border-t border-line py-10 mt-auto text-center text-fg-2">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex items-center justify-center gap-6 flex-wrap text-sm">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              {...(link.external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              className="hover:text-fg transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="mt-4 font-mono text-fg-3 text-[13px]">
          © {new Date().getFullYear()} nextlog · built by hams, for hams · 73
        </div>
      </div>
    </footer>
  );
}
