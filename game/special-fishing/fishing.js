/* global wardrobeContainsItem */
/* global generateClothingItem */
/**
 * Rolls the size of the input fish at the input location
 *
 * @param {string} bus
 * @param {string} fishKey
 * @returns {number}
 */
function rollFishSize(bus, fishKey) {
	const fishConfig = setup.fishing.lootTables.fish[fishKey];
	let preferredMatchCount = 0;

	if (fishConfig.preferredLocation.includes(bus)) {
		preferredMatchCount++;
	}

	if (Time.isBloodMoon()) {
		preferredMatchCount++;
	}

	if (fishConfig.preferredSeason.includes(Time.season)) {
		preferredMatchCount++;
	}

	const slope = Math.clamp(preferredMatchCount, 0, 2) - 1;
	const rand = State.random();
	const sizeRoll = slope === 0 ? rand : (slope / 2 - 1 + Math.sqrt((1 - slope / 2) ** 2 + 2 * slope * rand)) / slope;
	const size = lerp(sizeRoll, fishConfig.minSize, fishConfig.maxSize);

	// Rounds 98%+ sized to 100% so people don't get fish that are super super close to max size, but aren't the max size.
	if (size >= fishConfig.minSize + 0.98 * (fishConfig.maxSize - fishConfig.minSize)) {
		return fishConfig.maxSize;
	}
	return size;
}

/**
 * Used to weight the likelihood of catching fish relative to other fish
 *
 * Without bait of any sort, you are more likely to catch baitfish than other fish.
 * With foodstuff bait that isn't baitfish, you are less likely to catch baitfish and more likely to catch normal fish.
 * While using baitfish as bait, you are able to catch Bass (saltwater), Pike (freshwater) and Eel (moor), which require those baitfish to catch.
 *
 * Does not effect the odds of the catch event.
 *
 * @param {string} fishKey
 * @returns {number}
 */
function fishingBaitWeightMultiplier(fishKey) {
	const bait = V.fishing.currentBait;
	const fishInfo = setup.fishing.lootTables.fish[fishKey];

	if (!bait) {
		if (fishInfo.requiresBaitFish) {
			return 0;
		} else if (fishInfo.isBaitFish) {
			return 0.7;
		} else {
			return 0.3;
		}
	} else if (bait === "bait_worm") {
		if (fishInfo.requiresBaitFish) {
			return 0;
		} else if (fishInfo.isBaitFish) {
			return 0.7;
		} else {
			return 0.3;
		}
	} else if (bait === "baitfish") {
		if (fishInfo.requiresBaitFish) {
			return 0.75;
		} else if (fishInfo.isBaitFish) {
			return 0.05;
		} else {
			return 0.5;
		}
	} else {
		// Other foodstuff bait

		if (fishInfo.requiresBaitFish) {
			return 0.05;
		} else if (fishInfo.isBaitFish) {
			return 0.25;
		} else {
			return 0.7;
		}
	}
}
window.fishingBaitWeightMultiplier = fishingBaitWeightMultiplier;

/**
 * Used to modify the weight of rolling a specific fish based on the current bait. Does not effect the odds of the catch event.
 *
 * @param {string} fishKey
 * @returns {number}
 */
function fishingPreferredBaitWeight(fishKey) {
	const bait = V.fishing.currentBait;
	const fish = setup.fishing.lootTables.fish[fishKey];
	return fish.preferredBait === bait ? 1.5 : 1;
}
window.fishingPreferredBaitWeight = fishingPreferredBaitWeight;

/**
 * Used to modify the weight of rolling a catch event based on the current bait type (no bait, bait_worm, baitfish or other foodstuff)
 *
 * @returns {number}
 */
function fishingCatchWeightBaitMultiplier() {
	const bait = V.fishing.currentBait;
	if (!bait) {
		return 0.2;
	} else if (bait === "bait_worm") {
		return 0.5;
	} else if (bait === "baitfish") {
		return 1;
	} else {
		// Other foodstuff bait
		return 1;
	}
}
window.fishingCatchWeightBaitMultiplier = fishingCatchWeightBaitMultiplier;

/**
 * Used to scale the likelihood of catching a fish. x1.5 when teeming, x0.7 when quiet, 1 otherwise.
 *
 * @param bus
 * @returns {number}
 */
