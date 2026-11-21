import { deleteGalleryAction, saveGalleryAction } from "@/actions/admin";
import { requireOwner } from "@/lib/admin-auth";
import { listGallery, type GalleryItem } from "@/lib/content";
import { storageMode } from "@/lib/integrations/storage";
import { Photo } from "@/components/shared/Photo";
import { Empty, Notice, PageTitle, btnDanger, btnPrimary, card, input, label, one, type SP } from "../../ui";

export const dynamic = "force-dynamic";

function GalleryForm({ g }: { g?: GalleryItem }) {
  return (
    <form action={saveGalleryAction} className="space-y-4">
      {g && <input type="hidden" name="id" value={g.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Title *
          <input name="title" required minLength={2} maxLength={80} defaultValue={g?.title} className={`${input} mt-1`} />
        </label>
        <label className={label}>
          Category (optional)
          <input name="category" maxLength={40} defaultValue={g?.category} placeholder="e.g. Clinic, Equipment" className={`${input} mt-1`} />
        </label>
      </div>
      <label className={label}>
        Photo (JPG, PNG or WebP, up to 2 MB){g ? ". Leave empty to keep the current photo." : " *"}
        <input name="photo" type="file" required={!g} accept="image/jpeg,image/png,image/webp" className="mt-1 block w-full text-sm" />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="published" defaultChecked={g ? g.published : true} /> Shown on the home page
      </label>
      <button className={btnPrimary}>{g ? "Save photo" : "Add photo"}</button>
    </form>
  );
}

export default async function GalleryAdminPage({ searchParams }: { searchParams: SP }) {
  await requireOwner();
  const sp = await searchParams;
  const items = await listGallery();
  const mode = storageMode();

  return (
    <>
      <PageTitle sub="Photos of the clinic for the home page. The gallery section stays hidden until you add at least one published photo.">Gallery</PageTitle>
      <Notice notice={one(sp.notice)} error={one(sp.error)} />
      {mode === "none" && (
        <p role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Photo upload is not set up yet. Add the Supabase storage settings under Integrations, then come back to add photos.
        </p>
      )}
      {mode === "disk" && <p className="mb-4 rounded-xl border border-border bg-sand/40 px-4 py-3 text-sm text-text-secondary">Development mode: photos are saved on this computer only. Connect Supabase Storage before going live.</p>}

      <section className={`${card} mb-8 p-4`}>
        <h2 className="mb-3 font-heading text-lg font-semibold">Add a photo</h2>
        <GalleryForm />
      </section>

      <h2 className="mb-3 font-heading text-lg font-semibold">All photos ({items.length})</h2>
      {items.length === 0 ? (
        <Empty>No photos yet.</Empty>
      ) : (
        <div className="space-y-3">
          {items.map((g) => (
            <details key={g.id} className={`${card} p-4`}>
              <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                <Photo src={g.image} alt="" fallbackName={g.title} width={64} height={48} className="h-12 w-16 rounded-md object-cover text-base" />
                <span className="font-semibold">{g.title}</span>
                {g.category && <span className="text-sm text-text-secondary">{g.category}</span>}
                {!g.published && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">Hidden</span>}
              </summary>
              <div className="mt-4">
                <GalleryForm g={g} />
                <form action={deleteGalleryAction} className="mt-4 border-t border-border pt-4">
                  <input type="hidden" name="id" value={g.id} />
                  <button className={btnDanger}>Delete photo</button>
                </form>
              </div>
            </details>
          ))}
        </div>
      )}
    </>
  );
}
