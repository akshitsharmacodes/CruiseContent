import { useState } from "react"
import { Outlet } from "react-router-dom"
import { Menu } from "lucide-react"
import { AdminSidebar } from "./AdminSidebar"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"

export default function AdminLayout() {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-background pt-24 lg:pt-28">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-card md:flex">
        <AdminSidebar />
      </aside>

      {/* Mobile Sidebar & Header */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              }
            />
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">Admin Navigation</SheetTitle>
              <AdminSidebar />
            </SheetContent>
          </Sheet>
          <span className="font-semibold tracking-tight">Admin Console</span>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-muted/20 p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
