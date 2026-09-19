import { prisma } from "@/lib/database/client";
import type { NormalizedTeam } from "@/types/football";
import type { ProviderId } from "@/lib/config";

/**
 * Explicit branches, not a dynamic `where` key, so Prisma's generated
 * WhereUniqueInput types stay fully checked — no casts needed.
 */
export async function upsertTeamByProvider(providerId: ProviderId, team: NormalizedTeam) {
  const fields = { name: team.name, shortName: team.shortName, logo: team.logo };

  if (providerId === "football-data-org") {
    return prisma.team.upsert({
      where: { footballDataOrgId: team.externalId },
      update: fields,
      create: { footballDataOrgId: team.externalId, ...fields },
    });
  }
  if (providerId === "api-football") {
    return prisma.team.upsert({
      where: { apiFootballId: team.externalId },
      update: fields,
      create: { apiFootballId: team.externalId, ...fields },
    });
  }
  throw new Error(`upsertTeamByProvider: "${providerId}" is test-only and doesn't write real Team rows`);
}
