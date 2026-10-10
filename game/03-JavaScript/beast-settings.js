/**
 * Animal means animals. Monster means monster people. Beast means either.
 */

/**
 * Returns the settings for a creature type.
 *
 * @param {BeastSettingType} type
 * @returns {BeastTypeSettings}
 */
function beastSettingsFor(type) {
	const settings = V.settings.beastSettings[type];
	if (settings === undefined) throw new Error(`beastSettingsFor: no beast settings for type "${type}"`);
	return settings;
}

/**
 * The chance a creature of this type is a monster person.
 *
 * @param {BeastSettingType} type
 * @returns {number} 0-100.
 */
function monsterChanceForType(type) {
	return beastSettingsFor(type).monsterChance;
}
window.monsterChanceForType = monsterChanceForType;

/**
 * Whether monster people of this type only appear while hallucinating.
 *
 * @param {BeastSettingType} type
 * @returns {boolean}
 */
function monsterHallucinationsOnlyForType(type) {
	return beastSettingsFor(type).hallucinationsOnly;
}
window.monsterHallucinationsOnlyForType = monsterHallucinationsOnlyForType;

/**
 * Whether victims of this type always generate as monster people.
 *
 * @param {BeastSettingType} type
 * @returns {boolean}
 */
function victimsAlwaysMonsterForType(type) {
	return beastSettingsFor(type).victimsAlwaysMonster;
}
window.victimsAlwaysMonsterForType = victimsAlwaysMonsterForType;

/**
 * The chance that a beast of this type is male.
 *
 * @param {BeastSettingType} type
 * @param {string} towardAppearanceOf
 * @returns {number} 0-100.
 */
function beastMaleChanceForType(type, towardAppearanceOf = V.player.gender_appearance) {
	const settings = beastSettingsFor(type);
	if (!settings.maleChanceSplit) return settings.maleChance;
	if (towardAppearanceOf === "m") return settings.maleChanceMale;
	if (towardAppearanceOf === "f") return settings.maleChanceFemale;
	return 50;
}
window.beastMaleChanceForType = beastMaleChanceForType;

/**
 * Whether bestiality is allowed with real animals of this type.
 *
 * @param {BeastSettingType} type
 * @returns {boolean}
 */
function animalSexEnabledForType(type) {
	return beastSettingsFor(type).bestiality === "on";
}
window.animalSexEnabledForType = animalSexEnabledForType;

/**
 * Whether bestiality is allowed with monster people of this type.
 *
 * @param {BeastSettingType} type
 * @returns {boolean}
 */
function monsterSexEnabledForType(type) {
	return beastSettingsFor(type).bestiality !== "off";
}
window.monsterSexEnabledForType = monsterSexEnabledForType;

/**
 * Whether bestiality is allowed for with monsters or animals of this type, or if the creature has already been generated as a monster.
 *
 *
 * @param {BeastSettingType} type
 * @param {boolean} beastAlreadyGeneratedAsMonster Optional
 * @returns {boolean}
 */
function beastSexEnabledForType(type, beastAlreadyGeneratedAsMonster) {
	if (beastAlreadyGeneratedAsMonster === undefined) {
		return animalSexEnabledForType(type) || (monsterSexEnabledForType(type) && monsterCanAppearForType(type));
	} else {
		return beastAlreadyGeneratedAsMonster ? monsterSexEnabledForType(type) : animalSexEnabledForType(type);
	}
}
window.beastSexEnabledForType = beastSexEnabledForType;

/**
 * Whether bestiality content is allowed with real animals of at least one type.
 *
 * @returns {boolean}
 */
function isBestialityOnForAnyCreature() {
	return C.beastSettingTypes.some(animalSexEnabledForType);
}
window.isBestialityOnForAnyCreature = isBestialityOnForAnyCreature;

/**
 * Whether a monster person of this type can appear right now. Decides appearance, not for use as a bestiality gate.
 *
 * NOTE: Anywhere that this is used is ignoring the monster person chance slider, or treating it as a toggle rather than a slider. Though without storing the first roll / pregenerating the beast, fixing this "bug" could cause odd flickering of the creature type in passages. It is used to guard the same kind of content as `as monsterChanceForType(X) gte random(1, 100) and ($hallucinations gte 1 or !monsterHallucinationsOnlyForType(X))`, but that code respects the slider.
 *
 * @param {BeastSettingType} type
 * @returns {boolean}
 */
function monsterCanAppearForType(type) {
	return monsterChanceForType(type) >= 1 && (V.hallucinations >= 1 || !monsterHallucinationsOnlyForType(type));
}
window.monsterCanAppearForType = monsterCanAppearForType;

/**
 * Whether this creature's semen counts as human. Monster people do, real animals do not.
 *
 * @param {CharacterTypes} type The NPC's type, not a beast settings type.
 * @returns {boolean}
 */
