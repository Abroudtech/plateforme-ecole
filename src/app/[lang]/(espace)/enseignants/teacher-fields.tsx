import type { Teacher } from "@prisma/client";
import type { Dictionary } from "@/i18n/dictionaries";
import { Field, Input } from "@/components/ui";

export function TeacherFields({ dict, value }: { dict: Dictionary; value?: Teacher }) {
  const s = dict.students;
  const g = dict.guardians;
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
    </div>
  );
}
