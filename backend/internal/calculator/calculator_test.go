package calculator_test

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/shopspring/decimal"

	"github.com/pietromezzadri/simple-calculator/backend/internal/calculator"
)

func dec(t *testing.T, s string) decimal.Decimal {
	t.Helper()
	d, err := decimal.NewFromString(s)
	if err != nil {
		t.Fatalf("bad test value %q: %v", s, err)
	}
	return d
}

// 1e100 is one past the largest allowed magnitude; this is the largest integer below it.
var maxInteger = strings.Repeat("9", calculator.MaxMagnitude)

func TestBinaryOperations(t *testing.T) {
	type op = func(a, b decimal.Decimal) (decimal.Decimal, error)
	tests := []struct {
		name    string
		op      op
		a, b    string
		want    string
		wantErr error
	}{
		{name: "add integers", op: calculator.Add, a: "2", b: "3", want: "5"},
		{name: "add is exact where floats are not", op: calculator.Add, a: "0.1", b: "0.2", want: "0.3"},
		{name: "add negatives", op: calculator.Add, a: "-2.5", b: "-2.5", want: "-5"},
		{name: "add past the limit", op: calculator.Add, a: maxInteger, b: "1", wantErr: calculator.ErrOutOfRange},

		{name: "subtract", op: calculator.Subtract, a: "5", b: "8", want: "-3"},
		{name: "subtract is exact", op: calculator.Subtract, a: "0.3", b: "0.1", want: "0.2"},
		{name: "subtract past the limit", op: calculator.Subtract, a: "-" + maxInteger, b: "1", wantErr: calculator.ErrOutOfRange},

		{name: "multiply", op: calculator.Multiply, a: "6", b: "7", want: "42"},
		{name: "multiply is exact", op: calculator.Multiply, a: "1.1", b: "1.1", want: "1.21"},
		{name: "multiply by zero", op: calculator.Multiply, a: "123.45", b: "0", want: "0"},
		{name: "multiply past the limit", op: calculator.Multiply, a: "1e60", b: "1e60", wantErr: calculator.ErrOutOfRange},
		{name: "multiply rounds to the scale", op: calculator.Multiply, a: "1e-30", b: "1e-30", want: "0"},

		{name: "divide", op: calculator.Divide, a: "10", b: "4", want: "2.5"},
		{name: "divide rounds to the scale", op: calculator.Divide, a: "1", b: "3", want: "0.3333333333333333333333333333333333"},
		{name: "divide rounds half away from zero", op: calculator.Divide, a: "2", b: "3", want: "0.6666666666666666666666666666666667"},
		{name: "divide negative", op: calculator.Divide, a: "-1", b: "8", want: "-0.125"},
		{name: "divide zero", op: calculator.Divide, a: "0", b: "5", want: "0"},
		{name: "divide by zero", op: calculator.Divide, a: "1", b: "0", wantErr: calculator.ErrDivisionByZero},
		{name: "divide zero by zero", op: calculator.Divide, a: "0", b: "0", wantErr: calculator.ErrDivisionByZero},
		{name: "divide past the limit", op: calculator.Divide, a: "1e60", b: "1e-60", wantErr: calculator.ErrOutOfRange},

		{name: "percentage", op: calculator.Percentage, a: "10", b: "200", want: "20"},
		{name: "percentage of one is a fraction", op: calculator.Percentage, a: "25", b: "1", want: "0.25"},
		{name: "percentage is exact", op: calculator.Percentage, a: "33.3", b: "0.1", want: "0.0333"},
		{name: "percentage of negative", op: calculator.Percentage, a: "50", b: "-8", want: "-4"},

		{name: "power", op: calculator.Power, a: "2", b: "10", want: "1024"},
		{name: "power of decimal is exact", op: calculator.Power, a: "1.1", b: "2", want: "1.21"},
		{name: "negative base, even exponent", op: calculator.Power, a: "-2", b: "2", want: "4"},
		{name: "negative base, odd exponent", op: calculator.Power, a: "-2", b: "3", want: "-8"},
		{name: "negative exponent", op: calculator.Power, a: "2", b: "-2", want: "0.25"},
		{name: "fractional exponent", op: calculator.Power, a: "4", b: "0.5", want: "2"},
		{name: "irrational power", op: calculator.Power, a: "2", b: "0.5", want: "1.4142135623730950488016887242096981"},
		{name: "exponent of zero", op: calculator.Power, a: "7", b: "0", want: "1"},
		{name: "zero to the zero", op: calculator.Power, a: "0", b: "0", want: "1"},
		{name: "zero to a positive", op: calculator.Power, a: "0", b: "3", want: "0"},
		{name: "zero to a negative", op: calculator.Power, a: "0", b: "-1", wantErr: calculator.ErrUndefinedPower},
		{name: "negative base, fractional exponent", op: calculator.Power, a: "-4", b: "0.5", wantErr: calculator.ErrUndefinedPower},
		{name: "largest power below the limit", op: calculator.Power, a: "10", b: "99", want: "1" + strings.Repeat("0", 99)},
		{name: "power exactly at the limit", op: calculator.Power, a: "10", b: "100", wantErr: calculator.ErrOutOfRange},
		{name: "power far past the limit", op: calculator.Power, a: "10", b: "1000", wantErr: calculator.ErrOutOfRange},
		{name: "exponent over its cap", op: calculator.Power, a: "1", b: "1001", wantErr: calculator.ErrOutOfRange},
		{name: "tiny power rounds to zero", op: calculator.Power, a: "2", b: "-1000", want: "0"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := tt.op(dec(t, tt.a), dec(t, tt.b))
			if tt.wantErr != nil {
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("got result %v, error %v; want error %v", got, err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got.String() != tt.want {
				t.Errorf("got %s, want %s", got, tt.want)
			}
		})
	}
}

func TestSqrt(t *testing.T) {
	tests := []struct {
		name    string
		a       string
		want    string
		wantErr error
	}{
		{name: "perfect square", a: "144", want: "12"},
		{name: "decimal perfect square", a: "0.09", want: "0.3"},
		{name: "zero", a: "0", want: "0"},
		{name: "irrational", a: "2", want: "1.4142135623730950488016887242096981"},
		{name: "largest operand", a: maxInteger, want: "1" + strings.Repeat("0", 50)},
		{name: "negative", a: "-1", wantErr: calculator.ErrNegativeSqrt},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := calculator.Sqrt(dec(t, tt.a))
			if tt.wantErr != nil {
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("got result %v, error %v; want error %v", got, err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got.String() != tt.want {
				t.Errorf("got %s, want %s", got, tt.want)
			}
		})
	}
}

func TestParse(t *testing.T) {
	valid := map[string]string{
		"0":            "0",
		"42":           "42",
		"-3.5":         "-3.5",
		"+7":           "7",
		".5":           "0.5",
		"5.":           "5",
		"1.5e3":        "1500",
		"2E-2":         "0.02",
		maxInteger:     maxInteger,
		"1e99":         "1" + strings.Repeat("0", 99),
		"0.1234567890": "0.123456789",
	}
	for in, want := range valid {
		t.Run("accepts "+in, func(t *testing.T) {
			got, err := calculator.Parse(in)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got.String() != want {
				t.Errorf("got %s, want %s", got, want)
			}
		})
	}

	invalid := map[string]error{
		"":                       calculator.ErrInvalidNumber,
		" ":                      calculator.ErrInvalidNumber,
		" 1":                     calculator.ErrInvalidNumber,
		"abc":                    calculator.ErrInvalidNumber,
		"1.2.3":                  calculator.ErrInvalidNumber,
		"1,5":                    calculator.ErrInvalidNumber,
		"0x10":                   calculator.ErrInvalidNumber,
		"1_000":                  calculator.ErrInvalidNumber,
		"NaN":                    calculator.ErrInvalidNumber,
		"Infinity":               calculator.ErrInvalidNumber,
		"-Inf":                   calculator.ErrInvalidNumber,
		"1e":                     calculator.ErrInvalidNumber,
		"-":                      calculator.ErrInvalidNumber,
		".":                      calculator.ErrInvalidNumber,
		"1e100":                  calculator.ErrOperandTooLarge,
		"1e9999":                 calculator.ErrOperandTooLarge,
		"1e-257":                 calculator.ErrOperandTooLarge,
		"1" + maxInteger:         calculator.ErrOperandTooLarge,
		strings.Repeat("1", 257): calculator.ErrOperandTooLarge,
	}
	for in, want := range invalid {
		t.Run("rejects "+in, func(t *testing.T) {
			got, err := calculator.Parse(in)
			if err == nil {
				t.Fatalf("got %s, want an error", got)
			}
			if !errors.Is(err, want) {
				t.Errorf("got error %v, want %v", err, want)
			}
		})
	}
}

// Extreme exponents are refused without being expanded, so even the largest
// values the library will decode must come back straight away.
func TestParseRefusesHugeExponentsQuickly(t *testing.T) {
	start := time.Now()
	for _, s := range []string{"1e10000", "1e-10000", "1e1000000000", "1e-1000000000", "1e99999999999999"} {
		if _, err := calculator.Parse(s); err == nil {
			t.Errorf("Parse(%q) succeeded, want an error", s)
		}
	}
	if elapsed := time.Since(start); elapsed > time.Second {
		t.Errorf("took %v", elapsed)
	}
}

// The largest power the limits allow must still finish quickly: this is the
// request an attacker would choose.
func TestPowerWorstCaseIsQuick(t *testing.T) {
	long := "0." + strings.Repeat("9", 250)
	cases := [][2]string{{long, "1000"}, {long, "-1000"}, {long, "999.5"}, {"1.0001", "999.5"}, {maxInteger, "0.99"}}

	start := time.Now()
	for _, c := range cases {
		if _, err := calculator.Power(dec(t, c[0]), dec(t, c[1])); err != nil {
			t.Errorf("Power(%.12s…, %s): %v", c[0], c[1], err)
		}
	}
	if elapsed := time.Since(start); elapsed > 2*time.Second {
		t.Errorf("took %v", elapsed)
	}
}

// A chained calculator sends each result back as the next operand, so every
// result the package can return has to be accepted by Parse.
func TestResultsAreValidOperands(t *testing.T) {
	results := []func() (decimal.Decimal, error){
		func() (decimal.Decimal, error) { return calculator.Divide(dec(t, "1"), dec(t, "3")) },
		func() (decimal.Decimal, error) { return calculator.Add(dec(t, maxInteger), dec(t, "0")) },
		func() (decimal.Decimal, error) { return calculator.Add(dec(t, "-"+maxInteger), dec(t, "0.5")) },
		func() (decimal.Decimal, error) { return calculator.Sqrt(dec(t, "2")) },
	}
	for _, result := range results {
		d, err := result()
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if _, err := calculator.Parse(d.String()); err != nil {
			t.Errorf("result %s is not a valid operand: %v", d, err)
		}
	}
}