function fishingCatchWeightPopulationMultiplier(bus) {
	const population = V.daily.fishing[bus]?.fishPopulation;
	if (population === "teeming") {
		return 1.5;
	} else if (population === "quiet") {
		return 0.7;
	} else {
		return 1;
	}
}
window.fishingCatchWeightPopulationMultiplier = fishingCatchWeightPopulationMultiplier;

/**
 * Rolls how populated the location is today, if it hasn't been rolled already.
 *
 * If the player is new to fishing, we don't want to add another thing to think about, nor have their fist fishing experience be one with few fish, so we default the population to "normal" if the user is new to fishing.
 *
 * @param {string} location
 */
function rollFishPopulation(location) {
	V.daily.fishing ??= {};
	V.daily.fishing[location] ??= {};
	if (numberOfFishCaught() <= 5) {
		V.daily.fishing[location].fishPopulation ??= "normal";
	} else {
		const roll = random(1, 100);
		if (roll <= 10) {
			V.daily.fishing[location].fishPopulation ??= "teeming";
		} else if (roll <= 30) {
			V.daily.fishing[location].fishPopulation ??= "quiet";
		} else {
			V.daily.fishing[location].fishPopulation ??= "normal";
		}
	}
}
window.rollFishPopulation = rollFishPopulation;

/**
 * Rolls a fish for a given location, taking into account everything that contributes to the weights of the different fish, and generates the the size of the fish that gets rolled.
 *
 * @param {string} bus
 * @returns {{type: string, size: number}}
 */
function rollFish(bus) {
	const possibleFish = [];
	for (const [fishKey, fishConfig] of Object.entries(setup.fishing.lootTables.fish)) {
		const locationWeight = fishConfig.locations[bus];
		if (locationWeight > 0) {
			const weatherMultiplier = fishConfig.preferredWeather.includes(Weather.name) ? 2 : 0.5;
			const baitTypeMultiplier = fishingBaitWeightMultiplier(fishKey);
			const preferredBaitMultiplier = fishingPreferredBaitWeight(fishKey);

			possibleFish.push([fishKey, locationWeight * weatherMultiplier * baitTypeMultiplier * preferredBaitMultiplier]);
		}
	}
	const fishKey = weightedRandom(...possibleFish);
	const size = Math.ceil(rollFishSize(bus, fishKey));
	return {
		type: fishKey,
		size,
	};
}
window.rollFish = rollFish;

/**
 * Returns the fish currently more active at the location than normal, so they can be shown breaking the surface as a wait ambient.
 *
 * @param {string} location
 * @returns {Array}
 */
function fishingSurfacingFish(location) {
	return Object.entries(setup.fishing.lootTables.fish)
		.filter(([, fishConfig]) => fishConfig.locations[location] > 0 && fishConfig.preferredWeather.includes(Weather.name))
		.map(([fishKey]) => fishKey);
}
window.fishingSurfacingFish = fishingSurfacingFish;

/**
 * If a fish you just hooked should be caught with the minigame.
 *
 * @param {object} fish
 * @returns {boolean}
 */
function fishTriggersMinigame(fish) {
	const fishConfig = setup.fishing.lootTables.fish[fish.type];
	if (fishConfig.requiresBaitFish) {
		return true;
	}

	if (!fishConfig.minigame) {
		return false;
	}

	return fish.size >= 35;
}
window.fishTriggersMinigame = fishTriggersMinigame;

/**
 * Shared helper to roll an item from one of the fishing loot tables
 *
 * @param {object} lootTable
 * @param {string} bus
 * @returns {string}
 */
function rollFishingLootKey(lootTable, bus) {
	const options = [];
	for (const [lootKey, loot] of Object.entries(lootTable)) {
		if (loot.locations && !loot.locations.includes(bus)) {
			continue;
		}
		options.push([lootKey, loot.weight]);
	}
	return weightedRandom(...options);
}
window.rollFishingLootKey = rollFishingLootKey;

/**
 * Checks if the antique is available.
 * todo: move this to a shared location and implement it globally
 *
 * @param {string} antiqueKey
 * @returns {boolean}
 */
function fishingAntiqueAvailable(antiqueKey) {
	const status = V.museumAntiques?.antiques?.[antiqueKey];
	return !status || status === "notFound";
}
window.fishingAntiqueAvailable = fishingAntiqueAvailable;

/**
 * Rolls for a piece of trash that the player has caught at the given location
 *
 * @param {string} bus
 * @returns {string}
 */
