import type { ClassGroup, GradeLevel, Track } from "@prisma/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { pickName } from "@/i18n/localized";
import { Field, Input, Select } from "@/components/ui";

/** Champs du formulaire de classe (création et modification). */
export function ClassFields({
  dict,
  lang,
  levels,
  tracks,
  value,
}: {
  dict: Dictionary;
  lang: Locale;
  levels: GradeLevel[];
  tracks: Track[];
  value?: ClassGroup;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label={dict.classes.name} hint={dict.classes.nameHint}>
        <Input name="name" required maxLength={30} defaultValue={value?.name} />
      </Field>
      <Field label={dict.classes.nameAr} hint={dict.common.optional}>
        <Input name="nameAr" maxLength={60} defaultValue={value?.nameAr ?? ""} />
      </Field>
      <Field label={dict.classes.level}>
        <Select name="gradeLevelId" required defaultValue={value?.gradeLevelId ?? ""}>
          <option value="" disabled>—</option>
          {levels.map((l) => (
            <option key={l.id} value={l.id}>
              {dict.cycles[l.cycle]} · {pickName(l, lang)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={dict.classes.track} hint={dict.classes.trackHint}>
        <Select name="trackId" defaultValue={value?.trackId ?? ""}>
          <option value="">{dict.common.none}</option>
          {tracks.map((t) => (
            <option key={t.id} value={t.id}>{pickName(t, lang)}</option>
          ))}
        </Select>
      </Field>
      <Field label={dict.classes.capacity} hint={dict.common.optional}>
        <Input name="capacity" type="number" min={1} max={200} inputMode="numeric" defaultValue={value?.capacity ?? ""} />
      </Field>
    </div>
  );
}
