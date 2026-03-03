'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import type { Sport, Creator, CreatorVideoWithRelations, VideoPlatform, AdStatus, Platform } from '@/lib/types'

type DialogMode = 'view' | 'edit' | 'add'

interface VideoDialogProps {
  open: boolean
  onClose: (refresh?: boolean) => void
  video: CreatorVideoWithRelations | null
  sports: Sport[]
  creators: Creator[]
  mode?: DialogMode
  onEditClick?: () => void
}

const platformOptions: { value: VideoPlatform; label: string }[] = [
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'other', label: 'Other' },
]

const statusOptions: { value: AdStatus; label: string }[] = [
  { value: 'running', label: 'Running' },
  { value: 'not_running', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'unknown', label: 'Unknown' },
]

const adPlatformOptions: { value: Platform; label: string }[] = [
  { value: 'meta', label: 'Meta' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'google', label: 'Google' },
]

export function VideoDialog({ open, onClose, video, sports, creators, mode = 'add', onEditClick }: VideoDialogProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isViewMode = mode === 'view'
  const [formData, setFormData] = useState({
    creator_id: '',
    sport_id: '',
    title: '',
    caption: '',
    platform: 'tiktok' as VideoPlatform,
    posted_link: '',
    drive_link: '',
    platform_code: '',
    ad_status: 'unknown' as AdStatus,
    ad_platforms: [] as Platform[],
    notes: '',
  })

  const supabase = createClient()

  useEffect(() => {
    if (video) {
      setFormData({
        creator_id: video.creator_id || '',
        sport_id: video.sport_id || '',
        title: video.title || '',
        caption: video.caption || '',
        platform: video.platform,
        posted_link: video.posted_link || '',
        drive_link: video.drive_link || '',
        platform_code: video.platform_code || '',
        ad_status: video.ad_status,
        ad_platforms: video.ad_platforms || [],
        notes: video.notes || '',
      })
    } else {
      setFormData({
        creator_id: '',
        sport_id: '',
        title: '',
        caption: '',
        platform: 'tiktok',
        posted_link: '',
        drive_link: '',
        platform_code: '',
        ad_status: 'unknown',
        ad_platforms: [],
        notes: '',
      })
    }
    setError(null)
  }, [video, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const data = {
      creator_id: formData.creator_id || null,
      sport_id: formData.sport_id || null,
      title: formData.title || null,
      caption: formData.caption || null,
      platform: formData.platform,
      posted_link: formData.posted_link || null,
      drive_link: formData.drive_link || null,
      platform_code: formData.platform_code || null,
      ad_status: formData.ad_status,
      ad_platforms: formData.ad_platforms.length > 0 ? formData.ad_platforms : null,
      notes: formData.notes || null,
    }

    let saveError
    if (video) {
      const result = await supabase
        .from('creator_videos')
        .update(data)
        .eq('id', video.id)
      saveError = result.error
    } else {
      const result = await supabase.from('creator_videos').insert(data)
      saveError = result.error
    }

    setSaving(false)

    if (!saveError) {
      onClose(true)
    } else {
      console.error('Error saving video:', saveError)
      setError(saveError.message || 'Failed to save video')
    }
  }

  const handleAdPlatformToggle = (platform: Platform) => {
    setFormData((prev) => ({
      ...prev,
      ad_platforms: prev.ad_platforms.includes(platform)
        ? prev.ad_platforms.filter((p) => p !== platform)
        : [...prev.ad_platforms, platform],
    }))
  }

  const dialogTitle = isViewMode ? 'Video Details' : video ? 'Edit Video' : 'Add Video'
  const dialogDescription = isViewMode
    ? 'View video information and tracking details.'
    : video ? 'Update the video details below.' : 'Add a new creator video to track.'

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive mt-2">
              {error}
            </div>
          )}

          <div className="grid gap-4 py-4 overflow-y-auto flex-1 pr-2">
            {isViewMode ? (
              // View mode - read-only display
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Creator</Label>
                    <p className="text-sm font-medium">{video?.creator_name || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Sport</Label>
                    <p className="text-sm font-medium">{video?.sport_name || '-'}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Title / Description</Label>
                  <p className="text-sm">{formData.title || '-'}</p>
                </div>

                {formData.caption && (
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Caption (for TikTok ad matching)</Label>
                    <p className="text-sm bg-muted p-2 rounded">{formData.caption}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Posted Platform</Label>
                    <p className="text-sm font-medium capitalize">{formData.platform}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Platform Code</Label>
                    <p className="text-sm">{formData.platform_code || '-'}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Posted Link</Label>
                  {formData.posted_link ? (
                    <a href={formData.posted_link} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline block truncate">
                      {formData.posted_link}
                    </a>
                  ) : (
                    <p className="text-sm">-</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Drive Link (Raw File)</Label>
                  {formData.drive_link ? (
                    <a href={formData.drive_link} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline block truncate">
                      {formData.drive_link}
                    </a>
                  ) : (
                    <p className="text-sm">-</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Ad Status</Label>
                  <Badge variant={formData.ad_status === 'running' ? 'default' : 'secondary'}>
                    {statusOptions.find(s => s.value === formData.ad_status)?.label || formData.ad_status}
                  </Badge>
                </div>

                {formData.ad_platforms.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Running on Ad Platforms</Label>
                    <div className="flex gap-2">
                      {formData.ad_platforms.map((p) => (
                        <Badge key={p} variant="outline">{adPlatformOptions.find(o => o.value === p)?.label || p}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {formData.notes && (
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Notes</Label>
                    <p className="text-sm whitespace-pre-wrap">{formData.notes}</p>
                  </div>
                )}
              </>
            ) : (
              // Edit/Add mode - form inputs
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="creator">Creator</Label>
                    <Select
                      value={formData.creator_id}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, creator_id: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select creator" />
                      </SelectTrigger>
                      <SelectContent>
                        {creators.map((creator) => (
                          <SelectItem key={creator.id} value={creator.id}>
                            {creator.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sport">Sport</Label>
                    <Select
                      value={formData.sport_id}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, sport_id: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select sport" />
                      </SelectTrigger>
                      <SelectContent>
                        {sports.map((sport) => (
                          <SelectItem key={sport.id} value={sport.id}>
                            {sport.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Title / Description</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, title: e.target.value }))
                    }
                    placeholder="Video title or description"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="caption">Caption (for TikTok ad matching)</Label>
                  <Textarea
                    id="caption"
                    value={formData.caption}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, caption: e.target.value }))
                    }
                    placeholder="e.g., Download the @SidelineSwap App now! #fyp #hockey #ad"
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">
                    Used to match TikTok ads where the ad name is the video caption
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="platform">Posted Platform</Label>
                    <Select
                      value={formData.platform}
                      onValueChange={(value: VideoPlatform) =>
                        setFormData((prev) => ({ ...prev, platform: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {platformOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="platform_code">Platform Code</Label>
                    <Input
                      id="platform_code"
                      value={formData.platform_code}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, platform_code: e.target.value }))
                      }
                      placeholder="e.g., TikTok code"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="posted_link">Posted Link</Label>
                  <Input
                    id="posted_link"
                    type="url"
                    value={formData.posted_link}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, posted_link: e.target.value }))
                    }
                    placeholder="https://tiktok.com/..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="drive_link">Drive Link (Raw File)</Label>
                  <Input
                    id="drive_link"
                    type="url"
                    value={formData.drive_link}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, drive_link: e.target.value }))
                    }
                    placeholder="https://drive.google.com/..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ad_status">Ad Status</Label>
                  <Select
                    value={formData.ad_status}
                    onValueChange={(value: AdStatus) =>
                      setFormData((prev) => ({ ...prev, ad_status: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Running on Ad Platforms</Label>
                  <div className="flex gap-4">
                    {adPlatformOptions.map((opt) => (
                      <div key={opt.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`ad-platform-${opt.value}`}
                          checked={formData.ad_platforms.includes(opt.value)}
                          onCheckedChange={() => handleAdPlatformToggle(opt.value)}
                        />
                        <Label
                          htmlFor={`ad-platform-${opt.value}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {opt.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    placeholder="Additional notes..."
                    rows={2}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="pt-4 border-t mt-4">
            {isViewMode ? (
              <>
                <Button type="button" variant="outline" onClick={() => onClose()}>
                  Close
                </Button>
                {onEditClick && (
                  <Button type="button" onClick={onEditClick}>
                    Edit
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => onClose()}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : video ? 'Update' : 'Add Video'}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
