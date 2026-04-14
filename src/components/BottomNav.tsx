"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Upload, User } from "lucide-react";
import { motion } from "framer-motion";

const tabs = [
  { href: "/", label: "Home", icon: Home },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/profile", label: "Profile", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        background: "rgba(14, 14, 40, 0.95)",
        borderTop: "1px solid #1c1c42",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
      className="fixed bottom-0 left-0 right-0 z-50 h-16"
    >
      {/* Inner wrapper mirrors the 960px content column */}
      <div
        style={{
          maxWidth: "960px",
          width: "100%",
          margin: "0 auto",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          padding: "0 8px",
        }}
      >
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href || (href !== "/" && pathname.startsWith(href));

          return (
            <Link
              key={href}
              href={href}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                position: "relative",
                textDecoration: "none",
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "32px",
                    height: "2px",
                    borderRadius: "9999px",
                    background: "#7c3aed",
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <motion.div
                whileTap={{ scale: 0.85 }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Icon
                  size={22}
                  style={{
                    color: isActive ? "#a78bfa" : "#4a4a6a",
                    filter: isActive
                      ? "drop-shadow(0 0 8px rgba(167, 139, 250, 0.6))"
                      : "none",
                    transition: "all 0.2s ease",
                  }}
                />
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: isActive ? "600" : "400",
                    color: isActive ? "#a78bfa" : "#4a4a6a",
                    letterSpacing: "0.05em",
                    transition: "all 0.2s ease",
                  }}
                >
                  {label}
                </span>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
