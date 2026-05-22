# Tencent Cloud backend deployment

This repository keeps the first online version simple:

- Node.js/Express runs on port `8787`.
- Nginx exposes the API domain and later terminates HTTPS.
- `.env` controls server settings.
- `DATA_DIR` keeps assignments, submissions, history and uploaded images outside the Git checkout.

## 1. Buy and prepare cloud resources

Create a Tencent Cloud Lighthouse server with a Node.js image or a Linux image that has Node.js LTS installed.
Create an API domain such as `api.example.com` and point its DNS record to the server.
For a mainland China server, finish ICP filing before formal domain access.

Open inbound ports:

- `22` for SSH
- `80` for HTTP certificate verification and redirect
- `443` for HTTPS

## 2. Upload the code

On the server:

```bash
sudo mkdir -p /opt
cd /opt
sudo git clone YOUR_GITHUB_REPO_URL primary-ai-question-assistant
sudo chown -R ubuntu:ubuntu /opt/primary-ai-question-assistant
cd /opt/primary-ai-question-assistant
npm install
```

Create `/opt/primary-ai-question-assistant/.env`:

```bash
PORT=8787
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
DATA_DIR=/var/lib/primary-ai-question-assistant
```

Leave `OPENAI_API_KEY` empty for the first mock deployment.

Prepare the persistent data folder:

```bash
sudo mkdir -p /var/lib/primary-ai-question-assistant/uploads
sudo chown -R ubuntu:ubuntu /var/lib/primary-ai-question-assistant
```

## 3. Run the API as a service

Copy `deploy/tencent/primary-ai-server.service.example` to:

```text
/etc/systemd/system/primary-ai-server.service
```

If the server login user is not `ubuntu`, replace `User=ubuntu` in the service file first.

Then run:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now primary-ai-server
sudo systemctl status primary-ai-server
curl http://127.0.0.1:8787/api/health
```

## 4. Add Nginx

Install Nginx, then copy `deploy/tencent/nginx-api.conf.example` to the server Nginx site config.
Replace `api.example.com` with the real API domain.

Validate and reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
curl http://api.example.com/api/health
```

## 5. Add HTTPS

Apply for an SSL certificate for the API domain and install it in Nginx.
After HTTPS is ready, verify:

```bash
curl https://api.example.com/api/health
```

Only use the HTTPS API domain in the mini program production build.

## 6. Build the mini program for the API domain

From Windows CMD in this repository:

```bat
set MINIAPP_API_BASE=https://api.example.com
npm.cmd run build:weapp
```

From PowerShell:

```powershell
$env:MINIAPP_API_BASE="https://api.example.com"
npm.cmd run build:weapp
```

Configure the same HTTPS domain as the WeChat mini program `request` legal domain before uploading the production or trial build.
