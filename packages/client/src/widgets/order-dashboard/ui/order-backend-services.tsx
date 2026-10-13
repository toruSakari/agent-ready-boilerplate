import { Boxes, Database, RadioTower } from "lucide-react";

const services = [
  {
    icon: Database,
    label: "D1 + Outbox",
    tone: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200",
  },
  {
    icon: Boxes,
    label: "Inventory DO",
    tone: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-200",
  },
  { icon: RadioTower, label: "Queues + D1 history", tone: "bg-emerald-50 text-success" },
];

export function OrderBackendServices() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {services.map((props) => (
        <div
          className="rounded-2xl border border-hero-border bg-hero-surface p-4"
          key={props.label}
        >
          <span className={`mb-3 inline-flex rounded-xl p-2 ${props.tone}`}>
            <props.icon aria-hidden="true" size={18} />
          </span>
          <p className="text-sm font-medium text-hero-muted">{props.label}</p>
        </div>
      ))}
    </div>
  );
}