function rollFishingTrash(bus) {
	return rollFishingLootKey(setup.fishing.lootTables.fishingTrash, bus);
}
window.rollFishingTrash = rollFishingTrash;

/**
 * Rolls for a piece of clothing that the player has caught at the given location
 *
 * @param {string} bus
 * @returns {{slot: string, item: object, colour: string}}
 */
function rollFishingClothing(bus) {
	return generateClothingItem(rollFishingLootKey(setup.fishing.lootTables.fishingClothing, bus));
}
window.rollFishingClothing = rollFishingClothing;

/**
 * Updates the fishing record with the fish passed in
 *
 * @param {string} fishKey
 * @param {number} fishSize
 * @param {string} bus
 */
function updateFishRecord(fishKey, fishSize, bus) {
	V.fishing.record[fishKey] ??= {
		numCaught: 0,
		largest: fishSize,
		foundIn: [],
	};

	V.fishing.waitsSinceLastCatch = 0;

	const fishRecord = V.fishing.record[fishKey];
	fishRecord.numCaught += 1;
	fishRecord.largest = Math.max(fishRecord.largest, fishSize);
	if (!fishRecord.foundIn.includes(bus)) {
		fishRecord.foundIn.push(bus);
	}

	if (fishKey === "bass" && fishRecord.numCaught === 1) {
		Wikifier.wikifyEval('<<earnFeat "Nice Bass">>');
	}
}
window.updateFishRecord = updateFishRecord;

/**
 * The number of fish the player has caught in all time
 *
 * @returns {number}
 */
function numberOfFishCaught() {
	return Object.values(V.fishing.record).reduce((sum, r) => sum + r.numCaught, 0);
}
window.numberOfFishCaught = numberOfFishCaught;

/**
 * Whether the player has a fishing rod in hand or stored in a wardrobe
 *
 * @returns {boolean}
 */
function playerOwnsFishingRod() {
	return V.worn.handheld.type.includes("fishing_rod") || wardrobeContainsItem("fishing rod");
}
window.playerOwnsFishingRod = playerOwnsFishingRod;

/**
 * @returns {boolean}
 */
function baitShopOpen() {
	return Time.hour >= 6 && Time.hour < 19;
}
window.baitShopOpen = baitShopOpen;

/**
 * Picks a random fish the bait shop npc can request
 *
 * @returns {string}
 */
function baitShopRequestFish() {
	let allowedBehaviors = [];
	let includeEel = false;

	if (numberOfFishCaught() <= 5) {
		allowedBehaviors = ["runner"];
	} else if (numberOfFishCaught() <= 10) {
		allowedBehaviors = ["runner", "darter"];
	} else if (numberOfFishCaught() <= 15) {
		allowedBehaviors = ["runner", "darter", "panicked"];
	} else {
		allowedBehaviors = ["runner", "darter", "panicked", "anchor", "thrasher", "slipper"];
		includeEel = true;
	}

	const eligible = Object.keys(setup.fishing.lootTables.fish).filter(type => {
		const fish = setup.fishing.lootTables.fish[type];
		const isCookableOrEel = fish.cookable === true || (includeEel && type === "eel");
		const hasAllowedBehavior = fish.minigame && allowedBehaviors.includes(fish.minigame.behavior);
		return isCookableOrEel && hasAllowedBehavior;
	});
	return eligible.random();
}
window.baitShopRequestFish = baitShopRequestFish;

/**
 * Rolls if the bait shop is going to request for a fish today.
 */
function rollIfBaitShopRequestsFishToday() {
	V.daily.fishing ??= {};
	if (V.daily.fishing.baitShopRequest !== undefined) return;

	if (random(1, 100) <= 70 + V.fishing.baitShopRequestsCompleted) {
		V.daily.fishing.baitShopRequest = "willRequest";
	} else {
		V.daily.fishing.baitShopRequest = "notToday";
	}
}
window.rollIfBaitShopRequestsFishToday = rollIfBaitShopRequestsFishToday;

/**
 * If the fish is the fish being requested
 *
 * @param {string} fishType
 * @returns {boolean}
 */
function baitShopWants(fishType) {
	return V.daily.fishing?.baitShopRequest === "requested" && V.daily.fishing?.baitShopRequestFish === fishType && baitShopOpen();
}
window.baitShopWants = baitShopWants;

/**
 * If the fish can be cooked
 *
 * @param {string} fishKey
 * @returns {boolean}
 */
