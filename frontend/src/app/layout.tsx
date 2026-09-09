import type { Metadata } from "next";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";
import Providers from "./providers";
export const metadata: Metadata = {
  title: { default: "Gopax — Every trip counts", template: "%s · Gopax" },
  description:
    "Turn your travel tickets into insights. Track your carbon impact and claim GOPAX rewards on BSC Testnet.",
  icons: { icon: "/logo.svg" },
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
