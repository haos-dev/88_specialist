import { Outlet, useLocation } from "react-router-dom";
import { OfflineBanner } from "./OfflineBanner";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  const { pathname } = useLocation();
  const dashboard = pathname === "/";

  return (
    <div className="min-h-dvh pb-28">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <OfflineBanner />
        <main
          className={
            dashboard
              ? "w-full px-4 py-6 sm:px-6 lg:px-10 lg:py-8"
              : "mx-auto w-full max-w-column px-4 py-6 sm:px-6 lg:px-10 lg:py-9"
          }
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
