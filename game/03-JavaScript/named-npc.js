/* This file contains utility functions for named NPCs. */

function statusCheck(name) {
	if (!V.NPCNameList.includes(name)) {
		Errors.report(`getNNPC received an invalid name ${name}.`);
		return;
	}

	const nnpc = C.npc[name];

	/* To remove later:
	 * When debugging, this temp var not being set will cause an error in scenes that use legacy temporary variables.
	 * These should be replaced with C.npc.Robin instead of _robin, for example.
	 */
	if (V.debug === 0) {
		T[name.toLowerCase()] = nnpc;
	}
	/* /To remove later */

	/* Assume this is successful, unless the game is severely unhinged. */
	if (nnpc.init === 1) {
		switch (nnpc.nam) {
			case "Robin":
				getRobinLocation();
				break;
			case "Kylar":
				kylarStatusCheck(nnpc);
				break;
			case "Sydney":
				sydneyStatusCheck();
				break;
			case "Gwylan":
				gwylanStatusCheck();
				break;
		}
	}
	return nnpc;
}
window.statusCheck = statusCheck;

function sydneyStatusCheck() {
	const sydney = C.npc.Sydney;

	if (sydney.purity >= 50 && sydney.lust >= 60) T.sydneyStatus = "pureLust";
	else if (sydney.corruption >= 10 && sydney.lust >= 20) T.sydneyStatus = "corruptLust";
	else if (sydney.purity >= 50) T.sydneyStatus = "pure";
	else if (sydney.corruption >= 10) T.sydneyStatus = "corrupt";
	else if (sydney.lust >= 40) T.sydneyStatus = "neutralLust";
	else T.sydneyStatus = "neutral";

	if (sydney.chastity.penis.includes("chastity") || sydney.chastity.vagina.includes("chastity")) T.sydneyChastity = 1;
	if (sydney.virginity.vaginal && sydney.virginity.penile) T.sydneyVirgin = 1;
}

