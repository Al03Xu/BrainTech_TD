# Panduan DevOps BrainTech_TD

Proyek ini memakai aplikasi Todo dari https://github.com/AddyKhan257/To-Do-App (React + Express + MySQL 8) yang sudah disesuaikan untuk pipeline CI/CD. Repository proyek: https://github.com/Al03Xu/BrainTech_TD

## Alur keseluruhan

Satu kali `git push` ke branch `main` menjalankan seluruh rantai berikut di GitHub Actions (VM milik GitHub), tanpa langkah manual:

```
push ke main
  └─ CI   : backend unit test + build frontend  (paralel)
       └─ integration test: docker compose up 3 container, smoke test lewat nginx
            └─ build & push 3 image (frontend, backend, mysql)
                 ├─ Docker Hub : docker.io/<user>/todo-*:latest dan :sha-xxxxxxx
                 └─ GHCR       : ghcr.io/<owner>/todo-*  (cadangan di cloud GitHub)
                      └─ CD: SSH ke VPS -> pull image -> up -d -> cek /api/health
```

Pull request ke `main` hanya menjalankan bagian CI (test), tidak membangun image dan tidak deploy.

Job deploy hanya jalan kalau repository variable `DEPLOY_ENABLED` bernilai `true`. Selama VPS belum ada, jangan buat variable itu: job deploy akan berstatus skipped (abu-abu) dan pipeline tetap hijau.

## Urutan pengerjaan kalau VPS belum ada

Tahap A, bisa dikerjakan sekarang tanpa VPS: langkah 1, 2, 3, lalu di langkah 5 isi hanya `DOCKERHUB_USERNAME` dan `DOCKERHUB_TOKEN`, kemudian langkah 6 (push). Hasilnya: test, integration test, dan image di Docker Hub serta GHCR sudah berjalan.

Tahap B, menjelang submit setelah VPS ada: langkah 4, lalu sisa secret di langkah 5 (`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`), lalu buat variable `DEPLOY_ENABLED` = `true` (Settings > Secrets and variables > Actions > tab Variables > New repository variable). Picu deploy dengan Actions > CI-CD > Run workflow (branch `main`), atau push commit baru ke `main`. Lanjutkan ke langkah 7.

## Apa saja yang diubah dari repo asli

| File | Perubahan | Alasan |
|---|---|---|
| `frontend/src/App.js` | URL API dari `http://localhost:5000` menjadi `/api` | Di VPS, `localhost` di browser adalah laptop pengunjung, bukan server |
| `frontend/nginx.conf` | Baru: `/api/` diteruskan ke container `backend:5000` | Hanya port 80 yang perlu dibuka ke internet |
| `frontend/Dockerfile` | Node 22, `npm ci`, memakai nginx.conf, healthcheck | Node 18 sudah EOL; build jadi reproducible |
| `backend/index.js` | Ekspor `app`, `listen` hanya saat dijalankan langsung | Supaya bisa di-unit-test |
| `backend/test/app.test.js` | Baru: 3 unit test (node --test + supertest) | Tahap CI |
| `backend/Dockerfile` | Node 22, `npm ci --omit=dev`, user non-root, healthcheck | Praktik standar image produksi |
| `mysql/Dockerfile` | Baru: `mysql:8.4` + `init.sql` di dalam image | Database punya image sendiri, tidak bergantung image pribadi orang lain |
| `docker-compose.yml` | Build dari source, password dari env, user DB khusus (bukan root), healthcheck berantai | Dipakai untuk dev lokal dan integration test |
| `deploy/docker-compose.prod.yml` | Baru: hanya `image:` dari registry, `restart: unless-stopped`, port 3306 dan 5000 tidak dibuka | Dipakai di VPS |
| `deploy/.env.example` | Baru: contoh variabel rahasia | `.env` asli hanya ada di VPS |
| `.github/workflows/ci-cd.yml` | Baru: pipeline CI/CD lengkap | Inti tugas |
| `package-lock.json` (2 file) | Baru | Wajib untuk `npm ci` |

## Langkah 1. Siapkan repository kelompok

Repository: https://github.com/Al03Xu/BrainTech_TD (sudah dibuat, masih kosong).

