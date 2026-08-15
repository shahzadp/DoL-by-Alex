const constants = {
	penisSize: {
		max: 6,
		min: 0,
	},
	tiredness: {
		max: 2000,
		min: 0,
	},
	weather: {
		fogParticles: {
			// Caps for fog particle counts after location band scaling. The area where fog can spawn is larger in some locations than others,
			// so the number of fog particles needs to be adjusted based on that, or else fog density will be inconsistent across different
			// locations, even when there is the same amount of Weather.fog.
			globalLocationCapMax: 40,
			globalLocationCapMin: 10,
		},
	},
	badEndTimeRules: {
		badEndsWithTimeObfuscation: ["Underground Farm", "Wolf Cave", "Underground Dungeon", "Mines"],
		hoursToLoseMinutes: 2,
		hoursToLoseTime: 8,
	},

	// Soft ends that pause Bailey's rent
	badEndsThatPauseRent: ["Prison", "Asylum", "Underground Farm", "Underground Dungeon"],

	/**
	 * Minimum and maximum values for the player's stats
	 *
	 * Grouped by category, then sorted in alphabetical order
	 *
	 * Code that references a variable's max value should be relative to "V.variablemax" / "$variablemax".
	 * - The Awareness variable has an exception, where its innocence stat is called "V.innocenceMin" / "$innocenceMin".
	 *
	 * Magic numbers that appear in multiple functions will be stored as "C.stats.variable.name".
	 *
	 * Magic numbers that affect each other in complicated ways will be stored as "C.stats.variable.group.name".
	 *
	 * Magic numbers that appear in only 1 function will stay in the function, with a comment marking their current value and where they are used.
	 *
	 * The "$wraith.will" variable will need to be adjusted to depend on a proportion of V.willpowermax.
	 */
	stats: {
		// Character State Constants
		drunk: {
			/**
			 * How much allure the PC gains at the drunk effect limit. Can be amplified by other allure modifiers.
			 *
			 * The drunk allure math is handled in the "calculateallure" function.
			 */
			// allureBonus: 500,
			/**
			 * The PC's required level of intoxication to achieve its maximum effects.
			 *
			 * Also determines the scaling of the drunk stat's descriptions and colors in the ""
			 */
			effectLimit: 500,
			/**
			 * How much fatigue the PC gains at the drunk effect limit. This is also applied while the PC is sleeping.
			 *
			 * The hourly fatigue math is handled in the "minutePassed" function.
			 */
			// hourlyFatigue: 20,
			/**
			 * How much stress the PC gains at the drunk effect limit. This is also applied while the PC is sleeping.
			 *
			 * The hourly stress math is handled in the "minutePassed" function.
			 */
			// hourlyStress: -120,
			/**
			 * The maximum value that the PC's $drunk stat can reach, before it begins to overflow.
			 *
			 * Initialized as "$drunkmax" in "game\04-Variables\variables-start.twee".
			 */
			// max: 1000,
			mod: {
				/**
				 * How much the player's sex stats will be increased, depending on their current sex stat and level of intoxication.
				 *
				 * The breakpoints for max drunk increasing each sex stat's tier are as follows:
				 *   Base Stat = 0 (Level 0)  ==> Final Stat = 30 (Level 2)
				 *   Base Stat = 7 (Level 2) ==> Final Stat = 35 (Level 3)
				 *   Base Stat = 32 (Level 3) ==> Final Stat = 55 (Level 4)
				 *   Base Stat = 57 (Level 4) ==> Final Stat = 75 (Level 5)
				 *   Base Stat = 82 (Level 5) ==> Final Stat = 95 (Level 6)
				 */
				maxSex: {
					minDrunk: 1,
					maxDrunk: 10,
				},
				minSex: {
					minDrunk: 1,
					maxDrunk: 30,
				},
			},
			/**
			 * How much more pain the PC can tolerate at the drunk effect limit.
			 *
			 * The pain tolerance math is handled in the "pain" function.
			 */
			// painTolerance: 0.2,
			/**
			 * How much the PC's stats decrease at the drunk effect limit.
			 *
			 * Affected stats:
			 *   Willpower, Skulduggery, Dancing, Swimming, Athletics, Tending, Housekeeping
			 *   Seduction, Oral, Chest, Hands, Buttocks, Anal, Vaginal, Feet, Thighs
			 *   English, History, Maths, Science
			 *
			 * The "Sprays", "Nets", "Batons", "Whips" should also be affected by drunk, but the "currentSkillValue" function doesn't currently handle them.
			 */
			skillPenalty: 100,
			/**
			 * How much more stress the PC can tolerate at the drunk effect limit.
			 *
			 * The stress tolerance math is handled in the "stress" function.
			 */
			// stressTolerance: 3,
		},
		// arousal: {
		// 	max: 10000,
		// 	min: 0,
		// },
		// control: {
		// 	max: 1000,
		// 	min: 0,
		// },
		// /**
		//  * Variable name: "drugged"
		//  */
		// drugs: {
		// 	max: 1000,
		// 	min: 0,
		// },
		// /**
		//  * Variable name: "tiredness"
		//  */
		// fatigue: {
		// 	max: 2000,
		// 	/**
		// 	 * How much fatigue is reduced each hour the player is sleeping / resting.
		// 	 */
		// 	hourlyRate: 250,
		// 	/**
		// 	 * How much fatigue is gained every minute the player is awake.
		// 	 */
		// 	minuteRate: 1,
		// 	min: 0,
		// },
		// /**
		//  * Variable name: "hallucinogen"
		//  */
		// hallucinogens: {
		// 	max: 1000,
		// 	min: 0,
		// },
		// pain: {
		// 	max: 200,
		// 	min: 0,
		// },
		// stress: {
		// 	max: 10000,
		// 	min: 0,
		// },
		// trauma: {
		// 	max: 5000,
		// 	min: 0,
		// },
		//
		// // Core Characteristic Constants
		// /**
		//  * Awareness has a negative range where it turns into Innocence. "Base" will refer to 0 Awareness.
		//  */
		// awareness: {
		// 	max: 1000,
		// 	base: 0,
		// 	min: -200,
		// },
		// beauty: {
		// 	max: 10000,
		// 	min: 0,
		// },
		// deviancy: {
		// 	max: 100,
		// 	min: 0,
		// },
		// exhibitionism: {
		// 	max: 100,
		// 	min: 0,
		// },
		// /**
		//  * The player's body can currently be 1 of 4 sizes:
		//  *
		//  * Tiny, Small, Normal, and Large
		//  */
		// physique: {
		// 	absoluteMax: 20000,
		// 	largeMax: 15000,
		// 	normalMax: 12000,
		// 	smallMax: 9000,
		// 	tinyMax: 6000,
		// 	min: 0,
		// },
		// promiscuity: {
		// 	max: 100,
		// 	min: 0,
		// },
		// purity: {
		// 	min: 0,
		// 	nonVirginMax: 999,
		// 	virginMax: 1000,
		// },
		// willpower: {
		// 	max: 1000,
		// 	min: 0,
		// },
		//
		// // Secondary Characteristic Constants
		// fringeLength: {
		// 	max: 1000,
		// 	min: 0,
		// },
		// grace: {
		// 	max: 100,
		// 	min: 0,
		// },
		// hairLength: {
		// 	max: 1000,
		// 	min: 0,
		// },
		// masochism: {
		// 	max: 1000,
		// 	min: 0,
		// },
		// sadism: {
		// 	max: 1000,
		// 	min: 0,
		// },
		// /**
		//  * Variable name: "submissive"
		//  */
		// submissiveness: {
		// 	max: 2000,
		// 	min: 0,
		// },
		//
		// // Fluid Production Constants
		// milkVolume: {
		// 	cowMax: 6000,
		// 	normalMax: 3000,
		// 	min: 0,
		// },
		// semenVolume: {
		// 	cowMax: 6000,
		// 	normalMax: 3000,
		// 	min: 0,
		// },
		// /**
		//  * It seems there's no upper limit on the amount of fluid a vagina can produce when it orgasms. May be added in
		//  * a future update.
		//  *
		//  * See "game\base-system\orgasm.twee" for the code.
		//  */
		//
		// // Core Skill Constants
		// athletics: {
		// 	max: 1000,
		// 	min: 0,
		// },
		// /**
		//  * Variable name: "danceskill"
		//  */
		// dance: {
		// 	max: 1000,
		// 	min: 0,
		// },
		// housekeeping: {
		// 	max: 1000,
		// 	min: 0,
		// },
		// skulduggery: {
		// 	max: 1000,
		// 	min: 0,
		// },
		// /**
		//  * Variable name: "swimmingskill"
		//  */
		// swimming: {
		// 	max: 1000,
		// 	min: 0,
		// },
		// tending: {
		// 	max: 1000,
		// 	min: 0,
		// },
		//
		// // School Skill Constants
		// english: {
		// 	max: 1000,
		// 	min: 0,
		// },
		// history: {
		// 	max: 1000,
		// 	min: 0,
		// },
		// maths: {
		// 	max: 1000,
		// 	min: 0,
		// },
		// science: {
		// 	max: 1000,
		// 	min: 0,
		// },
		//
		// // Sex Skill Constants
		// /**
		//  * Variable name: "analskill"
		//  */
		// anal: {
		// 	max: 1000,
		// 	min: 0,
		// },
		// /**
		//  * Variable name: "bottomskill"
		//  */
		// buttocks: {
		// 	max: 1000,
		// 	min: 0,
		// },
		// /**
		//  * Variable name: "chestskill"
		//  */
		// chest: {
		// 	max: 1000,
		// 	min: 0,
		// },
		// /**
		//  * Variable name: "feetskill"
		//  */
		// feet: {
		// 	max: 1000,
		// 	min: 0,
		// },
		// /**
		//  * Variable name: "handskill"
		//  */
		// hands: {
		// 	max: 1000,
		// 	min: 0,
		// },
		// /**
		//  * Variable name: "oralskill"
		//  */
		// oral: {
		// 	max: 1000,
		// 	min: 0,
		// },
		// /**
		//  * Variable name: "seductionskill"
		//  */
		// seduction: {
		// 	max: 1000,
		// 	min: 0,
		// },
		// /**
		//  * Variable name: "thighskill"
		//  */
		// thighs: {
		// 	max: 1000,
		// 	min: 0,
		// },
		// /**
		//  * Variable name: "vaginalskill"
		//  */
		// vaginal: {
		// 	max: 1000,
		// 	min: 0,
		// },
	},

	// fames: {
	// 	// Negative Fame Constants
	// 	bestiality: {
	// 		max: 2000,
	// 		min: 0,
	// 	},
	// 	exhibitionism: {
	// 		max: 2000,
	// 		min: 0,
	// 	},
	// 	/**
	// 	 * Variable name: "impreg"
	// 	 */
	// 	impregnation: {
	// 		max: 2000,
	// 		min: 0,
	// 	},
	// 	pimp: {
	// 		max: 2000,
	// 		min: 0,
	// 	},
	// 	pregnancy: {
	// 		max: 2000,
	// 		min: 0,
	// 	},
	// 	prostitution: {
	// 		max: 2000,
	// 		min: 0,
	// 	},
	// 	rape: {
	// 		max: 2000,
	// 		min: 0,
	// 	},
	// 	sex: {
	// 		max: 2000,
	// 		min: 0,
	// 	},
	//
	// 	// Positive Fame Constants
	// 	business: {
	// 		max: 2000,
	// 		min: 0,
	// 	},
	// 	/**
	// 	 * Variable name: "scrap"
	// 	 */
	// 	combat: {
	// 		max: 2000,
	// 		min: 0,
	// 	},
	// 	/**
	// 	 * Variable name: "good"
	// 	 */
	// 	kindness: {
	// 		max: 2000,
	// 		min: 0,
	// 	},
	// 	model: {
	// 		max: 2000,
	// 		min: 0,
	// 	},
	// 	/**
	// 	 * Variable name: "social"
	// 	 */
	// 	socialite: {
	// 		max: 2000,
	// 		min: 0,
	// 	},
	//
	// 	// Crime Fame Constants
	// 	/**
	// 	 * Original values obtained from "game\03-JavaScript\alias2.js"
	// 	 */
	// 	crime: {
	// 		max: 10000,
	// 		min: 0,
	// 		/**
	// 		 * If the player commits too much of the same type of crime in one day, they leave behind more evidence.
	// 		 *
	// 		 * The dawnCheck() function in "game\03-JavaScript\time.js" will increase the player's crime by an additional
	// 		 * 10% if their daily crime stat is greater than "spree".
	// 		 */
	// 		spree: 1000,
	// 	},
	// },
};

/* Hoist Constants to the top (For statevars.js) */
// eslint-disable-next-line no-var
var Constants = ConstantsLoader.init(constants);
window.Constants = Constants;
