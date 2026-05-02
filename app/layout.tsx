// app/layout.tsx
import "./globals.css";
import React from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "UST Journal",
  description: "Ultimate Scalper Tool Trading Journal",
  manifest: "/manifest.json",
  themeColor: "#020617",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#020617" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ("serviceWorker" in navigator) {
                window.addEventListener("load", function () {
                  navigator.serviceWorker.register("/sw.js")
                    .then(function () {
                      console.log("UST Journal service worker registered");
                    })
                    .catch(function (error) {
                      console.log("Service worker registration failed:", error);
                    });
                });
              }
            `,
          }}
        />
      </head>

      <body>{children}</body>
    </html>
  );
}
