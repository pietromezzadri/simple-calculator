# Builds the frontend and the server, and runs both from one small image:
#   docker build -t simple-calculator .
#   docker run -p 8080:8080 simple-calculator

FROM node:24-alpine AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM golang:1.26-alpine AS backend
WORKDIR /app
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /server ./cmd/server

# Only the static binary and the built frontend, running as a non-root user.
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=backend /server /server
COPY --from=frontend /app/dist /web
ENV STATIC_DIR=/web
EXPOSE 8080
ENTRYPOINT ["/server"]
