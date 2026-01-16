"use client"

import { useState } from "react"

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  placeholder?: string
  className?: string
}

export function ColorPicker({ value, onChange, placeholder = "#ffffff", className = "" }: ColorPickerProps): React.ReactElement {
  const [isValid, setIsValid] = useState(true)

  const handleTextChange = (newValue: string): void => {
    // Validate hex color format
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
    const valid = hexRegex.test(newValue) || newValue === ""
    setIsValid(valid)
    
    if (valid) {
      onChange(newValue)
    }
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-12 h-10 border rounded-md cursor-pointer"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => handleTextChange(e.target.value)}
        className={`flex-1 px-3 py-2 border rounded-md font-mono text-sm ${
          !isValid ? 'border-red-500 bg-red-50' : ''
        }`}
        placeholder={placeholder}
      />
    </div>
  )
} 