function sydneySchedule() {
	if (V.sydney_location_override && V.replayScene) {
		T.sydney_location = V.sydney_location_override;
	} else if (V.daily.sydney.punish === 1) {
		T.sydney_location = "home";
		T.sydney_location_message = "home";
	} else if (V.englishPlay === "ongoing" && V.englishPlayDays === 0 && between(Time.hour, 17, 20)) {
		T.sydney_location = "englishPlay";
	} else if (Time.weekDay === 1) {
		T.sydney_location = "temple";
	} else if (Time.weekDay === 7) {
		if (V.adultshopopeningsydney === true && Time.hour < 21) {
			T.sydney_location = "shop";
		} else if (Time.hour >= 6) {
			T.sydney_location = "temple";
		} else {
			T.sydney_location = "home";
		}
	} else if (Time.weekDay === 6 && between(Time.hour, 16, 19)) {
		if (V.adultshophelped === 1) {
			T.sydney_location = "temple";
		} else {
			T.sydney_location = "shop";
		}
	} else if (V.sydneySeen !== undefined && V.adultshopunlocked && C.npc.Sydney.corruption > 10 && between(Time.hour, 16, 19)) {
		const corruption = C.npc.Sydney.corruption;
		if (V.adultshophelped === 1) {
			T.sydney_location = "temple";
		} else if (corruption > 10 && Time.weekDay === 4) {
			T.sydney_location = "shop";
			T.sydney_location_message = "shop";
		} else if (corruption > 20 && Time.weekDay === 5) {
			T.sydney_location = "shop";
			T.sydney_location_message = "shop";
		} else if (corruption > 30 && Time.weekDay === 3 && V.sydney.rank === "initiate") {
			T.sydney_location = "shop";
			T.sydney_location_message = "shop";
		} else if (corruption > 40 && Time.weekDay === 2 && V.sydney.rank === "initiate") {
			T.sydney_location = "shop";
			T.sydney_location_message = "shop";
		} else {
			T.sydney_location = "temple";
			T.sydney_location_message = "temple";
		}
	} else if (!Time.schoolTerm) {
		if (Time.hour >= 6 && Time.hour <= 22) {
			T.sydney_location = "temple";
		} else {
			T.sydney_location = "home";
		}
	} else if (Time.schoolDay) {
		wikifier("schooleffects");
		if (Time.hour <= 5) {
			T.sydney_location = "home";
		} else if (Time.hour >= 6 && Time.hour <= 9 && V.sydneyLate === 1) {
			T.sydney_location = "late";
		} else if (Time.hour === 6) {
			T.sydney_location = "temple";
		} else if (Time.hour === 7 || Time.hour === 8 || (Time.hour === 9 && V.sydneyScience !== 1)) {
			T.sydney_location = "library";
		} else if (Time.hour === 9) {
			T.sydney_location = "science";
		} else if (["second", "third"].includes(V.schoolstate)) {
			T.sydney_location = "class";
		} else if (V.schoolstate === "lunch" && V.daily.school.lunchEaten !== 1 && Time.minute <= 15) {
			T.sydney_location = "canteen";
		} else if (V.englishPlay === "ongoing" && V.schoolstate === "afternoon") {
			T.sydney_location_message = "rehearsal";
			T.sydney_location = "rehearsal";
		} else if (Time.hour <= 15 || (Time.hour === 16 && Time.minute <= 40)) {
			if (V.daily.sydney.templeSkip) {
				T.sydney_location = "temple";
			} else {
				T.sydney_location = "library";
			}
		} else if (Time.hour >= 16 && Time.hour <= 22) {
			T.sydney_location = "temple";
		} else {
			T.sydney_location = "home";
		}
	} else {
		T.sydney_location = "home";
	}
	if (T.sydney_location === "temple") {
		switch (Time.hour) {
			case 1:
			case 2:
			case 3:
			case 4:
			case 5:
				V.sydney_templeWork = Time.weekDay === 1 ? "sleep" : "pray";
				break;
			case 6:
				V.sydney_templeWork = "pray";
				break;
			case 7:
			case 8:
			case 9:
			case 10:
				V.sydney_templeWork = "garden";
				break;
			case 11:
			case 12:
				V.sydney_templeWork = Time.weekDay === 1 && V.daily.massAttended !== 1 ? "mass" : "pray";
				break;
			case 13:
			case 14:
			case 15:
			case 16:
				V.sydney_templeWork = "pray";
				break;
			case 17:
			case 18:
			case 19:
			case 20:
				V.sydney_templeWork = Time.weekDay === 1 && V.sydney && V.sydney.rank === "initiate" ? "anguish" : "quarters";
				break;
			case 21:
			case 22:
				V.sydney_templeWork = Time.weekDay === 1 && V.sydney && V.sydney.rank === "initiate" ? "anguish" : "pray";
				break;
			case 23:
			case 0:
				V.sydney_templeWork = Time.weekDay === 7 ? "sleep" : "pray";
				break;
			default:
				V.sydney_templeWork = "pray";
		}
	}
}
window.sydneySchedule = sydneySchedule;
DefineMacro("sydneySchedule", sydneySchedule);

function kylarStatusCheck(kylar) {
	const kylarStatus = [];
	// USAGE:
	// if Kylar's love is 50+:  <<if _kylarStatus.includes("Love")>>
	// if Kylar's love is 0-50: <<if !_kylarStatus.includes("Love")>>
	if (kylar.love >= 50) {
		kylarStatus.push("Love");
	}
	// USAGE:
	// if Kylar's lust is 60+:  <<if _kylarStatus.includes("Lust")>>
	// if Kylar's lust is 0-60: <<if !_kylarStatus.includes("Lust")>>
	if (kylar.lust >= 60) {
		kylarStatus.push("Lust");
	}
	// USAGE:
	// if Kylar's jealousy is 90+:   <<if _kylarStatus.includes("MaxRage")>>
	if (kylar.rage >= 90) {
		kylarStatus.push("MaxRage");
	}

	// USAGE:
	// if Kylar's jealousy is 60+:   <<if _kylarStatus.includes("Rage")>>. Not mutually exclusive with 90+
	// if Kylar's jealousy is 30-59: <<if _kylarStatus.includes("Sus")>>
	// if Kylar's jealousy is 0-30:  <<if _kylarStatus.includes("Calm")>>
	if (kylar.rage >= 60) {
		kylarStatus.push("Rage");
	} else if (kylar.rage >= 30) {
		kylarStatus.push("Sus");
	} else {
		kylarStatus.push("Calm");
	}
	return (T.kylarStatus = kylarStatus);
}

