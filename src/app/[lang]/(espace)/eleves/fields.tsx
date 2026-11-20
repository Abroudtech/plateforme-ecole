import type { Guardian, GuardianRelationship, Student } from "@prisma/client";
import type { Dictionary } from "@/i18n/dictionaries";
import { Field, Input, Select } from "@/components/ui";

function dateValue(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : "";
}

/** Champs d'identité de l'élève. */
export function StudentFields({ dict, value }: { dict: Dictionary; value?: Student }) {
  const s = dict.students;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label={s.firstName}>
        <Input name="firstName" required defaultValue={value?.firstName} autoComplete="off" />
      </Field>
      <Field label={s.lastName}>
        <Input name="lastName" required defaultValue={value?.lastName} autoComplete="off" />
      </Field>
      <Field label={s.firstNameAr} hint={dict.common.optional}>
        <Input name="firstNameAr" lang="ar" dir="rtl" defaultValue={value?.firstNameAr ?? ""} autoComplete="off" />
      </Field>
      <Field label={s.lastNameAr} hint={dict.common.optional}>
        <Input name="lastNameAr" lang="ar" dir="rtl" defaultValue={value?.lastNameAr ?? ""} autoComplete="off" />
      </Field>
      <Field label={s.gender}>
        <Select name="gender" defaultValue={value?.gender ?? ""}>
          <option value="">—</option>
          <option value="FEMALE">{s.genders.FEMALE}</option>
          <option value="MALE">{s.genders.MALE}</option>
        </Select>
      </Field>
      <Field label={s.birthDate} hint={dict.common.optional}>
        <Input name="birthDate" type="date" defaultValue={dateValue(value?.birthDate)} />
      </Field>
      <Field label={s.birthPlace} hint={dict.common.optional}>
        <Input name="birthPlace" defaultValue={value?.birthPlace ?? ""} />
      </Field>
      <Field label={s.number} hint={value ? undefined : s.numberHint}>
        <Input name="studentNumber" dir="ltr" defaultValue={value?.studentNumber ?? ""} required={!!value} />
      </Field>
    </div>
  );
}

/** Champs d'un parent / tuteur. `prefix` sert quand le formulaire contient aussi l'élève. */
export function GuardianFields({
  dict,
  prefix = "",
  value,
  relationship,
  isPrimary,
  required = true,
  showPrimary = true,
}: {
  dict: Dictionary;
  prefix?: string;
  value?: Guardian;
  relationship?: GuardianRelationship;
  isPrimary?: boolean;
  required?: boolean;
  showPrimary?: boolean;
}) {
  const g = dict.guardians;
  const s = dict.students;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label={g.relationship}>
        <Select name={`${prefix}relationship`} defaultValue={relationship ?? "FATHER"}>
          {(["FATHER", "MOTHER", "GUARDIAN", "OTHER"] as const).map((r) => (
            <option key={r} value={r}>{g.relationships[r]}</option>
          ))}
        </Select>
      </Field>
      <div className="hidden sm:block" />
      <Field label={s.firstName}>
        <Input name={`${prefix}firstName`} required={required} defaultValue={value?.firstName} />
      </Field>
      <Field label={s.lastName}>
        <Input name={`${prefix}lastName`} required={required} defaultValue={value?.lastName} />
      </Field>
      <Field label={s.firstNameAr} hint={dict.common.optional}>
        <Input name={`${prefix}firstNameAr`} lang="ar" dir="rtl" defaultValue={value?.firstNameAr ?? ""} />
      </Field>
      <Field label={s.lastNameAr} hint={dict.common.optional}>
        <Input name={`${prefix}lastNameAr`} lang="ar" dir="rtl" defaultValue={value?.lastNameAr ?? ""} />
      </Field>
      <Field label={g.phone}>
        <Input name={`${prefix}phone`} type="tel" dir="ltr" inputMode="tel" defaultValue={value?.phone ?? ""} />
      </Field>
      <Field label={g.whatsapp} hint={dict.common.optional}>
        <Input name={`${prefix}whatsapp`} type="tel" dir="ltr" inputMode="tel" defaultValue={value?.whatsapp ?? ""} />
      </Field>
      <Field label={g.email} hint={dict.common.optional}>
        <Input name={`${prefix}email`} type="email" dir="ltr" defaultValue={value?.email ?? ""} />
      </Field>
      {showPrimary && (
        <label className="flex items-center gap-2 self-end py-2 text-sm font-medium">
          <input type="checkbox" name={`${prefix}isPrimary`} defaultChecked={isPrimary} className="size-5" />
          {g.primary}
        </label>
      )}
    </div>
  );
}
