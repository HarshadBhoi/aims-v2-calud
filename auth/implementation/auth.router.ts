/**
 * Auth tRPC Router
 *
 * All authentication endpoints. Mostly publicProcedure (unauthenticated inputs)
 * with internal checks because auth endpoints need to handle both
 * unauthenticated and authenticated requests.
 *
 * Thin router; business logic in authService.
 */

import { TRPCError } from '@trpc/server';
import { router } from '@/api/trpc/middleware';
import {
  publicProcedure,
  authedProcedure,
  platformProcedure,
  authEndpointProcedure,
} from '@/api/trpc/procedures';
import {
  SignupInputSchema,
  LoginInputSchema,
  MfaVerifyInputSchema,
  RequestPasswordResetInputSchema,
  CompletePasswordResetInputSchema,
  ChangePasswordInputSchema,
  VerifyEmailInputSchema,
  ResendVerificationEmailInputSchema,
  RequestMagicLinkInputSchema,
  VerifyMagicLinkInputSchema,
  InviteUserInputSchema,
  BulkInviteUsersInputSchema,
  AcceptInvitationInputSchema,
  RevokeInvitationInputSchema,
  EnrollTotpStartInputSchema,
  EnrollTotpVerifyInputSchema,
  EnrollPasskeyStartInputSchema,
  EnrollPasskeyCompleteInputSchema,
  RegenerateBackupCodesInputSchema,
  RemoveMfaMethodInputSchema,
  RevokeSessionInputSchema,
  SwitchTenantInputSchema,
  ConfigureSsoSamlInputSchema,
  ConfigureSsoOidcInputSchema,
  VerifySsoDomainInputSchema,
  GenerateScimTokenInputSchema,
  StartImpersonationInputSchema,
  EndImpersonationInputSchema,
  StepUpAuthInputSchema,
  RequestAccountDeletionInputSchema,
  UpdateProfileInputSchema,
} from './schemas/auth.schemas';
import { z } from 'zod';
import { authService } from './services/auth.service';
import { sessionService } from './services/session.service';
import { mfaService } from './services/mfa.service';
import { ssoService } from './services/sso.service';
import { invitationService } from './services/invitation.service';
import { impersonationService } from './services/impersonation.service';

