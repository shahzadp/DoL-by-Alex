/* This file contains utility functions for named NPCs. */

function statusCheck(name) {
	if (V.NPCNameList.includes(name)) {
		const nnpc = V.NPCName[V.NPCNameList.indexOf(name)];

		/* To remove later */
		if (V.options && V.options.debugdisable === "t" && V.debug === 0) {
			T[name.toLowerCase()] = nnpc;
		}
		/* To remove later */

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
			}
		}
		return nnpc;
	} else {
		Errors.report(`getNNPC received an invalid name ${name}.`);
	}
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
