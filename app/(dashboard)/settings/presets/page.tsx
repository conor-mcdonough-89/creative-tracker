'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Trash2 } from 'lucide-react'
import type { ColumnPreset, Platform } from '@/lib/types'
import { format } from 'date-fns'

const PLATFORM_LABELS: Record<Platform, string> = {
  meta: 'Meta',
  tiktok: 'TikTok',
  google: 'Google',
}

export default function PresetsPage() {
  const [presets, setPresets] = useState<ColumnPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    const loadPresets = async () => {
      const { data, error } = await supabase
        .from('column_presets')
        .select('*')
        .order('name')

      if (data && !error) {
        setPresets(data as ColumnPreset[])
      }
      setLoading(false)
    }
    loadPresets()
  }, [supabase])

  const handleDelete = async () => {
    if (!deleteId) return

    setDeleting(true)
    try {
      await supabase.from('column_presets').delete().eq('id', deleteId)
      setPresets(presets.filter((p) => p.id !== deleteId))
      setDeleteId(null)
    } finally {
      setDeleting(false)
    }
  }

  const getMappedFieldCount = (mappings: Record<string, string>): number => {
    return Object.values(mappings).filter((v) => v && v !== '__none__').length
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Column Presets</h1>
        <p className="text-muted-foreground">
          Manage saved column mapping presets for CSV uploads
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Mapped Fields</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : presets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No presets saved yet. Create one during CSV upload.
                </TableCell>
              </TableRow>
            ) : (
              presets.map((preset) => (
                <TableRow key={preset.id}>
                  <TableCell className="font-medium">{preset.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {PLATFORM_LABELS[preset.platform]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {getMappedFieldCount(preset.mappings as Record<string, string>)} fields
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(preset.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(preset.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Preset</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this preset? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
