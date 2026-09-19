import { describe, expect, it } from "vitest";
import { HomeAwayModel } from "./home-away";
import type { MatchContext } from "@/lib/predictions/types";
import type { TeamMatchRecord } from "@/lib/analytics/team-stats";

function record(goalsFor: number, goalsAgainst: number, isHome: boolean): TeamMatchRecord {
  return { matchId: 1, scheduledAt: new Date("2026-01-01"), isHome, goalsFor, goalsAgainst };
}

describe("HomeAwayModel", () => {
  it("uses only home-venue records for the home team's attack, ignoring its away form entirely", () => {
    // Home-only attack average is (4+3)/2=3.5; a poor away record (0,0) must
    // NOT drag that down, since HomeAwayModel should never touch homeTeamOverall's away games.
    const homeTeamHomeOnly: TeamMatchRecord[] = [record(4, 0, true), record(3, 1, true)];
    const awayTeamAwayOnly: TeamMatchRecord[] = [record(1, 1, false), record(1, 1, false)];

    const context: MatchContext = {
      homeTeamOverall: [...homeTeamHomeOnly, record(0, 2, false), record(0, 1, false)],
      homeTeamHomeOnly,
      awayTeamOverall: awayTeamAwayOnly,
      awayTeamAwayOnly,
      leagueAverages: { avgHomeGoalsFor: 1.5, avgAwayGoalsFor: 1.1 },
    };

    const output = new HomeAwayModel().predict(context);
    // lambdaHome = (homeTeamHomeAttack=3.5 + awayTeamAwayDefense=1) / 2 = 2.25
    expect(output.predictedHomeGoals).toBeCloseTo(2.25, 5);
  });

  it("accounts for the specific opponent's away defensive record, not just the home team's own attack", () => {
    const homeTeamHomeOnly: TeamMatchRecord[] = [record(2, 1, true), record(2, 0, true)];

    const leakyAwayDefense: TeamMatchRecord[] = [record(1, 3, false), record(0, 4, false)]; // concedes a lot away
    const tightAwayDefense: TeamMatchRecord[] = [record(1, 0, false), record(0, 1, false)]; // concedes little away

    const base = {
      homeTeamOverall: homeTeamHomeOnly,
      homeTeamHomeOnly,
      leagueAverages: { avgHomeGoalsFor: 1.5, avgAwayGoalsFor: 1.1 },
    };

    const vsLeaky = new HomeAwayModel().predict({ ...base, awayTeamOverall: leakyAwayDefense, awayTeamAwayOnly: leakyAwayDefense });
    const vsTight = new HomeAwayModel().predict({ ...base, awayTeamOverall: tightAwayDefense, awayTeamAwayOnly: tightAwayDefense });

    expect(vsLeaky.predictedHomeGoals).toBeGreaterThan(vsTight.predictedHomeGoals);
  });
});
