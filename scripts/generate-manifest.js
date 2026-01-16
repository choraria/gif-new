const fs = require('fs');
const path = require('path');

// No basePath - custom domain (gif.new) serves at root
const basePath = '';

const manifest = {
  name: "GIF.new - Personal Response GIF Creator",
  short_name: "GIF.new",
  description: "Instantly capture and create personal response GIFs from your camera",
  start_url: "/",
  display: "standalone",
  background_color: "#ffffff",
  theme_color: "#000000",
  orientation: "portrait-primary",
  scope: "/",
  lang: "en",
  categories: ["entertainment", "utilities", "multimedia"],
  icons: [
    {
      src: "/android-chrome-192x192.png",
      sizes: "192x192",
      type: "image/png"
    },
    {
      src: "/android-chrome-512x512.png",
      sizes: "512x512",
      type: "image/png"
    },
    {
      src: "/android-chrome-192x192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any maskable"
    },
    {
      src: "/android-chrome-512x512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any maskable"
    }
  ],
  screenshots: [
    {
      src: "/screenshot-wide.png",
      sizes: "1280x720",
      type: "image/png",
      form_factor: "wide",
      label: "GIF.new main interface on desktop"
    },
    {
      src: "/screenshot-narrow.png",
      sizes: "390x844",
      type: "image/png",
      form_factor: "narrow",
      label: "GIF.new mobile interface"
    }
  ],
  shortcuts: [
    {
      name: "Create GIF",
      short_name: "Create",
      description: "Start creating a new GIF",
      url: "/",
      icons: [
        {
          src: "/android-chrome-192x192.png",
          sizes: "192x192"
        }
      ]
    }
  ],
  share_target: {
    action: "/",
    method: "GET",
    enctype: "application/x-www-form-urlencoded",
    params: {
      title: "title",
      text: "text",
      url: "url"
    }
  },
  prefer_related_applications: false
};

// Write manifest to public folder
const manifestPath = path.join(__dirname, '../public/site.webmanifest');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`✅ Generated manifest (no basePath - serving at root)`);
