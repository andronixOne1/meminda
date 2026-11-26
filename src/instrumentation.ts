export async function register() {
  // Runs once when the Next.js Node server boots on Render.
  // Pings the public domain every 9 minutes so Render's ingress proxy registers active traffic
  // and prevents the 15-minute free-tier spin-down screen.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const publicUrl =
      process.env.RENDER_EXTERNAL_URL || "https://meminda.ge";
    const healthUrl = `${publicUrl.replace(/\/$/, "")}/api/health`;

    const INTERVAL_MS = 9 * 60 * 1000; // 9 minutes (Render sleeps after 15 minutes of inactivity)

    setInterval(async () => {
      try {
        await fetch(healthUrl, {
          method: "GET",
          headers: { "User-Agent": "Meminda-KeepAlive/1.0" },
          cache: "no-store",
        });
      } catch {
        // Ignore transient network errors
      }
    }, INTERVAL_MS);
  }
}
