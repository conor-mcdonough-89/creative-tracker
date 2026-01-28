'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Film,
  Upload,
  Settings,
  FileText,
  Trophy,
  ChevronDown,
  Video,
  SlidersHorizontal,
} from 'lucide-react'
import { useState } from 'react'

const navigation = [
  {
    name: 'Overview',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Creators',
    href: '/creators',
    icon: Users,
  },
  {
    name: 'Creator Videos',
    href: '/videos',
    icon: Video,
  },
  {
    name: 'Ad Creatives',
    href: '/ads',
    icon: Film,
  },
  {
    name: 'Upload Data',
    href: '/upload',
    icon: Upload,
  },
]

const settingsNavigation = [
  {
    name: 'Column Presets',
    href: '/settings/presets',
    icon: FileText,
  },
  {
    name: 'Sports',
    href: '/settings/sports',
    icon: Trophy,
  },
  {
    name: 'Platform Adjustments',
    href: '/settings/adjustments',
    icon: SlidersHorizontal,
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [settingsOpen, setSettingsOpen] = useState(
    pathname.startsWith('/settings')
  )

  return (
    <div className="flex h-full w-64 flex-col border-r bg-sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Film className="h-6 w-6 text-sidebar-primary" />
          <span className="font-semibold text-sidebar-foreground">
            Creative Tracker
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          )
        })}

        {/* Settings dropdown */}
        <div className="pt-4">
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className={cn(
              'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname.startsWith('/settings')
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}
          >
            <div className="flex items-center gap-3">
              <Settings className="h-4 w-4" />
              Settings
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform',
                settingsOpen && 'rotate-180'
              )}
            />
          </button>

          {settingsOpen && (
            <div className="ml-4 mt-1 space-y-1 border-l pl-4">
              {settingsNavigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </nav>
    </div>
  )
}
