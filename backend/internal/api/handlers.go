package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/shopspring/decimal"

	"github.com/pietromezzadri/simple-calculator/backend/internal/calculator"
)

// maxBodyBytes comfortably fits two operands at their longest.
const maxBodyBytes = 4 << 10

// Operands stay raw until validated, so that a field's absence, its type and
// its value can each be reported with their own error.
type binaryRequest struct {
	A json.RawMessage `json:"a"`
	B json.RawMessage `json:"b"`
}

type unaryRequest struct {
	A json.RawMessage `json:"a"`
}

type resultResponse struct {
	Result string `json:"result"`
}

func binaryHandler(op func(a, b decimal.Decimal) (decimal.Decimal, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req binaryRequest
		if err := decodeBody(w, r, &req); err != nil {
			writeError(w, err)
			return
		}
		a, err := parseOperand("a", req.A)
		if err != nil {
			writeError(w, err)
			return
		}
		b, err := parseOperand("b", req.B)
		if err != nil {
			writeError(w, err)
			return
		}
		result, opErr := op(a, b)
		writeResult(w, result, opErr)
	}
}

func unaryHandler(op func(a decimal.Decimal) (decimal.Decimal, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req unaryRequest
		if err := decodeBody(w, r, &req); err != nil {
			writeError(w, err)
			return
		}
		a, err := parseOperand("a", req.A)
		if err != nil {
			writeError(w, err)
			return
		}
		result, opErr := op(a)
		writeResult(w, result, opErr)
	}
}

func writeResult(w http.ResponseWriter, result decimal.Decimal, err error) {
	if err != nil {
		writeError(w, calculationError(err))
		return
	}
	writeJSON(w, http.StatusOK, resultResponse{Result: result.String()})
}

// decodeBody reads exactly one JSON object with only the fields of dst.
func decodeBody(w http.ResponseWriter, r *http.Request, dst any) *apiError {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes))
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(dst); err != nil {
		return decodeError(err)
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			return decodeError(err)
		}
		return &apiError{http.StatusBadRequest, "invalid_json", "The request body must contain a single JSON object."}
	}
	return nil
}

func decodeError(err error) *apiError {
	var tooLarge *http.MaxBytesError
	switch {
	case errors.As(err, &tooLarge):
		return &apiError{http.StatusRequestEntityTooLarge, "body_too_large", "The request body is too large."}
	case errors.Is(err, io.EOF):
		return &apiError{http.StatusBadRequest, "invalid_json", "The request body is empty."}
	case strings.HasPrefix(err.Error(), "json: unknown field "):
		// encoding/json has no typed error for this case.
		field := strings.TrimPrefix(err.Error(), "json: unknown field ")
		return &apiError{http.StatusBadRequest, "invalid_json", "Unknown field " + field + "."}
	default:
		return &apiError{http.StatusBadRequest, "invalid_json", "The request body must be a JSON object."}
	}
}

// parseOperand accepts a JSON number or a string holding one. Numbers are read
// from their source text and never pass through float64, so no digits are lost.
func parseOperand(name string, raw json.RawMessage) (decimal.Decimal, *apiError) {
	if len(raw) == 0 || bytes.Equal(raw, []byte("null")) {
		message := fmt.Sprintf("Operand %q is required.", name)
		return decimal.Decimal{}, &apiError{http.StatusBadRequest, "missing_operand", message}
	}

	text := string(raw)
	switch raw[0] {
	case '"':
		if err := json.Unmarshal(raw, &text); err != nil {
			return decimal.Decimal{}, invalidOperand(name, calculator.ErrInvalidNumber)
		}
	case '{', '[', 't', 'f':
		return decimal.Decimal{}, invalidOperand(name, calculator.ErrInvalidNumber)
	}

	value, err := calculator.Parse(text)
	if err != nil {
		return decimal.Decimal{}, invalidOperand(name, err)
	}
	return value, nil
}

func invalidOperand(name string, err error) *apiError {
	message := fmt.Sprintf("Operand %q is %v.", name, err)
	return &apiError{http.StatusBadRequest, "invalid_operand", message}
}
