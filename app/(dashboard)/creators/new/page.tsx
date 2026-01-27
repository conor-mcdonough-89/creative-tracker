import { CreatorForm } from '@/components/creators/CreatorForm'

export default function NewCreatorPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Add Creator</h1>
        <p className="text-muted-foreground">
          Create a new creator profile and set up pattern matching for their ads
        </p>
      </div>

      <div className="max-w-2xl">
        <CreatorForm mode="create" />
      </div>
    </div>
  )
}
