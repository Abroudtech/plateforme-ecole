import type { Fee, GradeLevel } from "@prisma/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { pickName } from "@/i18n/localized";
import { toISODate } from "@/lib/dates";
import { amountInputValue } from "@/lib/payments";
import { Field, Input, Select } from "@/components/ui";

export function FeeFields({ dict, lang, levels, value }: { dict: Dictionary; lang: Locale; levels: GradeLevel[]; value?: Fee }) {
  const p = dict.payments;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label={p.feeName}>
        <Input name="name" required defaultValue={value?.name} placeholder="Scolarité 1er trimestre" />
      </Field>
      <Field label={p.feeNameAr} hint={dict.common.optional}>
        <Input name="nameAr" lang="ar" dir="rtl" defaultValue={value?.nameAr ?? ""} />
      </Field>
      <Field label={p.amount}>
        <Input name="amount" required inputMode="decimal" dir="ltr" defaultValue={value ? amountInputValue(value.amountMillimes) : ""} />
      </Field>
      <Field label={p.dueDate}>
        <Input name="dueDate" type="date" required defaultValue={value ? toISODate(value.dueDate) : ""} />
      </Field>
      <Field label={p.level}>
        <Select name="gradeLevelId" defaultValue={value?.gradeLevelId ?? ""}>
          <option value="">{p.allLevels}</option>
          {levels.map((l) => (
            <option key={l.id} value={l.id}>{pickName(l, lang)}</option>
          ))}
        </Select>
      </Field>
      <label className="flex items-center gap-2 self-end py-2 text-sm font-medium">
        <input type="checkbox" name="isOptional" defaultChecked={value?.isOptional} className="size-5 shrink-0" />
        {p.optional}
      </label>
    </div>
  );
}
