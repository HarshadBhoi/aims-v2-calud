/**
 * @aims/validation
 *
 * Shared Zod schemas. Consumed by apps/web, apps/api, and apps/worker so that
 * the wire contract is a single source of truth.
 *
 * SLICE A TASK: Schemas accrue task-by-task:
 *   - Task 2.5: Engagement schemas (create/get/list input-output pairs)
 *   - Task 2.6: Pack schemas (attach, resolve)
 *   - Task 3.2: Finding schemas (create, updateElement, submitForReview, approve)
 *   - Task 4.1: Report schemas
 *
 * See VERTICAL-SLICE-PLAN.md §3.2 for the API procedure surface.
 */

export const PLACEHOLDER = true as const;
