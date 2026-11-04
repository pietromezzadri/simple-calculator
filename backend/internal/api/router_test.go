package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func newTestRouter(static http.Handler) http.Handler {
	return NewRouter(slog.New(slog.NewTextHandler(io.Discard, nil)), static)
}

func do(t *testing.T, h http.Handler, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if got := rec.Header().Get("Content-Type"); got != "application/json" && rec.Code != http.StatusTeapot {
		t.Errorf("Content-Type = %q, want application/json", got)
	}
	return rec
}

func errorCode(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var body errorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("response %q is not an error body: %v", rec.Body, err)
	}
	if body.Error.Message == "" {
		t.Errorf("error %q has no message", body.Error.Code)
	}
	return body.Error.Code
}

func TestOperations(t *testing.T) {
	tests := []struct {
		name, path, body, want string
	}{
		{"add", "add", `{"a": 2, "b": 3}`, "5"},
		{"add is exact", "add", `{"a": 0.1, "b": 0.2}`, "0.3"},
		{"subtract", "subtract", `{"a": 5, "b": 8}`, "-3"},
		{"multiply", "multiply", `{"a": 6, "b": 7}`, "42"},
		{"divide", "divide", `{"a": 10, "b": 4}`, "2.5"},
		{"power", "power", `{"a": 2, "b": 10}`, "1024"},
		{"percentage", "percentage", `{"a": 10, "b": 200}`, "20"},
		{"sqrt", "sqrt", `{"a": 144}`, "12"},
		{"operands as strings", "add", `{"a": "0.1", "b": "0.2"}`, "0.3"},
		{"mixed operand types", "add", `{"a": "1", "b": 2}`, "3"},
		{"exponent notation", "add", `{"a": 1e3, "b": "1E3"}`, "2000"},
		{"negative numbers", "add", `{"a": -1.5, "b": -1.5}`, "-3"},
		{"digits beyond float64 survive", "add", `{"a": 12345678901234567890.123456789, "b": 0}`, "12345678901234567890.123456789"},
	}

	router := newTestRouter(nil)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := do(t, router, http.MethodPost, apiPrefix+tt.path, tt.body)
			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, body %s", rec.Code, rec.Body)
			}
			var body resultResponse
			if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			if body.Result != tt.want {
				t.Errorf("result = %s, want %s", body.Result, tt.want)
			}
		})
	}
}

func TestErrors(t *testing.T) {
	tests := []struct {
		name, method, path, body string
		status                   int
		code                     string
	}{
		{"division by zero", "POST", apiPrefix + "divide", `{"a": 1, "b": 0}`, 422, "division_by_zero"},
		{"square root of a negative", "POST", apiPrefix + "sqrt", `{"a": -1}`, 422, "negative_sqrt"},
		{"undefined power", "POST", apiPrefix + "power", `{"a": 0, "b": -1}`, 422, "undefined_power"},
		{"result out of range", "POST", apiPrefix + "power", `{"a": 10, "b": 100}`, 422, "out_of_range"},

		{"empty body", "POST", apiPrefix + "add", ``, 400, "invalid_json"},
		{"malformed JSON", "POST", apiPrefix + "add", `{"a": 1,`, 400, "invalid_json"},
		{"not an object", "POST", apiPrefix + "add", `[1, 2]`, 400, "invalid_json"},
		{"unknown field", "POST", apiPrefix + "add", `{"a": 1, "b": 2, "c": 3}`, 400, "invalid_json"},
		{"second operand on sqrt", "POST", apiPrefix + "sqrt", `{"a": 1, "b": 2}`, 400, "invalid_json"},
		{"trailing data", "POST", apiPrefix + "add", `{"a": 1, "b": 2} {}`, 400, "invalid_json"},

		{"missing a", "POST", apiPrefix + "add", `{"b": 2}`, 400, "missing_operand"},
		{"missing b", "POST", apiPrefix + "add", `{"a": 1}`, 400, "missing_operand"},
		{"null operand", "POST", apiPrefix + "add", `{"a": null, "b": 2}`, 400, "missing_operand"},
		{"sqrt missing operand", "POST", apiPrefix + "sqrt", `{}`, 400, "missing_operand"},

		{"text operand", "POST", apiPrefix + "add", `{"a": "abc", "b": 2}`, 400, "invalid_operand"},
		{"empty operand", "POST", apiPrefix + "add", `{"a": 1, "b": ""}`, 400, "invalid_operand"},
		{"boolean operand", "POST", apiPrefix + "add", `{"a": true, "b": 2}`, 400, "invalid_operand"},
		{"array operand", "POST", apiPrefix + "add", `{"a": [1], "b": 2}`, 400, "invalid_operand"},
		{"object operand", "POST", apiPrefix + "add", `{"a": {}, "b": 2}`, 400, "invalid_operand"},
		{"NaN string", "POST", apiPrefix + "add", `{"a": "NaN", "b": 2}`, 400, "invalid_operand"},
		{"huge exponent", "POST", apiPrefix + "add", `{"a": 1e1000000000, "b": 2}`, 400, "invalid_operand"},
		{"sqrt with text operand", "POST", apiPrefix + "sqrt", `{"a": "abc"}`, 400, "invalid_operand"},

		{"body too large", "POST", apiPrefix + "add", `{"a": "` + strings.Repeat("1", maxBodyBytes) + `", "b": 2}`, 413, "body_too_large"},
		{"body too large after valid JSON", "POST", apiPrefix + "add", `{"a": 1, "b": 2}` + strings.Repeat(" ", maxBodyBytes), 413, "body_too_large"},

		{"unknown operation", "POST", apiPrefix + "modulo", `{"a": 1, "b": 2}`, 404, "not_found"},
		{"unknown API version", "POST", "/api/v2/add", `{"a": 1, "b": 2}`, 404, "not_found"},
		{"path with no static site", "GET", "/", ``, 404, "not_found"},

		{"GET on an operation", "GET", apiPrefix + "add", ``, 405, "method_not_allowed"},
		{"POST on the health check", "POST", "/healthz", ``, 405, "method_not_allowed"},
	}

	router := newTestRouter(nil)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := do(t, router, tt.method, tt.path, tt.body)
			if rec.Code != tt.status {
				t.Errorf("status = %d, want %d (body %s)", rec.Code, tt.status, rec.Body)
			}
			if code := errorCode(t, rec); code != tt.code {
				t.Errorf("code = %q, want %q", code, tt.code)
			}
		})
	}
}

