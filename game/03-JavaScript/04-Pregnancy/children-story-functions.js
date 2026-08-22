/* This was code left behind by the old pregnancy code for "first word" scenes that is not currently implemented.
const setChildFirstWord = (childId, word, playerAbsent = false) => {
	if (childId === undefined && V.childSelected) childId = V.childSelected.childId;
	if (childId === undefined && !V.childSelected) return false;

	const child = V.childRecords[childId];

	if (child.development.firstWord) return false;

	if (!word) {
		const wordList = ["mama", "mummy", "dada", "daddy", "papa", "no", "nana", "yes", "uh oh", "bye", "bye-bye", "hello"];
		word = wordList[random(0, wordList.length - 1)];
	}
	child.development.firstWord = word;
	return word;
};
DefineMacro("setChildFirstWord", setChildFirstWord);
*/

function updateChildActivity(childId) {
	const child = V.childRecords[childId];

	const daysFromLastActivity = Math.clamp(Time.days - child.development.activityDay, 0, Infinity);
	const hoursFromLastActivity = Time.hour - (child.development.activityHour - 24 * daysFromLastActivity);

	if (hoursFromLastActivity >= 4 || (Time.hour === 7 && hoursFromLastActivity >= 2) || child.development.activity === "noEvent") {
		switch (child.species) {
			case "human":
				humanChildActivity(childId);
				break;
			case "wolf":
				wolfChildActivity(childId);
				break;
			case "hawk":
				hawkChildActivity(childId);
				break;
			default:
				throw new Error(`updateChildActivity: child ${childId} has non-base species "${child.species}"`);
		}
		child.development.activityDay = Time.days;
		child.development.activityHour = Time.hour;
	}
}
DefineMacro("updateChildActivity", updateChildActivity);

function getChildDays(childId) {
	const child = V.childRecords[childId];

	if (!["human", "wolf", "hawk"].includes(child.species)) throw new Error(`getChildDays: child ${childId} has non-base species "${child.species}"`);
	return Math.clamp(childAgeOf(child), 0, 200);
}
window.getChildDays = getChildDays;

/**
 * Children's toy sets stored at the current location.
 *
 * @returns {string[]}
 */
function gatherToySets() {
	const toySets = [];
	if (V.storedChildrenToys && V.storedChildrenToys[V.location]) {
		V.storedChildrenToys[V.location].forEach(toy => toySets.pushUnique(toy.set));
	}
	return toySets;
}

function humanChildActivity(childId) {
	const child = V.childRecords[childId];

	const donor = getPregnancyOf(child).donor;
	const toySets = gatherToySets();
	statusCheck("Robin");
	let activity = [];

	if (between(T.childTotalDays, 0, 100)) {
		if (Time.dayState === "night") {
			activity = activity.concat(["sleeping", "sleeping", "sleeping", "sleeping", "sleeping", "restlessSleep", "restlessSleep", "crying", "nappyChange"]);
		} else {
			activity = activity.concat([
				"sleeping",
				"sleeping",
				"sleeping",
				"crying",
				"crying",
				"crying",
				"lonely",
				"nappyChange",
				"thumbSucking",
				"grumpyChild",
				"bathe",
			]);

			if (T.childTotalDays >= 50) activity.push("happy");
			if (toySets.includes("baby rattles")) activity.push("babyRattle");
			if (toySets.includes("teddy bears")) activity.push("teddyBear");
			if (toySets.includes("toy cars")) activity.push("toyCar");
			if (toySets.includes("dummies")) {
				activity.push("dummy");
			} else {
				activity.push("crying");
			}
			if (toySets.includes("clown")) activity.push("clown");
			if (T.robin_location === "orphanage") activity.push("Robin");
			if (donor === "Ivory Wraith") {
				wikifier("rngWraith", 1);
				if (T.wraithEvent) activity.push("Wraith");
			}
		}
	} else if (between(T.childTotalDays, 100, 200)) {
		if (Time.dayState === "night") {
			activity = activity.concat(["sleeping", "sleeping", "sleeping", "sleeping", "sleeping", "restlessSleep", "restlessSleep", "crying", "nappyChange"]);
		} else {
			activity = activity.concat([
				"sleeping",
				"sleeping",
				"sleeping",
				"crying",
				"lonely",
				"happy",
				"nappyChange",
				"thumbSucking",
				"talking",
				"grumpyChild",
				"bathe",
			]);

			if (T.childTotalDays >= 180) activity.push("readingAttempt");

			if (toySets.includes("baby rattles")) activity.push("babyRattle");
			if (toySets.includes("teddy bears")) activity.push("teddyBear");
			if (toySets.includes("toy cars")) activity.push("toyCar");
			if (toySets.includes("dummies")) {
				activity.push("dummy");
			} else {
				activity.push("crying");
			}
			if (toySets.includes("clown")) activity.push("clown");
			if (child.development.talking >= 10 && T.childTotalDays >= 150) activity.push("talking2");
			if (T.robin_location === "orphanage") activity.push("Robin");
			if (donor === "Ivory Wraith") {
				wikifier("rngWraith", 1);
				if (T.wraithEvent) activity.push("Wraith");
			}
		}
	}

	/* ToDo: Pregnancy - To be added at a later date
		if (child.development.crawling <= 5) {
			activity.push("crawlingAttempt");
		} else {
			activity.push("crawlingAttempt2");
		}
	*/

	child.development.activity = activity.length ? activity[random(0, activity.length - 1)] : "noEvent";
	child.development.event = true;
}

