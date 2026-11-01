# 0013. Take Number answers in a text input, not `type="number"`

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

The spec's Number field has a minimum, a maximum, a decimal-places setting, and a prefix and suffix. The reviewer checks that validation is correct, and D-15 already decided that extra decimals are an error, not something rounded away silently. So the control has to hand the plugin exactly what the respondent typed, and the plugin has to be able to say what is wrong with it.

The obvious control is `<input type="number">`. It has several documented problems for a form like this one:

- Scrolling the page with the pointer over a focused input changes its value in several browsers. A respondent scrolling past "Amount" can change 120 to 117 without noticing.
- It accepts exponent notation: `1e3` is a valid value, so the field takes 1000.
- When the text cannot be parsed (`12a`, or `1,5` in some locales), `value` comes back as `''`. The app cannot tell "empty" from "not a number", so it cannot report the actual problem.
- Its spinner buttons and its native validation bubbles (from `min`, `max` and `step`) duplicate the app's own error summary in a different voice and at a different time.

## Options considered

### Option A: `type="number"`, with `min`, `max` and `step`

Native semantics (`role="spinbutton"`), arrow-key stepping, and a numeric keyboard on phones. But it has every problem above. Working around them means a `wheel` listener that blurs the input, a `keydown` filter for `e`, and `noValidate` on the form, and the parse failure is still invisible. That is more code than the alternative, and it keeps fighting the browser.

### Option B: `type="text"` with `inputMode`, parsed by the plugin

The input holds the raw text. The stored value is `{ kind: 'number', input }`, the text as typed (HLD §4.2). `parseDecimal` accepts only an optional sign, digits and an optional fraction, so exponents, thousands separators and `Infinity` are refused with a message that gives an example ("like 24.50"). `inputMode="decimal"` (or `numeric` for whole numbers) still brings up a number pad on phones. The wheel does nothing to a text input.

What is lost: the spinbutton role and arrow-key stepping. Stepping matters little for amounts and counts typed from a receipt, and a text box with a label and a hint naming the limits is fully accessible.

### Option C: a third-party masked or number input

It formats as the respondent types and handles locales. But it is a dependency for one field, a masked value is hard to edit with assistive technology, and it still needs our own validation to meet D-15.

## Decision

Option B. A text input with `inputMode` gives the plugin the respondent's exact text, so every invalid answer can be named rather than coerced, and it removes the scroll-wheel and `e` problems instead of patching them.

## Consequences

- Number validation is plain, testable code in the plugin (`fields/number/definition.ts`): empty, not a number (with an example), too many decimals, below the minimum, above the maximum, in that order.
- The hint tells the respondent the precision and the limits before they submit ("Up to 2 decimal places, from 0 to 500."), because the browser no longer hints at them.
- Negative numbers are allowed. `1,000` is refused like `1e3`, so the parse does not depend on the locale. The export, by contrast, formats the number for the viewer's locale ("$1,234.50").
- The settings refuse a minimum or maximum with more decimal places than answers may have (a whole-number field with a minimum of 0.5), because the real limit would silently differ from the one the author typed.
- With more time: accept the locale's decimal comma, which needs a locale-aware parse and an unambiguous rule for thousands separators.
