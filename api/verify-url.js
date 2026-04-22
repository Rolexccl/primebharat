export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ ok: false, error: "URL required" });
  }

  try {
    const response = await fetch(url, { method: "HEAD" });
    if (response.ok) {
      return res.status(200).json({ ok: true });
    }

    const getResponse = await fetch(url, { method: "GET" });
    return res.status(200).json({ ok: getResponse.ok });
  } catch (error) {
    return res.status(200).json({ ok: false, error: "Network error" });
  }
}
