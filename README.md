# GIF.new

**Instantly capture and create personal response GIFs.**

A modern Next.js application with PWA support, featuring webcam recording, video trimming, and GIF conversion using FFmpeg WebAssembly.

## ✨ Features

- 📹 **Webcam Recording**: 10-second video capture with countdown
- ✂️ **Video Trimming**: Precise video editing with timeline controls
- 🎨 **Text Overlays**: Add custom text to your GIFs
- 📱 **PWA Support**: Install on mobile devices, works offline
- 🚀 **Performance Optimized**: Service worker caching, image optimization
- 🌙 **Dark/Light Theme**: Automatic theme switching
- 📊 **Analytics**: Built-in Google Analytics integration

## 🛠 Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript with strict ESLint configuration
- **Styling**: Tailwind CSS with Shadcn UI components
- **PWA**: next-pwa with Workbox
- **Video Processing**: FFmpeg WebAssembly
- **Theme**: next-themes
- **Analytics**: Google Analytics 4

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm, yarn, pnpm, or bun

### Development

1. **Clone the repository**
```bash
git clone https://github.com/choraria/gif-new.git
cd gif-new
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables** (optional)
```bash
cp env.template .env.local
```
Add your Google Analytics ID if you want to use a different one:
```
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-YOUR-GA-ID
```

4. **Run the development server**
```bash
npm run dev
```

5. **Open [http://localhost:3000](http://localhost:3000)** in your browser

### Build

```bash
# Build the project
npm run build

# The static export will be in the /out directory
```

## 📋 Deployment on GitHub Pages

This project is configured for static export and automatic deployment to GitHub Pages via GitHub Actions.

### Setup

1. **Enable GitHub Pages**:
   - Go to your repository Settings → Pages
   - Under "Source", select "GitHub Actions"

2. **Enable GitHub Actions** (if needed):
   - Go to Settings → Actions → General
   - Under "Workflow permissions", select "Read and write permissions"
   - Save changes

3. **Automatic Deployment**:
   - Every push to `main` will automatically build and deploy
   - The workflow builds the Next.js app as static files
   - Deployment typically takes 2-5 minutes

### Access Your Site

After deployment, your site will be available at:
- `https://choraria.github.io/gif-new/` (or your custom domain if configured)

## 🎯 Features Overview

### PWA Support
- ✅ Service worker automatically deployed to `/sw.js`
- ✅ Manifest accessible at `/site.webmanifest`
- ✅ Offline fallback page at `/offline`
- ✅ Static asset caching for performance

### Performance
- ✅ Optimized static export for GitHub Pages
- ✅ Compressed assets and responses
- ✅ Optimized chunk splitting
- ✅ FFmpeg libraries cached for offline use

## 🛠 Troubleshooting

### If Build Fails:
```bash
# Test locally first
npm run build

# Check for linting errors
npm run lint

# Verify all dependencies
npm install
```

### If PWA Features Don't Work:
- Ensure you're testing on HTTPS (GitHub Pages provides this automatically)
- Clear browser cache and service workers
- Check Network tab for service worker registration

### If FFmpeg Fails:
- Check if the domain allows SharedArrayBuffer
- Ensure service worker isn't blocking FFmpeg requests
- Verify browser supports WebAssembly

## 📚 Learn More

To learn more about the technologies used:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API
- [PWA Documentation](https://web.dev/progressive-web-apps/) - Progressive Web App concepts
- [FFmpeg WebAssembly](https://ffmpegwasm.netlify.app/) - Video processing in the browser
- [Shadcn/ui](https://ui.shadcn.com/) - Beautiful UI components

---

**Live at**: [https://choraria.github.io/gif-new/](https://choraria.github.io/gif-new/)
