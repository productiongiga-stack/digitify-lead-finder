# Deployment Guide — leads.digitify.be

## Overzicht

Deze guide beschrijft hoe je Digitify Lead Search deployt naar een subdomein `leads.digitify.be` op een VPS of cloud provider.

## Vereisten

- VPS of cloud server (DigitalOcean, Hetzner, AWS, etc.) met Ubuntu 22.04+
- Node.js >= 20 (via nvm)
- PostgreSQL 16
- Redis 7 (optioneel, voor queue workers in de toekomst)
- Nginx als reverse proxy
- SSL certificaat (Let's Encrypt)
- Domeinnaam met DNS toegang

---

## Stap 1: DNS Configuratie

Voeg een A-record toe bij je DNS provider (bv. Cloudflare, TransIP):

```
Type: A
Name: leads
Value: <je-server-ip>
TTL: 300
```

Na propagatie (5-30 min) moet `leads.digitify.be` naar je server wijzen.

---

## Stap 2: Server Setup

```bash
# SSH naar je server
ssh root@<je-server-ip>

# Update systeem
apt update && apt upgrade -y

# Installeer Node.js 20 via nvm
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# Installeer pnpm
npm install -g pnpm

# Installeer PostgreSQL
apt install -y postgresql postgresql-contrib

# Start PostgreSQL
systemctl enable postgresql
systemctl start postgresql

# Maak database en gebruiker
sudo -u postgres psql -c "CREATE USER digitify WITH PASSWORD 'KIES_EEN_STERK_WACHTWOORD';"
sudo -u postgres psql -c "CREATE DATABASE digitify_leads OWNER digitify;"

# Installeer Nginx
apt install -y nginx
systemctl enable nginx
```

---

## Stap 3: Applicatie Deployen

```bash
# Maak app directory
mkdir -p /var/www/leads.digitify.be
cd /var/www/leads.digitify.be

# Clone of upload je code
# Optie A: Git
git clone <jouw-repo-url> .

# Optie B: Rsync vanaf lokaal (run dit LOKAAL)
# rsync -avz --exclude node_modules --exclude .next . root@<server-ip>:/var/www/leads.digitify.be/

# Installeer dependencies
pnpm install

# Maak .env bestand
cat > .env << 'EOF'
DATABASE_URL="postgresql://digitify:KIES_EEN_STERK_WACHTWOORD@localhost:5432/digitify_leads"
REDIS_URL="redis://localhost:6379"
NEXTAUTH_URL="https://leads.digitify.be"
NEXTAUTH_SECRET="GENEREER_MET_openssl_rand_-base64_32"
NODE_ENV="production"
EOF

# Genereer Prisma client
pnpm db:generate

# Push schema naar database
pnpm db:push

# Seed initiële data
SEED_ADMIN_EMAIL="owner@jouwdomein.be" SEED_ADMIN_PASSWORD="sterk-wachtwoord-min-12" pnpm db:seed

# Build de applicatie
pnpm build
```

---

## Stap 4: Process Manager (PM2)

```bash
# Installeer PM2
npm install -g pm2

# Start de app
cd /var/www/leads.digitify.be/apps/web
pm2 start npm --name "digitify-leads" -- start -- -p 3000

# Auto-start bij reboot
pm2 startup
pm2 save
```

---

## Stap 5: Nginx Reverse Proxy

```bash
# Maak Nginx config
cat > /etc/nginx/sites-available/leads.digitify.be << 'EOF'
server {
    listen 80;
    server_name leads.digitify.be;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}
EOF

# Activeer de site
ln -s /etc/nginx/sites-available/leads.digitify.be /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## Stap 6: SSL met Let's Encrypt

```bash
# Installeer Certbot
apt install -y certbot python3-certbot-nginx

# Genereer SSL certificaat
certbot --nginx -d leads.digitify.be

# Auto-renew is standaard ingesteld via systemd timer
```

Na deze stap is `https://leads.digitify.be` bereikbaar.

---

## Stap 7: Firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

---

## Updates Deployen

```bash
cd /var/www/leads.digitify.be

# Pull nieuwe code
git pull

# Installeer eventuele nieuwe dependencies
pnpm install

# Push schema wijzigingen (indien nodig)
pnpm db:push

# Rebuild
pnpm build

# Herstart de app
pm2 restart digitify-leads
```

---

## Alternatief: Vercel Deployment

Als je liever op Vercel deployt (makkelijker, automatische deploys):

### 1. Push naar GitHub
```bash
git remote add origin https://github.com/digitify/lead-search.git
git push -u origin main
```

### 2. Vercel Setup
1. Ga naar [vercel.com](https://vercel.com) en importeer het project
2. Stel de **Root Directory** in op `apps/web`
3. Stel de **Build Command** in op `cd ../.. && pnpm build --filter @digitify/web`
4. Stel de **Install Command** in op `cd ../.. && pnpm install`

### 3. Environment Variables (in Vercel dashboard)
```
DATABASE_URL=postgresql://user:pass@host:5432/digitify_leads
NEXTAUTH_URL=https://leads.digitify.be
NEXTAUTH_SECRET=<genereer met openssl rand -base64 32>
```

### 4. Database
Gebruik een hosted PostgreSQL:
- **Supabase** (gratis tier): [supabase.com](https://supabase.com)
- **Neon** (gratis tier): [neon.tech](https://neon.tech)
- **Railway**: [railway.app](https://railway.app)

### 5. Custom Domain
In Vercel dashboard → Settings → Domains → voeg `leads.digitify.be` toe.
Volg de DNS instructies (CNAME record naar `cname.vercel-dns.com`).

---

## Monitoring

```bash
# Logs bekijken
pm2 logs digitify-leads

# Status checken
pm2 status

# Resource gebruik
pm2 monit
```

---

## Backup

```bash
# Database backup (voeg toe aan crontab)
pg_dump -U digitify digitify_leads > /backups/digitify_$(date +%Y%m%d).sql

# Crontab (dagelijks om 3:00)
# 0 3 * * * pg_dump -U digitify digitify_leads > /backups/digitify_$(date +\%Y\%m\%d).sql
```

---

## Checklist voor Go-Live

- [ ] DNS A-record wijst naar server
- [ ] PostgreSQL draait met sterke wachtwoorden
- [ ] `.env` bevat production waarden (NEXTAUTH_SECRET, DATABASE_URL)
- [ ] NEXTAUTH_URL is `https://leads.digitify.be`
- [ ] SSL certificaat is actief
- [ ] Firewall staat alleen SSH + HTTP/HTTPS toe
- [ ] PM2 is ingesteld met auto-start
- [ ] Seed data is geladen
- [ ] `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD` zijn via env gezet voor de eerste seed (geen hardcoded waarden in code/docs)
- [ ] `SETTINGS_ENCRYPTION_KEY` is gezet (≠ default) — vereist voor versleutelde API-keys/SMTP/OAuth tokens
- [ ] `NEXTAUTH_SECRET` is gezet en uniek per omgeving
- [ ] Google Places API key is ingesteld via Instellingen
- [ ] Anthropic/OpenAI API key is ingesteld via Instellingen
- [ ] SMTP is geconfigureerd voor e-mail verzending
- [ ] Backup strategie is ingesteld
