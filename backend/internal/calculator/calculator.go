// Package calculator holds the arithmetic behind the API. It knows nothing
// about HTTP: values go in as decimals, and failures come out as the sentinel
// errors below.
//
// Numbers are decimals rather than float64 so that 0.1 + 0.2 is exactly 0.3.
// Decimals are also unbounded, so the limits here keep one request from
// consuming unbounded CPU or memory.
package calculator

import (
	"errors"
	"fmt"
	"math"

	"github.com/shopspring/decimal"
)

const (
	// MaxScale is the number of decimal places a result is rounded to.
	MaxScale = 34
	// MaxMagnitude is the power of ten that operands and results must stay below.
	MaxMagnitude = 100
	// MaxPowerExponent is the largest absolute exponent Power accepts.
	MaxPowerExponent = 1000

	maxOperandLength   = 256
	minOperandExponent = -256
)

// Errors returned for values the calculator cannot accept or produce.
var (
	ErrInvalidNumber   = errors.New("not a valid number")
	ErrOperandTooLarge = errors.New("outside the supported range")
	ErrDivisionByZero  = errors.New("cannot divide by zero")
	ErrNegativeSqrt    = errors.New("cannot take the square root of a negative number")
	ErrUndefinedPower  = errors.New("this power is undefined")
	ErrOutOfRange      = errors.New("the result is outside the supported range")
)

// Parse converts text to an operand, rejecting anything too long or too extreme
// to calculate with safely. The checks use the decimal's stored exponent, so
// "1e9999" is refused without ever being expanded to its 10,000 digits.
func Parse(s string) (decimal.Decimal, error) {
	if len(s) > maxOperandLength {
		return decimal.Decimal{}, ErrOperandTooLarge
	}
	d, err := decimal.NewFromString(s)
	if err != nil {
		return decimal.Decimal{}, ErrInvalidNumber
	}
	if d.Exponent() < minOperandExponent || tooLarge(d) {
		return decimal.Decimal{}, ErrOperandTooLarge
	}
	return d, nil
}

// Add returns a + b.
func Add(a, b decimal.Decimal) (decimal.Decimal, error) {
	return finish(a.Add(b))
}

// Subtract returns a - b.
func Subtract(a, b decimal.Decimal) (decimal.Decimal, error) {
	return finish(a.Sub(b))
}

// Multiply returns a * b.
func Multiply(a, b decimal.Decimal) (decimal.Decimal, error) {
	return finish(a.Mul(b))
}

// Divide returns a / b.
func Divide(a, b decimal.Decimal) (decimal.Decimal, error) {
	if b.IsZero() {
		return decimal.Decimal{}, ErrDivisionByZero
	}
	return finish(a.DivRound(b, MaxScale))
}

// Percentage returns a percent of b, so Percentage(10, 200) is 20.
func Percentage(a, b decimal.Decimal) (decimal.Decimal, error) {
	return finish(a.Mul(b).Shift(-2))
}

// Sqrt returns the square root of a.
func Sqrt(a decimal.Decimal) (decimal.Decimal, error) {
	if a.IsNegative() {
		return decimal.Decimal{}, ErrNegativeSqrt
	}
	root, err := a.SqrtRound(MaxScale)
	if err != nil {
		return decimal.Decimal{}, fmt.Errorf("%w: %v", ErrOutOfRange, err)
	}
	return finish(root)
}

// Power returns a raised to b. Anything to the power of zero is 1, including
// zero itself, which is the usual convention for calculators.
func Power(a, b decimal.Decimal) (decimal.Decimal, error) {
	if b.IsZero() {
		return decimal.NewFromInt(1), nil
	}
	if a.IsZero() {
		if b.IsNegative() {
			return decimal.Decimal{}, ErrUndefinedPower
		}
		return decimal.Zero, nil
	}
	if a.IsNegative() && !b.IsInteger() {
		return decimal.Decimal{}, ErrUndefinedPower
	}
	if b.Abs().GreaterThan(decimal.NewFromInt(MaxPowerExponent)) {
		return decimal.Decimal{}, ErrOutOfRange
	}

	// Estimate the result's size first, so a huge power is refused before any
	// work is done on it and a tiny one is known to round to zero.
	digits := b.InexactFloat64() * math.Log10(a.Abs().InexactFloat64())
	if digits > MaxMagnitude+1 {
		return decimal.Decimal{}, ErrOutOfRange
	}
	if digits < -(MaxScale + 2) {
		return decimal.Zero, nil
	}

	result, err := a.PowWithPrecision(b, MaxScale)
	if err != nil {
		return decimal.Decimal{}, fmt.Errorf("%w: %v", ErrOutOfRange, err)
	}
	return finish(result)
}

// finish applies the rules every result shares: rounded to MaxScale places and
// below 10^MaxMagnitude. Keeping results within the operand limits means any
// result can be sent back as the next operand of a chained calculation.
func finish(d decimal.Decimal) (decimal.Decimal, error) {
	d = d.Round(MaxScale)
	if tooLarge(d) {
		return decimal.Decimal{}, ErrOutOfRange
	}
	return d, nil
}

// tooLarge reports whether |d| is at least 10^MaxMagnitude.
func tooLarge(d decimal.Decimal) bool {
	return !d.IsZero() && int64(d.NumDigits())+int64(d.Exponent()) > MaxMagnitude
}
