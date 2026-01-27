'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ColumnMapper } from '@/components/upload/ColumnMapper'
import { PresetSelector } from '@/components/upload/PresetSelector'
import { DataPreview } from '@/components/upload/DataPreview'
import { Upload, FileText, CheckCircle2, AlertCircle } from 'lucide-react'
import type { Platform, ColumnPreset, CanonicalField, CSVRow } from '@/lib/types'

type UploadStep = 'select-platform' | 'upload-file' | 'map-columns' | 'preview' | 'complete'

export default function UploadPage() {
  const [step, setStep] = useState<UploadStep>('select-platform')
  const [platform, setPlatform] = useState<Platform | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [csvData, setCsvData] = useState<CSVRow[]>([])
  const [csvColumns, setCsvColumns] = useState<string[]>([])
  const [mappings, setMappings] = useState<Record<string, string>>({})
  const [presets, setPresets] = useState<ColumnPreset[]>([])
  const [selectedPreset, setSelectedPreset] = useState<ColumnPreset | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string; count?: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()
  const router = useRouter()

  // Load presets
  useEffect(() => {
    const loadPresets = async () => {
      const { data, error } = await supabase
        .from('column_presets')
        .select('*')
        .order('name')

      if (data && !error) {
        setPresets(data as ColumnPreset[])
      }
    }
    loadPresets()
  }, [supabase])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setError(null)

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setError(`CSV parsing error: ${results.errors[0].message}`)
          return
        }

        const data = results.data as CSVRow[]
        const columns = results.meta.fields || []

        setCsvData(data)
        setCsvColumns(columns)
        setStep('map-columns')
      },
      error: (err) => {
        setError(`Failed to parse CSV: ${err.message}`)
      },
    })
  }

  const handleMappingChange = (canonicalField: CanonicalField, csvColumn: string) => {
    setMappings((prev) => ({
      ...prev,
      [canonicalField]: csvColumn,
    }))
  }

  const handleSelectPreset = (preset: ColumnPreset | null) => {
    setSelectedPreset(preset)
    if (preset) {
      setMappings(preset.mappings as Record<string, string>)
    }
  }

  const handleSavePreset = async (name: string) => {
    if (!platform) return

    const { data, error } = await supabase
      .from('column_presets')
      .insert({
        name,
        platform,
        mappings,
      })
      .select()
      .single()

    if (error) {
      setError(`Failed to save preset: ${error.message}`)
      return
    }

    setPresets((prev) => [...prev, data as ColumnPreset])
    setSelectedPreset(data as ColumnPreset)
  }

  const validateMappings = (): boolean => {
    const requiredFields: CanonicalField[] = ['ad_name', 'date', 'impressions', 'clicks', 'spend', 'conversions', 'conversion_value']
    const missing = requiredFields.filter((field) => !mappings[field] || mappings[field] === '__none__')

    if (missing.length > 0) {
      setError(`Missing required fields: ${missing.join(', ')}`)
      return false
    }

    return true
  }

  const handleUpload = async () => {
    if (!platform || !validateMappings()) return

    setUploading(true)
    setError(null)

    try {
      // Transform CSV data to match our schema
      const records = csvData.map((row) => {
        const parseNumber = (value: string): number => {
          if (!value) return 0
          const cleaned = value.replace(/[^0-9.-]/g, '')
          return parseFloat(cleaned) || 0
        }

        const parseDate = (value: string): string => {
          // Try to parse various date formats
          const date = new Date(value)
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0]
          }
          return value
        }

        return {
          ad_name: row[mappings.ad_name] || '',
          platform,
          date: parseDate(row[mappings.date] || ''),
          impressions: Math.round(parseNumber(row[mappings.impressions])),
          clicks: Math.round(parseNumber(row[mappings.clicks])),
          spend: parseNumber(row[mappings.spend]),
          conversions: Math.round(parseNumber(row[mappings.conversions])),
          conversion_value: parseNumber(row[mappings.conversion_value]),
          video_views: mappings.video_views && mappings.video_views !== '__none__'
            ? Math.round(parseNumber(row[mappings.video_views]))
            : null,
          creative_url: mappings.creative_url && mappings.creative_url !== '__none__'
            ? row[mappings.creative_url] || null
            : null,
        }
      }).filter((record) => record.ad_name && record.date)

      // Upsert data
      const { data, error: uploadError } = await supabase
        .from('ad_performance')
        .upsert(records, {
          onConflict: 'ad_name,platform,date',
          ignoreDuplicates: false,
        })
        .select()

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      // Count unique ads
      const uniqueAds = new Set(records.map((r) => r.ad_name)).size

      setUploadResult({
        success: true,
        message: `Successfully imported ${records.length} records for ${uniqueAds} ads`,
        count: records.length,
      })
      setStep('complete')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const resetUpload = () => {
    setStep('select-platform')
    setPlatform(null)
    setFile(null)
    setCsvData([])
    setCsvColumns([])
    setMappings({})
    setSelectedPreset(null)
    setUploadResult(null)
    setError(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload Data</h1>
        <p className="text-muted-foreground">
          Import ad performance data from Meta, TikTok, or Google
        </p>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-4">
        {(['select-platform', 'upload-file', 'map-columns', 'preview', 'complete'] as const).map((s, index) => (
          <div key={s} className="flex items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                step === s
                  ? 'bg-primary text-primary-foreground'
                  : index < ['select-platform', 'upload-file', 'map-columns', 'preview', 'complete'].indexOf(step)
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {index + 1}
            </div>
            {index < 4 && (
              <div
                className={`h-0.5 w-12 ${
                  index < ['select-platform', 'upload-file', 'map-columns', 'preview', 'complete'].indexOf(step)
                    ? 'bg-primary'
                    : 'bg-muted'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-2 pt-6 text-destructive">
            <AlertCircle className="h-5 w-5" />
            {error}
          </CardContent>
        </Card>
      )}

      {step === 'select-platform' && (
        <Card>
          <CardHeader>
            <CardTitle>Select Platform</CardTitle>
            <CardDescription>
              Choose the advertising platform your data is from
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="platform">Platform</Label>
              <Select
                value={platform || undefined}
                onValueChange={(value) => setPlatform(value as Platform)}
              >
                <SelectTrigger id="platform">
                  <SelectValue placeholder="Select a platform..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meta">Meta (Facebook/Instagram)</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="google">Google Ads</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => setStep('upload-file')}
              disabled={!platform}
            >
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'upload-file' && (
        <Card>
          <CardHeader>
            <CardTitle>Upload CSV File</CardTitle>
            <CardDescription>
              Upload a CSV file exported from {platform === 'meta' ? 'Meta Ads Manager' : platform === 'tiktok' ? 'TikTok Business Center' : 'Google Ads'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center w-full">
              <label
                htmlFor="csv-upload"
                className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-10 h-10 mb-3 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">CSV file only</p>
                </div>
                <input
                  id="csv-upload"
                  type="file"
                  className="hidden"
                  accept=".csv"
                  onChange={handleFileChange}
                />
              </label>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('select-platform')}>
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'map-columns' && platform && (
        <Card>
          <CardHeader>
            <CardTitle>Map Columns</CardTitle>
            <CardDescription>
              Map your CSV columns to the required fields
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {file && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                {file.name} ({csvData.length} rows)
              </div>
            )}

            <PresetSelector
              platform={platform}
              presets={presets}
              selectedPreset={selectedPreset}
              onSelectPreset={handleSelectPreset}
              onSavePreset={handleSavePreset}
              currentMappings={mappings}
            />

            <ColumnMapper
              csvColumns={csvColumns}
              mappings={mappings}
              onMappingChange={handleMappingChange}
            />

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('upload-file')}>
                Back
              </Button>
              <Button onClick={() => setStep('preview')}>
                Preview Data
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'preview' && (
        <Card>
          <CardHeader>
            <CardTitle>Preview & Confirm</CardTitle>
            <CardDescription>
              Review the mapped data before importing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <DataPreview
              data={csvData}
              mappings={mappings}
              maxRows={5}
            />

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('map-columns')}>
                Back
              </Button>
              <Button onClick={handleUpload} disabled={uploading}>
                {uploading ? 'Importing...' : `Import ${csvData.length} Records`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'complete' && uploadResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              Import Complete
            </CardTitle>
            <CardDescription>
              {uploadResult.message}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={resetUpload}>
                Upload More Data
              </Button>
              <Button variant="outline" onClick={() => router.push('/dashboard')}>
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
