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
  Mail,
  ArrowRight,
  Bell,
  Package,
  Trash2,
  Plus,
  BellOff,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import { RichTextEditor, type RichTextEditorHandle, type ShortcodeChoice } from "@/components/rich-text-editor";
import { OrderCard } from "./order-card";
import { RetoureDialog } from "./retoure-dialog";
import { useMemo } from "react";
import {
  sendReplyAction,
  addNoteAction,
  setStatusAction,
  setPriorityAction,
  setAssigneeAction,
  rejectDraftAction,
  updateContactAction,
  snoozeTicketAction,
  wakeTicketAction,
  addOrderAction,
  removeOrderAction,
  refreshOrderAction,
  resendMessageAction,
  regenerateDraftAction,
} from "./actions";
import { STATUS_LABEL, PRIORITY_LABEL, PRIORITY_CLASSES } from "@/lib/status";

type UserLite = { id: string; name: string; email: string };
type TemplateLite = {
  id: string;
  name: string;
  shortcode: string | null;
  subject: string;
  bodyHtml: string;
  category: string | null;
};

type MessageAttachment = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  inline: boolean;
  contentId: string | null;
};

type Message = {
  id: string;
  direction: string;
  kind: string;
  fromEmail: string;
  toEmail: string;
  subject: string | null;
  bodyHtml: string;
  aiGenerated: boolean;
  resentFromId: string | null;
  resendMessageId: string | null;
  authorUser: UserLite | null;
  attachments: MessageAttachment[];
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

type BelegPosition = {
  id?: number;
  typ?: string;
  artikelnummer?: string;
  hersteller?: string;
  herstellernummer?: string;
  beschreibung?: string;
  menge?: number;
  einzelpreis_brutto?: number;
  positionspreis_brutto?: number;
  status?: string;
};

type BelegAddress = {
  anrede?: string;
  vorname?: string;
  name?: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  land?: string;
  email?: string;
  telefon?: string;
};

type Beleg = {
  typ?: string;
  belegnummer?: string;
  belegdatum?: string;
  status?: string;
  bestellnummer?: string;
  endpreis_brutto?: number;
  endpreis_netto?: number;
  rechnungsadresse?: BelegAddress;
  lieferadresse?: BelegAddress;
  positionen?: BelegPosition[];
};

type Order = {
  id: string;
  ref: string;
  note: string | null;
  source: string;
  emailMatched: boolean;
  status: string | null;
  totalBrutto: number | null;
  fetchedAt: string | null;
  createdAt: string;
  beleg: Beleg | null;
  retoureCaseId: string | null;
  retoureAnmeldungUrl: string | null;
  retoureLabelUrl: string | null;
  retoureCreatedAt: string | null;
  retoureFreeLabel: boolean;
};

type Ticket = {
  id: string;
  number: number;
  code: string;
  subject: string;
  status: string;
  priority: string;
  category: string | null;
  contactId: string;
  assigneeId: string | null;
  firstResponseDueAt: string;
  resolutionDueAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  snoozedUntil: string | null;
  snoozedReason: string | null;
  gmailThreadId: string | null;
  createdAt: string;
  updatedAt: string;
  contact: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
    phone: string | null;
    orderRef: string | null;
    notes: string | null;
  };
  assignee: UserLite | null;
  orders: Order[];
  messages: Message[];
  notes: Note[];
  drafts: Draft[];
  events: Event[];
};

const CATEGORY_LABEL: Record<string, string> = {
  returns: "Retoure & Widerruf",
  shipping: "Versand & Bestellung",
  invoice: "Rechnung & Zahlung",
  advisory: "Beratung",
  complaint: "Reklamation",
  general: "Allgemein",
  other: "Sonstiges",
};

const STATUSES: [string, string][] = [
  ["open", STATUS_LABEL.open],
  ["pending", STATUS_LABEL.pending],
  ["on_hold", STATUS_LABEL.on_hold],
  ["resolved", STATUS_LABEL.resolved],
  ["closed", STATUS_LABEL.closed],
];

