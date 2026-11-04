package api

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/pietromezzadri/simple-calculator/backend/internal/calculator"
)

// apiError is an error as the client sees it. Message is for people; Code is
// stable, for programs to match on.
type apiError struct {
	Status  int
	Code    string
	Message string
}

type errorResponse struct {
	Error errorBody `json:"error"`
}

type errorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// calculationError maps an error from the calculator package to its response.
// These are 422s: the request was well formed, but has no answer.
func calculationError(err error) *apiError {
	switch {
	case errors.Is(err, calculator.ErrDivisionByZero):
		return &apiError{http.StatusUnprocessableEntity, "division_by_zero", "Cannot divide by zero."}
	case errors.Is(err, calculator.ErrNegativeSqrt):
		return &apiError{http.StatusUnprocessableEntity, "negative_sqrt", "Cannot take the square root of a negative number."}
	case errors.Is(err, calculator.ErrUndefinedPower):
		return &apiError{http.StatusUnprocessableEntity, "undefined_power", "This power is undefined."}
	case errors.Is(err, calculator.ErrOutOfRange):
		return &apiError{http.StatusUnprocessableEntity, "out_of_range", "The result is too large to calculate."}
	default:
		return internalError
	}
}

var internalError = &apiError{http.StatusInternalServerError, "internal_error", "Something went wrong."}

func writeError(w http.ResponseWriter, e *apiError) {
	writeJSON(w, e.Status, errorResponse{errorBody{Code: e.Code, Message: e.Message}})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	// The status is already sent, so a failed write can't be reported to the client.
	_ = json.NewEncoder(w).Encode(body)
}