function semenCountsAsHuman(type) {
	return ["human", "boy", "girl", "harpy", "centaur", "man", "woman"].some(word => type.includes(word));
}
window.semenCountsAsHuman = semenCountsAsHuman;

/**
 * Whether this named beast is a monster person today.
 *
 * @param {NamedBeastType} beast
 * @returns {boolean}
 */
function resolveIfNamedBeastIsMonster(beast) {
	if (V.settings.namedBeasts[beast].monsterChance === 0) return false;
	if (V.settings.namedBeasts[beast].monsterChance === 100) return true;
	const rollMonster = () => V.settings.namedBeasts[beast].monsterChance >= random(1, 100);
	switch (beast) {
		case "blackwolf":
			V.daily.bwMonsterRoll ??= rollMonster();
			return V.daily.bwMonsterRoll && (V.hallucinations >= 1 || !V.settings.namedBeasts[beast].hallucinationsOnly);
		case "greathawk":
			V.daily.ghMonsterRoll ??= rollMonster();
			return V.daily.ghMonsterRoll && (V.hallucinations >= 1 || !V.settings.namedBeasts[beast].hallucinationsOnly);
		case "nightmonster":
			V.daily.nmMonsterRoll ??= rollMonster();
			return V.daily.nmMonsterRoll && (V.hallucinations >= 1 || !V.settings.namedBeasts[beast].hallucinationsOnly);
		default:
			throw new Error(`resolveIfNamedBeastIsMonster: unknown named beast "${beast}"`);
	}
}
window.resolveIfNamedBeastIsMonster = resolveIfNamedBeastIsMonster;

/**
 * Save Migration
 *
 * Builds $settings.namedBeasts from each named beast's pre-granular settings.
 */
function migrateNamedBeastSettings() {
	V.settings.namedBeasts = {};

	if (V.blackwolfmonster === 2 || !V.settings.bestialityEnabled) {
		V.settings.namedBeasts.blackwolf = {
			monsterChance: 100,
			hallucinationsOnly: false,
		};
	} else if (V.blackwolfmonster === 0) {
		V.settings.namedBeasts.blackwolf = {
			monsterChance: 0,
			hallucinationsOnly: true,
		};
	} else {
		V.settings.namedBeasts.blackwolf = {
			monsterChance: V.settings.monsterChance,
			hallucinationsOnly: V.settings.monsterHallucinationsOnly,
		};
	}

	if (V.greathawkmonster === 2 || !V.settings.bestialityEnabled) {
		V.settings.namedBeasts.greathawk = {
			monsterChance: 100,
			hallucinationsOnly: false,
		};
	} else if (V.greathawkmonster === 0) {
		V.settings.namedBeasts.greathawk = {
			monsterChance: 0,
			hallucinationsOnly: true,
		};
	} else {
		V.settings.namedBeasts.greathawk = {
			monsterChance: V.settings.monsterChance,
			hallucinationsOnly: V.settings.monsterHallucinationsOnly,
		};
	}

	if (V.nightmonstermonster === 2 || !V.settings.bestialityEnabled) {
		V.settings.namedBeasts.nightmonster = {
			monsterChance: 100,
			hallucinationsOnly: false,
		};
	} else if (V.nightmonstermonster === 0) {
		V.settings.namedBeasts.nightmonster = {
			monsterChance: 0,
			hallucinationsOnly: true,
		};
	} else {
		V.settings.namedBeasts.nightmonster = {
			monsterChance: V.settings.monsterChance,
			hallucinationsOnly: V.settings.monsterHallucinationsOnly,
		};
	}
}
window.migrateNamedBeastSettings = migrateNamedBeastSettings;

/**
 * Save Migration
 */
function migrateBeastSettings() {
	const bestiality = V.settings.bestialityEnabled ? "on" : V.settings.monsterChance > 0 ? "monsterOnly" : "off";
	V.settings.beastSettings = {};
	C.beastSettingTypes.forEach(beastType => {
		V.settings.beastSettings[beastType] = {
			monsterChance: V.settings.monsterChance,
			hallucinationsOnly: V.settings.monsterHallucinationsOnly,
			maleChance: V.settings.beastMaleChance,
			maleChanceMale: V.settings.beastMaleChanceMale,
			maleChanceFemale: V.settings.beastMaleChanceFemale,
			maleChanceSplit: V.settings.beastMaleChanceSplit,
			bestiality,
			victimsAlwaysMonster: false,
		};
	});
	V.genericBeastSettings = {
		beastMaleChance: V.settings.beastMaleChance,
		beastMaleChanceMale: V.settings.beastMaleChanceMale,
		beastMaleChanceFemale: V.settings.beastMaleChanceFemale,
		beastMaleChanceSplit: V.settings.beastMaleChanceSplit,
		monsterHallucinationsOnly: V.settings.monsterHallucinationsOnly,
		monsterChance: V.settings.monsterChance,
		bestiality,
		victimsAlwaysMonster: false,
	};
}
window.migrateBeastSettings = migrateBeastSettings;
