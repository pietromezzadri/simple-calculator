package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestStaticHandler(t *testing.T) {
	dir := t.TempDir()
	file := filepath.Join(dir, "index.html")
	if err := os.WriteFile(file, []byte("hello"), 0o644); err != nil {
		t.Fatal(err)
	}

	t.Run("no directory configured", func(t *testing.T) {
		h, err := staticHandler("")
		if err != nil || h != nil {
			t.Errorf("got handler %v, error %v; want neither", h, err)
		}
	})

	t.Run("serves the directory", func(t *testing.T) {
		h, err := staticHandler(dir)
		if err != nil {
			t.Fatal(err)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
		if rec.Code != http.StatusOK || rec.Body.String() != "hello" {
			t.Errorf("status %d, body %q", rec.Code, rec.Body)
		}
	})

	t.Run("missing directory", func(t *testing.T) {
		if _, err := staticHandler(filepath.Join(dir, "nope")); err == nil {
			t.Error("want an error")
		}
	})

	t.Run("file instead of a directory", func(t *testing.T) {
		if _, err := staticHandler(file); err == nil {
			t.Error("want an error")
		}
	})
}
