"use client"

import Link from "next/link"
import { Twitter, Linkedin } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Header(): React.ReactElement {
  return (
    <header className="py-4 px-8">
      <div className="mx-auto max-w-[640px] px-4">
        <div className="flex justify-end items-center space-x-2">
          <Link 
            href="https://x.com/choraria" 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <Button variant="ghost" size="icon">
              <Twitter className="h-5 w-5" />
              <span className="sr-only">Twitter</span>
            </Button>
          </Link>
          <Link 
            href="https://linkedin.com/in/choraria" 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <Button variant="ghost" size="icon">
              <Linkedin className="h-5 w-5" />
              <span className="sr-only">LinkedIn</span>
            </Button>
          </Link>
        </div>
      </div>
    </header>
  )
} 