function wolfChildActivity(childId) {
	const child = V.childRecords[childId];

	const toySets = gatherToySets();
	let activity = [];

	if (toySets.includes("chew toys")) {
		activity = activity.concat(["squeakyToy", "squeakyToy2", "chewRope", "chewRope2", "chewBone", "chewBone2", "rollBall", "rollBall2"]);
	}

	if (between(T.childTotalDays, 0, 100)) {
		if (Time.dayState === "night") {
			activity = activity.concat(["sleepingWithWolf", "sleepingWithWolf", "sleepingWithWolf", "sleeping"]);
		} else {
			activity = activity.concat([
				"sleepingWithWolf",
				"sleeping",
				"sleeping",
				"sleeping",
				"crying",
				"playing",
				"watchingCurious",
				"watchingLonging",
				"staringOutside",
				"hungryWolf",
				"grumpyWolf",
				"gnawing",
			]);
		}
	} else if (between(T.childTotalDays, 100, 200)) {
		if (Time.dayState === "night") {
			activity = activity.concat(["sleepingWithWolf", "sleepingWithWolf", "sleepingWithWolf", "sleeping"]);
		} else {
			activity = activity.concat([
				"sleepingWithWolf",
				"sleeping",
				"sleeping",
				"sleeping",
				"crying",
				"playing",
				"watchingCurious",
				"watchingLonging",
				"playFighting",
				"staringOutside",
				"staringOutside",
				"hungryWolf",
				"grumpyWolf",
				"gnawing",
			]);
		}
	}

	child.development.activity = activity.length ? activity[random(0, activity.length - 1)] : "noEvent";
	child.development.event = true;
}

function hawkChildActivity(childId) {
	const child = V.childRecords[childId];

	let activity = [];

	/* ToDo: Waiting on additional writing and sprites in order to fully implement crafted hawk toys
	const toySets = gatherToySets();
	if (toySets.includes("hawk toys")) activity = activity.concat(["preeningToy", "swing"]);
	*/
	if (between(T.childTotalDays, 0, 100)) {
		if (Time.dayState === "night" && V.bird.state === "home" && ["sleep", "rest", "brood"].includes(V.bird.activity)) {
			activity = activity.concat(["sleepingWithGreatHawk", "sleepingWithGreatHawk", "sleepingWithGreatHawk", "sleeping"]);
		} else {
			activity = activity.concat(["sleeping", "sleeping", "sleeping", "crying", "reaching", "flap", "flap", "perch", "bathe"]);
		}
	} else if (between(T.childTotalDays, 100, 200)) {
		if (Time.dayState === "night" && V.bird.state === "home" && ["sleep", "rest", "brood"].includes(V.bird.activity)) {
			activity = activity.concat(["sleepingWithGreatHawk", "sleepingWithGreatHawk", "sleepingWithGreatHawk", "sleeping"]);
		} else {
			activity = activity.concat(["sleeping", "sleeping", "crying", "reaching", "flap", "perch", "batheSelf"]);
		}
	}
	if (T.childTotalDays >= 14) {
		activity.push("preen");
	}

	child.development.activity = activity.length ? activity[random(0, activity.length - 1)] : "noEvent";
	child.development.event = true;
}
