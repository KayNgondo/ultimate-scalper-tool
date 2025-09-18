"use client";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html>
      <body>
        <div style={{ padding: 24 }}>
          <h1>Something went wrong</h1>
          <p>{process.env.NODE_ENV === "development" ? error.message : "Please try again."}</p>
          <button onClick={() => reset()}>Try again</button>
        </div>
      </body>
    </html>
  );
}
