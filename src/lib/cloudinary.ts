/**
 * Cloudinary image URL helper.
 * Falls back to the original URL when Cloudinary is not configured.
 */
export function getCloudinaryUrl(
  publicId: string,
  options: { width?: number; height?: number; crop?: string } = {}
): string {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  if (!cloudName) {
    return publicId.startsWith("http") ? publicId : `https://placehold.co/600x400?text=${publicId}`;
  }

  const { width = 800, height, crop = "fill" } = options;
  const transforms = [`c_${crop}`, `w_${width}`, height ? `h_${height}` : "", "f_auto", "q_auto"]
    .filter(Boolean)
    .join(",");

  return `https://res.cloudinary.com/${cloudName}/image/upload/${transforms}/${publicId}`;
}
