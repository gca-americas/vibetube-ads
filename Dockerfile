# ==========================================
# Stage 1: Build Ad Ops Control Center Frontend (React SPA)
# ==========================================
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

COPY ad_ops_control_center/frontend/package*.json ./
RUN npm ci

COPY ad_ops_control_center/frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Build Ad Server (Go Backend)
# ==========================================
FROM golang:1.24-bookworm AS server-builder
WORKDIR /app/server

COPY ad_server/go.mod ad_server/go.sum* ./
RUN go mod download

COPY ad_server/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o /vibetube-ad-server .

# ==========================================
# Stage 3: Production Runtime Container
# ==========================================
FROM python:3.13-slim-bookworm
WORKDIR /app

# Install runtime dependencies for Python simulations and BigQuery
RUN pip install --no-cache-dir pydantic requests google-cloud-bigquery

# Copy frontend static build
COPY --from=frontend-builder /app/frontend/dist /app/dist

# Copy Go server binary
COPY --from=server-builder /vibetube-ad-server /app/vibetube-ad-server

# Copy lab policies, models, and simulation engine
COPY lab_01_yield_optimization /app/lab_01_yield_optimization

# Ensure policies directory exists and is writable
RUN mkdir -p /app/lab_01_yield_optimization/policies && \
    chmod -R 777 /app/lab_01_yield_optimization/policies

ENV PORT=8080
ENV STATIC_DIR=/app/dist
ENV LAB_DIR=/app/lab_01_yield_optimization

EXPOSE 8080

CMD ["/app/vibetube-ad-server"]