function understandsBirdBehaviour() {
	return V.harpy >= 6 || V.tending >= 600;
}
window.understandsBirdBehaviour = understandsBirdBehaviour;

function edenFreedomStatus() {
	if (V.edenfreedom >= 1 && V.edendays >= 0) {
		// if edenCagedEscape is true, the cage limit is 7 days regarless of $edenfreedom
		const daysCage = V.edenCagedEscape || V.edenfreedom === 1 ? 7 : 21;
		const daysFreedom = V.edenfreedom === 1 ? 2 : 7;

		if (V.syndromeeden && V.edendays > daysCage) return 2; // Cage if Eden hunts you down/finds you
		if (V.edendays > daysFreedom) return 1; // Recaptured if Eden finds you, angry if return on your own
		return 0; // Free as a bird, allowed to come and go as you please
	}
	return -1; // Player not allowed to leave (hasn't asked for freedom/pre-stockholm/hasn't met Eden)
}
window.edenFreedomStatus = edenFreedomStatus;

function gwylanStatusCheck() {
	const gwylanStatus = [];

	if (V.forest_shop_intro || V.gwylan_rescue || V.gwylan_cafe_intro || V.gwylan_hunt_intro) {
		gwylanStatus.push("met");
	}

	// return early if called before core vars are set
	if (!V.gwylanTalked || !V.gwylanSeen || !V.gwylan) return (T.gwylanStatus = gwylanStatus);

	if (V.gwylan?.timer?.lastSeen) T.gwylanLastSeenDays = Math.abs(Time.date.dayDifference(new DateTime(V.gwylan.timer.lastSeen)));

	const totalSets = getSpecialSets(sets => sets.shop.includes("forest"));
	const unlockedSets = getUnlockedSpecialSets(V.specialClothes.filter(c => c.unlocked >= 2).map(c => c.name)).filter(set =>
		setup.specialClothesSets[set].shop.includes("forest")
	);
	C.npc.Gwylan.love = Math.floor(unlockedSets.length + V.gwylanTalked.filter(set => setup.specialClothesSets[set]?.shop.includes("forest")).length);
	if (V.gwylan.wary > 1 && ["active", "scorned"].includes(C.npc.Gwylan.state)) {
		/* If Gwylan is around, temporarily lower love if player has worked against them until amends are made */
		C.npc.Gwylan.love -= V.gwylan.wary * 2;
		gwylanStatus.push("cautious");
	}
	T.gwylanLovePercent = Math.floor((C.npc.Gwylan.love / (totalSets.length * 2)) * 100);

	if (
		T.gwylanLovePercent >= 65 &&
		V.gwylanSeen.includes("ritual_sex") &&
		C.npc.Gwylan.dom >= 20 &&
		C.npc.Gwylan.lust >= 40 &&
		!gwylanStatus.includes("cautious")
	) {
		/* Gwylan allows themselves to become comfortable with the player before yearning unlock */
		if (!V.gwylanSeen.includes("yearning")) gwylanStatus.push("aroused");
		/* Gwylan is dominant over the player */
		if (C.npc.Gwylan.dom >= 100 || V.hypnosis_traits.devotion >= 3) gwylanStatus.push("dom");
	}

	if (
		T.gwylanLovePercent >= 75 &&
		V.gwylanSeen.includes("yearning") &&
		C.npc.Gwylan.dom >= 50 &&
		C.npc.Gwylan.lust >= 30 &&
		C.npc.Gwylan.dom + C.npc.Gwylan.lust >= 90 &&
		!gwylanStatus.includes("cautious")
	) {
		/* Gwylan allows themselves to become comfortable with the player again after 'breakup' */
		gwylanStatus.push("lust");
		if (V.gwylanSeen.includes("partners") && C.npc.Gwylan.dom >= 100 && C.npc.Gwylan.lust >= 40 && C.npc.Gwylan.dom + C.npc.Gwylan.lust >= 160)
			/* In heat/rut */
			gwylanStatus.push("heat");
		if (
			T.gwylanLovePercent >= 90 &&
			C.npc.Gwylan.dom >= 140 &&
			gwylanStatus.includes("heat") &&
			// eslint-disable-next-line no-undef
			!npcIsPregnant("Gwylan") &&
			!playerIsPregnant()
		)
			/* Wants pregnancy with player */
			gwylanStatus.push("wantsPregnancy");
	}

	/* Event handlers */
	if (V.avery_fate === "ascended" && V.auriga_scar >= 1 && !V.gwylanSeen.includes("auriga_scar") && V.gwylanSeen.includes("ritual_sex")) {
		gwylanStatus.push("aurigaScarConfront");
	}
	if (
		V.badEndStats.last()?.source !== "Gwylan" &&
		V.badEndStats.last()?.trackedStart >= V.gwylan.timer.lastSeen &&
		T.gwylanLastSeenDays >= 14 &&
		V.gwylanSeen.includes("lights")
	) {
		gwylanStatus.push("reunion");
	}
	if (
		V.gwylanSeen.includes("romance") &&
		(gwylanStatus.includes("aurigaScarConfront") ||
			(C.npc.Gwylan.dom >= 125 &&
				V.hypnosis_traits.devotion &&
				!(V.avery_mansion && !V.avery_fate) &&
				(gwylanStatus.includes("reunion") || V.gwylan.hunting === 3)))
	) {
		gwylanStatus.push("badEndReady");
	}

	/* Transformation part visibility */
	T.gwylanTF = {
		ears: "hidden",
		tail: "hidden",
		fangs: "hidden",
		known: false,
	};
	if (V.settings?.transformAnimalEnabled) {
		if (V.gwylanSeen.includes("gwylan_tf_revealed")) {
			// No longer hiding it from the player
			if (V.hallucinations >= 1) {
				T.gwylanTF.ears = "revealed";
				T.gwylanTF.tail = "revealed";
				T.gwylanTF.fangs = "revealed";
			} else {
				T.gwylanTF.ears = "fake";
				T.gwylanTF.tail = "fake";
				T.gwylanTF.fangs = "fake";
			}
			T.gwylanTF.known = true;
		} else {
			if (
				V.awarelevel >= 4 ||
				(V.hallucinations >= 1 &&
					gwylanStatus.includesAny("aroused", "lust") &&
					(V.awarelevel >= 3 || (V.hypnosis_traits.insight >= 1 && V.awarelevel < 1)))
			) {
				T.gwylanTF.ears = "visible";
				T.gwylanTF.tail = "visible";
				T.gwylanTF.fangs = "visible";
			}
			if (V.gwylanSeen.includes("gwylan_ears")) T.gwylanTF.ears = V.hallucinations >= 1 ? "revealed" : "fake";
			if (V.gwylanSeen.includes("gwylan_tail")) T.gwylanTF.tail = V.hallucinations >= 1 ? "revealed" : "fake";
			if (V.gwylanSeen.includes("gwylan_fangs")) T.gwylanTF.fangs = V.hallucinations >= 1 ? "revealed" : "fake";
		}
	}

	if (V.brownFoxWoundedTimer && Time.date.dayDifference(new DateTime(V.brownFoxWoundedTimer)) > 0) gwylanStatus.push("wounded");
	if (V.brownFoxWounded) gwylanStatus.push("scarred");

	return (T.gwylanStatus = gwylanStatus);
}
window.gwylanStatusCheck = gwylanStatusCheck;

