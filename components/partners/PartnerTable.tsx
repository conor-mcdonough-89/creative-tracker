'use client'

import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatCompactNumber } from '@/lib/calculations'
import type { PartnerWithPerformance, PartnerStatus } from '@/lib/types'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PartnerTableProps {
  partners: PartnerWithPerformance[]
  loading?: boolean
  sortField: string
  sortDirection: 'asc' | 'desc'
  onSort: (field: string) => void
}

const STATUS_BADGES: Record<PartnerStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  prospect: { label: 'Prospect', variant: 'secondary' },
  active: { label: 'Active', variant: 'default' },
  ended: { label: 'Ended', variant: 'outline' },
}

export function PartnerTable({
  partners,
  loading,
  sortField,
  sortDirection,
  onSort,
}: PartnerTableProps) {
  const SortHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 data-[state=open]:bg-accent"
      onClick={() => onSort(field)}
    >
      {children}
      {sortField === field ? (
        sortDirection === 'asc' ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : (
          <ArrowDown className="ml-2 h-4 w-4" />
        )
      ) : (
        <ArrowUpDown className="ml-2 h-4 w-4" />
      )}
    </Button>
  )

  if (loading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Partner</TableHead>
              <TableHead>Handle</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead className="text-right">GMV</TableHead>
              <TableHead className="text-right">Videos</TableHead>
              <TableHead className="text-right">Payout</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 7 }).map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (partners.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center">
        <p className="text-muted-foreground">No partners found</p>
        <Link href="/partners/new" className="text-primary hover:underline">
          Add your first partner
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <SortHeader field="name">Partner</SortHeader>
            </TableHead>
            <TableHead>Handle</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>
              <SortHeader field="rate">Rate</SortHeader>
            </TableHead>
            <TableHead className="text-right">
              <SortHeader field="gmv">GMV</SortHeader>
            </TableHead>
            <TableHead className="text-right">
              <SortHeader field="video_count">Videos</SortHeader>
            </TableHead>
            <TableHead className="text-right">
              <SortHeader field="calculated_payout">Payout</SortHeader>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {partners.map((partner) => {
            const statusBadge = STATUS_BADGES[partner.status]
            return (
              <TableRow key={partner.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell>
                  <Link
                    href={`/partners/${partner.id}`}
                    className="font-medium hover:underline"
                  >
                    {partner.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  @{partner.handle}
                </TableCell>
                <TableCell>
                  <Badge variant={statusBadge.variant}>
                    {statusBadge.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  {formatCurrency(partner.rate)}/{partner.rate_type === 'per_video' ? 'video' : 'month'}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(partner.performance.gmv)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCompactNumber(partner.video_count)}
                </TableCell>
                <TableCell className="text-right font-medium text-green-600">
                  {formatCurrency(partner.calculated_payout)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
