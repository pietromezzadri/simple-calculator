// Package api exposes the calculator over HTTP as a small JSON REST API.
package api

import (
	"log/slog"
	"net/http"

	"github.com/shopspring/decimal"

	"github.com/pietromezzadri/simple-calculator/backend/internal/calculator"
)

const apiPrefix = "/api/v1/"

// NewRouter returns the HTTP handler for the whole service. Paths outside the
// API go to static, which serves the frontend; it may be nil when the frontend
// is hosted elsewhere, as it is in development.
func NewRouter(logger *slog.Logger, static http.Handler) http.Handler {
	mux := http.NewServeMux()

	binaryOps := map[string]func(a, b decimal.Decimal) (decimal.Decimal, error){
		"add":        calculator.Add,
		"subtract":   calculator.Subtract,
		"multiply":   calculator.Multiply,
		"divide":     calculator.Divide,
		"power":      calculator.Power,
		"percentage": calculator.Percentage,
	}
	for name, op := range binaryOps {
		route(mux, http.MethodPost, apiPrefix+name, binaryHandler(op))
	}
	route(mux, http.MethodPost, apiPrefix+"sqrt", unaryHandler(calculator.Sqrt))
	route(mux, http.MethodGet, "/healthz", health)

	mux.HandleFunc("/api/", notFound)
	if static != nil {
		mux.Handle("/", static)
	} else {
		mux.HandleFunc("/", notFound)
	}

	return recoverPanics(logger, logRequests(logger, mux))
}

// route registers handler for one method on path, and a JSON 405 for the
// others in place of the plain-text one ServeMux would send.
func route(mux *http.ServeMux, method, path string, handler http.HandlerFunc) {
	mux.HandleFunc(method+" "+path, handler)
	mux.HandleFunc(path, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Allow", method)
		writeError(w, &apiError{http.StatusMethodNotAllowed, "method_not_allowed", "This endpoint only accepts " + method + "."})
	})
}

func health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func notFound(w http.ResponseWriter, _ *http.Request) {
	writeError(w, &apiError{http.StatusNotFound, "not_found", "No such endpoint."})
}
