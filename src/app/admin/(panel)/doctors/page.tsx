import { deleteDoctorAction, saveDoctorAction } from "@/actions/admin";
import { requireOwner } from "@/lib/admin-auth";
import { listDoctors, type Doctor } from "@/lib/clinic";
import { Photo } from "@/components/shared/Photo";
import { Empty, Notice, PageTitle, btnDanger, btnPrimary, card, input, label, one, textarea, type SP } from "../../ui";

export const dynamic = "force-dynamic";

function DoctorForm({ d }: { d?: Doctor }) {
  return (
    <form action={saveDoctorAction} className="space-y-4">
      {d && <input type="hidden" name="id" value={d.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Name *
          <input name="name" required maxLength={80} defaultValue={d?.name} placeholder="Dr. Full Name" className={`${input} mt-1`} />
        </label>
        <label className={label}>
          Designation *
          <input name="designation" required maxLength={80} defaultValue={d?.designation} placeholder="e.g. Consultant Dermatologist" className={`${input} mt-1`} />
        </label>
        <label className={label}>
          Qualification
          <input name="qualification" maxLength={80} defaultValue={d?.qualification} placeholder="e.g. MD (Dermatology)" className={`${input} mt-1`} />
        </label>
        <label className={label}>
          Registration number
          <input name="regNo" maxLength={40} defaultValue={d?.regNo} className={`${input} mt-1`} />
        </label>
        <label className={label}>
          Experience (years)
          <input name="experience" type="number" min={0} max={60} defaultValue={d?.experience ?? 0} className={`${input} mt-1`} />
        </label>
        <label className={label}>
          Display order (smaller shows first)
          <input name="sortOrder" type="number" defaultValue={d?.sortOrder} placeholder="auto" className={`${input} mt-1`} />
        </label>
      </div>
      <label className={label}>
        Specialisations (separate with commas)
        <input name="specialization" defaultValue={d?.specialization.join(", ")} placeholder="Hair Loss, PRP Therapy" className={`${input} mt-1`} />
      </label>
      <label className={label}>
        Biography
        <textarea name="bio" rows={3} maxLength={1000} defaultValue={d?.bio} className={`${textarea} mt-1`} />
      </label>
      <label className={label}>
        Message to patients (shown for the senior consultant)
        <textarea name="message" rows={2} maxLength={400} defaultValue={d?.message} className={`${textarea} mt-1`} />
      </label>
      <label className={label}>
        Photo (JPG, PNG or WebP, up to 2 MB){d ? ". Leave empty to keep the current photo." : ""}
        <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block w-full text-sm" />
      </label>
      <div className="flex flex-wrap gap-6 text-sm font-semibold">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="published" defaultChecked={d ? d.published : true} /> Published (shown on the website and in booking)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isSenior" defaultChecked={d?.isSenior} /> Senior consultant (featured on the home page)
        </label>
      </div>
      <button className={btnPrimary}>{d ? "Save doctor" : "Add doctor"}</button>
    </form>
  );
}

export default async function DoctorsAdminPage({ searchParams }: { searchParams: SP }) {
  await requireOwner();
  const sp = await searchParams;
  const doctors = await listDoctors();

  return (
    <>
      <PageTitle sub="Doctors you add here appear on the Doctors page, the home page and in the doctor choice when patients book.">Doctors</PageTitle>
      <Notice notice={one(sp.notice)} error={one(sp.error)} />

      <section className={`${card} mb-8 p-4`}>
        <h2 className="mb-3 font-heading text-lg font-semibold">Add a doctor</h2>
        <DoctorForm />
      </section>

      <h2 className="mb-3 font-heading text-lg font-semibold">All doctors ({doctors.length})</h2>
      {doctors.length === 0 ? (
        <Empty>No doctors yet. Add one above; patients cannot book consultations until at least one doctor is published.</Empty>
      ) : (
        <div className="space-y-3">
          {doctors.map((d) => (
            <details key={d.id} className={`${card} p-4`}>
              <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                <Photo src={d.image} alt="" fallbackName={d.name} width={48} height={48} className="h-12 w-12 rounded-full object-cover text-base" />
                <span className="font-semibold">{d.name}</span>
                <span className="text-sm text-text-secondary">{d.designation}</span>
                {d.isSenior && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">Senior consultant</span>}
                {!d.published && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">Unpublished</span>}
              </summary>
              <div className="mt-4">
                <DoctorForm d={d} />
                <form action={deleteDoctorAction} className="mt-4 border-t border-border pt-4">
                  <input type="hidden" name="id" value={d.id} />
                  <button className={btnDanger}>Delete doctor</button>
                  <p className="mt-2 text-xs text-text-secondary">A doctor with pending or confirmed appointments cannot be deleted; unpublish the profile instead.</p>
                </form>
              </div>
            </details>
          ))}
        </div>
      )}
    </>
  );
}
