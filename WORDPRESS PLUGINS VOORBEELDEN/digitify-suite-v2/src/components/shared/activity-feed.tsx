import { timeAgo } from "@/lib/utils";

interface ActivityItem {
  id: string;
  type: string;
  summary: string;
  createdAt: Date | string;
  user?: { name: string | null } | null;
}

const typeIcons: Record<string, string> = {
  "contact.created": "👤",
  "contact.updated": "✏️",
  "deal.created": "💼",
  "deal.stage_changed": "📊",
  "deal.won": "🎉",
  "deal.lost": "❌",
  "quote.created": "📄",
  "quote.sent": "📤",
  "quote.viewed": "👀",
  "quote.accepted": "✅",
  "quote.declined": "🚫",
  "invoice.sent": "💰",
  "invoice.paid": "💳",
  "booking.created": "📅",
  "booking.confirmed": "✅",
  "task.completed": "☑️",
  "email.sent": "📧",
};

export function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  if (activities.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nog geen activiteit
      </p>
    );
  }

  return (
    <div className="space-y-0">
      {activities.map((activity, i) => (
        <div
          key={activity.id}
          className="flex items-start gap-3 border-b border-border px-1 py-3 last:border-0"
        >
          {/* Icon */}
          <span className="mt-0.5 text-base">
            {typeIcons[activity.type] ?? "📋"}
          </span>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground">{activity.summary}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {timeAgo(activity.createdAt)}
              {activity.user?.name && ` · ${activity.user.name}`}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
