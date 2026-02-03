'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, RotateCcw, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import type { ImportLog, Platform } from '@/lib/types'

const PLATFORM_LABELS: Record<Platform, string> = {
  meta: 'Meta',
  tiktok: 'TikTok',
  google: 'Google',
}

const PLATFORM_COLORS: Record<Platform, string> = {
  meta: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  tiktok: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  google: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

export default function ImportHistoryPage() {
  const [imports, setImports] = useState<ImportLog[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedImport, setSelectedImport] = useState<ImportLog | null>(null)
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false)
  const [rollingBack, setRollingBack] = useState(false)
  const [rollbackResult, setRollbackResult] = useState<{ success: boolean; message: string; deletedCount?: number } | null>(null)

  const supabase = createClient()

  const loadImports = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('import_logs')
      .select('*')
      .order('created_at', { ascending: false })

    if (data && !error) {
      setImports(data as ImportLog[])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadImports()
  }, [])

  const handleRollback = async () => {
    if (!selectedImport) return

    setRollingBack(true)
    setRollbackResult(null)

    try {
      // Get current user email
      const { data: { user } } = await supabase.auth.getUser()
      const userEmail = user?.email || null

      // Count records that will be deleted
      const { count } = await supabase
        .from('ad_performance')
        .select('*', { count: 'exact', head: true })
        .eq('import_id', selectedImport.id)

      // Delete all ad_performance records with this import_id
      const { error: deleteError } = await supabase
        .from('ad_performance')
        .delete()
        .eq('import_id', selectedImport.id)

      if (deleteError) {
        throw new Error(deleteError.message)
      }

      // Update import log status
      const { error: updateError } = await supabase
        .from('import_logs')
        .update({
          status: 'rolled_back',
          rolled_back_at: new Date().toISOString(),
          rolled_back_by: userEmail,
        })
        .eq('id', selectedImport.id)

      if (updateError) {
        throw new Error(updateError.message)
      }

      setRollbackResult({
        success: true,
        message: `Successfully rolled back import`,
        deletedCount: count || 0,
      })

      // Refresh the list
      loadImports()
    } catch (err) {
      setRollbackResult({
        success: false,
        message: err instanceof Error ? err.message : 'Rollback failed',
      })
    } finally {
      setRollingBack(false)
    }
  }

  const openRollbackDialog = (importLog: ImportLog) => {
    setSelectedImport(importLog)
    setRollbackResult(null)
    setRollbackDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import History</h1>
        <p className="text-muted-foreground">
          View and manage data imports. Roll back imports to remove their data.
        </p>
      </div>

      {/* Warning about rollback behavior */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div>
            <h4 className="font-medium text-amber-800 dark:text-amber-200">
              Rollback deletes data permanently
            </h4>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              Rolling back an import will delete all records associated with it. If the import updated existing records, those records will be deleted entirely (not restored to previous values).
            </p>
          </div>
        </div>
      </div>

      {/* Import history table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Records</TableHead>
              <TableHead>Date Range</TableHead>
              <TableHead>Imported By</TableHead>
              <TableHead>Imported At</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : imports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No imports yet. Upload data to see import history.
                </TableCell>
              </TableRow>
            ) : (
              imports.map((importLog) => (
                <TableRow key={importLog.id} className={importLog.status === 'rolled_back' ? 'opacity-60' : ''}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium max-w-[200px] truncate" title={importLog.file_name}>
                        {importLog.file_name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={PLATFORM_COLORS[importLog.platform]}>
                      {PLATFORM_LABELS[importLog.platform]}
                    </Badge>
                  </TableCell>
                  <TableCell>{importLog.record_count.toLocaleString()}</TableCell>
                  <TableCell>
                    {importLog.date_range_start && importLog.date_range_end ? (
                      <span className="text-sm">
                        {format(new Date(importLog.date_range_start), 'MMM d')} - {format(new Date(importLog.date_range_end), 'MMM d, yyyy')}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{importLog.imported_by || '-'}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {format(new Date(importLog.created_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </TableCell>
                  <TableCell>
                    {importLog.status === 'completed' ? (
                      <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        <XCircle className="h-3 w-3 mr-1" />
                        Rolled Back
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {importLog.status === 'completed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openRollbackDialog(importLog)}
                        className="text-destructive hover:text-destructive"
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Rollback
                      </Button>
                    )}
                    {importLog.status === 'rolled_back' && importLog.rolled_back_at && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(importLog.rolled_back_at), 'MMM d, h:mm a')}
                        {importLog.rolled_back_by && ` by ${importLog.rolled_back_by}`}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Rollback confirmation dialog */}
      <AlertDialog open={rollbackDialogOpen} onOpenChange={setRollbackDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Roll Back Import?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This will permanently delete all <strong>{selectedImport?.record_count.toLocaleString()}</strong> records
                from the import <strong>&quot;{selectedImport?.file_name}&quot;</strong>.
              </p>
              <p className="text-amber-600 dark:text-amber-400">
                This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rollingBack}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRollback}
              disabled={rollingBack}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {rollingBack ? 'Rolling back...' : 'Roll Back Import'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rollback result dialog */}
      <Dialog open={rollbackResult !== null} onOpenChange={() => setRollbackResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {rollbackResult?.success ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Rollback Complete
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-destructive" />
                  Rollback Failed
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {rollbackResult?.success ? (
                <>Deleted {rollbackResult.deletedCount?.toLocaleString()} records from the database.</>
              ) : (
                rollbackResult?.message
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setRollbackResult(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
