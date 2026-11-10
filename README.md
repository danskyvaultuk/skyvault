This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Launch scope: journey switches

SkyVault launches with one journey: a homeowner uploads their own roof photos and gets a report. The drone
journey and the roofer journey are still in the code, but **both are switched off by default**. Nothing needs
setting for them to be off.

| Setting | Turns on | What it controls |
| --- | --- | --- |
| `NEXT_PUBLIC_SKYVAULT_DRONE_JOURNEY=on` | The drone journey | Drone operator sign-up, the "Drone capture" survey type and booking deposit, the `/drone` pages, `/api/drone-jobs` and `/api/stripe/drone-checkout`. |
| `NEXT_PUBLIC_SKYVAULT_ROOFER_JOURNEY=on` | The roofer journey | Roofer sign-up, lead emails to roofers after each report, the customer's Quotes page and roofer-interest counts, the `/roofer` pages, `/api/leads`, `/api/roofer`, `/api/stripe/checkout` and `/api/stripe/portal`. |

- Only the exact value `on` turns a journey on. Any other value, or no value, leaves it off.
- The settings are read in one place, `src/lib/journeys.ts`, and the page and API rules are in
  `src/lib/journeyGuard.ts`.
- They are `NEXT_PUBLIC_` settings because client pages read them, so Next.js fixes them **at build time**.
  After changing one in Vercel, redeploy.
- While a journey is off, an existing roofer or drone account that signs in sees a plain "not available at the
  moment" page (`/unavailable`). No account or record is deleted, and the Stripe webhook keeps working.
- The homepage, blog and site wording is separate and is not changed by these switches (BL-059).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
