"use client";

import { useActionState } from "react";
import { createClassAccesses, type BulkState } from "./actions";

type Labels = {
  submit: string; pending: string; sms: string; smsUnavailable: string; print: string; intro: string;
  student: string; guardian: string; login: string; password: string; site: string;
  statuses: Record<string, string>; smsSent: string; notFound: string; school: string; siteUrl: string;
};

export function BulkAccessForm({ lang, classId, labels, smsAvailable }: { lang: string; classId: string; labels: Labels; smsAvailable: boolean }) {
  const [state, action, pending] = useActionState<BulkState, FormData>(createClassAccesses.bind(null, lang, classId), undefined);
  const created = state?.rows?.filter((r) => r.password) ?? [];

  return (
    <div className="flex flex-col gap-4">
      {!state?.rows && (
        <form action={action} className="flex flex-col gap-3 print:hidden">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="sms" disabled={!smsAvailable} className="size-5" />
            {smsAvailable ? labels.sms : labels.smsUnavailable}
          </label>
          <div>
            <button disabled={pending} className="rounded-xl bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {pending ? labels.pending : labels.submit}
            </button>
          </div>
        </form>
      )}
      {state?.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{labels.notFound}</p>}
      {state?.rows && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
            <p className="text-sm text-slate-600">{labels.intro}</p>
            {created.length > 0 && (
              <button onClick={() => window.print()} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50">
                {labels.print}
              </button>
            )}
          </div>
          <ul className="flex flex-col gap-1 rounded-2xl bg-white p-4 text-sm shadow-card ring-1 ring-slate-200/80 print:hidden">
            {state.rows.map((r, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 border-b border-slate-100 py-1.5 last:border-0">
                <span><span className="font-medium">{r.student}</span>{r.guardian && <span className="text-slate-500"> · {r.guardian}</span>}</span>
                <span className={r.password ? "font-semibold text-emerald-700" : "text-slate-500"}>
                  {labels.statuses[r.status] ?? r.status}{r.smsSent ? ` · ${labels.smsSent}` : ""}
                </span>
              </li>
            ))}
          </ul>
          {/* Une fiche par famille, à découper et à remettre (imprimable). */}
          <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
            {created.map((r, i) => (
              <div key={i} className="break-inside-avoid rounded-xl border-2 border-dashed border-slate-300 bg-white p-4 text-sm">
                <p className="font-bold">{labels.school}</p>
                <p className="mt-1">{labels.guardian} : <span className="font-semibold">{r.guardian}</span></p>
                <p>{labels.student} : {r.student}</p>
                <p className="mt-2">{labels.site} : <bdi dir="ltr" className="font-mono">{labels.siteUrl}</bdi></p>
                <p>{labels.login} : <bdi dir="ltr" className="font-mono font-semibold">{r.login}</bdi></p>
                <p>{labels.password} : <bdi dir="ltr" className="font-mono font-semibold">{r.password}</bdi></p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
