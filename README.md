# Vestro by RA — Unlock Your Era

Handpicked kasavu & festive saree boutique. Doha, Qatar · free delivery · cash on delivery.

**Live shop:** https://vestrobyra.com.qa/
**Admin portal:** https://vestrobyra.com.qa/admin.html

The domain is registered with QHOST; its DNS is managed in Cloudflare (records set to
"DNS only", pointing at GitHub Pages). To change the domain, edit `CNAME`, `sitemap.xml`
and `robots.txt`, then update the DNS records.

## How it works

- Customers pick sarees with **Add to order** — one tap sends a WhatsApp message
  listing everything they chose (+974 6619 4953).
- The owner manages everything at **/admin**: add products with photos, set prices,
  mark **Sold out**, or **Hide** items. Changes appear on the site instantly.
- No server to maintain: hosted free on GitHub Pages, products stored in
  Firebase (project `vestro-e5637`, free tier).

## Fresh start (3 Oct 2026)

The shop was relaunched with an empty collection. Products added before
`VESTRO_FRESH_START` (in `firebase-config.js`) are archived: customers never see
them, and the admin portal lists them under **Archived**, where each can be
brought back or deleted. Set the value to `0` to show everything again.

## Files

| File | Purpose |
|---|---|
| `index.html` / `styles.css` / `script.js` | The shop — layout, design, 3D silk hero |
| `catalog.js` | Loads products from Firebase + the WhatsApp order basket |
| `admin.html` (+ `admin/`) | Admin portal, reachable at `/admin` |
| `firebase-config.js` | Firebase keys + WhatsApp numbers |
| `logo.png` / `logo-mark.png` | Brand logo and round emblem |

## Common changes

- **WhatsApp numbers** — edit them at the bottom of `firebase-config.js`.
- **Admin logins** — Firebase console → Authentication → Users → Add user.
- **Categories** — admin portal → **Categories**: add or delete. Deleting one hides
  its products from the shop (they stay in the admin as Hidden). The list is saved
  in Firebase as `products/shop-settings`, which is not a product.
- **Colors** — edit the `:root` section at the top of `styles.css`.

Every push to `main` goes live automatically in ~1 minute.
