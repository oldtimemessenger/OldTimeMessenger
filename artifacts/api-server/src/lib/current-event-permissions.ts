export type StageRole = 'host' | 'moderator' | 'speaker' | 'listener';

export function canManageStageTarget(actorRole: StageRole, targetRole: StageRole): boolean {
  if (actorRole !== 'host' && actorRole !== 'moderator') return false;
  if (targetRole === 'host') return false;
  if (actorRole === 'moderator' && targetRole === 'moderator') return false;
  return true;
}