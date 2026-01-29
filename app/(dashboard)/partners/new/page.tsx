import { PartnerForm } from '@/components/partners/PartnerForm'

export default function NewPartnerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Add Partner</h1>
        <p className="text-muted-foreground">
          Create a new partner profile with fixed-rate contract details
        </p>
      </div>

      <div className="max-w-2xl">
        <PartnerForm mode="create" />
      </div>
    </div>
  )
}
