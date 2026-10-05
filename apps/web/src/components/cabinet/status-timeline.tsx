import { Ban, CircleCheck, CircleDashed, CircleDot } from "lucide-react";
import { STATUS_INFO, timeline, type ApplicationStatus, type StatusOwner } from "../../lib/application-status";

const OWNER: Record<Exclude<StatusOwner, null>, string> = { farmer: "Farmer", arranger: "Arranger", investors: "Investors", chain: "On-chain checks" };

/** The application's 14 steps with the current one, its owner and the next action. Stopped applications show why. */
export function StatusTimeline({ status, note, viewer }: { status: ApplicationStatus; note?: string | null; viewer?: "farmer" | "arranger" }) {
  const info = STATUS_INFO[status];
  if (status === "rejected" || status === "withdrawn") {
    return (
      <div className="flex items-start gap-3 text-sm">
        <Ban aria-hidden strokeWidth={1.5} className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <p className="font-medium">{info.label}</p>
          <p className="text-muted-foreground">{note ?? info.next}</p>
        </div>
      </div>
    );
  }
  const owner = info.owner ? (viewer && info.owner === viewer ? "You" : OWNER[info.owner]) : null;
  const steps = timeline(status);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-sm">
        <p>
          <span className="font-medium">{`Next: ${info.next}`}</span>
          {owner ? <span className="text-muted-foreground">{` · ${owner}`}</span> : null}
        </p>
        {note ? <p className="text-muted-foreground">{note}</p> : null}
      </div>
      <ol className="grid gap-x-4 gap-y-2 text-sm sm:grid-flow-col sm:grid-rows-7 lg:grid-rows-4">
        {steps.map((s) => (
          <li key={s.status} aria-current={s.state === "current" ? "step" : undefined} className="flex items-center gap-2">
            {s.state === "done" ? (
              <CircleCheck aria-hidden strokeWidth={1.5} className="size-4 shrink-0 text-success" />
            ) : s.state === "current" ? (
              <CircleDot aria-hidden strokeWidth={1.5} className="size-4 shrink-0 text-primary" />
            ) : (
              <CircleDashed aria-hidden strokeWidth={1.5} className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className={s.state === "current" ? "font-medium text-foreground" : s.state === "done" ? "text-foreground" : "text-muted-foreground"}>{s.label}</span>
            <span className="sr-only">{s.state === "done" ? "Done" : s.state === "current" ? "Current step" : "Upcoming"}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