func TestMethodNotAllowedNamesTheMethod(t *testing.T) {
	rec := do(t, newTestRouter(nil), http.MethodGet, apiPrefix+"add", "")
	if got := rec.Header().Get("Allow"); got != http.MethodPost {
		t.Errorf("Allow = %q, want POST", got)
	}
}

func TestHealth(t *testing.T) {
	rec := do(t, newTestRouter(nil), http.MethodGet, "/healthz", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"ok"`)) {
		t.Errorf("body = %s", rec.Body)
	}
}

func TestStaticHandlerServesEverythingOutsideTheAPI(t *testing.T) {
	static := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	})
	router := newTestRouter(static)

	if rec := do(t, router, http.MethodGet, "/index.html", ""); rec.Code != http.StatusTeapot {
		t.Errorf("static path: status = %d", rec.Code)
	}
	rec := do(t, router, http.MethodGet, "/api/v1/nope", "")
	if rec.Code != http.StatusNotFound {
		t.Errorf("unknown API path must not reach the frontend: status = %d", rec.Code)
	}
}

func TestPanicBecomesInternalError(t *testing.T) {
	var logs bytes.Buffer
	logger := slog.New(slog.NewTextHandler(&logs, nil))
	handler := recoverPanics(logger, http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("boom")
	}))

	rec := do(t, handler, http.MethodGet, "/", "")

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status = %d", rec.Code)
	}
	if code := errorCode(t, rec); code != "internal_error" {
		t.Errorf("code = %q", code)
	}
	if !strings.Contains(logs.String(), "boom") {
		t.Errorf("panic not logged: %s", logs.String())
	}
}

func TestUnexpectedCalculationErrorIsNotLeaked(t *testing.T) {
	got := calculationError(errors.New("secret detail"))
	if got.Status != http.StatusInternalServerError || strings.Contains(got.Message, "secret") {
		t.Errorf("got %+v", got)
	}
}

func TestRequestsAreLogged(t *testing.T) {
	var logs bytes.Buffer
	router := NewRouter(slog.New(slog.NewTextHandler(&logs, nil)), nil)

	do(t, router, http.MethodPost, apiPrefix+"divide", `{"a": 1, "b": 0}`)

	for _, want := range []string{"method=POST", "path=/api/v1/divide", "status=422"} {
		if !strings.Contains(logs.String(), want) {
			t.Errorf("log %q is missing %q", logs.String(), want)
		}
	}
}
