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

export async function searchArticles(query) {
  const params = new URLSearchParams({ q: query });
  const res = await fetch(`${API_BASE}/search?${params.toString()}`);
  if (!res.ok) throw new Error("Search failed");
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

export async function fetchFaculty(keywords) {
  const res = await fetch(`${API_BASE}/faculty`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keywords }),
  });
  if (!res.ok) throw new Error("Faculty lookup failed");
  return res.json();
}
