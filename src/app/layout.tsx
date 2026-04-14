import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "Patch the Reality",
  description: "Crowd-sourced fact verification platform",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Patch the Reality",
  },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" style={{ colorScheme: "dark" }}>
      <body
        style={{
          backgroundColor: "#07071a",
          color: "#f0f0ff",
          margin: 0,
          padding: 0,
          minHeight: "100vh",
          overflowX: "hidden",
          overflowY: "auto",
        }}
      >
        <main
          style={{
            width: "100%",
            minHeight: "100vh",
            paddingBottom: "80px",
          }}
        >
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