function gwylanSchedule() {
	if (V.gwylan?.timer?.nobody >= Time.date.timeStamp) {
		return "nowhere";
	} else if (C.npc.Gwylan.state === "scorned") {
		if (Time.hour >= 17 && Time.hour <= 23 && !V.gwylanSeen?.includes("yearning_pub") && !V.yearningLetter && !V.daily.gwylan.preventProgress) {
			return "pub";
		} else {
			return "sulking";
		}
	} else if (V.robin_in_forest_shop) {
		return "shop";
	} else if (Time.hour === 5 || (Time.hour === 6 && Time.minute < 45)) {
		return "garden"; // ToDo: Gwylan: watching Gwylan sleep or stretch in the garden during temperate weather
	} else if (!V.daily.gwylan.cafeSkip && Time.hour === 7 && Time.minute < 20 && !V.daily.gwylan.cafe) {
		return "walking_to_cafe";
	} else if (
		!V.daily.gwylan.cafeSkip &&
		((Time.hour === 7 && (Time.minute >= 20 || V.daily.gwylan.cafe)) || Time.hour === 8 || (Time.hour === 9 && Time.minute <= 20))
	) {
		if (between(V.chef_state, 7, 8)) {
			return "cliff";
		} else {
			return "cafe";
		}
	} else if (!Time.isBloodMoon() && (Time.hour >= 23 || Time.hour <= 5) && (!V.gwylan?.hunting || V.location === "forest_shop")) {
		return "sleep";
	}
	return "shop";
}
window.gwylanSchedule = gwylanSchedule;

