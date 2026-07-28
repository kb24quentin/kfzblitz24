"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Wrench,
  Users,
  FileText,
  CalendarClock,
  BellRing,
  Package,
  Sparkles,
  ShieldCheck,
  Check,
  ChevronRight,
  Palette,
  BookOpenCheck,
  Zap,
  TrendingUp,
  Clock,
  Euro,
  ArrowDown,
} from "lucide-react";

export function Landing() {
  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden">
      <TopNav />
      <Hero />
      <TrustBadges />
      <WhatIsIt />
      <ForWhom />
      <FeatureShowcase />
      <KfzBlitzStory />
      <HowItWorks />
      <WhyUs />
      <Pricing />
      <FinalCta />
      <Footer />
      <GlobalStyles />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Global inline styles — keyframes für animations                    */
/* ------------------------------------------------------------------ */
function GlobalStyles() {
  return (
    <style jsx global>{`
      @keyframes float-slow {
        0%, 100% { transform: translate(0, 0) scale(1); }
        50% { transform: translate(30px, -20px) scale(1.05); }
      }
      @keyframes float-medium {
        0%, 100% { transform: translate(0, 0) scale(1); }
        50% { transform: translate(-25px, -30px) scale(0.95); }
      }
      @keyframes float-fast {
        0%, 100% { transform: translate(0, 0); }
        50% { transform: translate(15px, 20px); }
      }
      @keyframes grid-drift {
        0% { transform: translate(0, 0); }
        100% { transform: translate(60px, 60px); }
      }
      @keyframes fade-up {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes bounce-slow {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(8px); }
      }
      @keyframes shine {
        0% { background-position: -200% center; }
        100% { background-position: 200% center; }
      }
      @keyframes ping-slow {
        75%, 100% { transform: scale(2.5); opacity: 0; }
      }
      @keyframes wave {
        0%, 100% { transform: rotate(0deg); }
        20% { transform: rotate(-6deg); }
        40% { transform: rotate(8deg); }
        60% { transform: rotate(-4deg); }
      }
      @keyframes gradient-shift {
        0%, 100% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
      }
      .reveal {
        opacity: 0;
        transform: translateY(24px);
        transition: opacity 0.7s ease-out, transform 0.7s ease-out;
      }
      .reveal.in {
        opacity: 1;
        transform: translateY(0);
      }
      .reveal.delay-1 { transition-delay: 0.1s; }
      .reveal.delay-2 { transition-delay: 0.2s; }
      .reveal.delay-3 { transition-delay: 0.3s; }
      .reveal.delay-4 { transition-delay: 0.4s; }
      .reveal.delay-5 { transition-delay: 0.5s; }
    `}</style>
  );
}

/* ------------------------------------------------------------------ */
/* Intersection-observer für scroll-triggered reveals                  */
/* ------------------------------------------------------------------ */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.classList.add("in");
            obs.unobserve(el);
          }
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

