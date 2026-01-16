const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Create SVG templates for light and dark modes
const createSVG = (color) => `<svg
  xmlns="http://www.w3.org/2000/svg"
  width="32"
  height="32"
  viewBox="0 0 24 24"
  fill="none"
  stroke="${color}"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="m11 16-5 5"/>
  <path d="M11 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6.5"/>
  <path d="M15.765 22a.5.5 0 0 1-.765-.424V13.38a.5.5 0 0 1 .765-.424l5.878 3.674a1 1 0 0 1 0 1.696z"/>
  <circle cx="9" cy="9" r="2"/>
</svg>`;

const lightSVG = createSVG('black');
const darkSVG = createSVG('white');

// Ensure the public directory exists
const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir);
}

// Function to create PNG files
async function createPNG(size, outputName, isDark = false) {
  const svg = isDark ? darkSVG : lightSVG;
  const prefix = isDark ? 'dark-' : '';
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(path.join(publicDir, `${prefix}${outputName}`));
  console.log(`Generated ${prefix}${outputName}`);
}

// Generate favicon.ico for both modes
async function createICO(isDark = false) {
  const svg = isDark ? darkSVG : lightSVG;
  const prefix = isDark ? 'dark-' : '';
  
  const [buffer16, buffer32] = await Promise.all([
    sharp(Buffer.from(svg))
      .resize(16, 16)
      .toBuffer(),
    sharp(Buffer.from(svg))
      .resize(32, 32)
      .toBuffer()
  ]);

  const size16Header = Buffer.from([
    0, 0, // Reserved
    1, 0, // ICO format
    2, 0, // 2 images
    // Image 1 (16x16)
    16, 16, // Width, height
    0, // Color palette
    0, // Reserved
    1, 0, // Color planes
    32, 0, // Bits per pixel
    buffer16.length & 0xFF, (buffer16.length >> 8) & 0xFF, (buffer16.length >> 16) & 0xFF, (buffer16.length >> 24) & 0xFF, // Size
    22, 0, 0, 0 // Offset
  ]);

  const size32Header = Buffer.from([
    // Image 2 (32x32)
    32, 32, // Width, height
    0, // Color palette
    0, // Reserved
    1, 0, // Color planes
    32, 0, // Bits per pixel
    buffer32.length & 0xFF, (buffer32.length >> 8) & 0xFF, (buffer32.length >> 16) & 0xFF, (buffer32.length >> 24) & 0xFF, // Size
    22 + buffer16.length, 0, 0, 0 // Offset
  ]);

  const ico = Buffer.concat([
    size16Header,
    size32Header,
    buffer16,
    buffer32
  ]);

  fs.writeFileSync(path.join(publicDir, `${prefix}favicon.ico`), ico);
  console.log(`Generated ${prefix}favicon.ico`);
}

// Create site.webmanifest for both modes
function createWebManifest(isDark = false) {
  const prefix = isDark ? 'dark-' : '';
  const manifest = {
    name: 'GIF.new',
    short_name: 'GIF.new',
    icons: [
      {
        src: `/${prefix}android-chrome-192x192.png`,
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: `/${prefix}android-chrome-512x512.png`,
        sizes: '512x512',
        type: 'image/png'
      }
    ],
    theme_color: isDark ? '#000000' : '#ffffff',
    background_color: isDark ? '#000000' : '#ffffff',
    display: 'standalone'
  };

  fs.writeFileSync(
    path.join(publicDir, `${prefix}site.webmanifest`),
    JSON.stringify(manifest, null, 2)
  );
  console.log(`Generated ${prefix}site.webmanifest`);
}

// Generate all assets for both modes
async function generateAll() {
  try {
    // Generate light mode assets
    console.log('\nGenerating light mode assets...');
    await Promise.all([
      createPNG(16, 'favicon-16x16.png'),
      createPNG(32, 'favicon-32x32.png'),
      createPNG(192, 'android-chrome-192x192.png'),
      createPNG(512, 'android-chrome-512x512.png'),
      createPNG(180, 'apple-touch-icon.png'),
    ]);
    await createICO();
    createWebManifest();

    // Generate dark mode assets
    console.log('\nGenerating dark mode assets...');
    await Promise.all([
      createPNG(16, 'favicon-16x16.png', true),
      createPNG(32, 'favicon-32x32.png', true),
      createPNG(192, 'android-chrome-192x192.png', true),
      createPNG(512, 'android-chrome-512x512.png', true),
      createPNG(180, 'apple-touch-icon.png', true),
    ]);
    await createICO(true);
    createWebManifest(true);

    console.log('\nAll favicon assets generated successfully!');
  } catch (err) {
    console.error('Error generating favicon assets:', err);
    process.exit(1);
  }
}

generateAll(); 