"use client"

import Link from 'next/link'
import { RefreshCw, Wifi } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function OfflinePage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md mx-auto text-center space-y-6">
        <div className="space-y-2">
          <Wifi className="h-16 w-16 mx-auto text-muted-foreground" />
          <h1 className="text-2xl font-bold">You&apos;re Offline</h1>
          <p className="text-muted-foreground">
            It looks like you&apos;ve lost your internet connection. Some features may not be available.
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg text-left space-y-2">
            <h3 className="font-semibold">What you can still do:</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• View previously recorded videos</li>
              <li>• Convert existing recordings to GIFs</li>
              <li>• Trim and edit videos you&apos;ve already created</li>
            </ul>
          </div>
          
          <div className="p-4 bg-muted rounded-lg text-left space-y-2">
            <h3 className="font-semibold">What requires internet:</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Loading FFmpeg libraries for first use</li>
              <li>• Downloading fonts for text overlays</li>
            </ul>
          </div>
        </div>

        <div className="space-y-3">
          <Button 
            onClick={() => window.location.reload()} 
            className="w-full"
            variant="default"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          
          <Button asChild variant="outline" className="w-full">
            <Link href="/">
              Return to GIF.new
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
} 