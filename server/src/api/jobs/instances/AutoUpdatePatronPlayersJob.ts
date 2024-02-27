import prisma from '../../../prisma';
import { Period, PeriodProps } from '../../../utils';
import { JobType, JobDefinition, JobPriority } from '../job.types';
import { jobManager } from '..';

class AutoUpdatePatronPlayersJob implements JobDefinition<unknown> {
  type: JobType;

  constructor() {
    this.type = JobType.AUTO_UPDATE_PATRON_PLAYERS;
  }

  async execute() {
    if (process.env.NODE_ENV === 'development') {
      return;
    }

    const dayAgo = new Date(Date.now() - PeriodProps[Period.DAY].milliseconds);

    const outdatedPatronPlayers = await prisma.patron
      .findMany({
        where: {
          playerId: { not: null },
          player: {
            OR: [{ updatedAt: { lt: dayAgo } }, { updatedAt: null }]
          }
        },
        include: {
          player: true
        }
      })
      .then(res => res.map(p => p.player).filter(Boolean));

    // Execute the update action for every member
    outdatedPatronPlayers.forEach(({ username }) => {
      jobManager.add(
        {
          type: JobType.UPDATE_PLAYER,
          payload: { username }
        },
        {
          priority: JobPriority.HIGH
        }
      );
    });
  }
}

export default new AutoUpdatePatronPlayersJob();
