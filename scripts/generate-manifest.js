const fs = require('fs');
const path = require('path');

// Determine basePath based on environment
const isProduction = process.env.NODE_ENV === 'production';
const basePath = isProduction ? '/gif-new' : '';

const manifest = {
  name: "GIF.new - Personal Response GIF Creator",
  short_name: "GIF.new",
  description: "Instantly capture and create personal response GIFs from your camera",
  start_url: `${basePath}/`,
  display: "standalone",
  background_color: "#ffffff",
  theme_color: "#000000",
  orientation: "portrait-primary",
  scope: `${basePath}/`,
  lang: "en",
  categories: ["entertainment", "utilities", "multimedia"],
  icons: [
    {
      src: `${basePath}/android-chrome-192x192.png`,
      sizes: "192x192",
      type: "image/png"
    },
    {
      src: `${basePath}/android-chrome-512x512.png`,
      sizes: "512x512",
      type: "image/png"
    },
    {
      src: `${basePath}/android-chrome-192x192.png`,
      sizes: "192x192",
      type: "image/png",
      purpose: "any maskable"
    },
    {
      src: `${basePath}/android-chrome-512x512.png`,
      sizes: "512x512",
      type: "image/png",
      purpose: "any maskable"
    }
  ],
  screenshots: [
    {
      src: `${basePath}/screenshot-wide.png`,
      sizes: "1280x720",
      type: "image/png",
      form_factor: "wide",
      label: "GIF.new main interface on desktop"
    },
    {
      src: `${basePath}/screenshot-narrow.png`,
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
      url: `${basePath}/`,
      icons: [
        {
          src: `${basePath}/android-chrome-192x192.png`,
          sizes: "192x192"
        }
      ]
    }
  ],
  share_target: {
    action: `${basePath}/`,
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
console.log(`✅ Generated manifest with basePath: "${basePath || '(none)'}"`);