function canCookFish(fishKey) {
	return setup.fishing.lootTables.fish[fishKey].cookable;
}
window.canCookFish = canCookFish;

/**
 * If the player can start fishing
 *
 * @returns {boolean}
 */
function canStartFishing() {
	return V.debug === 1 || (!pcAreArmsBound("any") && V.worn.handheld.type.includes("fishing_rod"));
}
window.canStartFishing = canStartFishing;

function debugDiscoverAllFishing() {
	V.fishing.locationsFound = ["fishingPier", "fishingBeach", "fishingCoastPath", "fishingForestLake", "fishingMoor"];
	V.daily.fishing ??= {};

	for (const [fishKey, fishConfig] of Object.entries(setup.fishing.lootTables.fish)) {
		const busValues = V.fishing.locationsFound.filter(loc => fishConfig.locations[loc] > 0);
		if (random(1, 2) === 1) {
			updateFishRecord(fishKey, Math.ceil((fishConfig.minSize + fishConfig.maxSize) / 2), busValues[0]);
		} else {
			updateFishRecord(fishKey, fishConfig.minSize, busValues[0]);
			updateFishRecord(fishKey, fishConfig.maxSize, busValues[0]);
		}
		V.fishing.record[fishKey].foundIn = busValues;
	}
}
window.debugDiscoverAllFishing = debugDiscoverAllFishing;

function resetFishingCatchState() {
	delete V.fishingHookedFish;
	delete V.fishingTrash;
}
window.resetFishingCatchState = resetFishingCatchState;

function initFishingBeach() {
	V.bus = "fishingBeach";
	V.daily.fishing ??= {};
	V.daily.fishing.trashCaught ??= 0;
	V.daily.fishing.fishingBeach ??= {};
	V.daily.fishing.fishingBeach.sessionStartTime ??= Time.date.timeStamp;
	V.daily.fishing.fishingBeach.fisher ??= {};
	V.daily.fishing.fishingBeach.fisher.age ??= 0;
	V.daily.fishing.fishingBeach.fisher.drunk ??= 0;
	V.daily.fishing.fishingBeach.fisherOgle ??= 1;
	resetFishingCatchState();
}
window.initFishingBeach = initFishingBeach;

function initFishingCoastPath() {
	V.bus = "fishingCoastPath";
	V.daily.fishing ??= {};
	V.daily.fishing.trashCaught ??= 0;
	V.daily.fishing.fishingCoastPath ??= {};
	V.daily.fishing.fishingCoastPath.sessionStartTime ??= Time.date.timeStamp;
	resetFishingCatchState();
}
window.initFishingCoastPath = initFishingCoastPath;

function initFishingForestLake() {
	V.bus = "fishingForestLake";
	V.fishing.fishingForestLake ??= {};
	V.fishing.fishingForestLake.event ??= "none";
	V.fishing.fishingForestLake.eventDanger ??= 0;
	V.daily.fishing ??= {};
	V.daily.fishing.trashCaught ??= 0;
	V.daily.fishing.fishingForestLake ??= {};
	V.daily.fishing.fishingForestLake.sessionStartTime ??= Time.date.timeStamp;
	resetFishingCatchState();
}
window.initFishingForestLake = initFishingForestLake;

function initFishingMoor() {
	V.bus = "fishingMoor";
	V.fishing.fishingMoor ??= {};
	V.fishing.fishingMoor.event ??= "none";
	V.fishing.fishingMoor.eventDanger ??= 0;
	V.daily.fishing ??= {};
	V.daily.fishing.trashCaught ??= 0;
	V.daily.fishing.fishingMoor ??= {};
	V.daily.fishing.fishingMoor.sessionStartTime ??= Time.date.timeStamp;
	V.daily.fishing.fishingMoor.fox ??= {};
	V.daily.fishing.fishingMoor.fox.closeness ??= 0;
	V.daily.fishing.fishingMoor.hikers ??= {};
	V.daily.fishing.fishingMoor.hikers.drinkCount ??= 0;
	if (V.moor_hunt >= 1) {
		V.fishing.fishingMoor.event = "none";
		V.fishing.fishingMoor.eventDanger = 0;
		if (["sit", "campfire"].includes(V.daily.fishing.fishingMoor.hikers.phase)) {
			V.daily.fishing.fishingMoor.hikers.phase = "finished";
			wikifier("clearNPC", "moor_hiker_1");
			wikifier("clearNPC", "moor_hiker_2");
		}
	}
	resetFishingCatchState();
}
window.initFishingMoor = initFishingMoor;

