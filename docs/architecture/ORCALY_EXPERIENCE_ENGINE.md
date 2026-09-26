# Product experience and branding

`lib/ecosystem/products.ts` is the source of truth. `lib/ecosystem/experience.ts` translates product colors/surfaces/motion to CSS variables. Shared components live in `components/ecosystem`; Wealth applies its own green theme and personal data experience through its layout.

Public discovery includes eight intent paths, product cards with availability, illustrative product journeys, a distinct One proposal, identity/privacy content and accessible links. Server-rendered content uses small client islands for actions, consent revocation, installation and simulation. Motion uses transform/opacity and respects prefers-reduced-motion. Existing Business marketing remains intact.

Brand inventory is in `public/brand/README.md`. Original supplied PNGs are preserved. Business/Flow/Market/Partners/One use text while their required signature-free primary assets are missing. Wealth/Growth/Academy use the most recent supplied endorsed images. No generated logo, crop that removes signatures, fabricated symbol or CSS reconstruction was added. Separate product favicons/PWA icons remain missing.

The root manifest now starts in `/apps`. Hub installation uses the browser's real beforeinstallprompt and detects standalone display; it provides a Safari manual path without promising unsupported APIs. Product-specific installability is disabled until its own icons, scope, routing and release are verified. Product subdomains/DNS are not configured or assumed. There is no offline storage of private financial records, no new service worker caching private data and no push provider claim.

Verified locally: 320, 390, 768, 1440 and 1920 pixel widths, public navigation, invalid product 404, preserved Business pricing, private-route login redirect, authenticated Hub redirect, and Wealth form persistence. Browser QA artifacts are ignored in `.local-qa/ecosystem-browser/`. See the QA matrix for the latest accessibility status.