1. Ekstrak `BrainTech_TD.zip`, lalu buka terminal (Git Bash, PowerShell, atau terminal Linux/Mac) di folder `BrainTech_TD`. Pastikan folder tersembunyi `.github` ikut terekstrak.
2. Jadikan repo Git dan sambungkan ke GitHub, tapi jangan push dulu:

   ```bash
   git init
   git config user.name "Al03Xu"
   git config user.email "<email-akun-github>"
   git add .
   git commit -m "Initial commit: aplikasi Todo dengan Docker dan pipeline CI/CD"
   git branch -M main
   git remote add origin https://github.com/Al03Xu/BrainTech_TD.git
   ```

3. Jangan push dulu. Selesaikan langkah 2, 3, dan isi secret Docker Hub di langkah 5, karena push pertama ke `main` langsung membangun dan mengirim image.

## Langkah 2. Uji di laptop

Docker:

```bash
docker compose up -d --build
docker compose ps          # tunggu sampai ketiganya "healthy"
```

Buka http://localhost:3000, coba tambah, centang, dan hapus todo. Matikan dengan `docker compose down` (tambahkan `-v` untuk menghapus data MySQL).

Podman (alternatif):

```bash
podman compose up -d --build
podman ps
```

`podman compose` memanggil `docker-compose` atau `podman-compose` yang terpasang. Disarankan memasang `docker-compose` sebagai provider karena dukungan `depends_on: condition: service_healthy` lebih lengkap.

Unit test bisa dicoba tanpa container:

```bash
cd backend && npm ci && npm test
```

## Langkah 3. Siapkan Docker Hub

1. Daftar atau login di https://hub.docker.com.
2. Buka Account settings > Personal access tokens > Generate new token, beri akses Read & Write, salin tokennya.
3. Repository `todo-frontend`, `todo-backend`, dan `todo-mysql` tidak perlu dibuat manual, karena akan dibuat otomatis saat push pertama. Pastikan visibilitas default akun adalah Public. Kalau private, VPS harus `docker login` sekali (lihat langkah 4).

## Langkah 4. Siapkan VPS

Contoh untuk Ubuntu 22.04/24.04. Jalankan sebagai root atau user dengan sudo.

1. Install Docker (sudah termasuk plugin compose):

   ```bash
   curl -fsSL https://get.docker.com | sh
   ```

2. Buat user khusus deploy dan beri akses Docker:

   ```bash
   adduser --disabled-password --gecos "" deploy
   usermod -aG docker deploy
   ```

3. Buat SSH key khusus untuk GitHub Actions. Lakukan di laptop, bukan di VPS:

   ```bash
   ssh-keygen -t ed25519 -C "github-actions-deploy" -f deploy_key -N ""
   ```

   Isi `deploy_key.pub` dimasukkan ke VPS:

   ```bash
   mkdir -p /home/deploy/.ssh
   cat deploy_key.pub >> /home/deploy/.ssh/authorized_keys   # tempel isinya
   chown -R deploy:deploy /home/deploy/.ssh
   chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
   ```

   Isi `deploy_key` (private key) nanti dimasukkan ke GitHub Secrets. Coba dari laptop: `ssh -i deploy_key deploy@IP_VPS`.

4. Buat folder aplikasi dan file `.env` (sekali saja, tidak pernah masuk Git):

   ```bash
   su - deploy
   mkdir -p ~/todo-app && cd ~/todo-app
   nano .env      # isi seperti deploy/.env.example
   chmod 600 .env
   ```

   Isi `IMAGE_PREFIX=docker.io/<username-dockerhub>` dan password yang kuat. `IMAGE_TAG` akan ditimpa otomatis oleh pipeline.

5. Buka firewall hanya untuk SSH dan HTTP:

   ```bash
   sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw enable
   ```

Kalau VPS memakai Podman (misalnya Fedora atau RHEL), workflow otomatis memakai `podman compose` bila perintah `docker` tidak ada. Hal yang perlu disiapkan:

- Pasang `podman` dan `docker-compose` (sebagai provider `podman compose`), lalu aktifkan socket: `systemctl --user enable --now podman.socket`.
- Mode rootless tidak bisa membuka port di bawah 1024. Pilih salah satu: set `APP_PORT=8080` di `.env`, atau jalankan `sudo sysctl -w net.ipv4.ip_unprivileged_port_start=80`.
- Agar container hidup lagi setelah VPS reboot: `sudo loginctl enable-linger deploy` dan `systemctl --user enable podman-restart.service`.

