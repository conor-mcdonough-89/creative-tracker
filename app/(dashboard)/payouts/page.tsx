'use client'

import { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { DateRange } from 'react-day-picker'
import { createClient } from '@/lib/supabase/client'
import { PayoutTable } from '@/components/payouts/PayoutTable'
import { DateRangePicker } from '@/components/dashboard/DateRangePicker'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Plus, X } from 'lucide-react'
import type { Creator, PayoutWithCreator, PayoutStatus } from '@/lib/types'

export default function PayoutsPage() {
  const [payouts, setPayouts] = useState<PayoutWithCreator[]>([])
  const [creators, setCreators] = useState<Creator[]>([])
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Filters
  const [selectedCreators, setSelectedCreators] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<PayoutStatus[]>([])
  const [paidAtRange, setPaidAtRange] = useState<DateRange | undefined>(undefined)

  // Filter popover states
  const [creatorOpen, setCreatorOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [creatorSearch, setCreatorSearch] = useState('')

  const supabase = createClient()

  // Get user email for admin check
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUserEmail(user?.email || null)
    }
    getUser()
  }, [supabase])

  const isAdmin = userEmail === 'conor@sidelineswap.com'

  // Load creators for filter
  useEffect(() => {
    const loadCreators = async () => {
      const { data } = await supabase
        .from('creators')
        .select('*')
        .order('name')
      if (data) setCreators(data as Creator[])
    }
    loadCreators()
  }, [supabase])

  // Load payouts
  const loadPayouts = async () => {
    setLoading(true)

    // First get payouts
    let query = supabase
      .from('payouts')
      .select('*')
      .order('created_at', { ascending: false })

    if (selectedCreators.length > 0) {
      query = query.in('creator_id', selectedCreators)
    }

    if (selectedStatuses.length > 0) {
      query = query.in('status', selectedStatuses)
    }

    // If Paid At filter is active, only show paid payouts in that range
    if (paidAtRange?.from) {
      query = query
        .eq('status', 'paid')
        .gte('paid_at', format(paidAtRange.from, 'yyyy-MM-dd'))
      if (paidAtRange.to) {
        query = query.lte('paid_at', format(paidAtRange.to, 'yyyy-MM-dd') + 'T23:59:59')
      }
    }

    const { data: payoutsData, error } = await query

    if (payoutsData && !error) {
      // Get creator details for each payout
      const creatorIds = [...new Set(payoutsData.map(p => p.creator_id))]
      const { data: creatorsData } = await supabase
        .from('creators')
        .select('id, name, handle')
        .in('id', creatorIds)

      const creatorsMap = new Map(creatorsData?.map(c => [c.id, c]) || [])

      const payoutsWithCreators: PayoutWithCreator[] = payoutsData.map(p => ({
        ...p,
        creator_name: creatorsMap.get(p.creator_id)?.name || 'Unknown',
        creator_handle: creatorsMap.get(p.creator_id)?.handle || 'unknown',
      }))

      setPayouts(payoutsWithCreators)
    }

    setLoading(false)
  }

  useEffect(() => {
    loadPayouts()
  }, [selectedCreators, selectedStatuses, paidAtRange])

  const filteredCreators = creators.filter(
    (c) =>
      c.name.toLowerCase().includes(creatorSearch.toLowerCase()) ||
      c.handle.toLowerCase().includes(creatorSearch.toLowerCase())
  )

  const hasFilters =
    selectedCreators.length > 0 ||
    selectedStatuses.length > 0 ||
    paidAtRange?.from !== undefined

  const clearAllFilters = () => {
    setSelectedCreators([])
    setSelectedStatuses([])
    setPaidAtRange(undefined)
  }

  // Calculate totals
  const totals = useMemo(() => {
    const total = payouts.reduce((sum, p) => sum + p.amount, 0)
    const paid = payouts.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0)
    const unpaid = payouts.filter(p => p.status === 'unpaid').reduce((sum, p) => sum + p.amount, 0)
    return { total, paid, unpaid }
  }, [payouts])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payouts</h1>
        <p className="text-muted-foreground">
          Manage creator payouts and payment status
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Total</div>
          <div className="text-2xl font-bold">
            ${totals.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Paid</div>
          <div className="text-2xl font-bold text-green-600">
            ${totals.paid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Unpaid</div>
          <div className="text-2xl font-bold text-amber-600">
            ${totals.unpaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Creator filter */}
        <Popover open={creatorOpen} onOpenChange={setCreatorOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Plus className="mr-1 h-3 w-3" />
              Creator
              {selectedCreators.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {selectedCreators.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3">
            <div className="space-y-2">
              <p className="text-sm font-medium">Creators</p>
              <Input
                placeholder="Search creators..."
                value={creatorSearch}
                onChange={(e) => setCreatorSearch(e.target.value)}
                className="h-8"
              />
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {filteredCreators.map((creator) => (
                    <div key={creator.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`creator-${creator.id}`}
                        checked={selectedCreators.includes(creator.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedCreators([...selectedCreators, creator.id])
                          } else {
                            setSelectedCreators(
                              selectedCreators.filter((c) => c !== creator.id)
                            )
                          }
                        }}
                      />
                      <Label htmlFor={`creator-${creator.id}`} className="text-sm">
                        {creator.name}
                        <span className="text-muted-foreground ml-1">
                          @{creator.handle}
                        </span>
                      </Label>
                    </div>
                  ))}
                  {filteredCreators.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No creators found
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </PopoverContent>
        </Popover>

        {/* Status filter */}
        <Popover open={statusOpen} onOpenChange={setStatusOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Plus className="mr-1 h-3 w-3" />
              Status
              {selectedStatuses.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {selectedStatuses.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-3">
            <div className="space-y-2">
              <p className="text-sm font-medium">Status</p>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="status-paid"
                  checked={selectedStatuses.includes('paid')}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedStatuses([...selectedStatuses, 'paid'])
                    } else {
                      setSelectedStatuses(
                        selectedStatuses.filter((s) => s !== 'paid')
                      )
                    }
                  }}
                />
                <Label htmlFor="status-paid" className="text-sm">
                  Paid
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="status-unpaid"
                  checked={selectedStatuses.includes('unpaid')}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedStatuses([...selectedStatuses, 'unpaid'])
                    } else {
                      setSelectedStatuses(
                        selectedStatuses.filter((s) => s !== 'unpaid')
                      )
                    }
                  }}
                />
                <Label htmlFor="status-unpaid" className="text-sm">
                  Unpaid
                </Label>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Paid At date range filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Paid At:</span>
          <DateRangePicker
            dateRange={paidAtRange}
            onDateRangeChange={setPaidAtRange}
          />
        </div>

        {/* Active filters */}
        {selectedCreators.map((creatorId) => {
          const creator = creators.find((c) => c.id === creatorId)
          return (
            <Badge
              key={`filter-creator-${creatorId}`}
              variant="secondary"
              className="gap-1"
            >
              Creator: {creator?.name}
              <button
                onClick={() =>
                  setSelectedCreators(selectedCreators.filter((c) => c !== creatorId))
                }
                className="hover:bg-muted rounded-full"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )
        })}

        {selectedStatuses.map((status) => (
          <Badge
            key={`filter-status-${status}`}
            variant="secondary"
            className="gap-1"
          >
            Status: {status.charAt(0).toUpperCase() + status.slice(1)}
            <button
              onClick={() =>
                setSelectedStatuses(selectedStatuses.filter((s) => s !== status))
              }
              className="hover:bg-muted rounded-full"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground"
            onClick={clearAllFilters}
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Payouts Table */}
      <PayoutTable
        payouts={payouts}
        loading={loading}
        onPayoutUpdated={loadPayouts}
        canDelete={isAdmin}
      />
    </div>
  )
}
