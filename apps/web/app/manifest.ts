import type { MetadataRoute } from "next";

/** Web App Manifest (PWA, mobile-first): cài BrewLite lên màn hình chính điện thoại. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BrewLite Coffee House",
    short_name: "BrewLite",
    description: "Đặt và thanh toán đồ uống không tiền mặt",
    id: "/",
    start_url: "/menu",
    display: "standalone",
    background_color: "#F8F5EF",
    theme_color: "#30271F",
    lang: "vi",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
