export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  featuredImage: string;
  modelUrl: string;
}

// TODO: swap modelUrl to CloudFront CDN URL (cdn.skyvaultuk.com) when CloudFront is set up
const PUBLIC_ASSETS_BASE =
  "https://skyvault-public-assets-786971594750.s3.eu-west-2.amazonaws.com";

export const blogPosts: BlogPost[] = [
  {
    slug: "3d-roof-survey-demo",
    title: "Inside a SkyVault Pro Survey — Interactive 3D Roof Model",
    description:
      "See how drone capture and photogrammetry produces a fully interactive 3D model of any property roof.",
    date: "June 2026",
    tags: ["Pro Survey", "Technology"],
    featuredImage: "/images/blog/miles-and-katies-orthophoto.jpg",
    modelUrl: `${PUBLIC_ASSETS_BASE}/blog/models/miles-and-katies/model.glb`,
  },
];
