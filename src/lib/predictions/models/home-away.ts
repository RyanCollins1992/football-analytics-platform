import { buildPredictionOutput } from "@/lib/predictions/build-output";
import type { MatchContext, PredictionModel, PredictionOutput } from "@/lib/predictions/types";
import { average } from "@/lib/predictions/models/shared";

/**
 * First model that accounts for the opponent: the home team's own home
 * scoring rate blended with the away team's own away conceding rate (and
 * symmetrically for the away side), using real venue-specific splits instead
 * of a flat home-advantage constant.
 */
export class HomeAwayModel implements PredictionModel {
  readonly id = "home-away";
  readonly version = "v1";

  predict(context: MatchContext): PredictionOutput {
    const homeTeamHomeAttack = average(context.homeTeamHomeOnly, "goalsFor");
    const awayTeamAwayDefense = average(context.awayTeamAwayOnly, "goalsAgainst");
    const awayTeamAwayAttack = average(context.awayTeamAwayOnly, "goalsFor");
    const homeTeamHomeDefense = average(context.homeTeamHomeOnly, "goalsAgainst");

    const lambdaHome = (homeTeamHomeAttack + awayTeamAwayDefense) / 2;
    const lambdaAway = (awayTeamAwayAttack + homeTeamHomeDefense) / 2;

    return buildPredictionOutput(lambdaHome, lambdaAway, {
      homeTeamHomeAttack,
      awayTeamAwayDefense,
      awayTeamAwayAttack,
      homeTeamHomeDefense,
    });
  }
}
