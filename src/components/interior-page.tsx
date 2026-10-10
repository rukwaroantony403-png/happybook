import Image from "next/image";
import Link from "next/link";

export function InteriorPage({
  eyebrow,
  title,
  intro,
  image,
  imageAlt,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  image: string;
  imageAlt: string;
}) {
  return <section className="interior-hero">
      <Image src={image} alt={imageAlt} fill priority sizes="100vw" />
      <div className="interior-shade" />
      <div className="wrap interior-hero-copy">
        <div className="interior-breadcrumb"><Link href="/">Home</Link><span>/</span>{eyebrow}</div>
        <span className="section-kicker">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{intro}</p>
        <Link className="gold-button" href="/book">Plan your stay <span aria-hidden="true">→</span></Link>
      </div>
    </section>;
}

export function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return <div className="interior-heading"><span className="section-kicker">{eyebrow}</span><h2>{title}</h2>{text && <p>{text}</p>}</div>;
}

export function PhotoCard({ image, imageAlt, title, text, href }: { image: string; imageAlt: string; title: string; text: string; href?: string }) {
  const contents = <><div className="photo-card-image"><Image src={image} alt={imageAlt} fill sizes="(max-width: 760px) 90vw, 32vw" /></div><div className="photo-card-copy"><h3>{title}</h3><p>{text}</p>{href && <span className="text-link">Discover <span aria-hidden="true">→</span></span>}</div></>;
  return href ? <Link className="photo-card" href={href}>{contents}</Link> : <article className="photo-card">{contents}</article>;
}

export function DetailBand({ eyebrow, title, text, image, imageAlt, reverse = false }: { eyebrow: string; title: string; text: string; image: string; imageAlt: string; reverse?: boolean }) {
  return <section className={`detail-band${reverse ? " reverse" : ""}`}><div className="detail-band-image"><Image src={image} alt={imageAlt} fill sizes="(max-width: 760px) 100vw, 48vw" /></div><div className="detail-band-copy"><span className="section-kicker">{eyebrow}</span><h2>{title}</h2><p>{text}</p></div></section>;
}
