import { useEffect, useState } from "react";
import { useDemo } from "@/lib/demo/store";
import { employeeById } from "@/lib/demo/data";
import { can, type Permission } from "@/lib/demo/permissions";

export function useHydrated() {
  const [h, setH] = useState(false);
  useEffect(() => setH(true), []);
  return h;
}

export function useSession() {
  const session = useDemo((s) => s.session);
  const managerCostAccess = useDemo((s) => s.settings.managerCostAccess);
  const user = employeeById(session?.userId);
  return {
    session,
    user,
    role: session?.role ?? "waiter",
    can: (p: Permission) => !!session && can(session.role, p, { managerCostAccess }),
  };
}
