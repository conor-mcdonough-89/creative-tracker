'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/calculations'
import { Check, Clock, Trash2 } from 'lucide-react'
import type { PayoutWithCreator } from '@/lib/types'

interface PayoutTableProps {
  payouts: PayoutWithCreator[]
  loading: boolean
  onPayoutUpdated: () => void
  canDelete?: boolean
}

export function PayoutTable({
  payouts,
  loading,
  onPayoutUpdated,
  canDelete = false,
}: PayoutTableProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const supabase = createClient()

  const handleToggleStatus = async (payout: PayoutWithCreator) => {
    if (payout.status === 'paid') return // Can't toggle back to unpaid

    setUpdatingId(payout.id)
    try {
      const { error } = await supabase
        .from('payouts')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
        })
        .eq('id', payout.id)

      if (error) throw error
      onPayoutUpdated()
    } catch (err) {
      console.error('Failed to update payout status:', err)
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDelete = async (payoutId: string) => {
    if (!confirm('Are you sure you want to delete this payout?')) return

    setDeletingId(payoutId)
    try {
      const { error } = await supabase
        .from('payouts')
        .delete()
        .eq('id', payoutId)

      if (error) throw error
      onPayoutUpdated()
    } catch (err) {
      console.error('Failed to delete payout:', err)
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Creator</TableHead>
              <TableHead>Date Range</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Paid At</TableHead>
              <TableHead>Payout Method</TableHead>
              {canDelete && <TableHead className="w-[50px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                {canDelete && <TableCell><Skeleton className="h-4 w-8" /></TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (payouts.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        No payouts found
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Creator</TableHead>
            <TableHead>Date Range</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Paid At</TableHead>
            <TableHead>Payout Method</TableHead>
            {canDelete && <TableHead className="w-[50px]"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {payouts.map((payout) => (
            <TableRow key={payout.id}>
              <TableCell>
                <Link
                  href={`/creators/${payout.creator_id}`}
                  className="font-medium hover:underline"
                >
                  {payout.creator_name}
                </Link>
                <div className="text-sm text-muted-foreground">
                  @{payout.creator_handle}
                </div>
              </TableCell>
              <TableCell>
                <div className="whitespace-nowrap">
                  {format(new Date(payout.date_start), 'MMM d, yyyy')} –{' '}
                  {format(new Date(payout.date_end), 'MMM d, yyyy')}
                </div>
              </TableCell>
              <TableCell className="font-medium">
                {formatCurrency(payout.amount)}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => handleToggleStatus(payout)}
                  disabled={payout.status === 'paid' || updatingId === payout.id}
                >
                  {payout.status === 'paid' ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                      <Check className="mr-1 h-3 w-3" />
                      Paid
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="hover:bg-green-100 hover:text-green-800">
                      <Clock className="mr-1 h-3 w-3" />
                      {updatingId === payout.id ? 'Updating...' : 'Unpaid'}
                    </Badge>
                  )}
                </Button>
              </TableCell>
              <TableCell>
                {payout.paid_at
                  ? format(new Date(payout.paid_at), 'MMM d, yyyy h:mm a')
                  : '—'}
              </TableCell>
              <TableCell>
                {payout.payout_method ? (
                  <div>
                    <span className="capitalize">{payout.payout_method}</span>
                    {payout.payout_username && (
                      <div className="text-sm text-muted-foreground">
                        {payout.payout_username}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              {canDelete && (
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(payout.id)}
                    disabled={deletingId === payout.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
