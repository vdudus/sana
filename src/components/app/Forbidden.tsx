import { Lock } from "lucide-react";
import { useEffect } from "react";
import { audit } from "@/lib/demo/store";

export function Forbidden({ perm }: { perm: string }) {
  useEffect(() => {
    audit("authz.denied", `403 viewing ${perm}`);
  }, [perm]);
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="max-w-sm text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-muted"><Lock className="size-5" /></div>
        <div className="mt-4 font-mono text-xs text-muted-foreground">HTTP 403 · {perm}</div>
        <h2 className="mt-2 font-display text-3xl">Not available for your role</h2>
        <p className="mt-2 text-sm text-muted-foreground">Access is enforced on every request. This attempt was written to the audit log.</p>
      </div>
    </div>
  );
}
