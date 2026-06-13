"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/components/ThemeProvider"
import { Button } from "@/components/ui/Button"

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}
      className={`relative ${className ?? ""}`}
      aria-label="Toggle theme"
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 opacity-100 transition-[opacity,transform] duration-[160ms] ease-[var(--ease-out)] dark:-rotate-90 dark:scale-95 dark:opacity-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-95 opacity-0 transition-[opacity,transform] duration-[160ms] ease-[var(--ease-out)] dark:rotate-0 dark:scale-100 dark:opacity-100" />
    </Button>
  )
}
