import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Verify URL availability
  app.get("/api/verify-url", async (req, res) => {
    const videoUrl = req.query.url as string;
    if (!videoUrl) return res.status(400).json({ ok: false, error: "URL required" });

    try {
      // Try HEAD request first as it's faster
      const response = await fetch(videoUrl, { method: "HEAD" });
      
      if (response.ok) {
        return res.json({ ok: true });
      }

      // Fallback to GET if HEAD is not allowed (some servers block HEAD)
      const getResponse = await fetch(videoUrl, { method: "GET" });
      return res.json({ ok: getResponse.ok });
    } catch (error) {
      return res.json({ ok: false, error: "Network error" });
    }
  });

  // Download Proxy to bypass CORS
  app.get("/api/proxy-download", async (req, res) => {
    const videoUrl = req.query.url as string;
    const fileName = req.query.filename as string || "video.mp4";

    if (!videoUrl) {
      return res.status(400).send("URL is required");
    }

    try {
      const response = await fetch(videoUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.statusText}`);
      }

      // Forward headers
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.setHeader("Content-Type", response.headers.get("Content-Type") || "video/mp4");
      
      const contentLength = response.headers.get("Content-Length");
      if (contentLength) {
        res.setHeader("Content-Length", contentLength);
      }

      // Stream the response
      if (response.body) {
        const reader = response.body.getReader();
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      } else {
        res.status(500).send("No response body");
      }
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).send("Error proxying download");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
