"use client";

import { useState, useTransition, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow, format } from "date-fns";
import { de } from "date-fns/locale";
import {
  ArrowLeft,
  Send,
  StickyNote,
  Sparkles,
  Clock,
  AlertCircle,
  Check,
  X,
  Mail,
  ArrowRight,
} from "lucide-react";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/rich-text-editor";
import {
  sendReplyAction,
  addNoteAction,
  setStatusAction,
  setPriorityAction,
  setAssigneeAction,
  rejectDraftAction,
} from "./actions";

type UserLite = { id: string; name: string; email: string };
type TemplateLite = { id: string; name: string; subject: string; bodyHtml: string; category: string | null };

type Message = {
  id: string;
  direction: string;
  fromEmail: string;
  toEmail: string;
  subject: string | null;
  bodyHtml: string;
  aiGenerated: boolean;
  authorUser: UserLite | null;
  createdAt: string;
  sentAt: string | null;
};

type Note = {
  id: string;
  body: string;
  user: UserLite | null;
  createdAt: string;
};

type Draft = {
  id: string;
  subject: string;
  bodyHtml: string;
  confidence: number;
  model: string;
  category: string | null;
  autoSendEligible: boolean;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
};

type Event = {
  id: string;
  type: string;
  meta: string | null;
  user: { name: string; email: string } | null;
  createdAt: string;
};

type Ticket = {
  id: string;
  number: number;
  subject: string;
  status: string;
  priority: string;
  category: string | null;
  contactId: string;
  assigneeId: string | null;
  slaDueAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  gmailThreadId: string | null;
  createdAt: string;
  updatedAt: string;
  contact: { id: string; email: string; name: string | null; phone: string | null; orderRef: string | null; notes: string | null };
  assignee: UserLite | null;
  messages: Message[];
  notes: Note[];
  drafts: Draft[];
  events: Event[];
};

const STATUSES: [string, string][] = [
  ["open", "Offen"],
  ["pending", "Wartend"],
  ["on_hold", "Pausiert"],
  ["resolved", "Gelöst"],
  ["closed", "Geschlossen"],
];

const PRIORITIES: [string, string][] = [
  ["low", "Niedrig"],
  ["normal", "Normal"],
  ["high", "Hoch"],
  ["urgent", "Dringend"],
];

const PRIO_CLASS: Record<string, string> = {
  low: "bg-gray-100 text-gray-700",
  normal: "bg-info/10 text-info",
  high: "bg-warning/15 text-warning",
  urgent: "bg-danger/15 text-danger",
};

const EVENT_LABEL: Record<string, string> = {
  created: "Ticket erstellt",
  assigned: "Zugewiesen",
  status_changed: "Status geändert",
  priority_changed: "Priorität geändert",
  sla_breached: "SLA überschritten",
  ai_drafted: "AI-Draft erstellt",
  ai_auto_sent: "AI-Antwort automatisch gesendet",
  note_added: "Notiz hinzugefügt",
  message_sent: "Antwort gesendet",
  message_received: "Nachricht empfangen",
};

function slaColor(dueAt: string, resolved: boolean) {
  if (resolved) return "text-text-light";
  const h = (new Date(dueAt).getTime() - Date.now()) / 36e5;
  if (h < 0) return "text-danger font-semibold";
  if (h < 2) return "text-danger";
  if (h < 6) return "text-warning";
  return "text-success";
}

