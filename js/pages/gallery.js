import { loadAlbums } from "../data-service.js";
import { normalizeAlbum } from "../albums.js";
import { albumCard } from "../album-view.js";
import { $ } from "../ui.js";

export async function render() {
  const albums = (await loadAlbums()).map(normalizeAlbum).sort((a, b) => b.date - a.date);
  $("#albums").innerHTML = albums.map(albumCard).join("");
}