/* ------------------------------------------------------------------ */
/* Top nav                                                            */
/* ------------------------------------------------------------------ */
function TopNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all ${
        scrolled ? "bg-white/85 backdrop-blur border-b border-slate-200 shadow-sm" : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <img src="/werkstattconnect-logo.svg" alt="WerkstattConnect" className="h-10 w-auto" />
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <a href="#was" className="text-slate-600 hover:text-slate-900 transition">Was ist das?</a>
          <a href="#features" className="text-slate-600 hover:text-slate-900 transition">Features</a>
          <a href="#pricing" className="text-slate-600 hover:text-slate-900 transition">Preise</a>
          <a href="#kfzblitz" className="text-slate-600 hover:text-slate-900 transition">kfzBlitz24</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="text-sm px-4 py-2 rounded-lg text-slate-700 hover:bg-slate-100 transition"
          >
            Login
          </Link>
          <Link
            href="/login"
            className="hidden md:inline-flex text-sm px-4 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition"
          >
            Werkstatt-Zugang
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* HERO — fullscreen, animated background                              */
/* ------------------------------------------------------------------ */
function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20 pb-20">
      {/* Animated grid background */}
      <div className="absolute inset-0 opacity-[0.12] pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, #0a2540 1px, transparent 1px), linear-gradient(to bottom, #0a2540 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            animation: "grid-drift 20s linear infinite",
          }}
        />
      </div>

      {/* Floating gradient orbs */}
      <div
        className="absolute top-1/4 -left-32 w-96 h-96 rounded-full opacity-40 blur-3xl pointer-events-none"
        style={{
          background: "radial-gradient(circle, #fe6503 0%, transparent 70%)",
          animation: "float-slow 12s ease-in-out infinite",
        }}
      />
      <div
        className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] rounded-full opacity-30 blur-3xl pointer-events-none"
        style={{
          background: "radial-gradient(circle, #0a2540 0%, transparent 70%)",
          animation: "float-medium 15s ease-in-out infinite",
        }}
      />
      <div
        className="absolute top-1/3 right-1/4 w-64 h-64 rounded-full opacity-25 blur-3xl pointer-events-none"
        style={{
          background: "radial-gradient(circle, #06b6d4 0%, transparent 70%)",
          animation: "float-fast 10s ease-in-out infinite",
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
        {/* Left: Text */}
        <div>
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-medium mb-6"
            style={{ animation: "fade-up 0.6s ease-out both" }}
          >
            <span
              className="relative flex h-2 w-2"
            >
              <span
                className="absolute inline-flex h-full w-full rounded-full bg-orange-500"
                style={{ animation: "ping-slow 2s cubic-bezier(0,0,0.2,1) infinite" }}
              />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-600"></span>
            </span>
            Neu: WerkstattConnect ist live
          </div>

          <h1
            className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6"
            style={{ animation: "fade-up 0.7s ease-out 0.1s both" }}
          >
            Das digitale <br />
            <span
              className="inline-block bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(90deg, #fe6503 0%, #ff8b3d 25%, #fe6503 50%, #ff8b3d 75%, #fe6503 100%)",
                backgroundSize: "200% auto",
                animation: "shine 6s linear infinite",
              }}
            >
              Rückgrat
            </span>{" "}
            <br />
            für Kfz-Werkstätten.
          </h1>

          <p
            className="text-xl text-slate-600 leading-relaxed max-w-xl mb-8"
            style={{ animation: "fade-up 0.7s ease-out 0.2s both" }}
          >
            Angebote in 30 Sekunden. Rechnungen GoBD-konform. Kunden binden mit
            digitalem Wartungsheft. Und Teile direkt aus dem kfzBlitz24-Katalog.
          </p>

          <div
            className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-8"
            style={{ animation: "fade-up 0.7s ease-out 0.3s both" }}
          >
            <a
              href="#pricing"
              className="group inline-flex items-center gap-2 px-6 py-3.5 bg-orange-600 text-white rounded-xl font-semibold hover:bg-orange-700 transition shadow-lg shadow-orange-600/25 hover:shadow-xl hover:shadow-orange-600/40 hover:-translate-y-0.5"
            >
              Kostenlos starten
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </a>
            <a
              href="#features"
              className="inline-flex items-center gap-2 px-6 py-3.5 border border-slate-300 rounded-xl font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition"
            >
              Features ansehen
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          <div
            className="flex items-center gap-6 text-xs text-slate-500"
            style={{ animation: "fade-up 0.7s ease-out 0.4s both" }}
          >
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              Ohne Kreditkarte
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              GoBD-konform
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              Server in Deutschland
            </span>
          </div>
        </div>

        {/* Right: Floating browser-mockup */}
        <div
          className="hidden lg:block relative"
          style={{ animation: "fade-up 0.9s ease-out 0.3s both" }}
        >
          <BrowserMockup />
        </div>
      </div>

      {/* Scroll indicator */}
      <a
        href="#was"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-slate-400 hover:text-slate-700 transition"
        style={{ animation: "bounce-slow 2s ease-in-out infinite" }}
      >
        <ArrowDown className="w-6 h-6" />
      </a>
    </section>
  );
}

function BrowserMockup() {
  return (
    <div
      className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
      style={{ transform: "perspective(1200px) rotateY(-6deg) rotateX(3deg)" }}
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-100 border-b border-slate-200">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400"></div>
          <div className="w-3 h-3 rounded-full bg-amber-400"></div>
          <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
        </div>
        <div className="ml-3 px-3 py-1 bg-white rounded text-[10px] text-slate-500 font-mono flex-1 truncate">
          connect.kfzblitz24-group.com/app/rechnungen
        </div>
      </div>
      {/* Fake app content */}
      <div className="p-5 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs text-slate-500">Rechnung</div>
            <div className="font-mono font-semibold text-slate-900">RE-26-0042</div>
          </div>
          <div className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs font-medium">
            Bezahlt
          </div>
        </div>
        <div className="space-y-2 mb-4">
          <MockRow name="Bremsscheiben + Beläge vorne" price="114,00" />
          <MockRow name="Bremsbelag-Satz vorne" price="47,90" />
          <MockRow name="Bremsscheiben-Satz vorne" price="89,50" />
        </div>
        <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
          <div className="text-xs text-slate-500">Gesamt (brutto)</div>
          <div className="text-xl font-bold text-orange-600">299,86 €</div>
        </div>
      </div>
      {/* Floating badge */}
      <div
        className="absolute -top-4 -right-4 bg-gradient-to-br from-orange-500 to-orange-700 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg"
        style={{ animation: "wave 3s ease-in-out infinite", transformOrigin: "bottom right" }}
      >
        GoBD ✓
      </div>
    </div>
  );
}

