'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Lock, Trash2 } from 'lucide-react'
import { ADMIN_EMAIL } from '@/lib/calculations'
import { formatCompactNumber } from '@/lib/calculations'

interface ImportGroup {
  upload_date: string
  record_count: number
  platforms: string[]
  date_range_start: string
  date_range_end: string
}

export default function ImportsPage() {
  const [imports, setImports] = useState<ImportGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Removal state
  const [removeTarget, setRemoveTarget] = useState<ImportGroup | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [removing, setRemoving] = useState(false)

  const supabase = createClient()
  const isAdmin = userEmail === ADMIN_EMAIL

  const loadImports = async () => {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    setUserEmail(user?.email ?? null)

    // Query ad_performance grouped by upload date (created_at truncated to date)
    const { data, error: queryError } = await supabase
      .rpc('get_import_groups')

    if (queryError) {
      // Fallback: query raw data and group client-side
      const { data: rawData, error: rawError } = await supabase
        .from('ad_performance')
        .select('created_at, platform, date')
        .order('created_at', { ascending: false })

      if (rawData && !rawError) {
        const groups = new Map<string, {
          count: number
          platforms: Set<string>
          minDate: string
          maxDate: string
        }>()

        for (const row of rawData) {
          const uploadDate = new Date(row.created_at).toISOString().split('T')[0]
          const existing = groups.get(uploadDate)
          if (existing) {
            existing.count++
            existing.platforms.add(row.platform)
            if (row.date < existing.minDate) existing.minDate = row.date
            if (row.date > existing.maxDate) existing.maxDate = row.date
          } else {
            groups.set(uploadDate, {
              count: 1,
              platforms: new Set([row.platform]),
              minDate: row.date,
              maxDate: row.date,
            })
          }
        }

        const result: ImportGroup[] = Array.from(groups.entries())
          .map(([date, info]) => ({
            upload_date: date,
            record_count: info.count,
            platforms: Array.from(info.platforms).sort(),
            date_range_start: info.minDate,
            date_range_end: info.maxDate,
          }))
          .sort((a, b) => b.upload_date.localeCompare(a.upload_date))

        setImports(result)
      }
    } else if (data) {
      setImports(data as ImportGroup[])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadImports()
  }, [supabase])

  const handleRemove = async () => {
    if (!removeTarget || confirmText !== 'REMOVE' || !isAdmin) return

    setRemoving(true)
    setError(null)

    try {
      const uploadDate = removeTarget.upload_date
      // Delete records where created_at falls on this date
      const { error: deleteError, count } = await supabase
        .from('ad_performance')
        .delete({ count: 'exact' })
        .gte('created_at', `${uploadDate}T00:00:00.000Z`)
        .lt('created_at', `${uploadDate}T23:59:59.999Z`)

      if (deleteError) throw deleteError

      setSuccess(`Removed ${count ?? removeTarget.record_count} records from ${uploadDate}`)
      setRemoveTarget(null)
      setConfirmText('')
      setTimeout(() => setSuccess(null), 5000)

      // Reload the list
      await loadImports()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove records')
    } finally {
      setRemoving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Imports</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Imports</h1>
          <p className="text-muted-foreground">
            View and remove imported ad data by upload date
          </p>
        </div>

        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <Lock className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Access Restricted</p>
              <p className="text-sm text-muted-foreground">
                This settings page is only accessible to administrators.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Manage Imports</h1>
        <p className="text-muted-foreground">
          View and remove imported ad data by upload date
        </p>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-2 pt-6 text-destructive">
            <AlertCircle className="h-5 w-5" />
            {error}
          </CardContent>
        </Card>
      )}

      {success && (
        <Card className="border-green-500">
          <CardContent className="flex items-center gap-2 pt-6 text-green-600">
            {success}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Import History</CardTitle>
          <CardDescription>
            Records grouped by the date they were uploaded. Removing an import permanently deletes all
            ad performance records from that upload.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {imports.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No imports found.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Upload Date</TableHead>
                    <TableHead>Platforms</TableHead>
                    <TableHead>Performance Date Range</TableHead>
                    <TableHead className="text-right">Records</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {imports.map((imp) => (
                    <TableRow key={imp.upload_date}>
                      <TableCell className="font-medium">
                        {imp.upload_date}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {imp.platforms.map((p) => (
                            <Badge key={p} variant="secondary">{p}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {imp.date_range_start === imp.date_range_end
                          ? imp.date_range_start
                          : `${imp.date_range_start} to ${imp.date_range_end}`}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCompactNumber(imp.record_count)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setRemoveTarget(imp)
                            setConfirmText('')
                            setError(null)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Removal confirmation dialog */}
      <Dialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRemoveTarget(null)
            setConfirmText('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Remove Import</DialogTitle>
            <DialogDescription>
              This will permanently delete{' '}
              <strong>{removeTarget?.record_count.toLocaleString()}</strong> ad performance
              records uploaded on <strong>{removeTarget?.upload_date}</strong>.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            <p className="text-sm font-medium">
              Type <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-destructive">REMOVE</code> to confirm:
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type REMOVE to confirm"
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRemoveTarget(null)
                setConfirmText('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={confirmText !== 'REMOVE' || removing}
            >
              {removing ? 'Removing...' : 'Remove Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
