/**
 * Zod schemas for all auth endpoints.
 * Shared between client and server for type-safe validation.
 */

import { z } from 'zod';

// =============================================================================
// PRIMITIVES
// =============================================================================

export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(255);

export const PasswordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must be at most 128 characters');

/** Tenant slug: URL-safe, lowercase. */
export const TenantSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(50)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Must start and end with alphanumeric; only lowercase letters, digits, dashes');

/** ULID for idempotency + ID tokens. */
export const UlidSchema = z
  .string()
  .regex(/^[0-9A-HJKMNP-TV-Z]{26}$/i);

/** CUID2 for identifiers. */
export const CuidSchema = z
  .string()
  .regex(/^[a-z0-9]{24}$/);

/** 6-digit TOTP code. */
export const TotpCodeSchema = z
  .string()
  .regex(/^\d{6}$/);

/** 16-character backup code (format xxxx-xxxx-xxxx-xxxx or no dashes). */
export const BackupCodeSchema = z
  .string()
  .regex(/^[a-z0-9]{4}(-[a-z0-9]{4}){3}$|^[a-z0-9]{16}$/i)
  .transform(s => s.replace(/-/g, '').toLowerCase());

// =============================================================================
// DATA REGIONS (matches Prisma enum)
// =============================================================================

export const DataRegionEnum = z.enum([
  'US_EAST',
  'US_WEST',
  'EU_CENTRAL',
  'EU_WEST',
  'UK',
  'ASIA_PACIFIC',
  'INDIA',
  'CANADA',
  'AUSTRALIA',
  'ON_PREMISES',
]);

// =============================================================================
// SIGNUP
// =============================================================================

export const SignupInputSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  name: z.string().trim().min(1).max(200),
  organizationName: z.string().trim().min(1).max(200),
  tenantSlug: TenantSlugSchema.optional(),  // If omitted, derived from organizationName
  dataRegion: DataRegionEnum,
  acceptedTermsAt: z.string().datetime(),   // Must be sent to prove T&C accepted
  acceptedPrivacyAt: z.string().datetime(),
  captchaToken: z.string().min(1),
});
export type SignupInput = z.infer<typeof SignupInputSchema>;

// =============================================================================
// LOGIN
// =============================================================================

export const LoginInputSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  tenantSlug: TenantSlugSchema.optional(),  // Required for multi-tenant users
  rememberMe: z.boolean().default(false),
  captchaToken: z.string().optional(),      // Required after N failed attempts
  deviceFingerprint: z.string().max(500).optional(),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const LoginResponseSchema = z.discriminatedUnion('mfaRequired', [
  z.object({
    mfaRequired: z.literal(false),
    user: z.object({
      id: CuidSchema,
      email: EmailSchema,
      name: z.string(),
      displayName: z.string().nullable(),
      avatarUrl: z.string().nullable(),
    }),
    tenant: z.object({
      id: CuidSchema,
      slug: TenantSlugSchema,
      name: z.string(),
      logoUrl: z.string().nullable(),
    }),
    session: z.object({
      id: CuidSchema,
      expiresAt: z.string().datetime(),
    }),
  }),
  z.object({
    mfaRequired: z.literal(true),
    mfaToken: z.string(),
    mfaTokenExpiresAt: z.string().datetime(),
    mfaMethods: z.array(
      z.object({
        id: CuidSchema,
        type: z.enum(['TOTP', 'WEBAUTHN', 'BACKUP_CODES']),
        nickname: z.string().nullable(),
      }),
    ),
  }),
]);

// =============================================================================
// MFA VERIFY
// =============================================================================

export const MfaVerifyInputSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('TOTP'),
    mfaToken: z.string(),
    credentialId: CuidSchema,
    code: TotpCodeSchema,
  }),
  z.object({
    method: z.literal('WEBAUTHN'),
    mfaToken: z.string(),
    assertion: z.object({
      id: z.string(),
      rawId: z.string(),
      type: z.literal('public-key'),
      response: z.object({
        clientDataJSON: z.string(),
        authenticatorData: z.string(),
        signature: z.string(),
        userHandle: z.string().optional(),
      }),
      clientExtensionResults: z.record(z.string(), z.unknown()).optional(),
    }),
  }),
  z.object({
    method: z.literal('BACKUP_CODE'),
    mfaToken: z.string(),
    code: BackupCodeSchema,
  }),
]);
export type MfaVerifyInput = z.infer<typeof MfaVerifyInputSchema>;

// =============================================================================
// PASSWORD RESET
// =============================================================================

export const RequestPasswordResetInputSchema = z.object({
  email: EmailSchema,
  captchaToken: z.string().min(1),
});

export const CompletePasswordResetInputSchema = z.object({
  token: z.string().min(1).max(500),
  newPassword: PasswordSchema,
});

