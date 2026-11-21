"use client";

/**
 * Last-resort error page, used when the root layout itself fails. It replaces the whole document, so it carries its
 * own tags and plain inline styles (the site stylesheet may not be available).
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fbfaf7", color: "#17222b" }}>
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ maxWidth: "28rem", textAlign: "center" }}>
            <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Something went wrong</h1>
            <p style={{ color: "#4b5b66" }}>The page could not be shown. Please try again in a moment.</p>
            {error.digest && <p style={{ color: "#4b5b66", fontSize: "0.75rem" }}>Reference: {error.digest}</p>}
            <p>
              <button type="button" onClick={reset} style={{ padding: "0.6rem 1.4rem", borderRadius: "999px", border: 0, background: "#1f7a63", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
                Try again
              </button>{" "}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- the router may be unavailable here, so a plain link is the safe way out */}
              <a href="/" style={{ marginLeft: "0.75rem", color: "#1f7a63", fontWeight: 600 }}>
                Go home
              </a>
            </p>
          </div>
        </main>
      </body>
    </html>
  );
}
