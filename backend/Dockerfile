# Multi-stage Dockerfile for FastAPI Backend

# Stage 1: Base image
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install python packages
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Stage 2: Development stage
FROM base AS development
EXPOSE 8000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# Stage 3: Production stage
FROM base AS production

# Create a secure non-root user
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -m -s /bin/bash appuser

# Copy application source code into the package path /app/backend
COPY . /app/backend

# Create database directory, upload directories, and fix directory ownership
RUN mkdir -p /app/data /app/uploads/reports /app/uploads/user_1 && \
    chown -R appuser:appgroup /app

# Switch to the non-root user
USER appuser

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