function MockRow({ name, price }: { name: string; price: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-700 truncate">{name}</span>
      <span className="font-semibold text-slate-900 tabular-nums">{price} €</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Trust badges                                                       */
/* ------------------------------------------------------------------ */
function TrustBadges() {
  return (
    <section className="border-y border-slate-200 bg-slate-50/50">
      <div className="max-w-6xl mx-auto px-6 py-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm text-slate-500">
        <BadgeItem icon={<ShieldCheck className="w-4 h-4 text-emerald-600" />} label="GoBD-konform" />
        <BadgeItem icon={<ShieldCheck className="w-4 h-4 text-emerald-600" />} label="DSGVO" />
        <BadgeItem icon={<ShieldCheck className="w-4 h-4 text-emerald-600" />} label="Server in Deutschland" />
        <BadgeItem icon={<ShieldCheck className="w-4 h-4 text-emerald-600" />} label="ZUGFeRD E-Rechnung" />
        <BadgeItem icon={<ShieldCheck className="w-4 h-4 text-emerald-600" />} label="Ein Produkt der kfzBlitz24 GmbH" />
      </div>
    </section>
  );
}

function BadgeItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {icon}
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* WAS IST DAS?                                                        */
/* ------------------------------------------------------------------ */
function WhatIsIt() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section id="was" className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div ref={ref} className="reveal text-center mb-16">
          <div className="inline-block px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-xs font-medium mb-4">
            Was ist WerkstattConnect?
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 mb-4">
            Ein System.
            <br />
            <span className="text-slate-400">Der ganze Werkstatt-Alltag.</span>
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Schluss mit Excel-Listen, Papier-Terminkalendern und getippten Rechnungen.
            WerkstattConnect bündelt alles was du täglich brauchst — und ist direkt
            an den größten deutschen Ersatzteil-Katalog angebunden.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <RevealFeatureCard
            delay={0}
            icon={<Users className="w-6 h-6" />}
            title="Kunden & Fahrzeuge"
            body="Kunden, Adressen, Fahrzeuge mit HSN/TSN und FIN. Suche über Kennzeichen findet alles."
            gradient="from-orange-500 to-orange-700"
          />
          <RevealFeatureCard
            delay={100}
            icon={<CalendarClock className="w-6 h-6" />}
            title="Kalender & Termine"
            body="Wochen-Ansicht mit Ressourcen-Planung. Wer macht was wann — auf einen Blick."
            gradient="from-blue-500 to-blue-700"
          />
          <RevealFeatureCard
            delay={200}
            icon={<FileText className="w-6 h-6" />}
            title="Rechnungen & Angebote"
            body="GoBD-konform, ZUGFeRD-Embed, Storno-Workflow. In 30 Sekunden aus Vorlage."
            gradient="from-emerald-500 to-emerald-700"
          />
        </div>
      </div>
    </section>
  );
}

