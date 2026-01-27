'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Platform, Sport, Creator } from '@/lib/types'

interface FilterBarProps {
  platforms: Platform[]
  selectedPlatforms: Platform[]
  onPlatformsChange: (platforms: Platform[]) => void
  sports: Sport[]
  selectedSports: string[]
  onSportsChange: (sportIds: string[]) => void
  creators: Creator[]
  selectedCreators: string[]
  onCreatorsChange: (creatorIds: string[]) => void
}

const PLATFORM_LABELS: Record<Platform, string> = {
  meta: 'Meta',
  tiktok: 'TikTok',
  google: 'Google',
}

export function FilterBar({
  platforms,
  selectedPlatforms,
  onPlatformsChange,
  sports,
  selectedSports,
  onSportsChange,
  creators,
  selectedCreators,
  onCreatorsChange,
}: FilterBarProps) {
  const [platformOpen, setPlatformOpen] = useState(false)
  const [sportOpen, setSportOpen] = useState(false)
  const [creatorOpen, setCreatorOpen] = useState(false)
  const [creatorSearch, setCreatorSearch] = useState('')

  const filteredCreators = creators.filter(
    (c) =>
      c.name.toLowerCase().includes(creatorSearch.toLowerCase()) ||
      c.handle.toLowerCase().includes(creatorSearch.toLowerCase())
  )

  const hasFilters =
    selectedPlatforms.length > 0 ||
    selectedSports.length > 0 ||
    selectedCreators.length > 0

  const clearAllFilters = () => {
    onPlatformsChange([])
    onSportsChange([])
    onCreatorsChange([])
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Platform filter */}
      <Popover open={platformOpen} onOpenChange={setPlatformOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            <Plus className="mr-1 h-3 w-3" />
            Platform
            {selectedPlatforms.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {selectedPlatforms.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3">
          <div className="space-y-2">
            <p className="text-sm font-medium">Platforms</p>
            {platforms.map((platform) => (
              <div key={platform} className="flex items-center gap-2">
                <Checkbox
                  id={`platform-${platform}`}
                  checked={selectedPlatforms.includes(platform)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onPlatformsChange([...selectedPlatforms, platform])
                    } else {
                      onPlatformsChange(
                        selectedPlatforms.filter((p) => p !== platform)
                      )
                    }
                  }}
                />
                <Label htmlFor={`platform-${platform}`} className="text-sm">
                  {PLATFORM_LABELS[platform]}
                </Label>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Sport filter */}
      <Popover open={sportOpen} onOpenChange={setSportOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            <Plus className="mr-1 h-3 w-3" />
            Sport
            {selectedSports.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {selectedSports.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3">
          <div className="space-y-2">
            <p className="text-sm font-medium">Sports</p>
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {sports.map((sport) => (
                  <div key={sport.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`sport-${sport.id}`}
                      checked={selectedSports.includes(sport.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          onSportsChange([...selectedSports, sport.id])
                        } else {
                          onSportsChange(
                            selectedSports.filter((s) => s !== sport.id)
                          )
                        }
                      }}
                    />
                    <Label htmlFor={`sport-${sport.id}`} className="text-sm">
                      {sport.name}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </PopoverContent>
      </Popover>

      {/* Creator filter */}
      <Popover open={creatorOpen} onOpenChange={setCreatorOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            <Plus className="mr-1 h-3 w-3" />
            Creator
            {selectedCreators.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {selectedCreators.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3">
          <div className="space-y-2">
            <p className="text-sm font-medium">Creators</p>
            <Input
              placeholder="Search creators..."
              value={creatorSearch}
              onChange={(e) => setCreatorSearch(e.target.value)}
              className="h-8"
            />
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {filteredCreators.map((creator) => (
                  <div key={creator.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`creator-${creator.id}`}
                      checked={selectedCreators.includes(creator.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          onCreatorsChange([...selectedCreators, creator.id])
                        } else {
                          onCreatorsChange(
                            selectedCreators.filter((c) => c !== creator.id)
                          )
                        }
                      }}
                    />
                    <Label htmlFor={`creator-${creator.id}`} className="text-sm">
                      {creator.name}
                      <span className="text-muted-foreground ml-1">
                        @{creator.handle}
                      </span>
                    </Label>
                  </div>
                ))}
                {filteredCreators.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No creators found
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        </PopoverContent>
      </Popover>

      {/* Active filters */}
      {selectedPlatforms.map((platform) => (
        <Badge
          key={`filter-platform-${platform}`}
          variant="secondary"
          className="gap-1"
        >
          Platform: {PLATFORM_LABELS[platform]}
          <button
            onClick={() =>
              onPlatformsChange(selectedPlatforms.filter((p) => p !== platform))
            }
            className="hover:bg-muted rounded-full"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      {selectedSports.map((sportId) => {
        const sport = sports.find((s) => s.id === sportId)
        return (
          <Badge
            key={`filter-sport-${sportId}`}
            variant="secondary"
            className="gap-1"
          >
            Sport: {sport?.name}
            <button
              onClick={() =>
                onSportsChange(selectedSports.filter((s) => s !== sportId))
              }
              className="hover:bg-muted rounded-full"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )
      })}

      {selectedCreators.map((creatorId) => {
        const creator = creators.find((c) => c.id === creatorId)
        return (
          <Badge
            key={`filter-creator-${creatorId}`}
            variant="secondary"
            className="gap-1"
          >
            Creator: {creator?.name}
            <button
              onClick={() =>
                onCreatorsChange(selectedCreators.filter((c) => c !== creatorId))
              }
              className="hover:bg-muted rounded-full"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )
      })}

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-muted-foreground"
          onClick={clearAllFilters}
        >
          Clear all
        </Button>
      )}
    </div>
  )
}
