# A Little Something For Lunatey — birthday gallery

A Next.js 20 birthday gallery for the celebrant. Visitors can upload
photographs, add memories, curate a photo album, and place stickers — every
change auto-saves and appears on every device from the same link.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How saving works

- **Images** (photos, album photos, custom stickers) are uploaded to
  **Cloudinary** through `app/api/upload/route.ts` and stored as permanent URLs.
- **State** (memory list, photo metadata, stickers + positions/rotation/size,
  the album book) is stored as one JSON document in **Vercel Blob** through
  `app/api/gallery/route.ts`. Every device loads the same document, so the same
  link shows the same content everywhere.
- A small chip in the corner shows the live status: **Saving… / Saved ✓ /
  Failed to save**. "Saved ✓" only appears after the cloud accepted the newest
  state. If the cloud is unreachable, your data is still kept on the device and
  the indicator explains the situation instead of silently dropping anything.
- Everything is automatic — there is no save button and no passphrase or lock
  screen.

## Environment variables

See `.env.local` — the Cloudinary values are already set. To enable
cross-device sync you must also add a Vercel Blob token:

1. Deploy the project to Vercel (or run `vercel link`).
2. In the Vercel dashboard, create a Blob read/write token
   (Storage → Blob → New token).
3. Set `BLOB_READ_WRITE_TOKEN=vercel_blob_rw_…` in your Vercel project's
   environment variables (and optionally in `.env.local` for local testing).

## Deploy on Vercel

Push the repository to Vercel as usual. Remember to set both the Cloudinary
and `BLOB_READ_WRITE_TOKEN` environment variables in the Vercel dashboard.
