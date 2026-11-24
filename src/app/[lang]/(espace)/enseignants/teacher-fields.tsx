import type { Teacher } from "@prisma/client";
import type { Dictionary } from "@/i18n/dictionaries";
import { Field, Input, Select } from "@/components/ui";

export function TeacherFields({ dict, value }: { dict: Dictionary; value?: Teacher }) {
  const s = dict.students;
  const g = dict.guardians;
  const t = dict.teachers;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label={s.firstName}>
        <Input name="firstName" required defaultValue={value?.firstName} />
      </Field>
      <Field label={s.lastName}>
        <Input name="lastName" required defaultValue={value?.lastName} />
      </Field>
      <Field label={s.firstNameAr} hint={dict.common.optional}>
        <Input name="firstNameAr" lang="ar" dir="rtl" defaultValue={value?.firstNameAr ?? ""} />
      </Field>
      <Field label={s.lastNameAr} hint={dict.common.optional}>
        <Input name="lastNameAr" lang="ar" dir="rtl" defaultValue={value?.lastNameAr ?? ""} />
      </Field>
      <Field label={g.phone} hint={dict.common.optional}>
        <Input name="phone" type="tel" dir="ltr" inputMode="tel" defaultValue={value?.phone ?? ""} />
      </Field>
      <Field label={g.email} hint={dict.common.optional}>
        <Input name="email" type="email" dir="ltr" defaultValue={value?.email ?? ""} />
      </Field>
      <Field label={t.gender} hint={dict.common.optional}>
        <Select name="gender" defaultValue={value?.gender ?? ""}>
          <option value="">—</option>
          <option value="FEMALE">{t.genders.FEMALE}</option>
          <option value="MALE">{t.genders.MALE}</option>
        </Select>
      </Field>
      <Field label={t.cin} hint={dict.common.optional}>
        <Input name="cin" dir="ltr" inputMode="numeric" maxLength={20} defaultValue={value?.cin ?? ""} />
      </Field>
      <Field label={t.hiredOn} hint={dict.common.optional}>
        <Input name="hiredOn" type="date" dir="ltr" defaultValue={value?.hiredOn ? value.hiredOn.toISOString().slice(0, 10) : ""} />
      </Field>
    </div>
  );
}
