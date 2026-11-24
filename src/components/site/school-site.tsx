/* eslint-disable @next/next/no-img-element -- photos servies par la plateforme, déjà réduites */
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ArrowUpRight, Clock, Mail, MapPin, MessageCircle, Phone, Sparkles } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { pickName } from "@/i18n/localized";
import type { SiteData } from "@/lib/data/site";
import { paragraphs, parseCycleTexts, parseHighlights, pickText, whatsappNumber } from "@/lib/site/content";
import { siteTheme } from "@/lib/site/themes";
import { InquiryForm } from "./inquiry-form";

export const photoUrl = (id: string) => `/api/vitrine/photo/${id}`;

/**
 * Page vitrine publique d'une école. Toutes les sections viennent des
 * réglages de la direction (« Site de l'école ») ; une section vide n'est
 * simplement pas affichée.
 */
export function SchoolSite({
  data,
  lang,
  dict,
  otherLangHref,
  preview,
}: {
  data: SiteData;
  lang: Locale;
  dict: Dictionary;
  /** Même page dans l'autre langue. */
  otherLangHref: string;
  /** Page non publiée, vue par la direction. */
  preview?: boolean;
}) {
  const v = dict.vitrine;
  const { school, site, logo, hero, gallery } = data;
  const theme = siteTheme(site?.theme);
  const name = pickName(school, lang);
  const heroTitle = pickText(site?.heroTitleFr, site?.heroTitleAr, lang) || name;
  const heroText = pickText(site?.heroTextFr, site?.heroTextAr, lang);
  const about = paragraphs(pickText(site?.aboutFr, site?.aboutAr, lang));
  const highlights = parseHighlights(site?.highlights);
  const cycleTexts = parseCycleTexts(site?.cycleTexts);
  const admissions = paragraphs(pickText(site?.admissionsFr, site?.admissionsAr, lang));
  const hours = pickText(site?.hoursFr, site?.hoursAr, lang);
  const wa = whatsappNumber(site?.whatsapp);
  const showForm = site?.inquiryForm ?? true;
  const cycles = (["PRIMARY", "MIDDLE", "SECONDARY"] as const).filter((c) => school.cycles.includes(c));
  const otherLang: Locale = lang === "fr" ? "ar" : "fr";

  const menu = [
    about.length > 0 && { id: "ecole", label: v.about },
    highlights.length > 0 && { id: "atouts", label: v.highlights },
    cycles.length > 0 && { id: "cycles", label: v.cycles },
    gallery.length > 0 && { id: "photos", label: v.gallery },
    admissions.length > 0 && { id: "inscriptions", label: v.admissions },
    { id: "contact", label: v.contact },
  ].filter((x): x is { id: string; label: string } => !!x);

  const style = {
    "--site-primary": theme.primary,
    "--site-accent": theme.accent,
    "--site-soft": theme.soft,
  } as CSSProperties;

  return (
    <div style={style} className="flex min-h-screen flex-col overflow-x-clip bg-[var(--site-soft)] text-slate-900">
      {preview && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
          <span>{v.preview}</span>
          <Link href={`/${lang}/site-vitrine`} className="font-semibold underline underline-offset-2">
            {v.edit}
          </Link>
        </div>
      )}

      {/* En-tête */}
      <header className="sticky top-0 z-30 border-b border-black/5 bg-[var(--site-soft)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <a href="#haut" className="flex min-w-0 items-center gap-3">
            <SchoolLogo logoId={logo?.id} name={name} />
            <span className="truncate font-display text-lg leading-tight font-semibold text-[var(--site-primary)] sm:text-xl">{name}</span>
          </a>
          <nav className="ms-auto hidden items-center gap-1 lg:flex" aria-label={v.menuLabel}>
            {menu.map((m) => (
              <a key={m.id} href={`#${m.id}`} className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-black/5">
                {m.label}
              </a>
            ))}
          </nav>
          <div className="ms-auto flex shrink-0 items-center gap-2 lg:ms-2">
            <Link href={otherLangHref} lang={otherLang} className="rounded-full border border-black/10 px-3 py-1.5 text-sm font-medium hover:bg-black/5">
              {dict.language.switchTo}
            </Link>
            <Link
              href={`/${lang}/connexion`}
              className="hidden rounded-full bg-[var(--site-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 sm:inline-block"
            >
              {v.parentSpace}
            </Link>
          </div>
        </div>
        {menu.length > 1 && (
          <nav className="-mt-1 flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden" aria-label={v.menuLabel}>
            {menu.map((m) => (
              <a key={m.id} href={`#${m.id}`} className="shrink-0 rounded-full px-3 py-1 text-sm font-medium text-slate-700 hover:bg-black/5">
                {m.label}
              </a>
            ))}
            <Link href={`/${lang}/connexion`} className="shrink-0 rounded-full px-3 py-1 text-sm font-semibold text-[var(--site-primary)] sm:hidden">
              {v.parentSpace}
            </Link>
          </nav>
        )}
      </header>

      <main id="haut" className="flex-1">
        {/* Accueil */}
        <section className="relative isolate overflow-hidden bg-[var(--site-primary)] text-white">
          {hero ? (
            <>
              <img src={photoUrl(hero.id)} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
              <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[var(--site-primary)] via-[var(--site-primary)]/70 to-[var(--site-primary)]/25" />
            </>
          ) : (
            <HeroPattern />
          )}
          <div className="mx-auto flex min-h-[26rem] max-w-6xl flex-col justify-end gap-5 px-4 pt-24 pb-14 sm:min-h-[32rem] sm:px-6 sm:pb-20">
            {school.city && (
              <p className="flex items-center gap-1.5 text-sm font-medium tracking-wide text-[var(--site-accent)] uppercase">
                <MapPin size={16} aria-hidden /> {school.city}
              </p>
            )}
            <h1 className="max-w-3xl font-display text-4xl leading-[1.1] font-semibold text-balance sm:text-6xl">{heroTitle}</h1>
            {heroText && <p className="max-w-2xl text-lg leading-relaxed text-white/85 sm:text-xl">{heroText}</p>}
            <div className="mt-2 flex flex-wrap gap-3">
              <a href="#contact" className="rounded-full bg-[var(--site-accent)] px-6 py-3 text-base font-semibold text-[var(--site-primary)] shadow-sm hover:brightness-105">
                {v.askInfo}
              </a>
              {school.phone && (
                <a href={`tel:${school.phone}`} className="flex items-center gap-2 rounded-full border border-white/40 px-5 py-3 text-base font-semibold hover:bg-white/10">
                  <Phone size={18} aria-hidden /> {v.callUs}
                </a>
              )}
            </div>
          </div>
        </section>

        {/* Présentation */}
        {about.length > 0 && (
          <Section id="ecole" label={v.about} title={name}>
            <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-start">
              <div className="flex flex-col gap-4 text-lg leading-relaxed text-slate-700">
                {about.map((p, i) => (
                  <p key={i} className={i === 0 ? "text-xl text-slate-800" : undefined}>
                    {p}
                  </p>
                ))}
              </div>
              {gallery[0] && (
                <figure className="relative">
                  <div className="absolute -inset-2 -z-10 translate-x-2 translate-y-3 sm:translate-x-3 rounded-[2rem] bg-[var(--site-accent)]/30 rtl:-translate-x-2 sm:rtl:-translate-x-3" />
                  <img src={photoUrl(gallery[0].id)} alt={pickText(gallery[0].captionFr, gallery[0].captionAr, lang)} className="aspect-[4/3] w-full rounded-[1.75rem] object-cover" />
                </figure>
              )}
            </div>
          </Section>
        )}

        {/* Atouts */}
        {highlights.length > 0 && (
          <Section id="atouts" label={v.highlights} tone="white">
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {highlights.map((h, i) => (
                <li key={i} className="rounded-3xl bg-[var(--site-soft)] p-6">
                  <span className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-[var(--site-primary)] text-[var(--site-accent)]">
                    <Sparkles size={20} aria-hidden />
                  </span>
                  <h3 className="mb-1.5 text-lg font-semibold text-[var(--site-primary)]">{pickText(h.titleFr, h.titleAr, lang)}</h3>
                  <p className="leading-relaxed text-slate-600">{pickText(h.textFr, h.textAr, lang)}</p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Cycles */}
        {cycles.length > 0 && (
          <Section id="cycles" label={v.cycles}>
            <ul className={`grid gap-4 ${cycles.length === 3 ? "md:grid-cols-3" : cycles.length === 2 ? "md:grid-cols-2" : ""}`}>
              {cycles.map((c, i) => (
                <li key={c} className="relative overflow-hidden rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                  <span className="absolute -end-1 -top-4 font-display text-[7rem] leading-none font-semibold text-[var(--site-accent)]/20" aria-hidden>
                    {i + 1}
                  </span>
                  <h3 className="relative mb-2 font-display text-2xl font-semibold text-[var(--site-primary)]">{dict.cycles[c]}</h3>
                  <p className="relative leading-relaxed text-slate-600">{pickText(cycleTexts[c]?.fr, cycleTexts[c]?.ar, lang) || v.cycleDefault[c]}</p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Galerie */}
        {gallery.length > 0 && (
          <Section id="photos" label={v.gallery} tone="white">
            <ul className="columns-2 gap-3 sm:gap-4 lg:columns-3">
              {gallery.map((p) => {
                const caption = pickText(p.captionFr, p.captionAr, lang);
                return (
                  <li key={p.id} className="mb-3 break-inside-avoid sm:mb-4">
                    <figure className="overflow-hidden rounded-2xl bg-[var(--site-soft)]">
                      <a href={photoUrl(p.id)} target="_blank" rel="noopener">
                        <img src={photoUrl(p.id)} alt={caption} loading="lazy" className="w-full transition duration-300 hover:scale-[1.02]" />
                      </a>
                      {caption && <figcaption className="px-3 py-2 text-sm text-slate-600">{caption}</figcaption>}
                    </figure>
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        {/* Inscriptions */}
        {admissions.length > 0 && (
          <section id="inscriptions" className="scroll-mt-28 bg-[var(--site-primary)] text-white">
            <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1fr_1.4fr]">
              <div>
                <p className="mb-2 text-sm font-semibold tracking-wider text-[var(--site-accent)] uppercase">{v.admissions}</p>
                <h2 className="font-display text-3xl leading-tight font-semibold sm:text-4xl">{name}</h2>
              </div>
              <div className="flex flex-col gap-4 text-lg leading-relaxed text-white/85">
                {admissions.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
                <div className="mt-2 flex flex-wrap gap-3">
                  <a href="#contact" className="rounded-full bg-[var(--site-accent)] px-6 py-3 text-base font-semibold text-[var(--site-primary)] hover:brightness-105">
                    {v.askInfo}
                  </a>
                  {wa && (
                    <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener" className="flex items-center gap-2 rounded-full border border-white/40 px-5 py-3 font-semibold hover:bg-white/10">
                      <MessageCircle size={18} aria-hidden /> {v.writeWhatsapp}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Contact */}
        <Section id="contact" label={v.contact} title={showForm ? v.formTitle : undefined}>
          <div className={`grid gap-8 ${showForm ? "lg:grid-cols-[1fr_1.3fr]" : ""}`}>
            <div className="flex flex-col gap-5">
              {showForm && <p className="text-lg text-slate-600">{v.formIntro}</p>}
              <ul className="flex flex-col gap-4">
                {school.address && (
                  <ContactLine icon={<MapPin size={20} />} label={v.address}>
                    {school.address}
                    {school.city && !school.address.includes(school.city) ? `, ${school.city}` : ""}
                    {site?.mapUrl && (
                      <a href={site.mapUrl} target="_blank" rel="noopener" className="mt-1 flex w-fit items-center gap-1 text-sm font-semibold text-[var(--site-primary)] underline underline-offset-2">
                        {v.seeMap} <ArrowUpRight size={14} className="rtl:-scale-x-100" aria-hidden />
                      </a>
                    )}
                  </ContactLine>
                )}
                {school.phone && (
                  <ContactLine icon={<Phone size={20} />} label={v.phone}>
                    <a href={`tel:${school.phone}`} dir="ltr" className="font-semibold hover:underline">
                      {formatPhone(school.phone)}
                    </a>
                  </ContactLine>
                )}
                {school.email && (
                  <ContactLine icon={<Mail size={20} />} label={v.email}>
                    <a href={`mailto:${school.email}`} dir="ltr" className="font-semibold break-all hover:underline">
                      {school.email}
                    </a>
                  </ContactLine>
                )}
                {hours && (
                  <ContactLine icon={<Clock size={20} />} label={v.hours}>
                    {hours}
                  </ContactLine>
                )}
              </ul>
              <div className="flex flex-wrap gap-2">
                {wa && (
                  <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener" className="flex items-center gap-2 rounded-full bg-[#1fa855] px-5 py-2.5 font-semibold text-white hover:opacity-90">
                    <MessageCircle size={18} aria-hidden /> {v.writeWhatsapp}
                  </a>
                )}
                {site?.facebookUrl && (
                  <a href={site.facebookUrl} target="_blank" rel="noopener" aria-label="Facebook" className="grid h-11 w-11 place-items-center rounded-full bg-white ring-1 ring-black/10 hover:bg-black/5">
                    <Facebook size={20} aria-hidden />
                  </a>
                )}
                {site?.instagramUrl && (
                  <a href={site.instagramUrl} target="_blank" rel="noopener" aria-label="Instagram" className="grid h-11 w-11 place-items-center rounded-full bg-white ring-1 ring-black/10 hover:bg-black/5">
                    <Instagram size={20} aria-hidden />
                  </a>
                )}
              </div>
            </div>
            {showForm && (
              <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-7">
                <InquiryForm
                  schoolId={school.id}
                  labels={{
                    name: v.name,
                    phone: v.phone2,
                    email: v.email2,
                    emailHint: v.emailHint,
                    level: v.level,
                    levelHint: v.levelHint,
                    message: v.message,
                    send: v.send,
                    sending: v.sending,
                    sent: v.sent,
                    error: v.error,
                    busy: v.busy,
                  }}
                />
              </div>
            )}
          </div>
        </Section>
      </main>

      <footer className="bg-[var(--site-primary)] text-white/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <SchoolLogo logoId={logo?.id} name={name} small />
            <span>
              © {new Date().getFullYear()} {name} · {v.rights}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link href={`/${lang}/connexion`} className="font-semibold text-white hover:underline">
              {v.parentSpace}
            </Link>
            <span className="text-white/50">{v.poweredBy}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({ id, label, title, tone, children }: { id: string; label: string; title?: string; tone?: "white"; children: ReactNode }) {
  return (
    <section id={id} className={`scroll-mt-28 ${tone === "white" ? "bg-white" : ""}`}>
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold tracking-wider text-[var(--site-primary)] uppercase">
          <span className="h-0.5 w-6 rounded bg-[var(--site-accent)]" aria-hidden />
          {label}
        </p>
        {title && <h2 className="mb-8 font-display text-3xl leading-tight font-semibold text-[var(--site-primary)] sm:text-4xl">{title}</h2>}
        {!title && <div className="mb-6" />}
        {children}
      </div>
    </section>
  );
}

function ContactLine({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <li className="flex gap-3.5">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-[var(--site-primary)] ring-1 ring-black/5" aria-hidden>
        {icon}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</span>
        <span className="text-slate-800">{children}</span>
      </div>
    </li>
  );
}

/** Logo de l'école, ou ses initiales dans un médaillon si aucun logo n'est envoyé. */
function SchoolLogo({ logoId, name, small }: { logoId?: string; name: string; small?: boolean }) {
  const size = small ? "h-9 w-9" : "h-11 w-11";
  if (logoId) return <img src={photoUrl(logoId)} alt="" className={`${size} shrink-0 rounded-xl bg-white object-contain`} />;
  const initials = name
    .replace(/^(école|ecole|groupe scolaire|institut|collège|lycée)\s+/i, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 || /^[A-Z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span className={`${size} grid shrink-0 place-items-center rounded-xl bg-[var(--site-primary)] font-display text-base font-semibold text-[var(--site-accent)] ring-2 ring-[var(--site-accent)]/40`} aria-hidden>
      {initials || name[0]}
    </span>
  );
}

/** Motif discret (lignes d'écriture et plume) quand l'école n'a pas encore de photo d'accueil. */
function HeroPattern() {
  return (
    <svg className="absolute inset-0 -z-10 h-full w-full" aria-hidden preserveAspectRatio="xMidYMid slice" viewBox="0 0 1200 600">
      <defs>
        <pattern id="lignes" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M0 39.5H40" stroke="white" strokeOpacity="0.06" />
        </pattern>
        <radialGradient id="halo" cx="80%" cy="20%" r="60%">
          <stop offset="0" stopColor="var(--site-accent)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--site-accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="600" fill="url(#lignes)" />
      <rect width="1200" height="600" fill="url(#halo)" />
      <path
        d="M1010 70c-120 18-228 126-264 270l-36 126 36 9 36-90c108 0 198-90 234-198-36 18-72 18-108 18 54-36 90-72 108-135z"
        fill="var(--site-accent)"
        fillOpacity="0.16"
      />
    </svg>
  );
}

/** +21671234567 → +216 71 234 567 */
function formatPhone(phone: string) {
  const m = phone.match(/^\+216(\d{2})(\d{3})(\d{3})$/);
  return m ? `+216 ${m[1]} ${m[2]} ${m[3]}` : phone;
}

// Logos Facebook et Instagram (simplifiés), absents de la bibliothèque d'icônes.
function Facebook({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H7.9v3h2.6V21h3z" />
    </svg>
  );
}

function Instagram({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}
