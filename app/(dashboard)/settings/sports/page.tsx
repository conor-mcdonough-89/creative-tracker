'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { Sport } from '@/lib/types'

export default function SportsPage() {
  const [sports, setSports] = useState<Sport[]>([])
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [currentSport, setCurrentSport] = useState<Sport | null>(null)
  const [sportName, setSportName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    const loadSports = async () => {
      const { data, error } = await supabase
        .from('sports')
        .select('*')
        .order('name')

      if (data && !error) {
        setSports(data as Sport[])
      }
      setLoading(false)
    }
    loadSports()
  }, [supabase])

  const handleAdd = async () => {
    if (!sportName.trim()) return

    setSaving(true)
    setError(null)

    try {
      const { data, error: insertError } = await supabase
        .from('sports')
        .insert({ name: sportName.trim() })
        .select()
        .single()

      if (insertError) {
        if (insertError.code === '23505') {
          setError('A sport with this name already exists')
          return
        }
        throw insertError
      }

      setSports([...sports, data as Sport].sort((a, b) => a.name.localeCompare(b.name)))
      setSportName('')
      setAddDialogOpen(false)
    } catch (err) {
      setError('Failed to add sport')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async () => {
    if (!currentSport || !sportName.trim()) return

    setSaving(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('sports')
        .update({ name: sportName.trim() })
        .eq('id', currentSport.id)

      if (updateError) {
        if (updateError.code === '23505') {
          setError('A sport with this name already exists')
          return
        }
        throw updateError
      }

      setSports(
        sports
          .map((s) => (s.id === currentSport.id ? { ...s, name: sportName.trim() } : s))
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      setSportName('')
      setCurrentSport(null)
      setEditDialogOpen(false)
    } catch (err) {
      setError('Failed to update sport')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!currentSport) return

    setSaving(true)
    setError(null)

    try {
      // Check if sport is in use
      const { count } = await supabase
        .from('ad_performance')
        .select('*', { count: 'exact', head: true })
        .eq('sport_id', currentSport.id)

      if (count && count > 0) {
        setError(`Cannot delete: ${count} ads are using this sport. Reassign them first.`)
        return
      }

      const { error: deleteError } = await supabase
        .from('sports')
        .delete()
        .eq('id', currentSport.id)

      if (deleteError) throw deleteError

      setSports(sports.filter((s) => s.id !== currentSport.id))
      setCurrentSport(null)
      setDeleteDialogOpen(false)
    } catch (err) {
      setError('Failed to delete sport')
    } finally {
      setSaving(false)
    }
  }

  const openEditDialog = (sport: Sport) => {
    setCurrentSport(sport)
    setSportName(sport.name)
    setError(null)
    setEditDialogOpen(true)
  }

  const openDeleteDialog = (sport: Sport) => {
    setCurrentSport(sport)
    setError(null)
    setDeleteDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sports</h1>
          <p className="text-muted-foreground">
            Manage sports categories for ad tagging
          </p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={(open) => {
          setAddDialogOpen(open)
          if (!open) {
            setSportName('')
            setError(null)
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Sport
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Sport</DialogTitle>
              <DialogDescription>
                Create a new sport category for ad tagging
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {error && (
                <div className="text-sm text-destructive">{error}</div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="sport-name">Name</Label>
                <Input
                  id="sport-name"
                  value={sportName}
                  onChange={(e) => setSportName(e.target.value)}
                  placeholder="e.g., Volleyball"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAdd()
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={saving || !sportName.trim()}>
                {saving ? 'Adding...' : 'Add Sport'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                </TableRow>
              ))
            ) : sports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                  No sports found
                </TableCell>
              </TableRow>
            ) : (
              sports.map((sport) => (
                <TableRow key={sport.id}>
                  <TableCell className="font-medium">{sport.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(sport)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => openDeleteDialog(sport)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open)
        if (!open) {
          setSportName('')
          setCurrentSport(null)
          setError(null)
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sport</DialogTitle>
            <DialogDescription>
              Update the sport name
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {error && (
              <div className="text-sm text-destructive">{error}</div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="edit-sport-name">Name</Label>
              <Input
                id="edit-sport-name"
                value={sportName}
                onChange={(e) => setSportName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleEdit()
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={saving || !sportName.trim()}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open)
        if (!open) {
          setCurrentSport(null)
          setError(null)
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Sport</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{currentSport?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
