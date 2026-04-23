"use client";

import { useState } from "react";
import { Inbox, Mail, AlertCircle, CheckCircle, Send, Clock } from "lucide-react";
import Link from "next/link";
import { updateReplyStatus, sendReply } from "./actions";

type Reply = {
  id: string;
  fromEmail: string;
  subject: string | null;
  body: string;
  receivedAt: Date;
  status: string;
  ourResponse: string | null;
  respondedAt: Date | null;
  contact: { id: string; firstName: string; lastName: string; email: string; company: string | null };
  email: { subject: string; campaign: { name: string } };
};

type Counts = { all: number; unread: number; action_needed: number; resolved: number };

const filters = [
  { value: "", label: "Alle", icon: Mail },
  { value: "unread", label: "Ungelesen", icon: Clock },
  { value: "action_needed", label: "Aktion nötig", icon: AlertCircle },
  { value: "resolved", label: "Erledigt", icon: CheckCircle },
];

export function InboxView({
  replies,
  counts,
  currentFilter,
}: {
  replies: Reply[];
  counts: Counts;
  currentFilter: string;
}) {
  const [selectedReply, setSelectedReply] = useState<Reply | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const handleSendReply = async () => {
    if (!selectedReply || !replyText.trim()) return;
    setSending(true);
    try {
      await sendReply(selectedReply.id, replyText);
      setReplyText("");
      setSelectedReply(null);
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (replyId: string, status: string) => {
    await updateReplyStatus(replyId, status);
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-180px)]">
      {/* Filter Sidebar */}
      <div className="w-48 shrink-0 space-y-1">
        {filters.map((f) => {
          const count = f.value ? counts[f.value as keyof Counts] : counts.all;
          return (
            <Link
              key={f.value}
              href={`/inbox${f.value ? `?filter=${f.value}` : ""}`}
              className={`flex items-center justify-between p-2.5 rounded-lg text-sm transition-colors ${
                currentFilter === f.value
                  ? "bg-accent text-white"
                  : "text-text hover:bg-bg-card"
              }`}
            >
              <div className="flex items-center gap-2">
                <f.icon className="w-4 h-4" />
                {f.label}
              </div>
              <span className={`text-xs font-medium ${
                currentFilter === f.value ? "text-white/80" : "text-text-light"
              }`}>
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Reply List */}
      <div className="w-96 shrink-0 bg-bg-card rounded-xl border border-border overflow-y-auto">
        {replies.length === 0 ? (
          <div className="p-8 text-center">
            <Inbox className="w-10 h-10 text-text-light/40 mx-auto mb-2" />
            <p className="text-sm text-text-light">Keine Nachrichten</p>
          </div>
        ) : (
          replies.map((reply) => (
            <button
              key={reply.id}
              onClick={() => {
                setSelectedReply(reply);
                if (reply.status === "unread") {
                  handleStatusChange(reply.id, "read");
                }
              }}
              className={`w-full text-left p-4 border-b border-border hover:bg-bg-secondary transition-colors ${
                selectedReply?.id === reply.id ? "bg-bg-secondary" : ""
              } ${reply.status === "unread" ? "font-semibold" : ""}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium truncate">
                  {reply.contact.firstName} {reply.contact.lastName}
                </span>
                <span className="text-xs text-text-light">
                  {new Date(reply.receivedAt).toLocaleDateString("de-DE")}
                </span>
              </div>
              <p className="text-xs text-text-light truncate">{reply.contact.company}</p>
              <p className="text-sm text-text-light truncate mt-1">{reply.body.slice(0, 80)}...</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  reply.status === "unread" ? "bg-blue-100 text-blue-700"
                  : reply.status === "action_needed" ? "bg-orange-100 text-orange-700"
                  : reply.status === "resolved" ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-700"
                }`}>
                  {reply.status === "unread" ? "Ungelesen"
                  : reply.status === "action_needed" ? "Aktion nötig"
                  : reply.status === "resolved" ? "Erledigt"
                  : "Gelesen"}
                </span>
                <span className="text-xs text-text-light">
                  {reply.email.campaign.name}
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Detail View */}
      <div className="flex-1 bg-bg-card rounded-xl border border-border overflow-y-auto">
        {!selectedReply ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Mail className="w-10 h-10 text-text-light/40 mx-auto mb-2" />
              <p className="text-sm text-text-light">Wähle eine Nachricht aus</p>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {/* Contact Info */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-text text-lg">
                  {selectedReply.contact.firstName} {selectedReply.contact.lastName}
                </h3>
                <p className="text-sm text-text-light">
                  {selectedReply.contact.email} · {selectedReply.contact.company}
                </p>
                <p className="text-xs text-text-light mt-1">
                  Kampagne: {selectedReply.email.campaign.name} · Original: {selectedReply.email.subject}
                </p>
              </div>
              <div className="flex gap-2">
                <select
                  value={selectedReply.status}
                  onChange={(e) => handleStatusChange(selectedReply.id, e.target.value)}
                  className="text-sm px-3 py-1.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50"
                >
                  <option value="unread">Ungelesen</option>
                  <option value="read">Gelesen</option>
                  <option value="action_needed">Aktion nötig</option>
                  <option value="resolved">Erledigt</option>
                </select>
              </div>
            </div>

            {/* Message */}
            <div className="bg-bg-secondary rounded-lg p-4">
              <p className="text-xs text-text-light mb-2">
                {new Date(selectedReply.receivedAt).toLocaleString("de-DE")}
              </p>
              <div className="text-sm whitespace-pre-wrap">{selectedReply.body}</div>
            </div>

            {/* Our Response */}
            {selectedReply.ourResponse && (
              <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
                <p className="text-xs text-accent font-medium mb-2">
                  Unsere Antwort · {selectedReply.respondedAt && new Date(selectedReply.respondedAt).toLocaleString("de-DE")}
                </p>
                <div className="text-sm whitespace-pre-wrap">{selectedReply.ourResponse}</div>
              </div>
            )}

            {/* Reply Form */}
            {!selectedReply.ourResponse && (
              <div className="space-y-3 pt-4 border-t border-border">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                  placeholder="Antwort schreiben..."
                />
                <button
                  onClick={handleSendReply}
                  disabled={!replyText.trim() || sending}
                  className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {sending ? "Wird gesendet..." : "Antwort senden"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
