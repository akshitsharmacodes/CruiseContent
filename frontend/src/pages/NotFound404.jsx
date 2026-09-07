import { Link, useNavigate } from "react-router-dom"
import { FileQuestion } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound404() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <div className="flex max-w-md flex-col items-center gap-6 rounded-lg border bg-card p-8 shadow-sm">
        <div className="rounded-full bg-muted p-4">
          <FileQuestion className="h-10 w-10 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">404 Not Found</h1>
          <p className="text-sm text-muted-foreground">
            The page you are looking for doesn't exist or has been moved.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center mt-4">
          <Button variant="outline" onClick={() => navigate(-1)} className="w-full sm:w-auto">
            Go Back
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link to="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
