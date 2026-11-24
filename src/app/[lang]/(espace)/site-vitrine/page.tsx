/* eslint-disable @next/next/no-img-element -- photos servies par la plateforme */
import Link from "next/link";
import { ArrowUpRight, Phone } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { t } from "@/i18n/format";
import { requirePermission } from "@/lib/auth/context";
import { getSiteForAdmin, siteInquiries } from "@/lib/data/site";
import { MAX_GALLERY_PHOTOS, MAX_HIGHLIGHTS, parseCycleTexts, parseHighlights, whatsappNumber } from "@/lib/site/content";
import { SITE_THEMES, type SiteThemeName } from "@/lib/site/themes";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { PhotoInput } from "@/components/site/photo-input";
import { photoUrl } from "@/components/site/school-site";
import {
  deleteSitePhoto,
  moveSitePhoto,
  saveSiteAbout,
  saveSiteAdmissions,
  saveSiteContact,
  saveSiteCycles,
  saveSiteHero,
  saveSiteHighlights,
  saveSitePhotoCaption,
  saveSitePublished,
  saveSiteTheme,
  setInquiryHandled,
  uploadSitePhoto,
} from "./actions";

const small = "[&_button]:px-2.5 [&_button]:py-1 [&_button]:text-xs";

export default async function SiteSettingsPage({ params }: PageProps<"/[lang]/site-vitrine">) {
  const lang = (await params).lang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "site.write");
  const s = dict.site;
  const labels = formLabels(dict, dict.common.save);
  const [data, inquiries] = await Promise.all([getSiteForAdmin(ctx.school.id), siteInquiries(ctx.school.id)]);
  if (!data) return null;
  const { school, site, logo, hero, gallery } = data;
  const highlights = parseHighlights(site?.highlights);
  const cycleTexts = parseCycleTexts(site?.cycleTexts);
  const cycles = (["PRIMARY", "MIDDLE", "SECONDARY"] as const).filter((c) => school.cycles.includes(c));
  const pagePath = `/${lang}/ecole/${school.slug}`;
  const pending = inquiries.filter((i) => !i.handledAt).length;
  const fmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-TN" : "fr-TN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Tunis" });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={s.title}
        subtitle={s.intro}
        action={
          <a href={pagePath} target="_blank" rel="noopener" className="flex items-center gap-1.5 rounded-xl bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800">
            {s.view} <ArrowUpRight size={16} className="rtl:-scale-x-100" aria-hidden />
          </a>
        }
      />

      <Card title={s.status}>
        <p className={`mb-3 w-fit rounded-full px-3 py-1 text-sm font-semibold ${site?.published ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}>
          {site?.published ? s.published : s.draft}
        </p>
        <ActionForm action={saveSitePublished.bind(null, lang)} labels={labels}>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="published" defaultChecked={site?.published ?? false} className="mt-0.5 h-5 w-5 shrink-0" />
            <span>
              <span className="block font-medium">{s.publishLabel}</span>
              <span className="text-slate-500">{s.publishHint}</span>
            </span>
          </label>
        </ActionForm>
        <dl className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 text-sm">
          <div>
            <dt className="text-slate-500">{s.pageAddress}</dt>
            <dd>
              <a href={pagePath} target="_blank" rel="noopener" dir="ltr" className="font-medium text-blue-800 underline underline-offset-2">
                {pagePath}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{s.domainSet}</dt>
            <dd>{site?.domain ? <bdi dir="ltr" className="font-semibold">{site.domain}</bdi> : <span className="text-slate-500">{s.domainNone}</span>}</dd>
          </div>
        </dl>
      </Card>

      <section id="demandes" className="scroll-mt-20">
        <Card title={`${s.inquiries}${pending ? ` · ${t(s.newCount, { n: pending })}` : ""}`}>
          {inquiries.length === 0 ? (
            <p className="text-sm text-slate-500">{s.inquiriesEmpty}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {inquiries.map((q) => {
                const wa = whatsappNumber(q.phone);
                return (
                  <li key={q.id} className={`rounded-xl p-3 ring-1 ${q.handledAt ? "bg-slate-50 ring-slate-200 opacity-70" : "bg-gold-50 ring-gold-200"}`}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-semibold">{q.parentName}</span>
                      <span className="text-xs text-slate-500">{fmt.format(q.createdAt)}</span>
                    </div>
                    <p className="text-sm text-slate-600">
                      <bdi dir="ltr">{q.phone}</bdi>
                      {q.email && (
                        <>
                          {" · "}
                          <bdi dir="ltr">{q.email}</bdi>
                        </>
                      )}
                      {q.childLevel && ` · ${s.level} : ${q.childLevel}`}
                    </p>
                    <p className="mt-1.5 text-sm whitespace-pre-line">{q.message}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <a href={`tel:${q.phone}`} className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold hover:bg-slate-50">
                        <Phone size={13} aria-hidden /> {s.call}
                      </a>
                      {wa && (
                        <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener" className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold hover:bg-slate-50">
                          {s.replyWhatsapp}
                        </a>
                      )}
                      <ActionForm
                        action={setInquiryHandled.bind(null, lang, q.id, !q.handledAt)}
                        labels={{ ...formLabels(dict, q.handledAt ? s.reopen : s.markHandled), saved: undefined }}
                        variant="secondary"
                        className={small}
                      />
                      {q.handledAt && <span className="text-xs font-semibold text-green-700">✓ {s.handled}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      <Card title={s.appearance}>
        <ActionForm action={saveSiteTheme.bind(null, lang)} labels={labels}>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{s.color}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(Object.keys(SITE_THEMES) as SiteThemeName[]).map((name) => {
                const th = SITE_THEMES[name];
                return (
                  <label key={name} className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 p-2.5 text-sm has-[:checked]:border-blue-900 has-[:checked]:ring-2 has-[:checked]:ring-blue-900/20">
                    <input type="radio" name="theme" value={name} defaultChecked={(site?.theme ?? "encre") === name} className="sr-only" />
                    <span className="flex h-8 w-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-black/10" aria-hidden>
                      <span className="flex-[2]" style={{ background: th.primary }} />
                      <span className="flex-1" style={{ background: th.accent }} />
                      <span className="flex-1" style={{ background: th.soft }} />
                    </span>
                    {s.themes[name]}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </ActionForm>
        <div className="mt-5 border-t border-slate-100 pt-4">
          <h3 className="mb-2 font-medium">
            {s.logo} <span className="text-sm font-normal text-slate-500">({s.logoHint})</span>
          </h3>
          <div className="flex flex-wrap items-start gap-4">
            {logo && (
              <div className="flex flex-col items-center gap-2">
                <img src={photoUrl(logo.id)} alt="" className="h-20 w-20 rounded-xl bg-white object-contain ring-1 ring-slate-200" />
                <ActionForm action={deleteSitePhoto.bind(null, lang, logo.id)} labels={formLabels(dict, s.removePhoto)} variant="danger" className={small} />
              </div>
            )}
            <div className="min-w-60 flex-1">
              <ActionForm action={uploadSitePhoto.bind(null, lang, "LOGO")} labels={formLabels(dict, s.addPhoto)} resetOnSuccess>
                <PhotoInput label={s.choosePhoto} maxSize={512} keepTransparency />
              </ActionForm>
            </div>
          </div>
        </div>
      </Card>

      <Card title={s.heroSection}>
        <ActionForm action={saveSiteHero.bind(null, lang)} labels={labels}>
          <BiFields label={s.heroTitle} hint={s.heroTitleHint} names={["heroTitleFr", "heroTitleAr"]} values={[site?.heroTitleFr, site?.heroTitleAr]} max={120} inFr={s.inFr} inAr={s.inAr} />
          <BiFields label={s.heroText} names={["heroTextFr", "heroTextAr"]} values={[site?.heroTextFr, site?.heroTextAr]} max={300} rows={2} inFr={s.inFr} inAr={s.inAr} />
        </ActionForm>
        <div className="mt-5 border-t border-slate-100 pt-4">
          <h3 className="mb-2 font-medium">
            {s.heroPhoto} <span className="text-sm font-normal text-slate-500">({s.heroPhotoHint})</span>
          </h3>
          {hero && (
            <div className="mb-3 flex flex-col gap-2">
              <img src={photoUrl(hero.id)} alt="" className="aspect-[16/7] w-full max-w-xl rounded-xl object-cover ring-1 ring-slate-200" />
              <ActionForm action={deleteSitePhoto.bind(null, lang, hero.id)} labels={formLabels(dict, s.removePhoto)} variant="danger" className={small} />
            </div>
          )}
          <ActionForm action={uploadSitePhoto.bind(null, lang, "HERO")} labels={formLabels(dict, s.addPhoto)} resetOnSuccess>
            <PhotoInput label={s.choosePhoto} maxSize={2000} />
          </ActionForm>
        </div>
      </Card>

      <Card title={s.aboutSection}>
        <p className="mb-3 text-sm text-slate-600">{s.aboutHint}</p>
        <ActionForm action={saveSiteAbout.bind(null, lang)} labels={labels}>
          <BiFields names={["aboutFr", "aboutAr"]} values={[site?.aboutFr, site?.aboutAr]} max={4000} rows={7} inFr={s.inFr} inAr={s.inAr} />
        </ActionForm>
      </Card>

      <Card title={s.highlightsSection}>
        <p className="mb-3 text-sm text-slate-600">{s.highlightsIntro}</p>
        <ActionForm action={saveSiteHighlights.bind(null, lang)} labels={labels}>
          {Array.from({ length: MAX_HIGHLIGHTS }, (_, i) => {
            const h = highlights[i];
            return (
              <details key={i} open={i < Math.max(highlights.length, 1)} className="rounded-xl bg-slate-50 p-3 [&[open]>summary]:mb-3">
                <summary className="cursor-pointer font-medium">
                  {t(s.highlight, { n: i + 1 })}
                  {h && <span className="ms-2 font-normal text-slate-500">· {lang === "ar" ? h.titleAr || h.titleFr : h.titleFr || h.titleAr}</span>}
                </summary>
                <div className="flex flex-col gap-3">
                  <BiFields label={s.highlightTitle} names={[`titleFr${i}`, `titleAr${i}`]} values={[h?.titleFr, h?.titleAr]} max={80} inFr={s.inFr} inAr={s.inAr} />
                  <BiFields label={s.highlightText} names={[`textFr${i}`, `textAr${i}`]} values={[h?.textFr, h?.textAr]} max={400} rows={2} inFr={s.inFr} inAr={s.inAr} />
                </div>
              </details>
            );
          })}
        </ActionForm>
      </Card>

      {cycles.length > 0 && (
        <Card title={s.cyclesSection}>
          <p className="mb-3 text-sm text-slate-600">{s.cyclesIntro}</p>
          <ActionForm action={saveSiteCycles.bind(null, lang)} labels={labels}>
            {cycles.map((c) => (
              <BiFields
                key={c}
                label={dict.cycles[c]}
                names={[`${c}Fr`, `${c}Ar`]}
                values={[cycleTexts[c]?.fr, cycleTexts[c]?.ar]}
                placeholders={[dict.vitrine.cycleDefault[c], undefined]}
                max={400}
                rows={2}
                inFr={s.inFr}
                inAr={s.inAr}
              />
            ))}
          </ActionForm>
        </Card>
      )}

      <Card title={`${s.gallerySection} (${gallery.length}/${MAX_GALLERY_PHOTOS})`}>
        <p className="mb-3 text-sm text-slate-600">{t(s.galleryIntro, { max: MAX_GALLERY_PHOTOS })}</p>
        {gallery.length === 0 ? (
          <p className="mb-4 text-sm text-slate-500">{s.noPhotos}</p>
        ) : (
          <ul className="mb-5 grid gap-3 sm:grid-cols-2">
            {gallery.map((p, i) => (
              <li key={p.id} className="flex flex-col gap-2 rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-200">
                <img src={photoUrl(p.id)} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-lg object-cover" />
                <ActionForm action={saveSitePhotoCaption.bind(null, lang, p.id)} labels={labels} className={`flex flex-col gap-2 ${small}`}>
                  <Input name="captionFr" maxLength={160} defaultValue={p.captionFr ?? ""} placeholder={`${s.caption} (${s.inFr})`} aria-label={`${s.caption} (${s.inFr})`} />
                  <Input name="captionAr" maxLength={160} lang="ar" dir="rtl" defaultValue={p.captionAr ?? ""} placeholder={`${s.caption} (${s.inAr})`} aria-label={`${s.caption} (${s.inAr})`} />
                </ActionForm>
                <div className="flex flex-wrap gap-1.5">
                  {i > 0 && <ActionForm action={moveSitePhoto.bind(null, lang, p.id, -1)} labels={{ ...formLabels(dict, s.moveUp), saved: undefined }} variant="secondary" className={small} />}
                  {i < gallery.length - 1 && <ActionForm action={moveSitePhoto.bind(null, lang, p.id, 1)} labels={{ ...formLabels(dict, s.moveDown), saved: undefined }} variant="secondary" className={small} />}
                  <ActionForm action={deleteSitePhoto.bind(null, lang, p.id)} labels={formLabels(dict, dict.common.remove)} variant="danger" confirm={s.photoDeleteConfirm} className={`ms-auto ${small}`} />
                </div>
              </li>
            ))}
          </ul>
        )}
        {gallery.length < MAX_GALLERY_PHOTOS && (
          <ActionForm action={uploadSitePhoto.bind(null, lang, "GALLERY")} labels={formLabels(dict, s.addPhoto)} resetOnSuccess className="flex flex-col gap-3 border-t border-slate-100 pt-4">
            <PhotoInput label={s.choosePhoto} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={`${s.caption} (${s.inFr})`} hint={s.captionHint}>
                <Input name="captionFr" maxLength={160} />
              </Field>
              <Field label={`${s.caption} (${s.inAr})`} hint={s.captionHint}>
                <Input name="captionAr" maxLength={160} lang="ar" dir="rtl" />
              </Field>
            </div>
          </ActionForm>
        )}
      </Card>

      <Card title={s.admissionsSection}>
        <p className="mb-3 text-sm text-slate-600">{s.admissionsHint}</p>
        <ActionForm action={saveSiteAdmissions.bind(null, lang)} labels={labels}>
          <BiFields names={["admissionsFr", "admissionsAr"]} values={[site?.admissionsFr, site?.admissionsAr]} max={3000} rows={5} inFr={s.inFr} inAr={s.inAr} />
        </ActionForm>
      </Card>

      <Card title={s.contactSection}>
        <p className="mb-3 text-sm text-slate-600">
          {s.contactIntro}{" "}
          <Link href={`/${lang}/parametres`} className="font-medium text-blue-800 underline underline-offset-2">
            {s.editSchoolInfo}
          </Link>
        </p>
        <ActionForm action={saveSiteContact.bind(null, lang)} labels={labels}>
          <BiFields label={s.hours} hint={s.hoursHint} names={["hoursFr", "hoursAr"]} values={[site?.hoursFr, site?.hoursAr]} max={200} inFr={s.inFr} inAr={s.inAr} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={s.whatsapp} hint={dict.common.optional}>
              <Input name="whatsapp" type="tel" dir="ltr" maxLength={30} defaultValue={site?.whatsapp ?? ""} />
            </Field>
            <Field label={s.facebook} hint={dict.common.optional}>
              <Input name="facebookUrl" dir="ltr" maxLength={300} defaultValue={site?.facebookUrl ?? ""} placeholder="facebook.com/…" />
            </Field>
            <Field label={s.instagram} hint={dict.common.optional}>
              <Input name="instagramUrl" dir="ltr" maxLength={300} defaultValue={site?.instagramUrl ?? ""} placeholder="instagram.com/…" />
            </Field>
            <Field label={s.map} hint={s.mapHint}>
              <Input name="mapUrl" dir="ltr" maxLength={600} defaultValue={site?.mapUrl ?? ""} placeholder="maps.app.goo.gl/…" />
            </Field>
          </div>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="inquiryForm" defaultChecked={site?.inquiryForm ?? true} className="mt-0.5 h-5 w-5 shrink-0" />
            <span>
              <span className="block font-medium">{s.inquiryFormLabel}</span>
              <span className="text-slate-500">{s.inquiryFormHint}</span>
            </span>
          </label>
        </ActionForm>
      </Card>
    </div>
  );
}

/** Un même texte en français et en arabe, côte à côte sur ordinateur. */
function BiFields({
  label,
  hint,
  names,
  values,
  placeholders,
  max,
  rows,
  inFr,
  inAr,
}: {
  label?: string;
  hint?: string;
  names: [string, string];
  values: [string | null | undefined, string | null | undefined];
  placeholders?: [string | undefined, string | undefined];
  max: number;
  rows?: number;
  inFr: string;
  inAr: string;
}) {
  const props = (i: 0 | 1) => ({
    name: names[i],
    maxLength: max,
    defaultValue: values[i] ?? "",
    placeholder: placeholders?.[i],
    ...(i === 1 ? { lang: "ar", dir: "rtl" as const } : {}),
  });
  const title = (lng: string) => (label ? `${label} (${lng})` : lng);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={title(inFr)} hint={hint}>
        {rows ? <Textarea rows={rows} {...props(0)} /> : <Input {...props(0)} />}
      </Field>
      <Field label={title(inAr)} hint={hint}>
        {rows ? <Textarea rows={rows} {...props(1)} /> : <Input {...props(1)} />}
      </Field>
    </div>
  );
}
