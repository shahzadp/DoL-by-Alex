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
		// The cycle advances by this much each <<menstruationCycle>>, which dayPassed and noonCheck
		// spend once each. Two ticks a day means one cycle day per real day, always: pills change how
		// fertile the body is, never how fast time runs, so a cycle day and a calendar day are the
		// same unit and a projected date is subtraction rather than a simulation.
		cycleDaysPerTick: 0.5,
		// The day a freshly restarted cycle begins on, so a projection of the next cycle and
		// restartMenstruationCycle itself agree on where it starts.
		cycleRestartDay: 0.5,
		// How many <<menstruationCycle>> ticks a real day holds: dayPassed and noonCheck, one each.
		cycleTicksPerDay: 2,
		baselineFertility: 0.01, // baseline fertillity so pregnancy chance is never 0
		// How much each fertility-booster dose lifts the floor under the day's fertility, up to
		// fertilityMaxDoses. A booster's job is to make the body fertile NOW rather than to
		// fast-forward the cycle, so a dose raises the floor instead of the clock: the floor is what
		// stops a dose being multiplied into a dead cycle day, and
		// conceptionModifiers.fertilityMultiplierPerDose is what makes an open window potent.
		// Tuned against what the pill UI can actually reach: take_condition is doseTaken < 2, so a
		// player gets 0, 1 or 2, and the game calls 2 an overdose (traits.twee, and taking the second
		// fires PillCollectionSecondDosePregnancy). Measured on the reported save's dead day, cycle 29
		// of 30: 1 dose reads "safe" and an overdose reads "risky", where 0.2 flat left one dose
		// indistinguishable from none -- a pill you take and watch do nothing.
		fertilityFloorPerDose: 0.3,
		riskyFertility: 0.375, // what fertillity counts as "risky"
		postOvulationDays: 1, // NPC fertile window stays this many days past cycleDangerousDay
		// playerHeatMinArousal's two tiers, read against the day's fertility rather than the meter's
		// label, so retuning what the player is told never retunes what their body does.
		heatFertility: { partial: 0.625, full: 0.875 },
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
	// The character-screen fertility meter. playerPregnancyRisk() takes the first label whose upTo
	// menstrualExposure() still falls under, and menstrualFertileDates() bands its printed date
	// ranges on the SAME function against these SAME bounds -- so the label and the dates two lines
	// under it cannot disagree. That coherence is structural now; it does not rest on two separate
	// constants being kept equal, which is how the panel came to contradict itself for a quarter of
	// the cycle while every constant still matched.
	//
	// upTo is an EXPOSURE fraction (0-1): the fertility a load left today can expect to meet across
	// its life, weighted by how likely it is to still be alive to meet it. The meter deliberately
	// does not read the odds directly, because settings.basePlayerPregnancyChance is a 0-100 slider
	// -- at the top of its range every day of the month reads dangerous, at the bottom ovulation
	// itself reads safe, and either way the reading stops describing the cycle. Exposure is very
	// nearly proportional to the real odds regardless of where that slider sits (measured: the ratio
	// holds within 3% across the whole cycle), so these bounds carry real meaning without it.
	//
	// Tuned so a 30-day cycle spreads 17/3/2/3/5 across the five bands. Banding on the peak instead
	// of the integral collapsed that to 25 of 30 days reading either "very safe" or "dangerous".
	riskMeterLabels: [
		{ text: "very safe", colour: "green", upTo: 0.05 },
		{ text: "safe", colour: "teal", upTo: 0.15 },
		{ text: "somewhat safe", colour: "lblue", upTo: 0.28 },
		{ text: "risky", colour: "pink", upTo: 0.5 },
		{ text: "dangerous", colour: "red", upTo: Infinity },
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
