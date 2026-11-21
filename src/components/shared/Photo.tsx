import Image from "next/image";
import { cn } from "@/lib/utils";

const initials = (name: string) =>
  name
    .replace(/^(dr|mr|mrs|ms)\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

/**
 * A photo the clinic uploaded, or the person's initials until one is added. Uploaded photos are already small
 * (2 MB limit), so they are served as they are (`unoptimized`); this also works on hosts without an image optimiser.
 * Give it either `width` and `height`, or `fill` inside a positioned parent.
 */
export function Photo({
  src,
  alt,
  fallbackName,
  width,
  height,
  fill,
  sizes,
  priority,
  className,
}: {
  src: string;
  alt: string;
  fallbackName: string;
  width?: number;
  height?: number;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  if (!src) {
    return (
      <div role="img" aria-label={alt || fallbackName} className={cn("flex items-center justify-center bg-sand font-heading text-2xl font-semibold text-primary", fill && "absolute inset-0", className)} style={fill ? undefined : { width, height }}>
        {initials(fallbackName) || "?"}
      </div>
    );
  }
  return fill ? (
    <Image src={src} alt={alt} fill sizes={sizes} priority={priority} unoptimized className={className} />
  ) : (
    <Image src={src} alt={alt} width={width ?? 96} height={height ?? 96} priority={priority} unoptimized className={className} />
  );
}
