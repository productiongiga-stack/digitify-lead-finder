# Deployment Guide — test.digitify.be

## Optie A: Vercel (aanbevolen)

### 1. Database aanmaken (Neon / Supabase / Railway)

De snelste optie is **Neon** (gratis tier, serverless PostgreSQL):

1. Ga naar https://neon.tech → maak account
2. Maak een nieuw project: `digitify-suite-test`
3. Kopieer de **connection string** (ziet er zo uit):
   ```
   postgresql://neondb_owner:xxx@ep-xxx.eu-west-1.aws.neon.tech/neondb?sslmode=require
   ```

Alternatieven:
- **Supabase** (https://supabase.com) — gratis PostgreSQL
- **Railway** (https://railway.app) — betaald, maar simpel
- **Vercel Postgres** — geïntegreerd in Vercel dashboard

### 2. GitHub repository

```bash
cd digitify-suite-v2

# Init git repo
git init
git add -A
git commit -m "Digitify Suite v2 — initial commit"

# Push naar GitHub
gh repo create digitify-suite-v2 --private --push
# OF handmatig:
git remote add origin git@github.com:JOUW_USERNAME/digitify-suite-v2.git
git push -u origin main
```

### 3. Vercel koppelen

1. Ga naar https://vercel.com/new
2. Importeer je GitHub repo
3. Framework: **Next.js** (auto-detected)
4. **Environment Variables** instellen (zie sectie hieronder)
5. Klik **Deploy**

### 4. Custom domain instellen

In Vercel dashboard → Project → Settings → Domains:

1. Voeg toe: `test.digitify.be`
2. Vercel geeft je een **CNAME record**:
   ```
   Type: CNAME
   Name: test
   Value: cname.vercel-dns.com
   ```
3. Ga naar je **DNS provider** (waar digitify.be geregistreerd is)
4. Voeg het CNAME record toe
5. Wacht 1-5 minuten → SSL wordt automatisch aangemaakt

### 5. Environment Variables (Vercel Dashboard)

Ga naar Project → Settings → Environment Variables en voeg toe:

| Key | Value | Notes |
|-----|-------|-------|
| `DATABASE_URL` | `postgresql://...` | Van Neon/Supabase |
| `AUTH_SECRET` | `(genereer)` | Zie hieronder |
| `AUTH_URL` | `https://test.digitify.be` | |
| `NEXT_PUBLIC_APP_URL` | `https://test.digitify.be` | |
| `AUTH_GOOGLE_ID` | `(optioneel)` | Google Cloud Console |
| `AUTH_GOOGLE_SECRET` | `(optioneel)` | Google Cloud Console |
| `RESEND_API_KEY` | `(optioneel)` | resend.com |
| `EMAIL_FROM` | `Digitify Suite <noreply@digitify.be>` | |
| `STRIPE_SECRET_KEY` | `(optioneel)` | stripe.com |
| `UPLOADTHING_TOKEN` | `(optioneel)` | uploadthing.com |

**AUTH_SECRET genereren:**
```bash
openssl rand -base64 32
```

### 6. Database schema pushen

Na eerste deploy, voer uit in terminal:
```bash
# Optie 1: Via Vercel CLI
npx vercel env pull .env.local   # haalt env vars op
npx prisma db push               # pusht schema naar database

# Optie 2: Direct met DATABASE_URL
DATABASE_URL="postgresql://..." npx prisma db push
```

### 7. Google OAuth instellen (optioneel)

1. Ga naar https://console.cloud.google.com/apis/credentials
2. Maak een OAuth 2.0 Client ID
3. Authorized redirect URI: `https://test.digitify.be/api/auth/callback/google`
4. Kopieer Client ID en Secret naar Vercel env vars

---

## Optie B: VPS (DigitalOcean / Hetzner)

### 1. Server opzetten

```bash
# Op je VPS (Ubuntu 22.04+)
sudo apt update && sudo apt upgrade -y

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres createuser digitify --createdb
sudo -u postgres psql -c "ALTER USER digitify PASSWORD 'STERK_WACHTWOORD';"
sudo -u postgres createdb digitify_suite -O digitify

# Nginx (reverse proxy)
sudo apt install -y nginx certbot python3-certbot-nginx

# PM2 (process manager)
sudo npm install -g pm2
```

### 2. Code deployen

```bash
# Op de VPS
cd /var/www
git clone git@github.com:JOUW_USERNAME/digitify-suite-v2.git
cd digitify-suite-v2

# Environment
cp .env.example .env
nano .env  # Vul alle waarden in:
#   DATABASE_URL="postgresql://digitify:STERK_WACHTWOORD@localhost:5432/digitify_suite"
#   AUTH_SECRET="(genereer met openssl rand -base64 32)"
#   AUTH_URL="https://test.digitify.be"
#   NEXT_PUBLIC_APP_URL="https://test.digitify.be"

# Install & build
npm install
npx prisma db push
npm run build
```

### 3. PM2 starten

```bash
# Start met PM2
pm2 start npm --name "digitify" -- start
pm2 save
pm2 startup  # auto-start bij reboot
```

### 4. Nginx configuratie

```bash
sudo nano /etc/nginx/sites-available/test.digitify.be
```

```nginx
server {
    server_name test.digitify.be;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/test.digitify.be /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. DNS + SSL

**DNS (bij je domein provider):**
```
Type: A
Name: test
Value: [IP van je VPS]
```

**SSL (Let's Encrypt):**
```bash
sudo certbot --nginx -d test.digitify.be
```

### 6. Auto-deploy (optioneel)

```bash
# Op VPS: maak deploy script
cat > /var/www/digitify-suite-v2/deploy.sh << 'EOF'
#!/bin/bash
cd /var/www/digitify-suite-v2
git pull origin main
npm install
npx prisma db push
npm run build
pm2 restart digitify
EOF
chmod +x /var/www/digitify-suite-v2/deploy.sh
```

---

## Na de deployment: eerste setup

1. Open `https://test.digitify.be/register` — maak je eerste account
2. Er wordt automatisch een workspace aangemaakt
3. Ga naar Settings → General om je workspace te configureren
4. Ga naar Configurators → maak je eerste offerte-wizard

## Seed data (optioneel)

Als je testdata wilt laden:
```bash
npx prisma db seed
```
(Vereist dat prisma/seed.ts bestaat met demo data)
