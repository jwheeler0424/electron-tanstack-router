import * as z from "zod/mini";
import { timezones } from "../../constants/timezones";

export const NullableSchema = z.union([z.null(), z.undefined()]);

export const StringSchema = z
  .string()
  .check(z.trim(), z.minLength(1, { message: "Please enter a value." }));

export const EmailSchema = z
  .string()
  .check(
    z.trim(),
    z.minLength(1, { message: "Please enter your email." }),
    z.email({ message: "Please enter a valid email address." })
  );

export const PasswordSchema = z
  .string()
  .check(z.trim(), z.minLength(1, { message: "Please enter your password." }));

export const ConfirmPasswordSchema = z
  .object({
    password: PasswordSchema,
    confirmPassword: PasswordSchema,
  })
  .check(
    z.refine((data) => data.password === data.confirmPassword, {
      message: "Passwords do not match.",
      path: ["confirmPassword"], // 👈 critical for form libraries
    })
  );

export const VerifyPasswordSchema = z.string().check(
  z.trim(),
  z.minLength(1, { message: "Please enter your password." }),
  z.minLength(8, {
    message: "Your password must be at least 8 characters long.",
  }),
  z.maxLength(100, { message: "Your password is too long." }),
  z.regex(/[a-z]/, {
    message: "Your password must contain a lowercase letter.",
  }),
  z.regex(/[A-Z]/, {
    message: "Your password must contain a uppercase letter.",
  }),
  z.regex(/[0-9]/, { message: "Your password must contain a number." }),
  z.regex(/[\W_]/, {
    message: "Your password must contain a special character.",
  })
);

export const UrlSchema = z
  .string()
  .check(
    z.trim(),
    z.minLength(1),
    z.url({ message: "The URL must be a valid URL format." })
  );

export const HostSchema = z
  .string()
  .check(
    z.trim(),
    z.minLength(1),
    z.url({ message: "The host URI must be a valid URI format." })
  );

export const PortSchema = z.string().check(
  z.trim(),
  z.regex(/^\d+$/, { message: "Port must be a number." }),
  z.refine(
    (v) => {
      const n = Number(v);
      return n >= 1 && n <= 65535;
    },
    { message: "Port must be between 1 and 65535." }
  )
);

export const NumberSchema = z
  .string()
  .check(
    z.trim(),
    z.regex(/^-?\d+(\.\d+)?$/, { message: "Value must be a number." })
  );

export const PortNumberSchema = z.number().check(
  z.refine((n) => Number.isInteger(n) && n >= 1 && n <= 65535, {
    message: "Port must be between 1 and 65535.",
  })
);

export const UsernameSchema = z.string().check(
  z.trim(),
  z.regex(/^[a-z0-9_-]$/iu, {
    message:
      "A username can only contain letters, numbers, underscores and hyphens.",
  }),
  z.minLength(4, {
    message: "Your username must be at least 4 characters long.",
  }),
  z.maxLength(128, {
    message: "Your username must be at most 128 characters long.",
  })
);

export const UsernameOrEmailSchema = z.union([UsernameSchema, EmailSchema], {
  message: "Input must be a valid username or email.",
});

export const PhoneNumberSchema = z.string().check(
  z.minLength(10, {
    message: "The phone number must be at least 10 characters long.",
  }),
  z.maxLength(15, { message: "The phone number cannot exceed 15 characters." }),
  z.regex(/^\+?[0-9()\s-]{10,15}$/, {
    message:
      'The phone number format is invalid. It should contain only digits, parentheses, spaces, hyphens, and an optional leading "+".',
  })
);

export const VerifyTokenUUIDSchema = z
  .string()
  .check(
    z.trim(),
    z.minLength(1, { message: "Invalid/Expired token" }),
    z.uuid({ message: "Invalid/Expired token" })
  );

export const VerifyTokenUUIDAsyncSchema = z.union([
  VerifyTokenUUIDSchema,
  NullableSchema,
]);

// ─────────────────────────────
// 2. Extract all zones (normal array, no const assertion)
// ─────────────────────────────
const allZones = Object.values(timezones)
  .flat()
  .map((tz) => tz.zone);

// ─────────────────────────────
// 3. Build Valibot enum object
// ─────────────────────────────
const zoneEnum = Object.fromEntries(
  allZones.map((zone) => [zone, zone])
) satisfies Record<string, string>;

// ─────────────────────────────
// 4. Create schema and type
// ─────────────────────────────
export const TimeZoneSchema = z.enum(allZones as [string, ...string[]]);
export type TimeZone = z.infer<typeof TimeZoneSchema>;
