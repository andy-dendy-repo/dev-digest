import type { FindingActionKind, FindingRecord } from '@devdigest/shared';
import { AppError, NotFoundError } from '../../platform/errors.js';
import type { ReviewsPort } from './ports.js';

/**
 * Finding actions available in the starter: accept / dismiss. These decisions
 * are the dataset later milestones build on (eval cases from accept/dismiss, the
 * `learn → memory` action, etc.).
 */
export async function actOnFinding(
  reviews: Pick<ReviewsPort, 'findingWorkspace' | 'setFindingAccepted' | 'setFindingDismissed'>,
  workspaceId: string,
  findingId: string,
  action: FindingActionKind,
): Promise<{ finding: FindingRecord }> {
  const owner = await reviews.findingWorkspace(findingId);
  if (owner !== workspaceId) {
    throw new NotFoundError('Finding not found');
  }

  let finding: FindingRecord | undefined;
  switch (action) {
    case 'accept':
      finding = await reviews.setFindingAccepted(findingId, new Date());
      break;
    case 'dismiss':
      finding = await reviews.setFindingDismissed(findingId, new Date());
      break;
    default:
      throw new AppError('invalid_action', `Action '${action}' is not available in the starter`, 400);
  }
  // Deleted between the ownership check and the update (e.g. its review was removed).
  if (!finding) throw new NotFoundError('Finding not found');
  return { finding };
}
