import { AppSidebar } from "@/components/shell/app-sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { Toaster } from "@/components/ui/toaster";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-white focus:text-blue-600"
      >
        Skip to content
      </a>
      <AppSidebar />
      <div className="min-h-screen bg-[#F6F8FB] md:ml-[260px]">
        <TopBar />
        <main id="main-content" className="p-4 sm:p-6">
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  );
}
