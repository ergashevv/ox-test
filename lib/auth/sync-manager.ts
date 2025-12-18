export interface MembershipRepository {
  listUserTeams(userId: string): Promise<string[]>;
  addMembership(userId: string, teamId: string): Promise<void>;
  removeMembership(userId: string, teamId: string): Promise<void>;
}

export interface SyncSession {
  userId: string;
  desiredTeams: string[];
}

/**
 * SyncManager handles syncing a user's team memberships to the desired state.
 * - Idempotent: rerunning with the same desiredTeams yields no extra changes.
 * - Operation order: additions first, removals second to minimize churn.
 */
export class SyncManager {
  private repo: MembershipRepository;

  constructor(repo: MembershipRepository) {
    this.repo = repo;
  }

  async syncUserToTeams(session: SyncSession): Promise<{ added: string[]; removed: string[] }> {
    const current = await this.repo.listUserTeams(session.userId);
    const desired = session.desiredTeams ?? [];

    const toAdd = desired.filter((t) => !current.includes(t));
    const toRemove = current.filter((t) => !desired.includes(t));

    // Apply additions
    for (const teamId of toAdd) {
      await this.repo.addMembership(session.userId, teamId);
    }

    // Apply removals
    for (const teamId of toRemove) {
      await this.repo.removeMembership(session.userId, teamId);
    }

    return { added: toAdd, removed: toRemove };
  }
}
