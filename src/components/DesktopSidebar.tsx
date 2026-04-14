"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Upload, User, ShieldCheck } from "lucide-react";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/profile", label: "Profile", icon: User },
];

export default function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: "220px",
        height: "100vh",
        backgroundColor: "#080820",
        borderRight: "1px solid #1c1c42",
        display: "flex",
        flexDirection: "column",
        padding: "24px 12px",
        position: "sticky",
        top: 0,
        flexShrink: 0,
        overflowY: "auto",
      }}
    >
      {/* Brand Logo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "4px 12px 28px",
          borderBottom: "1px solid #1c1c42",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            width: "38px",
            height: "38px",
            background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
            flexShrink: 0,
            boxShadow: "0 0 18px rgba(124, 58, 237, 0.5)",
          }}
        >
          🔍
        </div>
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: "11px", color: "#8b8baa", fontWeight: 500 }}>
            Patch the
          </div>
          <div
            style={{
              fontSize: "17px",
              fontWeight: 800,
              background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Reality
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          flex: 1,
        }}
      >
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href ||
            (href !== "/" && pathname.startsWith(href));

          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "11px 14px",
                borderRadius: "10px",
                textDecoration: "none",
                background: isActive
                  ? "rgba(124, 58, 237, 0.15)"
                  : "transparent",
                border: isActive
                  ? "1px solid rgba(124, 58, 237, 0.3)"
                  : "1px solid transparent",
                color: isActive ? "#a78bfa" : "#8b8baa",
                fontWeight: isActive ? 600 : 400,
                fontSize: "14px",
                transition: "all 0.18s ease",
                cursor: "pointer",
              }}
            >
              <Icon
                size={19}
                style={{
                  color: isActive ? "#a78bfa" : "#4a4a6a",
                  filter: isActive
                    ? "drop-shadow(0 0 6px rgba(167, 139, 250, 0.55))"
                    : "none",
                  flexShrink: 0,
                  transition: "all 0.18s ease",
                }}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer badge */}
      <div
        style={{
          borderTop: "1px solid #1c1c42",
          paddingTop: "16px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "14px 10px 0",
        }}
      >
        <ShieldCheck size={14} color="#4a4a6a" />
        <span style={{ fontSize: "11px", color: "#4a4a6a", lineHeight: 1.4 }}>
          Community-powered
          <br />fact verification
        </span>
      </div>
    </aside>
  );
}
