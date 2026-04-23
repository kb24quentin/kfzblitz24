"use client";

import { useState } from "react";
import {
  MessageSquare,
  ArrowRightLeft,
  Phone,
  Mail,
  StickyNote,
  Bell,
  Edit,
  Send,
} from "lucide-react";
import { addComment, logCall } from "./actions";

type Activity = {
  id: string;
  type: string;
  content: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
  user: { name: string } | null;
};

const typeConfig: Record<string, { icon: typeof MessageSquare; label: string; color: string }> = {
  comment: { icon: MessageSquare, label: "Kommentar", color: "bg-blue-500" },
  status_change: { icon: ArrowRightLeft, label: "Status", color: "bg-accent" },
  call: { icon: Phone, label: "Anruf", color: "bg-success" },
  email_sent: { icon: Mail, label: "Email", color: "bg-purple-500" },
  note: { icon: StickyNote, label: "Notiz", color: "bg-yellow-500" },
  reminder_created: { icon: Bell, label: "Wiedervorlage", color: "bg-info" },
  contact_edited: { icon: Edit, label: "Bearbeitet", color: "bg-gray-500" },
};

const statusLabels: Record<string, string> = {
  new: "Neu",
  contacted: "Kontaktiert",
  replied: "Geantwortet",
  interested: "Interessiert",
  not_interested: "Kein Interesse",
  customer: "Kunde",
};

export function ActivityTimeline({
  activities,
  contactId,
}: {
  activities: Activity[];
  contactId: string;
}) {
  const [commentText, setCommentText] = useState("");
  const [activeTab, setActiveTab] = useState<"comment" | "call">("comment");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!commentText.trim()) return;
    setLoading(true);
    try {
      if (activeTab === "comment") {
        await addComment(contactId, commentText);
      } else {
        await logCall(contactId, commentText);
      }
      setCommentText("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Input */}
      <div className="bg-bg-card rounded-xl border border-border p-4">
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setActiveTab("comment")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === "comment" ? "bg-primary text-white" : "bg-bg-secondary text-text-light hover:text-text"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" /> Kommentar
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("call")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === "call" ? "bg-success text-white" : "bg-bg-secondary text-text-light hover:text-text"
            }`}
          >
            <Phone className="w-3.5 h-3.5" /> Anruf loggen
          </button>
        </div>
        <div className="flex gap-2">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={2}
            className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
            placeholder={activeTab === "comment" ? "Kommentar schreiben..." : "Anruf-Notizen..."}
          />
          <button
            onClick={handleSubmit}
            disabled={!commentText.trim() || loading}
            className="self-end px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Timeline */}
      {activities.length === 0 ? (
        <p className="text-sm text-text-light text-center py-6">Noch keine Aktivitaeten</p>
      ) : (
        <div className="space-y-0">
          {activities.map((activity, i) => {
            const config = typeConfig[activity.type] || typeConfig.note;
            const Icon = config.icon;
            return (
              <div key={activity.id} className="flex gap-3 pb-4 relative">
                {/* Line */}
                {i < activities.length - 1 && (
                  <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />
                )}
                {/* Icon */}
                <div className={`${config.color} w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10`}>
                  <Icon className="w-3.5 h-3.5 text-white" />
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-text">
                      {activity.user?.name || "System"}
                    </span>
                    <span className="text-xs text-text-light">{config.label}</span>
                    <span className="text-xs text-text-light ml-auto">
                      {new Date(activity.createdAt).toLocaleString("de-DE", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {activity.type === "status_change" ? (
                    <p className="text-sm text-text">
                      <span className="text-text-light">{statusLabels[activity.oldValue || ""] || activity.oldValue}</span>
                      {" → "}
                      <span className="font-medium">{statusLabels[activity.newValue || ""] || activity.newValue}</span>
                    </p>
                  ) : activity.content ? (
                    <p className="text-sm text-text whitespace-pre-wrap">{activity.content}</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
