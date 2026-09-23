# Customer Site - Dear IT BD

## Ei Folder Ki?
Ei folder holo **CUSTOMER SITE** - Shudhu grahamonno (customer) der jonno.

## Admin Panel theke ALADA!
- Alada domain: `shop.dearitbd.com`
- Alada code: Admin er code NAI ei folder e
- Customer can only VIEW and ORDER - cannot edit!

## Deploy Kivabe?

### 1. Netlify Account Banao
- Google e search koro: `netlify.com`
- Sign Up koro (Google diye)

### 2. GitHub Account Banao (if not)
- Google e search koro: `github.com`
- Sign Up koro

### 3. Code Upload Koro
- GitHub e New Repository banao: `dearitbd-customer`
- Ei folder er sob file upload koro

### 4. Netlify e Deploy Koro
- Netlify → "New site from Git"
- GitHub repository select koro
- "Deploy site" click koro
- 5 minute waiting koro
- Site live! Link paben

### 5. Domain Name Change Koro
- Netlify → Domain Settings
- "Add custom domain" → `shop.dearitbd.com`

## Environment
Supabase URL ar anon key ekhon `js/config/env.js`-e ache — shekhanei update korte hobe.
Netlify-er kono env var lagbe na (project-e build step nei).

## Customer Features
- Products dekhte parbe
- Order dite parbe
- Cart maintain korte parbe
- Message pathate parbe
- **BUT: Product edit/slide/change korte PARBE NA!**

## Security
- Admin panel hack hole → Customer site SAFE
- Customer site hack hole → Admin panel SAFE
- Complete isolation!

## Help Lagle?
YouTube search koro: "netlify deploy static site"