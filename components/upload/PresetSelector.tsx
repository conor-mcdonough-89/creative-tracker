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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Save } from 'lucide-react'
import type { ColumnPreset, Platform } from '@/lib/types'

interface PresetSelectorProps {
  platform: Platform
  presets: ColumnPreset[]
  selectedPreset: ColumnPreset | null
  onSelectPreset: (preset: ColumnPreset | null) => void
  onSavePreset: (name: string) => Promise<void>
  currentMappings: Record<string, string>
}

export function PresetSelector({
  platform,
  presets,
  selectedPreset,
  onSelectPreset,
  onSavePreset,
  currentMappings,
}: PresetSelectorProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [saving, setSaving] = useState(false)

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

  return (
    <div className="flex items-center gap-4">
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

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="mt-6">
            <Save className="mr-2 h-4 w-4" />
            Save as Preset
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Column Mapping Preset</DialogTitle>
            <DialogDescription>
              Save the current column mappings as a preset for future uploads.
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
  )
}
