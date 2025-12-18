import { SyncManager, MembershipRepository } from '../../../lib/auth/sync-manager';

type MockRepoParams = {
  listUserTeams: string[];
  added: string[];
  removed: string[];
};

class MockRepo implements MembershipRepository {
  private state: MockRepoParams;
  constructor(initial: string[] = []) {
    this.state = { listUserTeams: initial, added: [], removed: [] } as any;
  }
  async listUserTeams(userId: string): Promise<string[]> {
    // Return the stored state; ignore userId for simplicity in tests
    return [...this.state.listUserTeams];
  }
  async addMembership(userId: string, teamId: string): Promise<void> {
    this.state.added.push(teamId);
    // Update internal state to reflect addition for idempotency tests
    if (!this.state.listUserTeams.includes(teamId)) {
      this.state.listUserTeams = [...this.state.listUserTeams, teamId];
    }
  }
  async removeMembership(userId: string, teamId: string): Promise<void> {
    this.state.removed.push(teamId);
    this.state.listUserTeams = this.state.listUserTeams.filter((t) => t !== teamId);
  }
}

describe('SyncManager', () => {
  it('performs a basic sync adding new memberships', async () => {
    const repo = new MockRepo(['team1']);
    const manager = new SyncManager(repo);
    const result = await manager.syncUserToTeams({ userId: 'u1', desiredTeams: ['team1', 'team2'] });
    expect(result.added).toEqual(['team2']);
    expect(result.removed).toEqual([]);
  });
});

describe('SyncManager - additional scenarios', () => {
  it('creates new membership when none exist', async () => {
    const repo = new MockRepo([]);
    const manager = new SyncManager(repo);
    const result = await manager.syncUserToTeams({ userId: 'u2', desiredTeams: ['teamA'] });
    expect(result.added).toEqual(['teamA']);
    expect(result.removed).toEqual([]);
  });

  it('updates and removes memberships to match desired state', async () => {
    const repo = new MockRepo(['teamA', 'teamB']);
    const manager = new SyncManager(repo);
    const result = await manager.syncUserToTeams({ userId: 'u3', desiredTeams: ['teamA', 'teamC'] });
    expect(result.added).toEqual(['teamC']);
    expect(result.removed).toEqual(['teamB']);
  });

  it('is idempotent when desired state matches current', async () => {
    const repo = new MockRepo(['team1', 'team2']);
    const manager = new SyncManager(repo);
    const result = await manager.syncUserToTeams({ userId: 'u4', desiredTeams: ['team1', 'team2'] });
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
  });

  it('handles sync failures gracefully', async () => {
    class FailingRepo extends MockRepo {
      async addMembership(userId: string, teamId: string): Promise<void> {
        // Simulate a failure on adding a membership
        throw new Error('Sync failure');
      }
    }
    const repo = new FailingRepo(['team1']);
    const manager = new SyncManager(repo);
    await expect(
      manager.syncUserToTeams({ userId: 'u5', desiredTeams: ['team1', 'teamX'] })
    ).rejects.toThrow('Sync failure');
  });
});
