import { CSSProperties, useState } from "react";

/**
 * The Vibetube lockup.
 *
 * The supplied artwork is a raster trace, so its wordmark is baked in as
 * hundreds of near-black fills and cannot be recoloured from CSS.
 * `logo-dark.svg` is a generated variant with every dark tone reflected up
 * around mid-lightness, hue and saturation preserved; the right file is chosen
 * by theme rather than rendering both and hiding one, which would still cost
 * the download.
 *
 * The travelling sweep in `.logo-shine` is masked with the same file, so the
 * light runs through the letterforms instead of over a rectangle.
 *
 * Falls back to a type-only wordmark if the asset is missing.
 */
interface LogoProps {
  /** Sizing classes for the wrapper. */
  className?: string;
  theme: "dark" | "light";
  /** Adds the glint sweep. Off for small or incidental placements. */
  shine?: boolean;
}

export const Logo = ({ className, theme, shine = true }: LogoProps) => {
  const [assetMissing, setAssetMissing] = useState(false);
  const src = theme === "dark" ? "/vibetube_ads_logo_dark.png" : "/vibetube_ads_logo.png";

  if (assetMissing) {
    // Sized in type units rather than reusing the image's width classes.
    return (
      <span className="font-display font-black tracking-tighter holo-text text-4xl md:text-5xl">
        Vibetube
      </span>
    );
  }

  return (
    <span
      className={`logo-wrap ${className ?? ""}`}
      style={{ "--logo-mask": `url(${src})` } as CSSProperties}
    >
      <img src={src} alt="Vibetube" className="rounded-md" onError={() => setAssetMissing(true)} />
      {shine && <span className="logo-shine" aria-hidden="true" />}
    </span>
  );
};
