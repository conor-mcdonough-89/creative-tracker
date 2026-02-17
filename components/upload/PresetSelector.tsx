'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Save, Pencil, Trash2 } from 'lucide-react'
import type { ColumnPreset, Platform } from '@/lib/types'

interface PresetSelectorProps {
  platform: Platform
  presets: ColumnPreset[]
  selectedPreset: ColumnPreset | null
  onSelectPreset: (preset: ColumnPreset | null) => void
  onSavePreset: (name: string) => Promise<void>
  onUpdatePreset?: (presetId: string, mappings: Record<string, string>) => Promise<void>
  onDeletePreset?: (presetId: string) => Promise<void>
  currentMappings: Record<string, string>
}

export function PresetSelector({
  platform,
  presets,
  selectedPreset,
  onSelectPreset,
  onSavePreset,
  onUpdatePreset,
  onDeletePreset,
  currentMappings,
}: PresetSelectorProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [saving, setSaving] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const filteredPresets = presets.filter((p) => p.platform === platform)

  const handleSave = async () => {
    if (!presetName.trim()) return

    setSaving(true)
    try {
      await onSavePreset(presetName.trim())
      setSaveDialogOpen(false)
      setPresetName('')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedPreset || !onUpdatePreset) return

    setUpdating(true)
    try {
      await onUpdatePreset(selectedPreset.id, currentMappings)
    } finally {
      setUpdating(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedPreset || !onDeletePreset) return

    setDeleting(true)
    try {
      await onDeletePreset(selectedPreset.id)
    } finally {
      setDeleting(false)
    }
  }

  // Check if current mappings differ from selected preset
  const hasChanges = selectedPreset && JSON.stringify(currentMappings) !== JSON.stringify(selectedPreset.mappings)

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label htmlFor="preset">Load Preset</Label>
          <Select
            value={selectedPreset?.id || '__none__'}
            onValueChange={(value) => {
              if (value === '__none__') {
                onSelectPreset(null)
              } else {
                const preset = presets.find((p) => p.id === value)
                if (preset) {
                  onSelectPreset(preset)
                }
              }
            }}
          >
            <SelectTrigger id="preset">
              <SelectValue placeholder="Select a preset..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">-- No preset --</SelectItem>
              {filteredPresets.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Update button - only show if a preset is selected and there are changes */}
        {selectedPreset && onUpdatePreset && (
          <Button
            variant="outline"
            onClick={handleUpdate}
            disabled={updating || !hasChanges}
            title={hasChanges ? 'Save changes to this preset' : 'No changes to save'}
          >
            <Pencil className="mr-2 h-4 w-4" />
            {updating ? 'Saving...' : 'Update'}
          </Button>
        )}

        {/* Delete button - only show if a preset is selected */}
        {selectedPreset && onDeletePreset && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={deleting}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Preset</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete &quot;{selectedPreset.name}&quot;? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  {deleting ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Save as new preset */}
        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Save className="mr-2 h-4 w-4" />
              Save as New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Column Mapping Preset</DialogTitle>
              <DialogDescription>
                Save the current column mappings as a new preset for future uploads.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="preset-name">Preset Name</Label>
                <Input
                  id="preset-name"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder={`e.g., "${platform === 'meta' ? 'Meta Ads Manager Export' : platform === 'tiktok' ? 'TikTok Business Center Export' : 'Google Ads Export'}"`}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || !presetName.trim()}>
                {saving ? 'Saving...' : 'Save Preset'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Show indicator when changes are pending */}
      {selectedPreset && hasChanges && (
        <p className="text-sm text-muted-foreground">
          You have unsaved changes to this preset. Click &quot;Update&quot; to save or &quot;Save as New&quot; to create a new preset.
        </p>
      )}
    </div>
  )
}