// =============================================================================
// PASSWORD CHANGE (logged in)
// =============================================================================

export const ChangePasswordInputSchema = z.object({
  currentPassword: z.string().min(1),  // Just require non-empty (server validates)
  newPassword: PasswordSchema,
}).refine(
  (data) => data.currentPassword !== data.newPassword,
  { message: 'New password must be different from current password' },
);

// =============================================================================
// EMAIL VERIFICATION
// =============================================================================

export const VerifyEmailInputSchema = z.object({
  token: z.string().min(1).max(500),
});

export const ResendVerificationEmailInputSchema = z.object({
  email: EmailSchema.optional(),  // Can resend for self (uses auth) or for specific email
});

// =============================================================================
// MAGIC LINK
// =============================================================================

export const RequestMagicLinkInputSchema = z.object({
  email: EmailSchema,
  tenantSlug: TenantSlugSchema.optional(),
  redirectTo: z.string().max(500).optional(),
  captchaToken: z.string().min(1),
});

export const VerifyMagicLinkInputSchema = z.object({
  token: z.string().min(1).max(500),
});

// =============================================================================
// INVITATION
// =============================================================================

export const InviteUserInputSchema = z.object({
  email: EmailSchema,
  role: z.string().min(1).max(100),
  permissions: z.array(z.string()).optional(),
  message: z.string().max(2000).optional(),
});

export const BulkInviteUsersInputSchema = z.object({
  invitations: z.array(InviteUserInputSchema).min(1).max(200),
});

export const AcceptInvitationInputSchema = z.object({
  token: z.string().min(1).max(500),
  // New user fields (if account doesn't exist):
  name: z.string().trim().min(1).max(200).optional(),
  password: PasswordSchema.optional(),
});

export const RevokeInvitationInputSchema = z.object({
  invitationId: CuidSchema,
  reason: z.string().max(500).optional(),
});

// =============================================================================
// MFA ENROLLMENT
// =============================================================================

export const EnrollTotpStartInputSchema = z.object({}).strict();

export const EnrollTotpStartResponseSchema = z.object({
  mfaCredentialId: CuidSchema,
  secret: z.string(),          // Base32 encoded
  qrCodeDataUri: z.string(),   // data: URI for client to display
  otpauthUri: z.string(),      // otpauth:// URI
});

export const EnrollTotpVerifyInputSchema = z.object({
  mfaCredentialId: CuidSchema,
  code: TotpCodeSchema,
});

export const EnrollTotpVerifyResponseSchema = z.object({
  success: z.literal(true),
  backupCodes: z.array(z.string()),  // One-time display; user MUST save
});

export const EnrollPasskeyStartInputSchema = z.object({}).strict();

export const EnrollPasskeyStartResponseSchema = z.object({
  options: z.object({
    challenge: z.string(),
    rp: z.object({ id: z.string(), name: z.string() }),
    user: z.object({
      id: z.string(),
      name: z.string(),
      displayName: z.string(),
    }),
    pubKeyCredParams: z.array(
      z.object({
        type: z.literal('public-key'),
        alg: z.number(),
      }),
    ),
    authenticatorSelection: z.object({
      userVerification: z.string(),
      residentKey: z.string(),
      authenticatorAttachment: z.string().optional(),
    }),
    timeout: z.number(),
    attestation: z.string(),
    excludeCredentials: z.array(
      z.object({
        type: z.literal('public-key'),
        id: z.string(),
      }),
    ),
  }),
});

export const EnrollPasskeyCompleteInputSchema = z.object({
  credential: z.object({
    id: z.string(),
    rawId: z.string(),
    type: z.literal('public-key'),
    response: z.object({
      clientDataJSON: z.string(),
      attestationObject: z.string(),
      transports: z.array(z.string()).optional(),
    }),
    clientExtensionResults: z.record(z.string(), z.unknown()).optional(),
  }),
  nickname: z.string().trim().min(1).max(100),
});

export const RegenerateBackupCodesInputSchema = z.object({}).strict();

export const RegenerateBackupCodesResponseSchema = z.object({
  backupCodes: z.array(z.string()),
});

export const RemoveMfaMethodInputSchema = z.object({
  mfaCredentialId: CuidSchema,
  reason: z.string().max(500).optional(),
});

// =============================================================================
// SESSION
// =============================================================================

export const RefreshSessionResponseSchema = z.object({
  accessTokenExpiresAt: z.string().datetime(),
  refreshTokenExpiresAt: z.string().datetime(),
});

