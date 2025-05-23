import { NotFoundError } from '../../api/errors';
import { standardize } from '../../api/modules/players/player.utils';
import { assertPlayerType } from '../../api/modules/players/services/AssertPlayerTypeService';
import prisma from '../../prisma';
import type { JobManager } from '../job.manager';
import { Job } from '../job.utils';

type CheckPlayerTypeJobPayload = {
  username: string;
};

export class CheckPlayerTypeJob extends Job<CheckPlayerTypeJobPayload> {
  constructor(jobManager: JobManager) {
    super(jobManager);

    this.options = {
      attempts: 3,
      backoff: 30_000,
      rateLimiter: { max: 1, duration: 5000 }
    };
  }

  async execute(payload: CheckPlayerTypeJobPayload): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    const player = await prisma.player.findFirst({
      where: { username: standardize(payload.username) }
    });

    if (!player) {
      throw new NotFoundError('Player not found.');
    }

    await assertPlayerType(player, true);
  }
}
