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

export async function searchArticles(query) {
  const trimmed = (query || "").trim();
  if (!trimmed) {
    throw new Error("Enter a search query.");
  }
  const params = new URLSearchParams({ q: trimmed });
  const res = await fetch(`${API_BASE}/search?${params.toString()}`);
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

export async function createCitation(article = {}) {
  const rawHeadline = article.headline;
  const headline =
    typeof rawHeadline === "string"
      ? rawHeadline
      : rawHeadline?.main || article.title || "Untitled Article";
  const url = article.web_url || article.url || "";
  const section = article.section || article.section_name || "Unknown section";
  const rawByline =
    typeof article.byline === "string"
      ? article.byline
      : article.byline?.original || "";
  const authors = rawByline
    ? rawByline
        .replace(/^by\s+/i, "")
        .split(/,|and|&/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const payload = {
    headline,
    pub_date: article.pub_date,
    url,
    section,
    source: "The New York Times",
    authors,
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

export async function fetchFaculty(keyword) {
  const query = (keyword || "").trim();
  if (!query) {
    return [];
  }
  const params = new URLSearchParams({ q: query });
  const res = await fetch(`${API_BASE}/faculty?${params.toString()}`);
  if (!res.ok) throw new Error("Faculty lookup failed");
  return res.json();
}
