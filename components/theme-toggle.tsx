"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { trackThemeChange, event, ANALYTICS_EVENTS } from "@/lib/analytics"

export function ThemeToggle(): React.ReactElement {
  const { theme, setTheme } = useTheme()

  const handleThemeChange = (newTheme: string): void => {
    setTheme(newTheme);
    trackThemeChange(newTheme);
    event({
      action: ANALYTICS_EVENTS.THEME_TOGGLE,
      category: 'User Preference',
      label: `Switch to ${newTheme} theme`,
    });
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => handleThemeChange(theme === "light" ? "dark" : "light")}
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
} 