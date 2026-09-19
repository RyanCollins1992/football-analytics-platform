import type { FetchFixturesParams, FootballDataProvider } from "@/lib/api/provider";
import type { NormalizedFixture, NormalizedStandings, NormalizedTeam } from "@/types/football";

const ARSENAL: NormalizedTeam = { externalId: "mock-57", name: "Arsenal FC", shortName: "Arsenal" };
const MAN_CITY: NormalizedTeam = { externalId: "mock-65", name: "Manchester City FC", shortName: "Man City" };

/**
 * No network calls — static, realistic-shaped data for tests and any code
 * that needs a FootballDataProvider without hitting a live API or spending
 * quota. Matches the same interface as every real adapter.
 */
export class MockProvider implements FootballDataProvider {
  readonly id = "mock" as const;

  async getStandings(competitionSlug: string): Promise<NormalizedStandings> {
    return {
      competitionSlug,
      matchday: 5,
      rows: [
        {
          team: ARSENAL,
          position: 1,
          played: 5,
          wins: 4,
          draws: 1,
          losses: 0,
          goalsFor: 10,
          goalsAgainst: 2,
          goalDifference: 8,
          points: 13,
        },
        {
          team: MAN_CITY,
          position: 2,
          played: 5,
          wins: 4,
          draws: 0,
          losses: 1,
          goalsFor: 9,
          goalsAgainst: 3,
          goalDifference: 6,
          points: 12,
        },
      ],
    };
  }

  async getFixtures(params: FetchFixturesParams): Promise<NormalizedFixture[]> {
    return [
      {
        externalId: "mock-1",
        competitionSlug: params.competitionSlug,
        matchday: 6,
        scheduledAt: new Date("2026-09-26T14:00:00Z"),
        status: "SCHEDULED",
        homeTeam: ARSENAL,
        awayTeam: MAN_CITY,
        homeScore: null,
        awayScore: null,
        halfTimeHomeScore: null,
        halfTimeAwayScore: null,
        venue: "Emirates Stadium",
      },
    ];
  }
}