const PRIORITIES: [string, string][] = [
  ["low", PRIORITY_LABEL.low],
  ["normal", PRIORITY_LABEL.normal],
  ["high", PRIORITY_LABEL.high],
  ["urgent", PRIORITY_LABEL.urgent],
];

const EVENT_LABEL: Record<string, string> = {
  created: "Ticket erstellt",
  assigned: "Zugewiesen",
  status_changed: "Status geändert",
  priority_changed: "Priorität geändert",
  first_response_sla_breached: "Erstantwort-SLA überschritten",
  resolution_sla_breached: "Lösungs-SLA überschritten",
  ai_drafted: "AI-Draft erstellt",
  ai_auto_sent: "AI-Antwort automatisch gesendet",
  note_added: "Notiz hinzugefügt",
  message_sent: "Antwort gesendet",
  message_received: "Nachricht empfangen",
  snoozed: "Auf Wiedervorlage gelegt",
  woken: "Wiedervorlage aufgehoben",
  reopened_by_customer: "Auto-reopen (Kundenantwort)",
  order_added: "Bestellung verknüpft",
  order_removed: "Bestellung entfernt",
  order_linked: "Bestellung automatisch verknüpft",
  order_refreshed: "Bestellung aus Webisco aktualisiert",
  order_refresh_failed: "Webisco-Refresh fehlgeschlagen",
  retoure_created: "Kundenretoure angelegt",
  retoure_create_failed: "Retoure-Anlage fehlgeschlagen",
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
  signatureHtml,
  currentUserRole,
}: {
  ticket: Ticket;
  users: UserLite[];
  templates: TemplateLite[];
  signatureHtml: string | null;
  currentUserRole: string;
}) {
  const isAdmin = currentUserRole === "admin";
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [replyHtml, setReplyHtml] = useState("");
  const [replySubject, setReplySubject] = useState(
    ticket.subject.startsWith("Re: ") ? ticket.subject : `Re: ${ticket.subject}`
  );
  const [replyStatus, setReplyStatus] = useState("pending");
  const [noteBody, setNoteBody] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [draftIdApplied, setDraftIdApplied] = useState<string | null>(null);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [snoozeUntil, setSnoozeUntil] = useState("");
  const [snoozeReason, setSnoozeReason] = useState("");
  const [newOrderRef, setNewOrderRef] = useState("");
  const [retoureOrderId, setRetoureOrderId] = useState<string | null>(null);
  const editorRef = useRef<RichTextEditorHandle>(null);
  const retoureOrder = retoureOrderId
    ? ticket.orders.find((o) => o.id === retoureOrderId) ?? null
    : null;

  const substitute = (input: string): string => {
    const c = ticket.contact;
    const first = c.firstName || c.name?.split(" ")[0] || "";
    const last = c.lastName || (c.name ? c.name.split(" ").slice(1).join(" ") : "") || "";
    // Prefer email-matched linked orders (from Webisco). Fall back to the
    // static contact.orderRef only if no ticket-level order was linked yet.
    const matchedOrder = ticket.orders.find((o) => o.emailMatched);
    const anyOrder = matchedOrder ?? ticket.orders[0] ?? null;
    const orderId = anyOrder?.ref || c.orderRef || "";
    const map: Record<string, string> = {
      "customer.first_name": first,
      "customer.last_name": last,
      "customer.name": [first, last].filter(Boolean).join(" ") || c.name || "",
      "customer.email": c.email,
      "customer.phone": c.phone || "",
      "order.id": orderId,
      "order.status": anyOrder?.status || "",
      "ticket.code": ticket.code,
      "ticket.number": ticket.code, // legacy alias — always show the code, never the internal number
      "ticket.subject": ticket.subject,
    };
    return input.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => map[key] ?? `{{${key}}}`);
  };

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setReplyHtml(substitute(t.bodyHtml));
    setReplySubject(substitute(t.subject || replySubject));
  };

  const shortcodeChoices: ShortcodeChoice[] = useMemo(
    () =>
      templates
        .filter((t) => !!t.shortcode)
        .map((t) => ({
          shortcode: t.shortcode!,
          label: t.name,
          category: t.category
            ? CATEGORY_LABEL[t.category] || t.category
            : null,
          html: substitute(t.bodyHtml),
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [templates, ticket.id, ticket.contact.id]
  );

  const applyDraft = (d: Draft) => {
    setReplyHtml(d.bodyHtml);
    setReplySubject(d.subject);
    setDraftIdApplied(d.id);
  };

  const [pendingRetoureAttach, setPendingRetoureAttach] = useState<string[]>([]);

  const submitReply = () => {
    if (!replyHtml.trim() || pending) return;
    const fd = new FormData();
    fd.set("ticketId", ticket.id);
    fd.set("subject", replySubject);
    fd.set("bodyHtml", replyHtml);
    fd.set("statusAfter", replyStatus);
    if (draftIdApplied) fd.set("draftId", draftIdApplied);
    if (pendingRetoureAttach.length > 0) {
      fd.set("attachRetoureOrderIds", pendingRetoureAttach.join(","));
    }
    startTransition(async () => {
      await sendReplyAction(fd);
      setReplyHtml("");
      setDraftIdApplied(null);
      setPendingRetoureAttach([]);
      router.refresh();
    });
  };

  const submitSnooze = () => {
    if (!snoozeUntil || pending) return;
    const fd = new FormData();
    fd.set("ticketId", ticket.id);
    fd.set("until", snoozeUntil);
    if (snoozeReason) fd.set("reason", snoozeReason);
    startTransition(async () => {
      await snoozeTicketAction(fd);
      setSnoozeOpen(false);
      setSnoozeUntil("");
      setSnoozeReason("");
      router.refresh();
    });
  };

  const wakeNow = () => {
    startTransition(async () => {
      await wakeTicketAction(ticket.id);
      router.refresh();
    });
  };

  const submitAddOrder = () => {
    if (!newOrderRef.trim() || pending) return;
    const fd = new FormData();
    fd.set("ticketId", ticket.id);
    fd.set("ref", newOrderRef.trim());
    startTransition(async () => {
      await addOrderAction(fd);
      setNewOrderRef("");
      router.refresh();
    });
  };

  const submitRemoveOrder = (orderId: string) => {
    startTransition(async () => {
      await removeOrderAction(orderId);
      router.refresh();
    });
  };

  const submitResendMessage = (messageId: string) => {
    startTransition(async () => {
      await resendMessageAction(messageId);
      router.refresh();
    });
  };

  const submitRegenerateDraft = () => {
    startTransition(async () => {
      await regenerateDraftAction(ticket.id);
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
    !ticket.resolvedAt && new Date(ticket.firstResponseDueAt).getTime() < Date.now();
  const resolutionOverdue =
    !ticket.resolvedAt && new Date(ticket.resolutionDueAt).getTime() < Date.now();
  const snoozeActive =
    ticket.snoozedUntil && new Date(ticket.snoozedUntil).getTime() > Date.now();

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
          <span className="text-sm font-mono text-text-light">#{ticket.code}</span>
          <h1 className="text-xl font-bold text-text flex-1">{ticket.subject}</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap text-sm text-text-light">
          <span>Von {ticket.contact.name || ticket.contact.email}</span>
          <span
            className={`flex items-center gap-1 ${slaColor(
              ticket.firstResponseDueAt,
              !!ticket.firstResponseAt || !!ticket.resolvedAt
            )}`}
          >
            {overdue && !ticket.firstResponseAt ? (
              <AlertCircle className="w-3.5 h-3.5" />
            ) : (
              <Clock className="w-3.5 h-3.5" />
            )}
            Erstantw. {formatDistanceToNow(new Date(ticket.firstResponseDueAt), {
              locale: de,
              addSuffix: true,
            })}
          </span>
          <span
            className={`flex items-center gap-1 ${slaColor(
              ticket.resolutionDueAt,
              !!ticket.resolvedAt
            )}`}
          >
            {resolutionOverdue ? (
              <AlertCircle className="w-3.5 h-3.5" />
            ) : (
              <Clock className="w-3.5 h-3.5" />
            )}
            Lösung {formatDistanceToNow(new Date(ticket.resolutionDueAt), {
              locale: de,
              addSuffix: true,
            })}
          </span>
          {ticket.firstResponseAt && (
            <span className="text-success">✓ Erstantwort</span>
          )}
          {snoozeActive && (
            <span className="inline-flex items-center gap-1 text-warning">
              <Bell className="w-3.5 h-3.5" /> Wiedervorlage{" "}
              {formatDistanceToNow(new Date(ticket.snoozedUntil!), {
                locale: de,
                addSuffix: true,
              })}
            </span>
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
                <MessageItem
                  key={m.id}
                  m={m}
                  onResend={submitResendMessage}
                  pending={pending}
                />
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
                    onClick={submitRegenerateDraft}
                    disabled={pending}
                    title="AI-Draft neu erzeugen (überschreibt aktuellen)"
                    className="px-4 py-2 border border-border rounded-lg text-sm text-text-light hover:bg-bg-secondary transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Neu
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
                  title="Templates auswählen — oder via ::kürzel im Editor"
                >
                  <option value="">Template …</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.shortcode ? ` (::${t.shortcode})` : ""}
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
                shortcodes={shortcodeChoices}
                placeholder="Antwort verfassen… (Tipp: :: für Template-Auswahl)"
                minHeight={180}
              />

              {pendingRetoureAttach.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pendingRetoureAttach.map((orderId) => {
                    const o = ticket.orders.find((x) => x.id === orderId);
                    if (!o) return null;
                    return (
                      <span
                        key={orderId}
                        className="inline-flex items-center gap-1.5 px-2 py-1 bg-accent/10 border border-accent/30 text-accent rounded text-xs"
                      >
                        <Package className="w-3 h-3" />
                        Retourenschein-{o.ref}.pdf
                        <button
                          type="button"
                          onClick={() =>
                            setPendingRetoureAttach((prev) => prev.filter((id) => id !== orderId))
                          }
                          className="ml-1 opacity-60 hover:opacity-100"
                          title="Nicht anhängen"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {signatureHtml ? (
                <details className="border border-border rounded-lg bg-bg-secondary/40">
                  <summary className="cursor-pointer px-3 py-2 text-xs text-text-light hover:text-text select-none">
                    Signatur wird angehängt ▾
                  </summary>
                  <div
                    className="px-4 py-3 border-t border-border bg-white text-sm"
                    dangerouslySetInnerHTML={{ __html: signatureHtml }}
                  />
                </details>
              ) : (
                <div className="text-xs text-warning">
                  Keine Signatur hinterlegt —{" "}
                  <a href="/settings" className="underline hover:text-warning/80">
                    in Einstellungen anlegen
                  </a>
                  .
                </div>
              )}

              <div className="flex items-center justify-end gap-2 flex-wrap">
                <label className="text-xs text-text-light">Status nach Senden:</label>
                <select
                  value={replyStatus}
                  onChange={(e) => setReplyStatus(e.target.value)}
                  className="text-sm border border-border rounded px-2 py-1.5 bg-white"
                >
                  <option value="keep">— unverändert —</option>
                  <option value="pending">Warten auf Kunde</option>
                  <option value="on_hold">Pausiert</option>
                  <option value="open">Offen</option>
                  <option value="resolved">Gelöst</option>
                  <option value="closed">Geschlossen</option>
                </select>
                <button
                  onClick={submitReply}
                  disabled={pending || !replyHtml.trim()}
                  className="flex items-center gap-2 px-5 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent-light transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {pending ? "Sende…" : "Senden & Status setzen"}
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
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-text">Ticket</h3>
              {snoozeActive ? (
                <button
                  onClick={wakeNow}
                  disabled={pending}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs border border-border text-text-light hover:bg-bg-secondary transition-colors"
                  title="Wiedervorlage aufheben"
                >
                  <BellOff className="w-3 h-3" /> Wecken
                </button>
              ) : (
                <button
                  onClick={() => setSnoozeOpen(!snoozeOpen)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs border border-border text-text-light hover:bg-bg-secondary transition-colors"
                >
                  <Bell className="w-3 h-3" /> Wiedervorlage
                </button>
              )}
            </div>

            {snoozeOpen && !snoozeActive && (
              <div className="bg-warning/5 border border-warning/30 rounded-lg p-3 space-y-2">
                <label className="block text-xs font-medium text-text">Wiedervorlage bis</label>
                <input
                  type="datetime-local"
                  value={snoozeUntil}
                  onChange={(e) => setSnoozeUntil(e.target.value)}
                  className="w-full px-2 py-1.5 border border-border rounded text-sm"
                />
                <div className="grid grid-cols-3 gap-1 text-xs">
                  {[
                    { label: "+1h", h: 1 },
                    { label: "morgen 9", h: null, tomorrow: true },
                    { label: "+3T", h: 72 },
                  ].map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => {
                        const d = q.tomorrow
                          ? (() => {
                              const t = new Date();
                              t.setDate(t.getDate() + 1);
                              t.setHours(9, 0, 0, 0);
                              return t;
                            })()
                          : new Date(Date.now() + (q.h as number) * 3600_000);
                        setSnoozeUntil(
                          new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
                            .toISOString()
                            .slice(0, 16)
                        );
                      }}
                      className="px-2 py-1 border border-border rounded hover:bg-bg-secondary"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={snoozeReason}
                  onChange={(e) => setSnoozeReason(e.target.value)}
                  placeholder="Grund (optional)"
                  className="w-full px-2 py-1.5 border border-border rounded text-sm"
                />
                <div className="flex gap-1">
                  <button
                    onClick={submitSnooze}
                    disabled={!snoozeUntil || pending}
                    className="flex-1 px-3 py-1.5 bg-warning text-white rounded text-sm font-medium hover:bg-warning/90 transition-colors disabled:opacity-50"
                  >
                    Snoozen
                  </button>
                  <button
                    onClick={() => setSnoozeOpen(false)}
                    className="px-3 py-1.5 border border-border rounded text-sm text-text-light"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}

            {snoozeActive && ticket.snoozedReason && (
              <div className="text-xs text-warning bg-warning/5 border border-warning/20 rounded p-2">
                {ticket.snoozedReason}
              </div>
            )}

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
                  PRIORITY_CLASSES[ticket.priority]
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
            <details>
              <summary className="cursor-pointer list-none">
                <div className="space-y-1 text-sm">
                  <div className="text-text font-medium">
                    {[ticket.contact.firstName, ticket.contact.lastName]
                      .filter(Boolean)
                      .join(" ") ||
                      ticket.contact.name ||
                      "—"}
                  </div>
                  <div className="text-text-light">{ticket.contact.email}</div>
                  {ticket.contact.phone && (
                    <div className="text-text-light">☎ {ticket.contact.phone}</div>
                  )}
                  {ticket.contact.orderRef && (
                    <div className="text-text-light">
                      Best.: <span className="font-mono">{ticket.contact.orderRef}</span>
                    </div>
                  )}
                  <div className="text-xs text-accent hover:underline mt-2">
                    Bearbeiten ▾
                  </div>
                </div>
              </summary>
              <form action={updateContactAction} className="mt-3 space-y-2">
                <input type="hidden" name="contactId" value={ticket.contact.id} />
                <input type="hidden" name="ticketId" value={ticket.id} />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    name="firstName"
                    defaultValue={ticket.contact.firstName || ""}
                    placeholder="Vorname"
                    className="w-full px-2 py-1.5 border border-border rounded text-sm"
                  />
                  <input
                    name="lastName"
                    defaultValue={ticket.contact.lastName || ""}
                    placeholder="Nachname"
                    className="w-full px-2 py-1.5 border border-border rounded text-sm"
                  />
                </div>
                <input
                  name="phone"
                  type="tel"
                  defaultValue={ticket.contact.phone || ""}
                  placeholder="Telefon"
                  className="w-full px-2 py-1.5 border border-border rounded text-sm"
                />
                <input
                  name="orderRef"
                  defaultValue={ticket.contact.orderRef || ""}
                  placeholder="Bestellnr."
                  className="w-full px-2 py-1.5 border border-border rounded text-sm font-mono"
                />
                <button
                  type="submit"
                  className="w-full px-3 py-1.5 bg-accent text-white rounded text-sm font-medium hover:bg-accent-light transition-colors"
                >
                  Speichern
                </button>
              </form>
            </details>
          </div>

          <div className="bg-bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-text mb-3 flex items-center gap-2">
              <Package className="w-4 h-4" /> Bestellungen
              <span className="text-xs text-text-light font-normal">
                ({ticket.orders.length})
              </span>
            </h3>
            <div className="space-y-1 mb-3">
              {ticket.orders.length === 0 && !ticket.contact.orderRef && (
                <div className="text-xs text-text-light italic">
                  Noch keine Bestellungen verknüpft.
                </div>
              )}
              {ticket.contact.orderRef && ticket.orders.length === 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-mono text-text">{ticket.contact.orderRef}</span>
                  <span className="text-xs text-text-light">(am Kontakt)</span>
                </div>
              )}
              {ticket.orders.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  isAdmin={isAdmin}
                  pending={pending}
                  onRefresh={() =>
                    startTransition(() => {
                      refreshOrderAction(o.id).then(() => router.refresh());
                    })
                  }
                  onRemove={() => submitRemoveOrder(o.id)}
                  onCreateRetoure={() => setRetoureOrderId(o.id)}
                />
              ))}
            </div>
            <div className="flex gap-1">
              <input
                type="text"
                value={newOrderRef}
                onChange={(e) => setNewOrderRef(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitAddOrder();
                  }
                }}
                placeholder="Bestellnr."
                className="flex-1 px-2 py-1.5 border border-border rounded text-sm font-mono"
              />
              <button
                onClick={submitAddOrder}
                disabled={pending || !newOrderRef.trim()}
                className="px-3 py-1.5 bg-accent text-white rounded text-sm hover:bg-accent-light transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
              </button>
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

      <RetoureDialog
        order={retoureOrder}
        isAdmin={isAdmin}
        onClose={() => setRetoureOrderId(null)}
        onCreated={(result) => {
          const attachOrderId = retoureOrderId;
          setRetoureOrderId(null);
          setReplyHtml(result.composerText);
          setReplyStatus("resolved");
          if (attachOrderId) {
            setPendingRetoureAttach((prev) =>
              prev.includes(attachOrderId) ? prev : [...prev, attachOrderId],
            );
          }
          router.refresh();
        }}
      />
    </div>
  );
}

function MessageItem({
  m,
  onResend,
  pending,
}: {
  m: Message;
  onResend: (id: string) => void;
  pending: boolean;
}) {
  const isOutbound = m.direction === "outbound";
  const kindBadge =
    m.kind === "acknowledgement"
      ? { label: "Eingangsbestätigung (auto)", cls: "bg-success/15 text-success" }
      : m.kind === "resend"
        ? { label: "Erneut gesendet", cls: "bg-warning/15 text-warning" }
        : null;

  const bg = m.kind === "acknowledgement" ? "bg-success/5" : isOutbound ? "bg-info/5" : "";

  return (
    <div className={`px-5 py-4 ${bg}`}>
      <div className="flex items-center justify-between text-xs text-text-light mb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
              isOutbound ? "bg-info/15 text-info" : "bg-gray-100 text-gray-700"
            }`}
          >
            {isOutbound ? "Ausgehend" : "Eingehend"}
          </span>
          {kindBadge && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${kindBadge.cls}`}
            >
              {kindBadge.label}
            </span>
          )}
          {m.aiGenerated && (
            <span className="inline-flex items-center gap-1 text-xs text-accent">
              <Sparkles className="w-3 h-3" /> AI
            </span>
          )}
          <span className="text-text font-medium">
            {isOutbound
              ? m.authorUser?.name || (m.kind === "acknowledgement" ? "System" : m.fromEmail)
              : m.fromEmail}
          </span>
          <span>→ {m.toEmail}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span>
            {format(new Date(m.sentAt || m.createdAt), "dd.MM.yyyy HH:mm", { locale: de })}
          </span>
          {isOutbound && m.sentAt && (
            <span
              className="text-success"
              title={m.resendMessageId ? `Resend-ID: ${m.resendMessageId}` : "Erfolgreich an Resend übergeben"}
            >
              ✓ gesendet
            </span>
          )}
          {isOutbound && (
            <button
              onClick={() => {
                if (confirm("Diese Nachricht erneut an den Kunden senden?")) {
                  onResend(m.id);
                }
              }}
              disabled={pending}
              className="inline-flex items-center gap-1 px-2 py-0.5 border border-border rounded text-text-light hover:bg-bg-secondary hover:text-text transition-colors disabled:opacity-50"
              title="Genau diese Nachricht nochmal an den Kunden senden"
            >
              <Send className="w-3 h-3" /> Erneut senden
            </button>
          )}
        </div>
      </div>
      {m.subject && (
        <div className="text-sm font-medium text-text mb-2">{m.subject}</div>
      )}
      <div
        className="prose prose-sm max-w-none text-text [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded"
        dangerouslySetInnerHTML={{ __html: m.bodyHtml }}
      />
      <MessageAttachments attachments={m.attachments || []} />
    </div>
  );
}

function MessageAttachments({ attachments }: { attachments: MessageAttachment[] }) {
  // Show all non-inline attachments as a downloadable strip. Inline images
  // are already embedded in the body (via /api/attachments/<id>/inline).
  const nonInline = attachments.filter((a) => !a.inline);
  // Also show inline images as thumbnails in case the HTML didn't reference
  // them (some mail clients attach without cid: refs).
  const inlineImages = attachments.filter(
    (a) => a.inline && a.contentType.startsWith("image/"),
  );
  const unreferencedInlineImages = inlineImages.filter(
    (a) => !a.contentId, // truly unreferenced if it has no cid
  );

  if (nonInline.length === 0 && unreferencedInlineImages.length === 0) return null;

  const fmtSize = (n: number) => {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="mt-3 pt-3 border-t border-border/60">
      {unreferencedInlineImages.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
          {unreferencedInlineImages.map((a) => (
            <a
              key={a.id}
              href={`/api/attachments/${a.id}/download`}
              target="_blank"
              rel="noopener noreferrer"
              className="block border border-border rounded overflow-hidden hover:border-accent transition-colors"
              title={a.filename}
            >
              <img
                src={`/api/attachments/${a.id}/inline`}
                alt={a.filename}
                className="w-full h-24 object-cover"
              />
            </a>
          ))}
        </div>
      )}
      {nonInline.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {nonInline.map((a) => (
            <a
              key={a.id}
              href={`/api/attachments/${a.id}/download`}
              download={a.filename}
              className="inline-flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg text-xs bg-white hover:bg-bg-secondary hover:border-accent transition-colors"
              title={`Download ${a.filename}`}
            >
              <FileIcon contentType={a.contentType} />
              <span className="font-medium text-text max-w-[200px] truncate">{a.filename}</span>
              <span className="text-text-light tabular-nums">{fmtSize(a.size)}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function FileIcon({ contentType }: { contentType: string }) {
  const iconClass = "w-4 h-4 shrink-0";
  if (contentType.startsWith("image/")) return <span className={`${iconClass} text-accent`}>🖼</span>;
  if (contentType === "application/pdf") return <span className={`${iconClass} text-danger`}>📄</span>;
  if (contentType.includes("word") || contentType.includes("document")) return <span className={`${iconClass} text-info`}>📝</span>;
  if (contentType.includes("excel") || contentType.includes("sheet")) return <span className={`${iconClass} text-success`}>📊</span>;
  if (contentType.includes("zip") || contentType.includes("archive")) return <span className={`${iconClass} text-warning`}>🗜</span>;
  return <span className={`${iconClass} text-text-light`}>📎</span>;
}

