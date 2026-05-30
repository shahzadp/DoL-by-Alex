declare module "twine-sugarcube" {
	export interface SugarCubeStoryVariables {
		daily: {
			dawnCheck: any;
			noonCheck: any;
			kylar: any;
			school: {
				attended(attended: any): unknown;
				lunchEaten: boolean;
			};
			milkFullPainMessage: boolean;
			graceUp: boolean;
		};
	}
}

declare global {
	/**
	 * The naked types check if the player's associated body slots (including underclothes) are completely naked.
	 * These checks will ignore clothing with the "Naked" trait.
	 * 
	 * The "genitalskill" uses the "penileskill" for males, the "vaginalskill" for females, and the average of the
	 * two if the player is a hermaphrodute / received a penis from an ear slime.
	 */
	export type EventTypes = "physique" | "willpower"
		| "athletics" | "danceskill" | "housekeeping" | "skulduggery" | "swimmingskill" | "tending"
		| "seductionskill" | "oralskill" | "genitalskill" | "vaginalskill" | "penileskill" | "analskill" | "handskill"
		| "feetskill" | "bottomskill" | "thighskill" | "chestskill"
		| "science" | "maths" | "english" | "history"
		| "spray" | "net" | "baton" | "whip"
		| "hairlength" | "hairnaked" | "facenaked" | "necknaked" | "uppernaked" | "handsnaked" | "handheldnaked"
		| "lowernaked" | "legsnaked" | "feetnaked"
		| "true";

	/**
	 * Requests are used by the eventChecks function to determine if the player passes or fails a specific check.
	 * 
	 * @param {EventTypes} checkType The parameter to be evaluated.
	 * @param {number} baseChance The base chance (0 to 100 percent) that the check succeeds, AFTER the randomized value has been passed. Defaults to 100.
	 * @param {number} checkMin The minimum randomized value that the parameter will need to pass, inclusive. Clothing checks will use its current integrity. Defaults to 1.
	 * @param {number} checkMax The maximum randomized value that the parameter will need to pass, inclusive. Clothing checks will use its current integrity. Defaults to the skill's maximum value / clothing maximum integrity
	 * @param {boolean} checkFail Checks if the player fails instead of succeeds at the check. Defaults to False.
	 * @param {boolean} includeBurden Include the Temple Burden's influence in the evaluations. Defaults to True.
	 */
	export interface EventRequest {
		checkType: EventTypes;
		baseChance: number;
		checkMin: number;
		checkMax: number;
		checkFail: boolean;
		includeBurden: boolean;
	}
}
export {};
