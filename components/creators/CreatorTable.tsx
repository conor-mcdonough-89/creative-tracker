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
import type { CreatorWithPerformance } from '@/lib/types'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CreatorTableProps {
  creators: CreatorWithPerformance[]
  loading?: boolean
  sortField: string
  sortDirection: 'asc' | 'desc'
  onSort: (field: string) => void
}

export function CreatorTable({
  creators,
  loading,
  sortField,
  sortDirection,
  onSort,
}: CreatorTableProps) {
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
              <TableHead>Creator</TableHead>
              <TableHead>Handle</TableHead>
              <TableHead>Sports</TableHead>
              <TableHead className="text-right">GMV</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Payout</TableHead>
              <TableHead className="text-right">Clicks</TableHead>
              <TableHead className="text-right">Conv.</TableHead>
              <TableHead className="text-right">ROAS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 9 }).map((_, j) => (
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

  if (creators.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center">
        <p className="text-muted-foreground">No creators found</p>
        <Link href="/creators/new" className="text-primary hover:underline">
          Add your first creator
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
              <SortHeader field="name">Creator</SortHeader>
            </TableHead>
            <TableHead>Handle</TableHead>
            <TableHead>Sports</TableHead>
            <TableHead className="text-right">
              <SortHeader field="gmv">GMV</SortHeader>
            </TableHead>
            <TableHead className="text-right">
              <SortHeader field="revenue">Revenue</SortHeader>
            </TableHead>
            <TableHead className="text-right">
              <SortHeader field="payout">Payout</SortHeader>
            </TableHead>
            <TableHead className="text-right">
              <SortHeader field="clicks">Clicks</SortHeader>
            </TableHead>
            <TableHead className="text-right">
              <SortHeader field="conversions">Conv.</SortHeader>
            </TableHead>
            <TableHead className="text-right">
              <SortHeader field="roas">ROAS</SortHeader>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {creators.map((creator) => (
            <TableRow key={creator.id} className="cursor-pointer hover:bg-muted/50">
              <TableCell>
                <Link
                  href={`/creators/${creator.id}`}
                  className="font-medium hover:underline"
                >
                  {creator.name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                @{creator.handle}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {creator.sports.slice(0, 3).map((sport) => (
                    <Badge key={sport.id} variant="outline" className="text-xs">
                      {sport.name}
                    </Badge>
                  ))}
                  {creator.sports.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{creator.sports.length - 3}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(creator.performance.gmv)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(creator.performance.revenue)}
              </TableCell>
              <TableCell className="text-right font-medium text-green-600">
                {formatCurrency(creator.performance.payout)}
              </TableCell>
              <TableCell className="text-right">
                {formatCompactNumber(creator.performance.clicks)}
              </TableCell>
              <TableCell className="text-right">
                {formatCompactNumber(creator.performance.conversions)}
              </TableCell>
              <TableCell className="text-right">
                {creator.performance.roas.toFixed(2)}x
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
