import type { Metadata, Viewport } from "next";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import "./globals.css";
import Providers from "./providers";

export const viewport: Viewport = {
  themeColor: "#203e34",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: { default: "Gopax", template: "%s · Gopax" },
  description:
    "Upload a travel ticket to save the route and view estimated emissions. Eligible trips can receive GOPAX rewards.",
  icons: {
    icon: "/logo-gopax.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Gopax",
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