export function TicketDetail({
  ticket,
  users,
  templates,
}: {
  ticket: Ticket;
  users: UserLite[];
  templates: TemplateLite[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [replyHtml, setReplyHtml] = useState("");
  const [replySubject, setReplySubject] = useState(
    ticket.subject.startsWith("Re: ") ? ticket.subject : `Re: ${ticket.subject}`
  );
  const [noteBody, setNoteBody] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [draftIdApplied, setDraftIdApplied] = useState<string | null>(null);
  const editorRef = useRef<RichTextEditorHandle>(null);

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setReplyHtml(t.bodyHtml);
    setReplySubject(t.subject || replySubject);
  };

  const applyDraft = (d: Draft) => {
    setReplyHtml(d.bodyHtml);
    setReplySubject(d.subject);
    setDraftIdApplied(d.id);
  };

  const submitReply = () => {
    if (!replyHtml.trim() || pending) return;
    const fd = new FormData();
    fd.set("ticketId", ticket.id);
    fd.set("subject", replySubject);
    fd.set("bodyHtml", replyHtml);
    if (draftIdApplied) fd.set("draftId", draftIdApplied);
    startTransition(async () => {
      await sendReplyAction(fd);
      setReplyHtml("");
      setDraftIdApplied(null);
      router.refresh();
    });
  };

  const submitNote = () => {
    if (!noteBody.trim() || pending) return;
    const fd = new FormData();
    fd.set("ticketId", ticket.id);
    fd.set("body", noteBody);
    startTransition(async () => {
      await addNoteAction(fd);
      setNoteBody("");
      router.refresh();
    });
  };

  const changeStatus = (s: string) => {
    startTransition(async () => {
      await setStatusAction(ticket.id, s);
      router.refresh();
    });
  };

  const changePriority = (p: string) => {
    startTransition(async () => {
      await setPriorityAction(ticket.id, p);
      router.refresh();
    });
  };

  const changeAssignee = (u: string) => {
    startTransition(async () => {
      await setAssigneeAction(ticket.id, u || null);
      router.refresh();
    });
  };

  const rejectDraft = (id: string) => {
    startTransition(async () => {
      await rejectDraftAction(id);
      if (draftIdApplied === id) setDraftIdApplied(null);
      router.refresh();
    });
  };

  const overdue =
    !ticket.resolvedAt && new Date(ticket.slaDueAt).getTime() < Date.now();

  return (
    <div>
      <Link
        href="/tickets"
        className="inline-flex items-center gap-1 text-sm text-text-light hover:text-text mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Zurück
      </Link>

      <div className="mb-4">
        <div className="flex items-baseline gap-3 mb-1">
          <span className="text-sm font-mono text-text-light">#{ticket.number}</span>
          <h1 className="text-xl font-bold text-text flex-1">{ticket.subject}</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap text-sm text-text-light">
          <span>Von {ticket.contact.name || ticket.contact.email}</span>
          <span className={`flex items-center gap-1 ${slaColor(ticket.slaDueAt, !!ticket.resolvedAt)}`}>
            {overdue ? <AlertCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
            SLA {formatDistanceToNow(new Date(ticket.slaDueAt), { locale: de, addSuffix: true })}
          </span>
          {ticket.firstResponseAt && (
            <span className="text-success">✓ Erstantwort</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-bg-card border border-border rounded-xl">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-text flex items-center gap-2">
                <Mail className="w-4 h-4" /> Verlauf
              </h3>
              <span className="text-xs text-text-light">
                {ticket.messages.length} Nachricht(en)
              </span>
            </div>
            <div className="divide-y divide-border">
              {ticket.messages.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-text-light">
                  Noch keine Nachrichten.
                </div>
              )}
              {ticket.messages.map((m) => (
                <MessageItem key={m.id} m={m} />
              ))}
            </div>
          </div>

          {ticket.drafts.length > 0 && (
            <div className="bg-accent/5 border-2 border-accent/30 rounded-xl">
              <div className="px-5 py-3 border-b border-accent/20 flex items-center justify-between">
                <h3 className="font-semibold text-accent flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> AI-Antwortvorschlag
                </h3>
                <span className="text-xs text-text-light">
                  {ticket.drafts[0].model} · Confidence{" "}
                  {Math.round(ticket.drafts[0].confidence * 100)}%
                  {ticket.drafts[0].autoSendEligible && " · Auto-Send-fähig"}
                </span>
              </div>
              <div className="p-5 space-y-3">
                <div className="text-xs font-medium text-text-light">
                  Betreff: {ticket.drafts[0].subject}
                </div>
                <div
                  className="prose prose-sm max-w-none text-text bg-white rounded-lg p-4 border border-accent/20"
                  dangerouslySetInnerHTML={{ __html: ticket.drafts[0].bodyHtml }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => applyDraft(ticket.drafts[0])}
                    disabled={pending}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors disabled:opacity-50"
                  >
                    <ArrowRight className="w-4 h-4" /> In Antwort übernehmen
                  </button>
                  <button
                    onClick={() => rejectDraft(ticket.drafts[0].id)}
                    disabled={pending}
                    className="px-4 py-2 border border-border rounded-lg text-sm text-text-light hover:bg-bg-secondary transition-colors disabled:opacity-50"
                  >
                    Verwerfen
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-bg-card border border-border rounded-xl">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-text flex items-center gap-2">
                <Send className="w-4 h-4" /> Antworten
              </h3>
              <div className="flex items-center gap-2">
                <select
                  value={templateId}
                  onChange={(e) => {
                    setTemplateId(e.target.value);
                    applyTemplate(e.target.value);
                  }}
                  className="text-xs border border-border rounded px-2 py-1 bg-white"
                  disabled={templates.length === 0}
                >
                  <option value="">Template …</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <input
                type="text"
                value={replySubject}
                onChange={(e) => setReplySubject(e.target.value)}
                placeholder="Betreff"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              />
              <RichTextEditor
                ref={editorRef}
                value={replyHtml}
                onChange={setReplyHtml}
                placeholder="Antwort verfassen…"
                minHeight={180}
              />
              <div className="flex justify-end">
                <button
                  onClick={submitReply}
                  disabled={pending || !replyHtml.trim()}
                  className="flex items-center gap-2 px-5 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent-light transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {pending ? "Sende…" : "Antwort senden"}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-bg-card border border-border rounded-xl">
            <div className="px-5 py-3 border-b border-border">
              <h3 className="font-semibold text-text flex items-center gap-2">
                <StickyNote className="w-4 h-4" /> Interne Notizen{" "}
                <span className="text-xs text-text-light font-normal">
                  (nicht sichtbar für Kunde)
                </span>
              </h3>
            </div>
            <div className="divide-y divide-border">
              {ticket.notes.map((n) => (
                <div key={n.id} className="px-5 py-3 bg-warning/5">
                  <div className="flex items-center justify-between text-xs text-text-light mb-1">
                    <span className="font-medium text-text">
                      {n.user?.name || n.user?.email || "System"}
                    </span>
                    <span>
                      {formatDistanceToNow(new Date(n.createdAt), {
                        locale: de,
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <div className="text-sm text-text whitespace-pre-wrap">{n.body}</div>
                </div>
              ))}
              <div className="p-5">
                <textarea
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  rows={2}
                  placeholder="Interne Notiz hinzufügen…"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-warning/30 focus:border-warning"
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={submitNote}
                    disabled={pending || !noteBody.trim()}
                    className="flex items-center gap-2 px-4 py-1.5 bg-warning text-white rounded-lg text-sm font-medium hover:bg-warning/90 transition-colors disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" /> Notiz speichern
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-bg-card border border-border rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-text">Ticket</h3>

            <div>
              <label className="text-xs font-medium text-text-light block mb-1">Status</label>
              <select
                value={ticket.status}
                onChange={(e) => changeStatus(e.target.value)}
                disabled={pending}
                className="w-full text-sm border border-border rounded px-2 py-1.5 bg-white"
              >
                {STATUSES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-text-light block mb-1">Priorität</label>
              <select
                value={ticket.priority}
                onChange={(e) => changePriority(e.target.value)}
                disabled={pending}
                className="w-full text-sm border border-border rounded px-2 py-1.5 bg-white"
              >
                {PRIORITIES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <span
                className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full ${
                  PRIO_CLASS[ticket.priority]
                }`}
              >
                {PRIORITIES.find(([v]) => v === ticket.priority)?.[1]}
              </span>
            </div>

            <div>
              <label className="text-xs font-medium text-text-light block mb-1">Zugewiesen</label>
              <select
                value={ticket.assigneeId || ""}
                onChange={(e) => changeAssignee(e.target.value)}
                disabled={pending}
                className="w-full text-sm border border-border rounded px-2 py-1.5 bg-white"
              >
                <option value="">— nicht zugewiesen —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-text mb-3">Kunde</h3>
            <div className="space-y-1 text-sm">
              <div className="text-text font-medium">
                {ticket.contact.name || "—"}
              </div>
              <div className="text-text-light">{ticket.contact.email}</div>
              {ticket.contact.phone && (
                <div className="text-text-light">{ticket.contact.phone}</div>
              )}
              {ticket.contact.orderRef && (
                <div className="text-text-light">
                  Bestellung: <span className="font-mono">{ticket.contact.orderRef}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-text mb-3">Verlauf</h3>
            <ul className="space-y-2 text-xs">
              {ticket.events.map((e) => (
                <li key={e.id} className="flex justify-between gap-2">
                  <span className="text-text">
                    {EVENT_LABEL[e.type] || e.type}
                    {e.user && (
                      <span className="text-text-light"> · {e.user.name}</span>
                    )}
                  </span>
                  <span className="text-text-light shrink-0">
                    {format(new Date(e.createdAt), "dd.MM. HH:mm", { locale: de })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageItem({ m }: { m: Message }) {
  const isOutbound = m.direction === "outbound";
  return (
    <div className={`px-5 py-4 ${isOutbound ? "bg-info/5" : ""}`}>
      <div className="flex items-center justify-between text-xs text-text-light mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
              isOutbound ? "bg-info/15 text-info" : "bg-gray-100 text-gray-700"
            }`}
          >
            {isOutbound ? "Ausgehend" : "Eingehend"}
          </span>
          {m.aiGenerated && (
            <span className="inline-flex items-center gap-1 text-xs text-accent">
              <Sparkles className="w-3 h-3" /> AI
            </span>
          )}
          <span className="text-text font-medium">
            {isOutbound ? m.authorUser?.name || m.fromEmail : m.fromEmail}
          </span>
          <span>→ {m.toEmail}</span>
        </div>
        <span>
          {format(new Date(m.sentAt || m.createdAt), "dd.MM.yyyy HH:mm", { locale: de })}
        </span>
      </div>
      {m.subject && (
        <div className="text-sm font-medium text-text mb-2">{m.subject}</div>
      )}
      <div
        className="prose prose-sm max-w-none text-text"
        dangerouslySetInnerHTML={{ __html: m.bodyHtml }}
      />
    </div>
  );
}

// Suppress unused-icon lint by re-referencing
void X;