function RevealFeatureCard({
  icon,
  title,
  body,
  gradient,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  gradient: string;
  delay: number;
}) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className="reveal group relative bg-white border border-slate-200 rounded-2xl p-8 hover:border-orange-300 hover:shadow-xl transition-all hover:-translate-y-1"
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition`}>
        {icon}
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{body}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FÜR WEN — Split hero                                                */
/* ------------------------------------------------------------------ */
function ForWhom() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section className="py-24 bg-slate-900 text-white relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />
      <div className="max-w-6xl mx-auto px-6 relative">
        <div ref={ref} className="reveal text-center mb-16">
          <div className="inline-block px-3 py-1 bg-white/10 text-white/80 rounded-full text-xs font-medium mb-4">
            Für wen?
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Zwei Zielgruppen.<br /><span className="text-orange-400">Eine Plattform.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <TargetCard
            title="Kfz-Werkstätten"
            subtitle="Freie Meisterbetriebe, kleine Filialen, Auto-Häuser"
            icon={<Wrench className="w-8 h-8" />}
            points={[
              "Ersetzt Excel-Kunden-Listen + Papier-Terminplaner",
              "GoBD-konforme Rechnungen ohne Steuerberater-Bauchweh",
              "Kundenbindung durch automatische TÜV-Erinnerung",
              "In 5 Minuten startklar, keine Schulung nötig",
            ]}
          />
          <TargetCard
            title="kfzBlitz24-Partner"
            subtitle="Werkstätten die Teile über uns beziehen"
            icon={<Package className="w-8 h-8" />}
            points={[
              "Direkter Zugriff auf 1M+ Ersatzteile im Katalog",
              "Passgenaue Vorschläge nach HSN/TSN",
              "Aus Auftrag → Teile bestellen mit 1 Klick",
              "Bündelung mit deiner Werkstatt-Buchhaltung",
            ]}
            highlight
          />
        </div>
      </div>
    </section>
  );
}

function TargetCard({
  title,
  subtitle,
  icon,
  points,
  highlight,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  points: string[];
  highlight?: boolean;
}) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`reveal rounded-2xl p-8 border transition-all hover:-translate-y-1 ${
        highlight
          ? "bg-gradient-to-br from-orange-600 to-orange-700 border-orange-500 shadow-2xl shadow-orange-600/30"
          : "bg-white/5 backdrop-blur border-white/10 hover:bg-white/10"
      }`}
    >
      <div className={`w-16 h-16 rounded-xl flex items-center justify-center mb-4 ${
        highlight ? "bg-white/20" : "bg-white/10"
      }`}>
        {icon}
      </div>
      <h3 className="text-2xl font-bold mb-1">{title}</h3>
      <p className={`text-sm mb-6 ${highlight ? "text-orange-100" : "text-white/60"}`}>{subtitle}</p>
      <ul className="space-y-3">
        {points.map((p, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <Check className={`w-4 h-4 mt-0.5 shrink-0 ${highlight ? "text-white" : "text-emerald-400"}`} />
            <span className={highlight ? "text-white/95" : "text-white/85"}>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FEATURE-SHOWCASE — tabs + mockup                                    */
/* ------------------------------------------------------------------ */
function FeatureShowcase() {
  const tabs = [
    {
      key: "kunden",
      label: "Kunden & Fahrzeuge",
      icon: <Users className="w-4 h-4" />,
      title: "Alles zum Kunden in einer Ansicht",
      body: "Kontakt, Adresse, alle Fahrzeuge (HSN/TSN/VIN), letzte Termine, offene Rechnungen. Suche über Kennzeichen findet in einer halben Sekunde.",
      bullets: ["B2C und B2B", "Volltextsuche", "Fahrzeug-Historie chronologisch", "Notizen & Anhänge"],
      mockup: <MockKunden />,
    },
    {
      key: "kalender",
      label: "Kalender",
      icon: <CalendarClock className="w-4 h-4" />,
      title: "Wochenübersicht mit Ressourcen-Planung",
      body: "Wer macht was wann. Termine per Drag verschieben. Status-Farben zeigen Auslastung. Kunden-Suche eingebaut.",
      bullets: ["Mo–Sa, 7–19 Uhr", "Mechaniker-Zuweisung", "Status: geplant / läuft / erledigt", "Termin verschieben"],
      mockup: <MockKalender />,
    },
    {
      key: "rechnung",
      label: "Rechnungen",
      icon: <FileText className="w-4 h-4" />,
      title: "In 30 Sekunden aus Katalog zusammengeklickt",
      body: "Aus 55+ vordefinierten Kfz-Leistungen wählen — typische Ersatzteile werden automatisch mit vorgeschlagen. GoBD-konforme Nummerierung, ZUGFeRD-XML embedded.",
      bullets: ["55+ Standard-Leistungen", "Auto-Teile-Vorschläge", "GoBD + ZUGFeRD", "18 Briefpapier-Templates"],
      mockup: <MockRechnung />,
    },
    {
      key: "wartungsheft",
      label: "Wartungsheft",
      icon: <BookOpenCheck className="w-4 h-4" />,
      title: "Digitales Serviceheft für jeden Kunden",
      body: "Alle Arbeiten pro Fahrzeug chronologisch dokumentiert. Als PDF druckbar — mit deinem Logo. Perfekt für den Kunden beim Weiterverkauf.",
      bullets: ["Automatisch aus Rechnungen", "PDF mit Werkstatt-Branding", "Kundenbindung", "Fahrzeug-Wertsteigerung"],
      mockup: <MockWartungsheft />,
    },
  ];
  const [active, setActive] = useState(tabs[0].key);
  const activeTab = tabs.find((t) => t.key === active)!;
  const ref = useReveal<HTMLDivElement>();

  return (
    <section id="features" className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div ref={ref} className="reveal text-center mb-12">
          <div className="inline-block px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium mb-4">
            Features im Detail
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 mb-4">
            Vier Module. Ein Workflow.
          </h2>
        </div>

        {/* Tab-nav */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition ${
                active === t.key
                  ? "bg-slate-900 text-white shadow-lg"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Content — animiert bei Tab-Wechsel */}
        <div key={active} className="grid lg:grid-cols-2 gap-12 items-center" style={{ animation: "fade-up 0.5s ease-out both" }}>
          <div>
            <h3 className="text-3xl font-bold text-slate-900 mb-4">{activeTab.title}</h3>
            <p className="text-lg text-slate-600 leading-relaxed mb-6">{activeTab.body}</p>
            <ul className="space-y-3">
              {activeTab.bullets.map((b, i) => (
                <li key={i} className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                  <span className="text-slate-700">{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>{activeTab.mockup}</div>
        </div>
      </div>
    </section>
  );
}

function MockContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-blue-500/20 rounded-3xl blur-2xl" />
      <div className="relative bg-white border border-slate-200 rounded-2xl shadow-2xl p-5">
        {children}
      </div>
    </div>
  );
}

function MockKunden() {
  return (
    <MockContainer>
      <div className="text-xs font-medium text-slate-500 mb-3">Kunden · Suche „M-AB"</div>
      <div className="space-y-2">
        {[
          { name: "Max Mustermann", plate: "M-AB 1234", brand: "BMW 320d" },
          { name: "Anna Beispiel", plate: "M-AB 5678", brand: "VW Golf" },
          { name: "Auto Meier GmbH", plate: "M-AB 9012", brand: "Ford Transit" },
        ].map((c, i) => (
          <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 border border-slate-100">
            <div>
              <div className="font-medium text-slate-900 text-sm">{c.name}</div>
              <div className="text-xs text-slate-500">{c.brand} · {c.plate}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </div>
        ))}
      </div>
    </MockContainer>
  );
}

function MockKalender() {
  const times = ["08:00", "10:00", "13:00", "15:00"];
  const colors = ["bg-blue-100 border-blue-400", "bg-orange-100 border-orange-400", "bg-emerald-100 border-emerald-400", "bg-slate-100 border-slate-400"];
  return (
    <MockContainer>
      <div className="text-xs font-medium text-slate-500 mb-3">KW 31 · Mo–Sa</div>
      <div className="grid grid-cols-6 gap-1 h-64">
        {Array.from({ length: 6 }).map((_, d) => (
          <div key={d} className="border-l border-slate-100 relative">
            <div className="text-[10px] text-slate-400 text-center py-1 border-b border-slate-100">
              {["Mo", "Di", "Mi", "Do", "Fr", "Sa"][d]}
            </div>
            {times.slice(0, (d + 2) % 4).map((t, i) => (
              <div
                key={i}
                className={`absolute left-1 right-1 rounded p-1 text-[9px] font-medium border ${colors[(d + i) % colors.length]}`}
                style={{ top: `${20 + i * 55}px`, height: "48px" }}
              >
                <div className="font-semibold text-[8px]">{t}</div>
                <div className="text-[8px] opacity-80 truncate">Ölwechsel</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </MockContainer>
  );
}

function MockRechnung() {
  return (
    <MockContainer>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs text-slate-500">Rechnung</div>
          <div className="font-mono font-semibold text-slate-900">RE-26-0042</div>
        </div>
        <div className="text-xs px-2 py-1 bg-orange-50 text-orange-700 rounded font-medium">Bar bezahlt</div>
      </div>
      <div className="text-[10px] font-semibold uppercase text-slate-400 mb-2">Arbeitsleistung</div>
      <MockRow name="Bremsscheiben + Beläge vorne (1,2 Std)" price="114,00" />
      <MockRow name="Ölwechsel (0,5 Std)" price="47,50" />
      <div className="text-[10px] font-semibold uppercase text-slate-400 mt-4 mb-2">Ersatzteile</div>
      <MockRow name="Bremsscheiben-Satz vorne" price="89,50" />
      <MockRow name="Bremsbelag-Satz vorne" price="47,90" />
      <MockRow name="Motoröl 5W-30 (5L)" price="62,50" />
      <div className="border-t border-slate-200 pt-3 mt-3 flex items-center justify-between">
        <div className="text-xs text-slate-500">Brutto</div>
        <div className="text-lg font-bold text-orange-600">431,26 €</div>
      </div>
    </MockContainer>
  );
}

function MockWartungsheft() {
  return (
    <MockContainer>
      <div className="text-xs font-semibold uppercase text-orange-600 mb-2">Service- & Wartungsheft</div>
      <div className="text-lg font-bold text-slate-900 mb-1">BMW 320d Touring</div>
      <div className="text-xs text-slate-500 mb-4">M-AB 1234 · für Max Mustermann</div>
      <div className="space-y-3">
        {[
          { date: "12.03.2026", km: "72.400", work: "Ölwechsel + Inspektion" },
          { date: "05.11.2025", km: "68.100", work: "Bremsbeläge hinten" },
          { date: "22.05.2025", km: "62.500", work: "HU + AU" },
        ].map((e, i) => (
          <div key={i} className="flex items-start gap-3 p-2 rounded bg-slate-50">
            <div className="text-xs font-bold text-orange-600 w-16">{e.date}</div>
            <div className="flex-1">
              <div className="text-xs font-medium text-slate-900">{e.work}</div>
              <div className="text-[10px] text-slate-500">{e.km} km</div>
            </div>
          </div>
        ))}
      </div>
    </MockContainer>
  );
}

/* ------------------------------------------------------------------ */
/* KFZBLITZ24 STORY                                                    */
/* ------------------------------------------------------------------ */
function KfzBlitzStory() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section id="kfzblitz" className="py-24 bg-gradient-to-br from-slate-50 via-orange-50/30 to-slate-50 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: "radial-gradient(ellipse at top left, rgba(254, 101, 3, 0.15) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(10, 37, 64, 0.15) 0%, transparent 50%)",
        }}
      />
      <div className="max-w-6xl mx-auto px-6 relative">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div ref={ref} className="reveal">
            <div className="inline-block px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium mb-4">
              Ein Produkt der kfzBlitz24 GmbH
            </div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 mb-6">
              Wir sind Kfz. Nicht nur Software.
            </h2>
            <div className="space-y-4 text-slate-700 leading-relaxed">
              <p>
                Seit vielen Jahren verkauft kfzBlitz24 Kfz-Ersatzteile an
                Werkstätten und Endkunden in ganz Deutschland.
              </p>
              <p>
                In tausenden Gesprächen haben wir gehört: <strong className="text-slate-900">
                „Ich brauche keine weitere Verwaltungssoftware. Ich brauche
                eine, die versteht, wie eine Werkstatt tickt."</strong>
              </p>
              <p>
                Darum haben wir WerkstattConnect gebaut — nicht als
                Nebenprodukt, sondern als eigenständige Lösung, die genau
                die Probleme löst, die uns eure Kolleg:innen jeden Tag
                schildern.
              </p>
            </div>
            <a
              href="https://kfzblitz24.de"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 mt-8 text-orange-700 font-semibold hover:text-orange-900"
            >
              Über kfzBlitz24 GmbH <ArrowRight className="w-4 h-4" />
            </a>
          </div>
          <div className="relative">
            <StatsGrid />
          </div>
        </div>
      </div>
    </section>
  );
}

function StatsGrid() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className="reveal grid grid-cols-2 gap-4">
      <StatCard number="1M+" label="Ersatzteile im Katalog" icon={<Package className="w-5 h-5" />} color="orange" />
      <StatCard number="10+" label="Jahre Kfz-Erfahrung" icon={<Clock className="w-5 h-5" />} color="blue" />
      <StatCard number="100%" label="GoBD-konform" icon={<ShieldCheck className="w-5 h-5" />} color="emerald" />
      <StatCard number="0 €" label="Für die Basis-Version" icon={<Euro className="w-5 h-5" />} color="purple" />
    </div>
  );
}

function StatCard({ number, label, icon, color }: { number: string; label: string; icon: React.ReactNode; color: string }) {
  const colorMap: Record<string, string> = {
    orange: "from-orange-500 to-orange-700",
    blue: "from-blue-500 to-blue-700",
    emerald: "from-emerald-500 to-emerald-700",
    purple: "from-purple-500 to-purple-700",
  };
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-xl transition hover:-translate-y-1">
      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colorMap[color]} text-white flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <div className="text-3xl font-extrabold text-slate-900 tabular-nums">{number}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* HOW IT WORKS — 4 steps                                              */
/* ------------------------------------------------------------------ */
function HowItWorks() {
  const steps = [
    { n: 1, title: "Werkstatt anmelden", body: "In 60 Sekunden — nur Name, Adresse, Email des Owners." },
    { n: 2, title: "Team einladen", body: "Mitarbeiter bekommen Setup-Mail und legen ihr Passwort selbst fest." },
    { n: 3, title: "Kunden anlegen", body: "Manuell, per Import, oder direkt beim ersten Angebot." },
    { n: 4, title: "Loslegen", body: "Angebote schreiben, Termine planen, Rechnungen versenden — direkt am ersten Tag." },
  ];
  return (
    <section className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium mb-4">
            So läufts
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 mb-4">
            Von null auf Rechnung in 5 Minuten
          </h2>
        </div>
        <div className="relative grid md:grid-cols-4 gap-8">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-8 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-transparent via-orange-300 to-transparent" />
          {steps.map((s, i) => (
            <StepCard key={s.n} {...s} delay={i * 150} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StepCard({ n, title, body, delay }: { n: number; title: string; body: string; delay: number }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className="reveal relative text-center" style={{ transitionDelay: `${delay}ms` }}>
      <div className="w-16 h-16 rounded-full bg-white border-2 border-orange-500 text-orange-600 font-extrabold text-xl flex items-center justify-center mx-auto mb-4 shadow-lg relative z-10">
        {n}
      </div>
      <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{body}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* WHY US — 6 benefits                                                 */
/* ------------------------------------------------------------------ */
function WhyUs() {
  const benefits = [
    { icon: <Zap className="w-5 h-5" />, title: "Blitzschnell", body: "Aus Katalog zusammenklicken statt tippen. 30 Sekunden pro Angebot." },
    { icon: <ShieldCheck className="w-5 h-5" />, title: "Steuerberater-safe", body: "GoBD-konforme Nummerierung + Journal. ZUGFeRD-Embed für E-Rechnung 2025." },
    { icon: <Palette className="w-5 h-5" />, title: "Dein Design", body: "18 Briefpapier-Templates, freie Farben, Logo-Upload, 3-Spalten-Fußzeile." },
    { icon: <BookOpenCheck className="w-5 h-5" />, title: "Kundenbindung", body: "Digitales Wartungsheft mit deinem Logo — dein Kunde kommt wieder." },
    { icon: <BellRing className="w-5 h-5" />, title: "Automatische Reminder", body: "TÜV, Ölwechsel, Bremsflüssigkeit — Kunde bekommt Erinnerung von dir." },
    { icon: <TrendingUp className="w-5 h-5" />, title: "Skaliert mit", body: "1 Mechaniker oder 20 — gleicher Preis. Free-Version reicht für den Start." },
  ];
  return (
    <section className="py-24 bg-slate-50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 mb-4">
            Warum WerkstattConnect?
          </h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {benefits.map((b, i) => (
            <BenefitCard key={i} {...b} delay={i * 80} />
          ))}
        </div>
      </div>
    </section>
  );
}

function BenefitCard({ icon, title, body, delay }: { icon: React.ReactNode; title: string; body: string; delay: number }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className="reveal bg-white border border-slate-200 rounded-xl p-6 hover:border-orange-300 transition" style={{ transitionDelay: `${delay}ms` }}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <h3 className="font-bold text-slate-900 mb-1">{title}</h3>
          <p className="text-sm text-slate-600 leading-relaxed">{body}</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PRICING                                                             */
/* ------------------------------------------------------------------ */
function Pricing() {
  return (
    <section id="pricing" className="py-24 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-block px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium mb-4">
            Preise
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 mb-4">
            Fair. Transparent. Ehrlich.
          </h2>
          <p className="text-lg text-slate-600">Free reicht für den Start. Pro wenn du Kunden binden willst.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <PricingCard
            plan="Free"
            price="0 €"
            per="Für immer"
            features={[
              "Unbegrenzt Kunden + Fahrzeuge",
              "Angebote + Rechnungen (GoBD)",
              "ZUGFeRD-E-Rechnung",
              "18 Briefpapier-Templates",
              "Kalender + Ressourcen-Planung",
              "Digitales Wartungsheft",
              "Team-Mitglieder ohne Limit",
            ]}
          />
          <PricingCard
            plan="Pro"
            price="29 €"
            per="pro Monat"
            highlight
            features={[
              "Alles aus Free",
              "Automatische TÜV-Erinnerung",
              "Öl-/Bremsflüssigkeits-Reminder",
              "Kunden-Benachrichtigungen per Mail",
              "Erweiterte Statistiken",
              "Priority-Support",
              "Frühzugriff neue Features",
            ]}
          />
        </div>
      </div>
    </section>
  );
}

function PricingCard({
  plan,
  price,
  per,
  features,
  highlight,
}: {
  plan: string;
  price: string;
  per: string;
  features: string[];
  highlight?: boolean;
}) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`reveal rounded-2xl p-8 border transition hover:-translate-y-1 ${
        highlight
          ? "bg-gradient-to-br from-orange-600 to-orange-700 border-orange-500 text-white shadow-2xl shadow-orange-600/30"
          : "bg-white border-slate-200 text-slate-900 hover:border-orange-300 hover:shadow-xl"
      }`}
    >
      {highlight && (
        <div className="inline-block px-2 py-0.5 bg-white/20 text-white rounded text-xs font-semibold mb-3">
          Beliebt
        </div>
      )}
      <div className="text-2xl font-bold mb-2">{plan}</div>
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-5xl font-extrabold">{price}</span>
      </div>
      <div className={`text-sm mb-6 ${highlight ? "text-orange-100" : "text-slate-500"}`}>{per}</div>
      <ul className="space-y-3 mb-8">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <Check className={`w-4 h-4 mt-0.5 shrink-0 ${highlight ? "text-white" : "text-emerald-600"}`} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/login"
        className={`block text-center px-4 py-3 rounded-xl font-semibold transition ${
          highlight
            ? "bg-white text-orange-700 hover:bg-orange-50"
            : "bg-slate-900 text-white hover:bg-slate-800"
        }`}
      >
        {highlight ? "Pro starten" : "Kostenlos starten"}
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FINAL CTA                                                           */
/* ------------------------------------------------------------------ */
function FinalCta() {
  return (
    <section className="py-24 bg-slate-900 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: "linear-gradient(135deg, #fe6503 0%, transparent 40%, transparent 60%, #06b6d4 100%)",
          backgroundSize: "200% 200%",
          animation: "gradient-shift 15s ease infinite",
        }}
      />
      <div className="max-w-4xl mx-auto px-6 text-center relative">
        <Sparkles className="w-12 h-12 text-orange-400 mx-auto mb-6" />
        <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
          Bereit für den nächsten<br />Schritt in deiner Werkstatt?
        </h2>
        <p className="text-xl text-white/80 mb-10 max-w-2xl mx-auto">
          Starte kostenlos. Ohne Kreditkarte. Ohne Vertrag.
          <br />
          Dein Zugang ist in einer Minute eingerichtet.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/login"
            className="group inline-flex items-center gap-2 px-8 py-4 bg-orange-600 text-white rounded-xl font-bold text-lg hover:bg-orange-700 transition shadow-2xl shadow-orange-600/40 hover:-translate-y-0.5"
          >
            Werkstatt-Zugang holen
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
          </Link>
          <a
            href="mailto:info@kfzblitz24.de?subject=WerkstattConnect%20Demo"
            className="inline-flex items-center gap-2 px-8 py-4 border border-white/20 text-white rounded-xl font-semibold hover:bg-white/10 transition"
          >
            Live-Demo vereinbaren
          </a>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* FOOTER                                                              */
/* ------------------------------------------------------------------ */
function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400 py-16">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          <div>
            <img src="/werkstattconnect-logo.svg" alt="WerkstattConnect" className="h-10 w-auto mb-4 brightness-200" />
            <p className="text-xs text-slate-500 leading-relaxed">
              Das digitale Rückgrat für moderne Kfz-Werkstätten. Ein Produkt der kfzBlitz24 GmbH.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm">Produkt</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#was" className="hover:text-white transition">Was ist das?</a></li>
              <li><a href="#features" className="hover:text-white transition">Features</a></li>
              <li><a href="#pricing" className="hover:text-white transition">Preise</a></li>
              <li><Link href="/login" className="hover:text-white transition">Login</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm">kfzBlitz24</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="https://kfzblitz24.de" target="_blank" rel="noopener" className="hover:text-white transition">Shop</a></li>
              <li><a href="https://kfzblitz24.de/impressum" className="hover:text-white transition">Impressum</a></li>
              <li><a href="https://kfzblitz24.de/datenschutz" className="hover:text-white transition">Datenschutz</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm">Kontakt</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="mailto:info@kfzblitz24.de" className="hover:text-white transition">info@kfzblitz24.de</a></li>
              <li className="text-xs text-slate-500 pt-2">
                kfzBlitz24 GmbH<br />
                Rauschwalder Str. 48B<br />
                02826 Görlitz
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs">
          <div>© {new Date().getFullYear()} kfzBlitz24 GmbH · Alle Rechte vorbehalten</div>
          <div className="flex items-center gap-4">
            <Link href="/admin/login" className="hover:text-white transition">KB24-Admin</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
