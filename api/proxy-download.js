export default async function handler(req, res) {
  const { url, filename } = req.query;
  const fileName = filename || "video.mp4";

  if (!url) {
    return res.status(400).send("URL is required");
  }

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      return res.status(500).send("Failed to fetch video");
    }

    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Type", response.headers.get("Content-Type") || "video/mp4");
    
    const contentLength = response.headers.get("Content-Length");
    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }

    // For serverless functions, we often have to buffer or use specific streaming
    // Node.js fetch returns a web stream. We can convert it.
    const body = response.body;
    if (!body) return res.status(500).send("Empty body");

    const reader = body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (error) {
    console.error("Proxy error:", error);
    res.status(500).send("Error proxying download");
  }
}
