const API_BASE = "/api";

export async function fetchMap() {
  const res = await fetch(`${API_BASE}/map`);
  if (!res.ok) throw new Error("Failed to fetch map");
  return res.json();
}

export async function fetchFineCluster(fineId) {
  const res = await fetch(`${API_BASE}/fine_cluster/${fineId}`);
  if (!res.ok) throw new Error("Failed to fetch fine cluster");
  return res.json();
}

export async function uploadText(text) {
  const formData = new FormData();
  formData.append("text", text);
  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Upload failed");
  return res.json();
}

export async function createCitation(article) {
  const payload = {
    headline: article.headline,
    pub_date: article.pub_date,
    url: article.url,
    section: article.section,
    source: "The New York Times",
    authors: article.byline
      ? article.byline
          .replace(/^by\s+/i, "")
          .split(/,|and|&/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  };
  const res = await fetch(`${API_BASE}/citation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Citation generation failed");
  return res.json();
}
