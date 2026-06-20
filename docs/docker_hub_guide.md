# InfraSight Docker Hub & Production Deployment Guide

This guide describes the optimized Docker configuration, image layout, and step-by-step instructions for publishing and running `InfraSight` images.

## Production Docker Images

| Component | Target Docker Hub Image | Base Image | Size (Virtual / Layer) | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Backend** | `yuvarajofl/infrasight-backend:latest` | `python:3.11-slim` | ~973 MB / ~220 MB | Optimized production FastAPI backend with non-root security execution. |
| **Frontend** | `yuvarajofl/infrasight-frontend:latest` | `nginx:stable-alpine` | ~102 MB / ~28.6 MB | Extremely small static bundle compiled via Vite + served by Nginx Alpine. |

## Image Optimization Details
1. **Multi-Stage Builds**:
   - Both backend and frontend utilize multi-stage Dockerfiles. The build tools (`node_modules` compilers, Python compilers) are used in transient stages and excluded from the final production images, reducing sizes dramatically.
2. **Minimal Base Images**:
   - Frontend runs on Nginx Alpine (`nginx:stable-alpine`).
   - Backend runs on Python slim (`python:3.11-slim`).
3. **Strict Ignore Patterns**:
   - `frontend/.dockerignore` and `backend/.dockerignore` ensure that host caches (`node_modules`, `venv`, `__pycache__`, `.pytest_cache`), local databases (`*.db`), logs, and secrets (`.env`) are never copied into the built images.

---

## Guide Commands

### 1. Build Production Images Locally

Run these commands from the root of the project to build the optimized production targets:

```bash
# Build backend production image
docker build --target production -t yuvarajofl/infrasight-backend:latest backend/

# Build frontend production image
docker build --target production -t yuvarajofl/infrasight-frontend:latest frontend/
```

### 2. Tag Images (Optional)

If you wish to use custom version tags alongside `latest`:

```bash
docker tag yuvarajofl/infrasight-backend:latest yuvarajofl/infrasight-backend:1.0.0
docker tag yuvarajofl/infrasight-frontend:latest yuvarajofl/infrasight-frontend:1.0.0
```

### 3. Login & Push to Docker Hub

Ensure you are logged into your Docker Hub account:

```bash
docker login -u yuvarajofl
```

Push the images to the registry:

```bash
docker push yuvarajofl/infrasight-backend:latest
docker push yuvarajofl/infrasight-frontend:latest
```

### 4. Pull and Run via Production Docker Compose

To pull and deploy the application in production without host source code dependencies:

```bash
# Pull the latest pre-built images from Docker Hub
docker compose -f docker-compose.prod.yml pull

# Run the complete stack in detached mode
docker compose -f docker-compose.prod.yml up -d
```

### 5. Stop the Production Stack

```bash
docker compose -f docker-compose.prod.yml down
```