function averyMansionScore() {
	if (C.npc.Avery.love < 50) return 0; // 50 love is hard requirement
	let score = 0;
	score += Math.floor(V.housekeeping / 20); // 1 point for every 20 housekeeping skill
	score += C.npc.Avery.love - 50; // 1 point for every point of love above 50
	score += Object.values(V.plants).filter(food => food.recipe).length * 2; // 2 points for each known recipe
	if (Object.values(V.plants).some(food => food.knownFavorite?.includes("Avery"))) score += 50; // 50 points if has ever given Avery a favourite food
	return score;
}
window.averyMansionScore = averyMansionScore;

/**
 * @param {"Eden" | "Black Wolf" | "Ivory Wraith" | "Gwylan" | "forest trio"} npc which npc to check
 */
function npcCanHunt(npc) {
	switch (npc) {
		case "Eden":
			// Only hunts beyond forest outskirts.
			return V.forest > 20;
		case "Black Wolf":
			// Only hunts beyond forest outskirts.
			return V.forest > 20;
		case "Ivory Wraith":
			// Wraith events can't start at 5 AM. Would result in possession immediately ending.
			return Time.isBloodMoon() && Time.hour !== 5;
		case "Gwylan":
			statusCheck("Gwylan");
			// Hunts in the outskirts normally, but will go beyond if they are actively looking for the player
			return (
				V.forest > 0 &&
				(V.forest <= 25 || V.gwylan?.hunting || T.gwylanStatus?.includesAny("reunion", "heat")) &&
				!V.daily.gwylan.noHunt &&
				!V.weekly.gwylanNoHunt &&
				!V.daily.gwylan.noTalk &&
				!V.daily.gwylan.locked &&
				!T.gwylanStatus?.includes("wounded") &&
				["shop", "garden", "nowhere"].includes(gwylanSchedule()) &&
				(C.npc.Gwylan.init === 0 || (C.npc.Gwylan.state === "active" && V.gwylanSeen?.includes("talk_intro")))
			);
		case "forest trio":
			return npcCanHunt("Eden") || npcCanHunt("Black Wolf") || npcCanHunt("Gwylan");
		default:
			Errors.report(`npcCanHunt function received an invalid npc name ${npc}.`);
	}
}
window.npcCanHunt = npcCanHunt;

function wraithSleepEventCheck() {
	return V.wraith.state !== "" && V.wraith.nightmare === 1 && npcCanHunt("Ivory Wraith");
}
window.wraithSleepEventCheck = wraithSleepEventCheck;