export const ListSessionsResponseSchema = z.array(
  z.object({
    id: CuidSchema,
    isCurrent: z.boolean(),
    createdAt: z.string().datetime(),
    lastUsedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    ipAddress: z.string().nullable(),
    userAgent: z.string().nullable(),
    location: z
      .object({
        city: z.string().optional(),
        country: z.string().optional(),
      })
      .nullable(),
    mfaVerifiedAt: z.string().datetime().nullable(),
    mfaMethod: z.string().nullable(),
    tenantId: CuidSchema,
  }),
);

export const RevokeSessionInputSchema = z.object({
  sessionId: CuidSchema,
});

// =============================================================================
// TENANT SWITCH
// =============================================================================

export const SwitchTenantInputSchema = z.object({
  tenantId: CuidSchema,
});

export const ListMyTenantsResponseSchema = z.array(
  z.object({
    id: CuidSchema,
    slug: TenantSlugSchema,
    name: z.string(),
    logoUrl: z.string().nullable(),
    primaryColor: z.string().nullable(),
    role: z.string(),
    isActive: z.boolean(),
    isCurrent: z.boolean(),
    lastAccessedAt: z.string().datetime().nullable(),
  }),
);

// =============================================================================
// SSO
// =============================================================================

export const ConfigureSsoSamlInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  emailDomains: z.array(z.string().trim().min(1)).min(1).max(10),
  enabled: z.boolean().default(false),
  jitProvisioning: z.boolean().default(true),
  defaultRole: z.string().optional(),
  enforceMfaViaSso: z.boolean().default(false),
  autoLockLocalAuth: z.boolean().default(false),
  // SAML fields
  samlMetadataUrl: z.string().url().optional(),
  samlMetadataXml: z.string().max(100_000).optional(),
  samlEntityId: z.string().optional(),
  samlSsoUrl: z.string().url().optional(),
  samlX509Cert: z.string().optional(),
  samlSignRequests: z.boolean().default(true),
  attributeMapping: z.record(z.string(), z.string()).default({}),
  groupToRoleMap: z.record(z.string(), z.string()).optional(),
}).refine(
  (data) => data.samlMetadataUrl || data.samlMetadataXml || (data.samlSsoUrl && data.samlX509Cert),
  { message: 'Must provide metadata URL, metadata XML, or (SSO URL + cert)' },
);

export const ConfigureSsoOidcInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  emailDomains: z.array(z.string().trim().min(1)).min(1).max(10),
  enabled: z.boolean().default(false),
  jitProvisioning: z.boolean().default(true),
  defaultRole: z.string().optional(),
  enforceMfaViaSso: z.boolean().default(false),
  autoLockLocalAuth: z.boolean().default(false),
  // OIDC fields
  oidcIssuer: z.string().url(),
  oidcClientId: z.string().min(1),
  oidcClientSecret: z.string().min(1),  // Will be encrypted before storage
  oidcScopes: z.array(z.string()).default(['openid', 'email', 'profile']),
  attributeMapping: z.record(z.string(), z.string()).default({}),
  groupToRoleMap: z.record(z.string(), z.string()).optional(),
});

export const VerifySsoDomainInputSchema = z.object({
  domain: z.string().trim().min(1),
});

export const GenerateScimTokenInputSchema = z.object({
  ssoConfigurationId: CuidSchema,
});

// =============================================================================
// IMPERSONATION (SUPERADMIN ONLY)
// =============================================================================

export const StartImpersonationInputSchema = z.object({
  tenantId: CuidSchema,
  userId: CuidSchema,
  ticketRef: z.string().trim().min(1).max(100),  // Support ticket reference
  justification: z.string().trim().min(10).max(2000),
  durationMinutes: z.number().int().min(5).max(60).default(15),
});

export const EndImpersonationInputSchema = z.object({}).strict();

// =============================================================================
// STEP-UP AUTH
// =============================================================================

export const StepUpAuthInputSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('PASSWORD'),
    password: z.string().min(1),
  }),
  z.object({
    method: z.literal('TOTP'),
    credentialId: CuidSchema,
    code: TotpCodeSchema,
  }),
  z.object({
    method: z.literal('WEBAUTHN'),
    credentialId: z.string(),
    assertion: z.record(z.string(), z.unknown()),
  }),
]);

// =============================================================================
// ACCOUNT DELETION (GDPR)
// =============================================================================

export const RequestAccountDeletionInputSchema = z.object({
  reason: z.string().max(2000).optional(),
  confirmEmail: EmailSchema,
});

// =============================================================================
// USER PROFILE
// =============================================================================

export const UpdateProfileInputSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  displayName: z.string().trim().max(200).optional(),
  title: z.string().trim().max(200).optional(),
  department: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(50).optional(),
  avatarUrl: z.string().url().max(1000).optional(),
  locale: z.string().max(10).optional(),
  timezone: z.string().max(100).optional(),
  preferences: z.record(z.string(), z.unknown()).optional(),
});
