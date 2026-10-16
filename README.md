# BrainTech_TD

Aplikasi Todo (React + Express + MySQL 8) yang dijalankan sebagai tiga container terpisah, dengan pipeline CI/CD di GitHub Actions: test, build image, push ke Docker Hub dan GitHub Container Registry, lalu deploy ke VPS.

Aplikasi dasarnya berasal dari [AddyKhan257/To-Do-App](https://github.com/AddyKhan257/To-Do-App), kemudian dimodifikasi untuk kebutuhan DevOps (Dockerfile per service, reverse proxy nginx, unit test, compose produksi, dan workflow CI/CD).

## Arsitektur

```
Browser ──> frontend (nginx :80) ──/api/──> backend (Express :5000) ──> mysql (:3306)
```

Hanya container frontend yang membuka port ke luar. Backend dan MySQL hanya bisa diakses dari jaringan internal container.

| Service | Folder | Image dasar |
|---|---|---|
| frontend | `frontend/` | node:22-alpine (build), nginx:stable-alpine (runtime) |
| backend | `backend/` | node:22-alpine |
| mysql | `mysql/` | mysql:8.4 |

## Menjalankan di laptop

Docker:

```bash
docker compose up -d --build
docker compose ps
```

Podman:

```bash
podman compose up -d --build
```

Buka http://localhost:3000. Hentikan dengan `docker compose down` (tambah `-v` untuk menghapus data).

Unit test backend:

```bash
cd backend && npm ci && npm test
```

## Pipeline CI/CD

File: `.github/workflows/ci-cd.yml`

| Pemicu | Yang dijalankan |
|---|---|
| Pull request ke `main` | unit test backend, build frontend, integration test |
| Push ke `main` / Run workflow | semua di atas, lalu build & push 3 image, lalu deploy (kalau `DEPLOY_ENABLED=true`) |

Image hasil build:

- `docker.io/<DOCKERHUB_USERNAME>/todo-frontend`, `todo-backend`, `todo-mysql`
- `ghcr.io/al03xu/todo-frontend`, `todo-backend`, `todo-mysql`

Setiap image diberi tag `latest` dan `sha-<7 karakter commit>`.

Secrets yang dibutuhkan: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, dan untuk deploy `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`.

## Deploy ke VPS

Gunakan `deploy/docker-compose.prod.yml` dan buat `.env` dari `deploy/.env.example` di folder `~/todo-app` pada VPS. Langkah lengkap ada di [PANDUAN-DEVOPS.md](PANDUAN-DEVOPS.md).
