import Link from "next/link"
import { Header } from "@/components/header"
import { ThemeToggle } from "@/components/theme-toggle"
import { VideoRecorder } from "@/components/video-recorder"

export default function Home(): React.ReactElement {
  return (
    <main className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="flex-1 p-8">
        <div className="mx-auto max-w-[640px]">
          <VideoRecorder />
        </div>
      </div>
      <footer className="py-4 px-8 bg-background">
        <div className="mx-auto max-w-[640px] px-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              Made by{" "}
              <Link 
                href="https://x.com/choraria" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-foreground"
              >
                @choraria
              </Link>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </footer>
    </main>
  )
}
