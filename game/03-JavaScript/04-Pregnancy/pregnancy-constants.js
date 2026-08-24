const PregnancyConstants = ConstantsLoader.init({
	/* === CUM LOADS + CONCEPTION === */
	// A load doesn't take its conception roll until it's at least this old (in seconds).
	// This is the window to wash a washable load out before it can conceive.
	loadGracePeriod: 21600, // 6 hours
	// How many days a load stays fertile, rolled per load.
	loadLifespanDays: { min: 4, max: 8 },
	// How long a pending conception takes to become a pregnancy record (in seconds).
	// Until then, the morning-after pill can still discard it.
	implantationWindow: 172800, // 2 days
	// How much each ejaculation depth multiplies the conception chance, before potency applies.
	// outside (washable), imminent (washable), deep (inside, not washable)
	depthWeight: { outside: 0.05, imminent: 0.15, deep: 1 },
	// Fertility-booster doses past this stop counting.
	// Cap for playerConceptionModifier's fertility-booster bonus.
	fertilityMaxDoses: 4,
	// PC conception chance modifiers, read in playerConceptionModifier.
	conceptionModifiers: {
		contraceptiveMultiplier: 0.1, // conception multiplier after a single contraceptive dose
		contraceptiveDosesToBlock: 2, // 2 pills = "overdose" and 100% effective
		fertilityMultiplierPerDose: 0.5, // each fertility booster dose adds this to the multiplier
		pregnancyTattooMultiplier: 1.5, // magic pregnancy tattoo multiplier
		earSlimeMultiplier: { pregnancy: 2, impregnation: 0.5 }, // ear slime multipliers
		npcContraceptiveMultiplier: 0.1, // a carrier NPC on contraceptives, ~90% effective
		npcFertilityMultiplier: 1.25, // a carrier NPC on fertility pills
	},
	// takeMorningAfterPill outcomes, as fractions of the implantation window
	morningAfterPill: {
		successFraction: 1 / 3, // caught within the first third of the window
		aLittleLateFraction: 2 / 3, // beyond two thirds is too late
	},

	/* === MENSTRUAL/FERTILITY CYCLE === */
	// menstrualFertility() reads these to place the fertile window.
	// rollMenstrualStages() turns these into the per-cycle stages array
	// [cycleStart, menstrualEnd, ovulationStart, ovulationEnd]
	menstrualCycle: {
		periodDaysMin: 3,
		periodDaysMax: 5,
		ovulationStartCycleFraction: 0.5, // ovulation starts mid-cycle
		fertileLeadDaysMin: 5, // fertile from this many days before ovulation...
		fertileLeadDaysMax: 7, // ...up to this many, rolled per cycle.
		lutealTailDays: 2, // fertility fades away over this many days after the window closes
		baselineFertility: 0.01, // baseline fertillity so pregnancy chance is never 0
		riskyFertility: 0.375, // what fertillity counts as "risky"
		postOvulationDays: 1, // NPC fertile window stays this many days past cycleDangerousDay
	},

	/* === GESTATION / SYMPTOMS / DETECTION === */
	// Adds variance to a pregnancy's gestation time
	gestation: {
		variancePercent: 10,
	},
	// NPC pregnancy timing (npcPregnancyCycle)
	npcGestation: {
		awareProgressFraction: 0.2, // an NPC notices the pregnancy after this fraction of gestation
		offscreenBirthGraceDays: 14, // days past due before an unseen NPC's pregnancy resolves offscreen
	},
	// advancePregnancy morning-sickness windows, as gestation fractions
	morningSickness: {
		earlyStart: 0.15, // light early nausea from here...
		earlyEnd: 0.25, // ...to here
		mainStart: 0.25, // main nausea from here...
		mainEnd: 0.45, // ...to here
	},
	// Pregnancy belly (playerBellySize / npcBellySize)
	belly: {
		maxSize: 24, // the belly sprite has 24 frames, so bellySize is capped here
		showFraction: 0.15, // belly stays hidden until this far into gestation, then ramps to term size
		termBase: 21, // term size is this plus the litter count, capped at maxSize
		// playerBellyVisible/npcBellyVisible size thresholds:
		// below bareMin a belly never shows
		// below clothedMin it needs revealing clothing
		// below hiddenMin bellyHide clothing can still hide it.
		visibility: { bareMin: 8, clothedMin: 13, hiddenMin: 18 },
	},
	// The character-screen fertility meter. playerPregnancyRisk() indexes it.
	riskMeterLabels: [
		{ text: "very safe", colour: "green" },
		{ text: "safe", colour: "teal" },
		{ text: "somewhat safe", colour: "lblue" },
		{ text: "risky", colour: "pink" },
		{ text: "dangerous", colour: "red" },
	],
	// Pregnancy test early negatives
	pregnancyTest: {
		veryEarlyDays: 2, // within the first 2 days...
		veryEarlyNegativeRoll: 10, // ... negative 90% of the time.
		earlyDays: 4, // within 2-4 days...
		earlyNegativeRoll: 15, // ...negative 85% of the time.
	},

	/* === CHILD GENERATION === */
	// Litter sizes and per-child trait rolls.
	childGen: {
		// litter-size distribution; triplets kept rare, a Feat depends on it
		humanLitterWeights: [
			[1, 900],
			[2, 90],
			[3, 2],
		],
		identicalMultiplePercent: 33, // chance a twin pair is identical, rolled again for a third/triplet
		hermChildPercent: 25, // a herm parent's chance of a herm child
		wolfLitterWeights: [
			// pup-count distribution
			[4, 1], // 10%
			[5, 2], // 20%
			[6, 4], // 40%
			[7, 2], // 20%
			[8, 1], // 10%
		],
		hawkLitterWeights: [
			// egg-count distribution
			[1, 1], // 10%
			[2, 4], // 40%
			[3, 4], // 40%
			[4, 1], // 10%
		],
		childSizeSameMax: 50,
		childSizeSmallerMax: 75,
	},
	// Child appearance gene pools
	genePool: {
		wolfFur: ["grey", "brown", "tan", "white"],
		hawkFeather: ["white", "brown"],
		eyeColour: ["purple", "dark blue", "light blue", "amber", "hazel", "green", "lime green", "red", "pink", "grey", "light grey"],
		hairColour: [
			"red",
			"jetblack",
			"black",
			"brown",
			"softbrown",
			"lightbrown",
			"burntorange",
			"blond",
			"softblond",
			"platinumblond",
			"ashyblond",
			"strawberryblond",
			"ginger",
			"dark brown",
		],
		childSize: ["tiny", "small", "normal", "large"],
	},

	/* === EGGS / HAWK / HARPY === */
	// How long a laid clutch of eggs sits in the nest before hatching (in seconds).
	birdNestTime: 604800, // 7 days
	// Egg pregnancies hatch up to this much later (in seconds), rolled per clutch when the record is created.
	birdHatchDelay: 259200, // 3 days
	// layCare can shave at most this fraction of the gestation length off the lay.
	maxLayCareFraction: 0.5,
});
window.PregnancyConstants = PregnancyConstants;
