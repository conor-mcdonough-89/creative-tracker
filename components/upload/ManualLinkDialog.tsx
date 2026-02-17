'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Link2, User } from 'lucide-react'

interface CreatorVideo {
  id: string
  title: string | null
  caption: string | null
  platform: string
  creator_id: string
  creator_name: string
  creator_handle: string | null
}

interface ManualLinkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  adName: string
  onLink: (creatorId: string, creatorName: string) => Promise<void>
}

export function ManualLinkDialog({
  open,
  onOpenChange,
  adName,
  onLink,
}: ManualLinkDialogProps) {
  const [videos, setVideos] = useState<CreatorVideo[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [linking, setLinking] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    if (open) {
      loadVideos()
    }
  }, [open])

  const loadVideos = async () => {
    setLoading(true)

    const { data } = await supabase
      .from('creator_videos_with_relations')
      .select('id, title, caption, platform, creator_id, creator_name, creator_handle')
      .order('created_at', { ascending: false })

    setVideos((data as CreatorVideo[]) || [])
    setLoading(false)
  }

  const handleLink = async (video: CreatorVideo) => {
    setLinking(video.id)
    try {
      await onLink(video.creator_id, video.creator_name)
      onOpenChange(false)
    } finally {
      setLinking(null)
    }
  }

  // Filter videos based on search query
  const filteredVideos = videos.filter((video) => {
    const query = searchQuery.toLowerCase()
    return (
      (video.title?.toLowerCase().includes(query) ?? false) ||
      (video.caption?.toLowerCase().includes(query) ?? false) ||
      video.creator_name.toLowerCase().includes(query) ||
      (video.creator_handle?.toLowerCase().includes(query) ?? false)
    )
  })

  // Group videos by creator for better UX
  const videosByCreator = filteredVideos.reduce((acc, video) => {
    const key = video.creator_id
    if (!acc[key]) {
      acc[key] = {
        creator_id: video.creator_id,
        creator_name: video.creator_name,
        creator_handle: video.creator_handle,
        videos: [],
      }
    }
    acc[key].videos.push(video)
    return acc
  }, {} as Record<string, { creator_id: string; creator_name: string; creator_handle: string | null; videos: CreatorVideo[] }>)

  const creators = Object.values(videosByCreator)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Link Ad to Creator
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">Select a creator video to link this ad to its creator.</span>
            <span className="block font-mono text-xs bg-muted p-2 rounded break-all">
              {adName}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by creator name, video title, or caption..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex-1 overflow-y-auto border rounded-lg min-h-0">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground">Loading videos...</div>
          ) : creators.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              {searchQuery ? 'No matching videos found' : 'No creator videos available'}
            </div>
          ) : (
            <div className="divide-y">
              {creators.map((creator) => (
                <div key={creator.creator_id} className="p-3 hover:bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{creator.creator_name}</span>
                      {creator.creator_handle && (
                        <span className="text-sm text-muted-foreground">
                          @{creator.creator_handle}
                        </span>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {creator.videos.length} video{creator.videos.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleLink(creator.videos[0])}
                      disabled={linking !== null}
                    >
                      {linking === creator.videos[0].id ? 'Linking...' : 'Link to Creator'}
                    </Button>
                  </div>
                  <div className="space-y-1 ml-6">
                    {creator.videos.slice(0, 3).map((video) => (
                      <div
                        key={video.id}
                        className="text-sm text-muted-foreground truncate"
                        title={video.caption || video.title || 'Untitled'}
                      >
                        <Badge variant="outline" className="mr-2 text-xs">
                          {video.platform}
                        </Badge>
                        {video.caption || video.title || 'Untitled video'}
                      </div>
                    ))}
                    {creator.videos.length > 3 && (
                      <div className="text-xs text-muted-foreground">
                        +{creator.videos.length - 3} more video{creator.videos.length - 3 !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
