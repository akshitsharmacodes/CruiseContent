import { Link } from "react-router-dom"
import { ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Forbidden403() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <div className="flex max-w-md flex-col items-center gap-6 rounded-lg border bg-card p-8 shadow-sm">
        <div className="rounded-full bg-destructive/10 p-4">
          <ShieldAlert className="h-10 w-10 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">403 Forbidden</h1>
          <p className="text-sm text-muted-foreground">
            You do not have the required permissions to access this page. If you believe this is an error, please contact your administrator.
          </p>
        </div>
        <Button asChild className="mt-4 w-full sm:w-auto">
          <Link to="/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
