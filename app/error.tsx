"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("[UST] Global error boundary:", error);
  return (
    <html>
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
        <h1 style={{ marginBottom: 8 }}>Something went wrong</h1>
        <p style={{ marginBottom: 24 }}>
          A client-side error occurred while loading the app.
        </p>
        <button
          onClick={() => reset()}
          style={{
            padding: "8px 14px",
            borderRadius: 6,
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
