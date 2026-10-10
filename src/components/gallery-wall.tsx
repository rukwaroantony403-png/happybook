"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Photo = { title?: string; name?: string; image?: string };
const imageSrc = (value: string, width = 1000) => value.startsWith("/") || value.startsWith("https://") ? value : `https://images.unsplash.com/${value}?auto=format&fit=crop&w=${width}&q=80`;

export default function GalleryWall() {
  const [photos, setPhotos] = useState<Photo[]>([]); const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => { fetch("/api/public/hotel", { cache: "no-store" }).then((response) => response.json()).then((data) => { const gallery = data.content?.gallery; if (Array.isArray(gallery)) setPhotos(gallery.filter((item) => item && typeof item.image === "string")); }).catch(() => undefined); }, []);
  if (!photos.length) return <p className="content-empty">No property photos have been published.</p>;
  return <><div className="image-wall">{photos.map((photo, index) => <button type="button" key={`${photo.title || photo.name || "photo"}-${index}`} onClick={() => setSelected(index)} aria-label={`Open photo: ${photo.title || photo.name || "Photo"}`}><Image src={imageSrc(photo.image!)} alt={photo.title || photo.name || "Hotel photo"} fill sizes="(max-width:760px) 50vw, 25vw" unoptimized/><span>{photo.title || photo.name || "Photo"}</span></button>)}</div>{selected !== null && photos[selected] && <div className="modal-backdrop gallery-backdrop" role="dialog" aria-modal="true" aria-label={photos[selected].title || photos[selected].name || "Photo"} onClick={() => setSelected(null)}><div className="gallery-view" onClick={(event) => event.stopPropagation()}><Image src={imageSrc(photos[selected].image!, 1800)} alt={photos[selected].title || photos[selected].name || "Hotel photo"} fill sizes="100vw" unoptimized/><button className="modal-close" type="button" onClick={() => setSelected(null)} aria-label="Close gallery">×</button><button className="gallery-arrow prev" type="button" aria-label="Previous image" onClick={() => setSelected((selected + photos.length - 1) % photos.length)}>‹</button><button className="gallery-arrow next" type="button" aria-label="Next image" onClick={() => setSelected((selected + 1) % photos.length)}>›</button></div></div>}</>;
}
