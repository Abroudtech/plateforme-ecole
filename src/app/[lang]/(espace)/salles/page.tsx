import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formLabels } from "@/i18n/form-labels";
import { requirePermission } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { listRooms } from "@/lib/data/timetable";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, PageHeader } from "@/components/ui";
import { addRoom, deleteRoom } from "../emplois-du-temps/actions";

export default async function RoomsPage({ params }: PageProps<"/[lang]/salles">) {
  const lang = (await params).lang as Locale;
  const dict = await getDictionary(lang);
  const ctx = await requirePermission(lang, "timetable.read");
  const rooms = await listRooms(ctx.school.id);
  const canWrite = can(ctx.roles, "staff.write");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={dict.rooms.title} back={{ href: `/${lang}/emplois-du-temps`, label: dict.timetable.title }} />
      <Card>
        {rooms.length === 0 ? (
          <p className="text-sm text-slate-500">{dict.rooms.none}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rooms.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <span>
                  <span className="font-semibold">{r.name}</span>
                  {r.capacity != null && <span className="text-sm text-slate-500"> · {r.capacity} {dict.rooms.capacity}</span>}
                </span>
                {canWrite && (
                  <ActionForm
                    action={deleteRoom.bind(null, lang, r.id)}
                    labels={formLabels(dict, dict.common.remove)}
                    variant="danger"
                    confirm={`${dict.common.remove} ${r.name} ?`}
                    className="[&_button]:px-2 [&_button]:py-1 [&_button]:text-xs"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {canWrite && (
        <Card title={dict.rooms.add}>
          <ActionForm action={addRoom.bind(null, lang)} labels={formLabels(dict, dict.common.add)} resetOnSuccess>
            <div className="grid grid-cols-2 gap-4">
              <Field label={dict.rooms.name}>
                <Input name="name" required maxLength={40} />
              </Field>
              <Field label={dict.rooms.capacity} hint={dict.common.optional}>
                <Input name="capacity" type="number" min={1} max={500} inputMode="numeric" />
              </Field>
            </div>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