function initFishingPier() {
	V.bus = "fishingPier";
	V.fishing.whitney ??= {};
	V.daily.fishing ??= {};
	V.daily.fishing.trashCaught ??= 0;
	V.daily.fishing.fishingPier ??= {};
	V.daily.fishing.fishingPier.sessionStartTime ??= Time.date.timeStamp;
	V.daily.fishing.fishingPier.fisher ??= {};
	V.daily.fishing.fishingPier.fisher.age ??= 0;
	V.daily.fishing.fishingPier.fisher.drunk ??= 0;
	V.daily.fishing.fishingPier.fisherOgle ??= 1;
	V.daily.fishing.fishingPier.whitney ??= {};
	V.daily.fishing.fishingPier.whitney.age ??= 0;
	V.daily.fishing.fishingPier.whitney.pcCider ??= 0;
	V.daily.fishing.fishingPier.whitney.pcCiderTotal ??= 0;
	resetFishingCatchState();
}
window.initFishingPier = initFishingPier;

/**
 * If the player is fishing alone with no other NPCs around
 *
 * @returns {boolean}
 */
function isPlayerFishingAlone() {
	switch (V.bus) {
		case "fishingBeach":
			return [undefined, "finished"].includes(V.daily?.fishing?.fishingBeach?.fisher?.phase);
		case "fishingPier":
			return (
				[undefined, "finished"].includes(V.daily?.fishing?.fishingPier?.fisher?.phase) &&
				[undefined, "finished"].includes(V.daily?.fishing?.fishingPier?.whitney?.phase)
			);
		case "fishingMoor":
			return (
				[undefined, "finished"].includes(V.daily?.fishing?.fishingMoor?.hikers?.phase) &&
				[undefined, "finished"].includes(V.daily?.fishing?.fishingMoor?.fox?.phase)
			);
		case "fishingCoastPath":
			return true;
		case "fishingForestLake":
			return true;
		default:
			throw new Error(`isPlayerFishingAlone: unknown bus "${V.bus}"`);
	}
}
window.isPlayerFishingAlone = isPlayerFishingAlone;

function openBaitOverlay() {
	if (["fishingPier", "fishingBeach", "fishingCoastPath", "fishingForestLake", "fishingMoor"].includes(V.bus) && !T.fishingEditBaitEnabled) return;
	V.fishing.displayBaitNotification = false;
	wikifier("overlayReplace", '"bait"');
}
window.openBaitOverlay = openBaitOverlay;

/**
 * Handles changing the selected bait from the bait dropdown <<baitMobileDropdown>>
 *
 * @param {string} newBait a foodstuff key or "none"
 */
function fishingChangeBaitFromDropdown(newBait) {
	const chosen = newBait === "none" ? undefined : newBait;
	const current = V.fishing.currentBait;
	if (current === chosen) return;

	if (chosen && !(V.foodstuff[chosen]?.amount >= 1)) return;

	if (current) V.foodstuff[current].amount += 1;
	if (!chosen) {
		delete V.fishing.currentBait;
	} else {
		V.foodstuff[chosen].amount -= 1;
		V.fishing.currentBait = chosen;
	}
}
window.fishingChangeBaitFromDropdown = fishingChangeBaitFromDropdown;

function onBaitLoss() {
	const bait = V.fishing.currentBait;
	delete V.fishing.currentBait;
	if (V.fishing.autoRebait && bait && V.foodstuff[bait]?.amount >= 1) {
		V.foodstuff[bait].amount -= 1;
		V.fishing.currentBait = bait;
	}
}
window.onBaitLoss = onBaitLoss;

/**
 * If the player can eat the fish as a cat, fox, or bird tf
 *
 * @param {object} fish
 * @returns {boolean}
 */
function canEatFishTf(fish) {
	return (V.cat >= 3 || V.fox >= 3 || V.harpy >= 3) && fish.size <= 20;
}
window.canEatFishTf = canEatFishTf;

/**
 * Returns which animal tf (cat, fox, or bird) is highest.
 *
 * @returns {"cat"|"fox"|"bird"}
 */