## Langkah 5. Isi GitHub Secrets

Di repo kelompok: Settings > Secrets and variables > Actions > New repository secret.

| Secret | Isi |
|---|---|
| `DOCKERHUB_USERNAME` | username Docker Hub |
| `DOCKERHUB_TOKEN` | token dari langkah 3 |
| `VPS_HOST` | IP publik VPS |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | seluruh isi file `deploy_key` (termasuk baris BEGIN dan END) |
| `VPS_PORT` | opsional, isi kalau SSH bukan port 22 |

Login ke GHCR memakai `GITHUB_TOKEN` bawaan. Izin `packages: write` sudah diminta di dalam workflow, jadi tidak perlu secret tambahan.

Workflow memakai environment `production`. GitHub membuatnya otomatis saat pertama kali jalan. Kalau ingin ada tombol persetujuan manual sebelum deploy, buka Settings > Environments > production > Required reviewers.

## Langkah 6. Satu trigger: push ke main

```bash
git add .
git commit -m "Tambah pipeline CI/CD dan konfigurasi container"
git push -u origin main
```

Buka tab Actions di GitHub. Urutan job yang terlihat:

1. Backend unit test dan Frontend build (jalan bersamaan)
2. Integration test (docker compose): menyalakan 3 container di VM GitHub, lalu memanggil `/`, `/api/health`, membuat todo, dan membacanya kembali lewat nginx
3. Build & push frontend / backend / mysql (3 job paralel)
4. Deploy ke VPS

## Langkah 7. Cek hasilnya

- Docker Hub: muncul 3 repository dengan tag `latest` dan `sha-xxxxxxx`.
- GitHub: tab Packages di profil atau organisasi berisi 3 image yang sama (GHCR).
- Browser: buka `http://IP_VPS` (atau `http://IP_VPS:8080` kalau Podman rootless). Aplikasi sudah online.
- Di VPS: `cd ~/todo-app && docker compose -f docker-compose.prod.yml ps`.

## Alur kerja sehari-hari

1. Buat branch: `git checkout -b fitur-x`, ubah kode, push.
2. Buka Pull Request ke `main`. Hanya CI yang jalan, sebagai pemeriksa.
3. Setelah CI hijau, merge. Merge adalah push ke `main`, sehingga image dibangun dan VPS ter-update otomatis.

Supaya `main` tidak bisa di-push tanpa lulus test, aktifkan Settings > Branches > Add rule untuk `main`: Require a pull request dan Require status checks (pilih `Backend unit test`, `Frontend build`, `Integration test`).

## Rollback ke versi sebelumnya

Setiap build punya tag `sha-<7 karakter commit>`. Di VPS:

```bash
cd ~/todo-app
IMAGE_TAG=sha-abc1234 docker compose -f docker-compose.prod.yml up -d
```

Atau revert commit di GitHub, lalu pipeline akan men-deploy ulang secara otomatis.

## Troubleshooting

| Gejala | Penyebab umum |
|---|---|
| Job build-push gagal `unauthorized` | `DOCKERHUB_TOKEN` salah atau tidak punya izin Write |
| Deploy gagal `ssh: handshake failed` | Private key tidak lengkap di secret, atau public key belum ada di `authorized_keys` user deploy |
| Deploy gagal `.env belum ada` | Langkah 4 poin 4 belum dikerjakan |
| `pull access denied` di VPS | Repo Docker Hub private; jalankan `docker login` sekali di VPS sebagai user deploy |
| Halaman tampil tapi daftar todo kosong atau error | Cek `docker compose -f docker-compose.prod.yml logs backend`; biasanya password DB di `.env` diubah setelah volume MySQL terlanjur dibuat |
| Data awal (3 todo contoh) tidak muncul | `init.sql` hanya dijalankan saat volume MySQL masih kosong. Reset dengan `docker compose -f docker-compose.prod.yml down -v` (data hilang) |

## Pengembangan lanjutan (opsional)

- Scan kerentanan image dengan Trivy (`aquasecurity/trivy-action`) sebelum push.
- HTTPS dengan domain sendiri memakai Caddy atau Nginx + Let's Encrypt di depan container frontend.
- Backup otomatis MySQL dengan `mysqldump` terjadwal (cron) ke object storage.
- Monitoring sederhana memakai Uptime Kuma yang memantau `http://IP_VPS/api/health`.
