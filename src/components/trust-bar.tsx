"use client"

import { ShieldCheck, Lock, Zap, Github } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = { className?: string }

const items = [
  { icon: ShieldCheck, label: "100% offline" },
  { icon: Lock, label: "No uploads, no tracking" },
  { icon: Zap, label: "Fast in-browser rendering" },
  { icon: Github, label: "Open source (MIT)" },
]

export function TrustBar({ className }: Props) {
  return (
    <div className={cn("w-full rounded-lg border bg-card px-4 py-3", className)}>
      <ul className="flex flex-wrap justify-around items-center text-xs text-muted-foreground md:gap-6">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2">
            <item.icon className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