function highestFishEatingTf() {
	return [
		["cat", V.catbuild],
		["bird", V.birdbuild],
		["fox", V.foxbuild],
	].reduce((max, current) => (current[1] > max[1] ? current : max))[0];
}
window.highestFishEatingTf = highestFishEatingTf;

/**
 * Records the current in-game time as the arrival of a fishing event NPC so some of their interactions can be gated until some time has elapsed.
 */
function fishingRecordNpcArrivalTime() {
	V.daily.fishing.eventArrivalTime = Time.date.timeStamp;
}
window.fishingRecordNpcArrivalTime = fishingRecordNpcArrivalTime;

/**
 * If it's been X minutes since the last fishing event NPC arrived.
 *
 * @param {number} minutes
 * @returns {boolean}
 */
function fishingHasMinutesPassedSinceNpcArrival(minutes) {
	const arrival = V.daily.fishing.eventArrivalTime;
	if (arrival === undefined) return false;
	return Time.date.timeStamp - arrival >= minutes * 60;
}
window.fishingHasMinutesPassedSinceNpcArrival = fishingHasMinutesPassedSinceNpcArrival;

/**
 * If it's been X minutes since the player first started fishing today.
 *
 * @param {number} minutes
 * @returns {boolean}
 */
function fishingMinutesIntoSession(minutes) {
	const start = V.daily.fishing[V.bus]?.sessionStartTime;
	return Time.date.timeStamp - start >= minutes * 60;
}
window.fishingMinutesIntoSession = fishingMinutesIntoSession;

/**
 * @param {string} bus
 * @returns {string}
 */
function fishingLocationWaterBodyName(bus) {
	switch (bus) {
		case "fishingPier":
		case "fishingBeach":
		case "fishingCoastPath":
			return "sea";
		case "fishingForestLake":
			return "lake";
		case "fishingMoor":
			return "water";
		default:
			throw new Error(`fishingLocationWaterBodyName: unknown bus "${bus}"`);
	}
}
window.fishingLocationWaterBodyName = fishingLocationWaterBodyName;

/**
 * Used to scale the likelihood of dangerous fishing events. x1 at allure <2000 (arbitrary), x2 at 8000 allure.
 * Ramps from x0 at fishing session start to x1 at 30 minutes, and from x0 to x1 as the PC catches their first 10 fish, as a pity system for new fishers and a guard against bad things immediately happening when you start fishing.
 *
 * @param {number} defaultEventWeight
 * @returns {number}
 */
function fishingDangerEventWeight(defaultEventWeight) {
	const allureMultiplier = Math.clamp(1 + (V.allure - 2000) / 6000, 1, 2);
	const newFisherPityMultiplier = Math.clamp(numberOfFishCaught() / 10, 0, 1);
	const sessionStartPityMultiplier = Math.clamp((Time.date.timeStamp - V.daily.fishing[V.bus].sessionStartTime) / (60 * 30), 0, 1);

	return defaultEventWeight * allureMultiplier * sessionStartPityMultiplier * newFisherPityMultiplier;
}
window.fishingDangerEventWeight = fishingDangerEventWeight;

/**
 * Gets the weight of the catch fish event for this location. If the player hasn't caught many fish yet, we want to have them be more likely to see the fish catch event than other events.
 *
 * @param {string} bus
 * @param {number} defaultEventWeight
 * @returns {number}
 */
function fishingCatchEventWeight(bus, defaultEventWeight) {
	const fishingIntroMultiplier = numberOfFishCaught() <= 5 ? 3 : 1;

	const pity = V.fishing.waitsSinceLastCatch;
	const pityMultiplier = pity > 6 ? Math.min(2, 1 + (pity - 6) * 0.17) : 1;

	return defaultEventWeight * fishingCatchWeightPopulationMultiplier(bus) * fishingCatchWeightBaitMultiplier() * fishingIntroMultiplier * pityMultiplier;
}
window.fishingCatchEventWeight = fishingCatchEventWeight;

/**
 * @param {string} bus
 * @returns {string}
 */
function fishingLocationDisplayName(bus) {
	switch (bus) {
		case "fishingBeach":
			return "Beach";
		case "fishingPier":
			return "Pier";
		case "fishingCoastPath":
			return "Coastal Path";
		case "fishingForestLake":
			return "Forest Lake";
		case "fishingMoor":
			return "Moor";
		default:
			throw new Error(`fishingLocationDisplayName: unknown bus "${bus}"`);
	}
}
window.fishingLocationDisplayName = fishingLocationDisplayName;
