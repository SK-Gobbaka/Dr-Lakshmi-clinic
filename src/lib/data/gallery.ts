export interface GalleryItem {
  id: string;
  title: string;
  image: string;
  category: string;
  aspectRatio: "square" | "portrait" | "landscape";
}

export const galleryItems: GalleryItem[] = [
  {
    id: "1",
    title: "Reception Area",
    image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&h=600&fit=crop",
    category: "Reception",
    aspectRatio: "landscape",
  },
  {
    id: "2",
    title: "Consultation Room",
    image: "https://images.unsplash.com/photo-1631217868264-e5b1bb5c9d7e?w=600&h=800&fit=crop",
    category: "Consultation Room",
    aspectRatio: "portrait",
  },
  {
    id: "3",
    title: "Treatment Room",
    image: "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=800&h=600&fit=crop",
    category: "Treatment Room",
    aspectRatio: "landscape",
  },
  {
    id: "4",
    title: "Advanced Equipment",
    image: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&h=600&fit=crop",
    category: "Equipment",
    aspectRatio: "square",
  },
  {
    id: "5",
    title: "Waiting Area",
    image: "https://images.unsplash.com/photo-1629909613654-28e377c37b62?w=800&h=500&fit=crop",
    category: "Waiting Area",
    aspectRatio: "landscape",
  },
  {
    id: "6",
    title: "Laser Suite",
    image: "https://images.unsplash.com/photo-1579684385127-1ef15d558a1a?w=600&h=800&fit=crop",
    category: "Treatment Room",
    aspectRatio: "portrait",
  },
];
