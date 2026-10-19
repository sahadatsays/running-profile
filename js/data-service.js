export async function loadActivityData(url = "data.json") {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
  const data = await res.json();
  if (!Array.isArray(data.records)) throw new Error(`${url} has no "records" array`);
  return data;
}
