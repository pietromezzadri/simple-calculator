// Command server runs the calculator API, and the frontend too when STATIC_DIR
// points at its build output.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/pietromezzadri/simple-calculator/backend/internal/api"
)

const shutdownTimeout = 5 * time.Second

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(logger); err != nil {
		logger.Error("server stopped", "error", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	static, err := staticHandler(os.Getenv("STATIC_DIR"))
	if err != nil {
		return err
	}

	server := &http.Server{
		Addr:              net.JoinHostPort(os.Getenv("HOST"), port),
		Handler:           api.NewRouter(logger, static),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	serveErr := make(chan error, 1)
	go func() {
		logger.Info("listening", "port", port)
		serveErr <- server.ListenAndServe()
	}()

	select {
	case err := <-serveErr:
		return err
	case <-ctx.Done():
	}

	logger.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		return err
	}
	if err := <-serveErr; !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

// staticHandler serves dir, or returns nil when no directory is configured.
func staticHandler(dir string) (http.Handler, error) {
	if dir == "" {
		return nil, nil
	}
	info, err := os.Stat(dir)
	if err != nil {
		return nil, fmt.Errorf("STATIC_DIR: %w", err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("STATIC_DIR: %s is not a directory", dir)
	}
	return http.FileServer(http.Dir(dir)), nil
}
