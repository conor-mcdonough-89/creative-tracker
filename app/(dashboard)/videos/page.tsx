'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { VideoTable } from '@/components/videos/VideoTable'
import { VideoDialog } from '@/components/videos/VideoDialog'
import { Plus, Search } from 'lucide-react'
import type { Sport, Creator, CreatorVideoWithRelations, VideoPlatform, AdStatus } from '@/lib/types'

export default function VideosPage() {
  const [videos, setVideos] = useState<CreatorVideoWithRelations[]>([])
  const [sports, setSports] = useState<Sport[]>([])
  const [creators, setCreators] = useState<Creator[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [selectedSport, setSelectedSport] = useState<string>('all')
  const [selectedCreator, setSelectedCreator] = useState<string>('all')
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingVideo, setEditingVideo] = useState<CreatorVideoWithRelations | null>(null)
  const [dialogMode, setDialogMode] = useState<'view' | 'edit' | 'add'>('add')

  const supabase = createClient()

  const loadVideos = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('creator_videos_with_relations')
      .select('*')
      .order('created_at', { ascending: false })

    if (data && !error) {
      setVideos(data as CreatorVideoWithRelations[])
    }
    setLoading(false)
  }

  useEffect(() => {
    const loadData = async () => {
      const [sportsRes, creatorsRes] = await Promise.all([
        supabase.from('sports').select('*').order('name'),
        supabase.from('creators').select('*').order('name'),
      ])

      if (sportsRes.data) setSports(sportsRes.data as Sport[])
      if (creatorsRes.data) setCreators(creatorsRes.data as Creator[])
    }
    loadData()
    loadVideos()
  }, [supabase])

  // Filter videos
  const filteredVideos = useMemo(() => {
    return videos.filter((video) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase()
        const matchesSearch =
          video.title?.toLowerCase().includes(searchLower) ||
          video.creator_name?.toLowerCase().includes(searchLower) ||
          video.platform_code?.toLowerCase().includes(searchLower) ||
          video.posted_link?.toLowerCase().includes(searchLower)
        if (!matchesSearch) return false
      }

      // Sport filter
      if (selectedSport !== 'all' && video.sport_id !== selectedSport) {
        return false
      }

      // Creator filter
      if (selectedCreator !== 'all' && video.creator_id !== selectedCreator) {
        return false
      }

      // Platform filter
      if (selectedPlatform !== 'all' && video.platform !== selectedPlatform) {
        return false
      }

      // Status filter
      if (selectedStatus !== 'all' && video.ad_status !== selectedStatus) {
        return false
      }

      return true
    })
  }, [videos, search, selectedSport, selectedCreator, selectedPlatform, selectedStatus])

  const handleAddVideo = () => {
    setEditingVideo(null)
    setDialogMode('add')
    setDialogOpen(true)
  }

  const handleViewVideo = (video: CreatorVideoWithRelations) => {
    setEditingVideo(video)
    setDialogMode('view')
    setDialogOpen(true)
  }

  const handleEditVideo = (video: CreatorVideoWithRelations) => {
    setEditingVideo(video)
    setDialogMode('edit')
    setDialogOpen(true)
  }

  const handleDeleteVideo = async (videoId: string) => {
    const { error } = await supabase.from('creator_videos').delete().eq('id', videoId)
    if (!error) {
      loadVideos()
    }
  }

  const handleDialogClose = (refresh?: boolean) => {
    setDialogOpen(false)
    setEditingVideo(null)
    setDialogMode('add')
    if (refresh) {
      loadVideos()
    }
  }

  const handleSwitchToEdit = () => {
    setDialogMode('edit')
  }

  // Stats for the summary cards
  const stats = useMemo(() => {
    const running = videos.filter((v) => v.ad_status === 'running').length
    const notRunning = videos.filter((v) => v.ad_status === 'not_running').length
    const completed = videos.filter((v) => v.ad_status === 'completed').length
    const unknown = videos.filter((v) => v.ad_status === 'unknown').length
    return { total: videos.length, running, notRunning, completed, unknown }
  }, [videos])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Creator Videos</h1>
          <p className="text-muted-foreground">
            Track creator videos, ad status, and raw file locations
          </p>
        </div>
        <Button onClick={handleAddVideo}>
          <Plus className="mr-2 h-4 w-4" />
          Add Video
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Videos</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Running as Ads</p>
          <p className="text-2xl font-bold text-green-600">{stats.running}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Not Running</p>
          <p className="text-2xl font-bold text-gray-500">{stats.notRunning}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Completed</p>
          <p className="text-2xl font-bold text-blue-600">{stats.completed}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Unknown Status</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.unknown}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search videos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={selectedSport} onValueChange={setSelectedSport}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Sports" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sports</SelectItem>
            {sports.map((sport) => (
              <SelectItem key={sport.id} value={sport.id}>
                {sport.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedCreator} onValueChange={setSelectedCreator}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Creators" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Creators</SelectItem>
            {creators.map((creator) => (
              <SelectItem key={creator.id} value={creator.id}>
                {creator.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Platforms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            <SelectItem value="tiktok">TikTok</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="youtube">YouTube</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="not_running">Not Running</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="unknown">Unknown</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Video Table */}
      <VideoTable
        videos={filteredVideos}
        loading={loading}
        onView={handleViewVideo}
        onEdit={handleEditVideo}
        onDelete={handleDeleteVideo}
      />

      {/* Add/Edit/View Dialog */}
      <VideoDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        video={editingVideo}
        sports={sports}
        creators={creators}
        mode={dialogMode}
        onEditClick={handleSwitchToEdit}
      />
    </div>
  )
}