export const authRouter = router({
  // ===========================================================================
  // SIGNUP & PROVISIONING
  // ===========================================================================

  /**
   * Sign up new tenant + first admin user.
   * Rate limited per IP (3/hour).
   */
  signup: authEndpointProcedure
    .input(SignupInputSchema)
    .mutation(async ({ input, ctx }) => {
      return authService.signup({
        input,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        logger: ctx.logger,
      });
    }),

  // ===========================================================================
  // LOGIN
  // ===========================================================================

  /**
   * Email + password login.
   * Returns either a session or MFA challenge.
   */
  login: authEndpointProcedure
    .input(LoginInputSchema)
    .mutation(async ({ input, ctx }) => {
      return authService.login({
        input,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        logger: ctx.logger,
        res: ctx.res,  // For setting cookies
      });
    }),

  /**
   * Complete MFA challenge to finish login.
   */
  mfaVerify: authEndpointProcedure
    .input(MfaVerifyInputSchema)
    .mutation(async ({ input, ctx }) => {
      return mfaService.verifyChallenge({
        input,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        logger: ctx.logger,
        res: ctx.res,
      });
    }),

  /**
   * Logout current session.
   */
  logout: publicProcedure
    .mutation(async ({ ctx }) => {
      if (ctx.auth) {
        await sessionService.revoke({
          sessionId: ctx.auth.sessionId,
          reason: 'logout',
        });
      }
      if (ctx.res) {
        ctx.res.setHeader('Set-Cookie', [
          'aims_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
          'aims_refresh=; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=0',
        ]);
      }
      return { success: true };
    }),

  /**
   * Logout all other devices (except current).
   */
  logoutAll: authedProcedure
    .mutation(async ({ ctx }) => {
      await sessionService.revokeAllForUser({
        userId: ctx.auth.userId,
        tenantId: ctx.auth.tenantId,
        exceptSessionId: ctx.auth.sessionId,
        reason: 'logout_all',
      });
      return { success: true };
    }),

  // ===========================================================================
  // SESSION MANAGEMENT
  // ===========================================================================

  /**
   * Refresh access token using refresh token cookie.
   * Rotates tokens (detects reuse → security alert).
   */
  refresh: publicProcedure
    .mutation(async ({ ctx }) => {
      const refreshToken = ctx.req?.cookies?.aims_refresh;
      if (!refreshToken) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'No refresh token' });
      }
      return sessionService.refresh({
        refreshToken,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        logger: ctx.logger,
        res: ctx.res,
      });
    }),

  /**
   * List all active sessions for current user.
   */
  listSessions: authedProcedure
    .query(async ({ ctx }) => {
      return sessionService.listForUser({
        userId: ctx.auth.userId,
        currentSessionId: ctx.auth.sessionId,
      });
    }),

  /**
   * Revoke a specific session (not the current one).
   */
  revokeSession: authedProcedure
    .input(RevokeSessionInputSchema)
    .mutation(async ({ input, ctx }) => {
      if (input.sessionId === ctx.auth.sessionId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot revoke current session via this endpoint; use logout instead',
        });
      }
      return sessionService.revoke({
        sessionId: input.sessionId,
        reason: 'user_revoked',
        actorUserId: ctx.auth.userId,
      });
    }),

  // ===========================================================================
  // EMAIL VERIFICATION
  // ===========================================================================

  verifyEmail: publicProcedure
    .input(VerifyEmailInputSchema)
    .mutation(async ({ input, ctx }) => {
      return authService.verifyEmail({
        token: input.token,
        ipAddress: ctx.ipAddress,
        logger: ctx.logger,
      });
    }),

  resendVerificationEmail: authEndpointProcedure
    .input(ResendVerificationEmailInputSchema)
    .mutation(async ({ input, ctx }) => {
      const email = input.email ?? ctx.auth?.userId;  // Authenticated users can resend for self
      if (!email) {
        throw new TRPCError({ code: 'BAD_REQUEST' });
      }
      return authService.resendVerificationEmail({ email, logger: ctx.logger });
    }),

  // ===========================================================================
  // PASSWORD RESET
  // ===========================================================================

  requestPasswordReset: authEndpointProcedure
    .input(RequestPasswordResetInputSchema)
    .mutation(async ({ input, ctx }) => {
      // Always return success (even if email not found) to prevent enumeration
      await authService.requestPasswordReset({
        email: input.email,
        captchaToken: input.captchaToken,
        ipAddress: ctx.ipAddress,
        logger: ctx.logger,
      });
      return { success: true };
    }),

  completePasswordReset: authEndpointProcedure
    .input(CompletePasswordResetInputSchema)
    .mutation(async ({ input, ctx }) => {
      return authService.completePasswordReset({
        token: input.token,
        newPassword: input.newPassword,
        ipAddress: ctx.ipAddress,
        logger: ctx.logger,
      });
    }),

  changePassword: authedProcedure
    .input(ChangePasswordInputSchema)
    .mutation(async ({ input, ctx }) => {
      return authService.changePassword({
        userId: ctx.auth.userId,
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
        sessionId: ctx.auth.sessionId,  // Preserve current session
        ipAddress: ctx.ipAddress,
        logger: ctx.logger,
      });
    }),

  // ===========================================================================
  // MAGIC LINK
  // ===========================================================================

  requestMagicLink: authEndpointProcedure
    .input(RequestMagicLinkInputSchema)
    .mutation(async ({ input, ctx }) => {
      await authService.requestMagicLink({
        input,
        ipAddress: ctx.ipAddress,
        logger: ctx.logger,
      });
      return { success: true };  // Silent success for enum prevention
    }),

  verifyMagicLink: publicProcedure
    .input(VerifyMagicLinkInputSchema)
    .mutation(async ({ input, ctx }) => {
      return authService.verifyMagicLink({
        token: input.token,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        logger: ctx.logger,
        res: ctx.res,
      });
    }),

  // ===========================================================================
  // MFA ENROLLMENT
  // ===========================================================================

  enrollTotpStart: authedProcedure
    .input(EnrollTotpStartInputSchema)
    .mutation(async ({ ctx }) => {
      return mfaService.startTotpEnrollment({
        userId: ctx.auth.userId,
        userEmail: ctx.auth.userId,  // Service loads full email
      });
    }),

  enrollTotpVerify: authedProcedure
    .input(EnrollTotpVerifyInputSchema)
    .mutation(async ({ input, ctx }) => {
      return mfaService.verifyTotpEnrollment({
        userId: ctx.auth.userId,
        mfaCredentialId: input.mfaCredentialId,
        code: input.code,
        logger: ctx.logger,
      });
    }),

  enrollPasskeyStart: authedProcedure
    .input(EnrollPasskeyStartInputSchema)
    .mutation(async ({ ctx }) => {
      return mfaService.startPasskeyEnrollment({
        userId: ctx.auth.userId,
      });
    }),

  enrollPasskeyComplete: authedProcedure
    .input(EnrollPasskeyCompleteInputSchema)
    .mutation(async ({ input, ctx }) => {
      return mfaService.completePasskeyEnrollment({
        userId: ctx.auth.userId,
        credential: input.credential,
        nickname: input.nickname,
        logger: ctx.logger,
      });
    }),

  regenerateBackupCodes: authedProcedure
    .input(RegenerateBackupCodesInputSchema)
    .mutation(async ({ ctx }) => {
      // Requires recent MFA (step-up)
      await sessionService.requireRecentMfa(ctx.auth.sessionId, 300);
      return mfaService.regenerateBackupCodes({
        userId: ctx.auth.userId,
        logger: ctx.logger,
      });
    }),

  removeMfaMethod: authedProcedure
    .input(RemoveMfaMethodInputSchema)
    .mutation(async ({ input, ctx }) => {
      // Requires recent MFA (step-up)
      await sessionService.requireRecentMfa(ctx.auth.sessionId, 300);
      return mfaService.removeCredential({
        userId: ctx.auth.userId,
        mfaCredentialId: input.mfaCredentialId,
        reason: input.reason,
        logger: ctx.logger,
      });
    }),

  listMfaMethods: authedProcedure
    .query(async ({ ctx }) => {
      return mfaService.listForUser({ userId: ctx.auth.userId });
    }),

  // ===========================================================================
  // STEP-UP AUTH
  // ===========================================================================

  /**
   * Re-verify identity for sensitive actions.
   * Updates session.mfaVerifiedAt to now.
   */
  stepUp: authedProcedure
    .input(StepUpAuthInputSchema)
    .mutation(async ({ input, ctx }) => {
      return authService.stepUp({
        userId: ctx.auth.userId,
        sessionId: ctx.auth.sessionId,
        input,
        logger: ctx.logger,
      });
    }),

  // ===========================================================================
  // TENANT SWITCHING
  // ===========================================================================

  /**
   * List tenants current user belongs to.
   */
  listMyTenants: authedProcedure
    .query(async ({ ctx }) => {
      return authService.listUserTenants({ userId: ctx.auth.userId, currentTenantId: ctx.auth.tenantId });
    }),

  /**
   * Switch to a different tenant (creates new session).
   */
  switchTenant: authedProcedure
    .input(SwitchTenantInputSchema)
    .mutation(async ({ input, ctx }) => {
      return authService.switchTenant({
        userId: ctx.auth.userId,
        currentSessionId: ctx.auth.sessionId,
        targetTenantId: input.tenantId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        logger: ctx.logger,
        res: ctx.res,
      });
    }),

  // ===========================================================================
  // USER INVITATIONS (tenant admin)
  // ===========================================================================

  inviteUser: authedProcedure
    .input(InviteUserInputSchema)
    .mutation(async ({ input, ctx }) => {
      // Permission check: user:invite
      if (!ctx.auth.permissions.has('user:invite')) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      return invitationService.invite({
        tenantId: ctx.auth.tenantId,
        invitedByUserId: ctx.auth.userId,
        input,
        logger: ctx.logger,
      });
    }),

  bulkInviteUsers: authedProcedure
    .input(BulkInviteUsersInputSchema)
    .mutation(async ({ input, ctx }) => {
      if (!ctx.auth.permissions.has('user:invite')) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      return invitationService.bulkInvite({
        tenantId: ctx.auth.tenantId,
        invitedByUserId: ctx.auth.userId,
        invitations: input.invitations,
        logger: ctx.logger,
      });
    }),

  acceptInvitation: publicProcedure
    .input(AcceptInvitationInputSchema)
    .mutation(async ({ input, ctx }) => {
      return invitationService.accept({
        token: input.token,
        name: input.name,
        password: input.password,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        logger: ctx.logger,
        res: ctx.res,
      });
    }),

  revokeInvitation: authedProcedure
    .input(RevokeInvitationInputSchema)
    .mutation(async ({ input, ctx }) => {
      if (!ctx.auth.permissions.has('user:invite')) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      return invitationService.revoke({
        tenantId: ctx.auth.tenantId,
        invitationId: input.invitationId,
        revokedByUserId: ctx.auth.userId,
        reason: input.reason,
      });
    }),

  listInvitations: authedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.auth.permissions.has('user:view_all')) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      return invitationService.listForTenant({ tenantId: ctx.auth.tenantId });
    }),

  // ===========================================================================
  // SSO CONFIGURATION (tenant admin)
  // ===========================================================================

  configureSsoSaml: authedProcedure
    .input(ConfigureSsoSamlInputSchema)
    .mutation(async ({ input, ctx }) => {
      if (!ctx.auth.permissions.has('sso:configure')) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      return ssoService.configureSaml({
        tenantId: ctx.auth.tenantId,
        actorUserId: ctx.auth.userId,
        input,
        logger: ctx.logger,
      });
    }),

  configureSsoOidc: authedProcedure
    .input(ConfigureSsoOidcInputSchema)
    .mutation(async ({ input, ctx }) => {
      if (!ctx.auth.permissions.has('sso:configure')) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      return ssoService.configureOidc({
        tenantId: ctx.auth.tenantId,
        actorUserId: ctx.auth.userId,
        input,
        logger: ctx.logger,
      });
    }),

  verifySsoDomain: authedProcedure
    .input(VerifySsoDomainInputSchema)
    .mutation(async ({ input, ctx }) => {
      if (!ctx.auth.permissions.has('sso:configure')) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      return ssoService.verifyDomain({
        tenantId: ctx.auth.tenantId,
        domain: input.domain,
        logger: ctx.logger,
      });
    }),

  generateScimToken: authedProcedure
    .input(GenerateScimTokenInputSchema)
    .mutation(async ({ input, ctx }) => {
      if (!ctx.auth.permissions.has('sso:configure')) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      // Requires recent MFA
      await sessionService.requireRecentMfa(ctx.auth.sessionId, 300);
      return ssoService.generateScimToken({
        tenantId: ctx.auth.tenantId,
        ssoConfigurationId: input.ssoConfigurationId,
        actorUserId: ctx.auth.userId,
      });
    }),

  getSsoConfiguration: authedProcedure
    .query(async ({ ctx }) => {
      return ssoService.getConfiguration({ tenantId: ctx.auth.tenantId });
    }),

  // ===========================================================================
  // USER PROFILE
  // ===========================================================================

  getProfile: authedProcedure
    .query(async ({ ctx }) => {
      return authService.getProfile({ userId: ctx.auth.userId });
    }),

  updateProfile: authedProcedure
    .input(UpdateProfileInputSchema)
    .mutation(async ({ input, ctx }) => {
      return authService.updateProfile({
        userId: ctx.auth.userId,
        updates: input,
      });
    }),

  // ===========================================================================
  // GDPR DATA RIGHTS
  // ===========================================================================

  requestDataExport: authedProcedure
    .mutation(async ({ ctx }) => {
      // Requires recent MFA (prevents casual data export)
      await sessionService.requireRecentMfa(ctx.auth.sessionId, 300);
      return authService.requestDataExport({
        userId: ctx.auth.userId,
        logger: ctx.logger,
      });
    }),

  requestAccountDeletion: authedProcedure
    .input(RequestAccountDeletionInputSchema)
    .mutation(async ({ input, ctx }) => {
      // Requires recent MFA + email match (defense against casual deletion)
      await sessionService.requireRecentMfa(ctx.auth.sessionId, 300);
      return authService.requestAccountDeletion({
        userId: ctx.auth.userId,
        reason: input.reason,
        confirmEmail: input.confirmEmail,
        logger: ctx.logger,
      });
    }),

  // ===========================================================================
  // IMPERSONATION (SUPERADMIN ONLY)
  // ===========================================================================

  startImpersonation: platformProcedure
    .input(StartImpersonationInputSchema)
    .mutation(async ({ input, ctx }) => {
      // Requires recent MFA + platform role
      if (!ctx.auth!.isSuperadmin) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      await sessionService.requireRecentMfa(ctx.auth!.sessionId, 300);
      return impersonationService.start({
        impersonatorUserId: ctx.auth!.userId,
        input,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        logger: ctx.logger,
        res: ctx.res,
      });
    }),

  endImpersonation: authedProcedure
    .input(EndImpersonationInputSchema)
    .mutation(async ({ ctx }) => {
      if (!ctx.auth.impersonating) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Not currently impersonating',
        });
      }
      return impersonationService.end({
        sessionId: ctx.auth.sessionId,
        impersonatorUserId: ctx.auth.impersonating.originalUserId,
        logger: ctx.logger,
        res: ctx.res,
      });
    }),

  // ===========================================================================
  // AUTH EVENTS (user's login history)
  // ===========================================================================

  listMyAuthEvents: authedProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(100).default(50),
      cursor: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      return authService.listAuthEvents({
        userId: ctx.auth.userId,
        tenantId: ctx.auth.tenantId,
        limit: input.limit,
        cursor: input.cursor,
      });
    }),
});
