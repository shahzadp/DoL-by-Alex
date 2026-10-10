/* globals isBestialityOnForAnyCreature, getActivePregnancies */

const monsterPresets = {
	monstersAll: { monsterChance: 100, hallucinationsOnly: false, namedMonsterChance: 100, namedHallucinationsOnly: false },
	monstersDefault: { monsterChance: 50, hallucinationsOnly: true, namedMonsterChance: 50, namedHallucinationsOnly: true },
	monstersNone: { monsterChance: 0, hallucinationsOnly: false, namedMonsterChance: 0, namedHallucinationsOnly: true },
};

/**
 * Applies a monster people preset to every creature type. Both the normal beast settings and named beast settings..
 *
 * @param {"monstersAll" | "monstersDefault" | "monstersNone"} presetName
 */
function applyMonstersPreset(presetName) {
	const preset = monsterPresets[presetName];
	if (!preset) return;
	V.genericBeastSettings.monsterChance = preset.monsterChance;
	V.genericBeastSettings.monsterHallucinationsOnly = preset.hallucinationsOnly;
	setAllBeastsMonsterChance(preset.monsterChance);
	setAllBeastsMonsterHallucinationsOnly(preset.hallucinationsOnly);
	C.namedBeasts.forEach(beast => {
		V.settings.namedBeasts[beast].monsterChance = preset.namedMonsterChance;
		V.settings.namedBeasts[beast].hallucinationsOnly = preset.namedHallucinationsOnly;
	});
}
window.applyMonstersPreset = applyMonstersPreset;

const kinkPresets = {
	kinkDefault: {
		bestiality: "on",
		namedBeastsAlwaysMonsters: false,
		swarmsEnabled: true,
		slimesEnabled: true,
		voreEnabled: true,
		tentaclesEnabled: true,
		plantsEnabled: true,
		analEnabled: true,
		analDoubleEnabled: true,
		footFetishEnabled: true,
		analingusGivingEnabled: true,
		analingusReceivingEnabled: true,
		vaginalDoubleEnabled: true,
		transformAnimalEnabled: true,
		transformDivineEnabled: true,
		breastFeedingEnabled: true,
		parasitePregnancyEnabled: true,
		watersportsEnabled: false,
		facesitEnabled: true,
		spidersEnabled: true,
		bodyWritingLevel: 3,
		parasitesEnabled: true,
		slugsEnabled: true,
		waspsEnabled: true,
		lurkersEnabled: true,
		beesEnabled: true,
		pregnancySpeechEnabled: true,
		toyDildoEnabled: true,
		toyWhipEnabled: true,
		playerPregnancyHumanEnabled: true,
		playerPregnancyBeastEnabled: true,
		playerPregnancyEggLayingEnabled: true,
		hypnosisEnabled: true,
	},
	kinkVanilla: {
		bestiality: "off",
		namedBeastsAlwaysMonsters: true,
		swarmsEnabled: false,
		slimesEnabled: false,
		voreEnabled: false,
		tentaclesEnabled: false,
		plantsEnabled: false,
		analEnabled: true,
		analDoubleEnabled: false,
		footFetishEnabled: true,
		analingusGivingEnabled: true,
		analingusReceivingEnabled: true,
		vaginalDoubleEnabled: false,
		transformAnimalEnabled: true,
		transformDivineEnabled: true,
		breastFeedingEnabled: false,
		parasitePregnancyEnabled: false,
		watersportsEnabled: false,
		facesitEnabled: false,
		spidersEnabled: false,
		bodyWritingLevel: 2,
		parasitesEnabled: false,
		slugsEnabled: false,
		waspsEnabled: false,
		lurkersEnabled: false,
		beesEnabled: false,
		pregnancySpeechEnabled: true,
		toyDildoEnabled: true,
		toyWhipEnabled: true,
		playerPregnancyHumanEnabled: true,
		playerPregnancyBeastEnabled: false,
		playerPregnancyEggLayingEnabled: false,
		hypnosisEnabled: true,
	},
	kinkNoBeasts: {
		bestiality: "off",
		namedBeastsAlwaysMonsters: true,
		swarmsEnabled: false,
		slimesEnabled: true,
		voreEnabled: false,
		tentaclesEnabled: true,
		plantsEnabled: true,
		analEnabled: true,
		analDoubleEnabled: true,
		footFetishEnabled: true,
		analingusGivingEnabled: true,
		analingusReceivingEnabled: true,
		vaginalDoubleEnabled: true,
		transformAnimalEnabled: true,
		transformDivineEnabled: true,
		breastFeedingEnabled: true,
		parasitePregnancyEnabled: false,
		watersportsEnabled: false,
		facesitEnabled: true,
		spidersEnabled: false,
		bodyWritingLevel: 3,
		parasitesEnabled: false,
		slugsEnabled: false,
		waspsEnabled: false,
		lurkersEnabled: false,
		beesEnabled: false,
		pregnancySpeechEnabled: true,
		toyDildoEnabled: true,
		toyWhipEnabled: true,
		playerPregnancyHumanEnabled: true,
		playerPregnancyBeastEnabled: false,
		playerPregnancyEggLayingEnabled: false,
		hypnosisEnabled: true,
	},
	kinkEverything: {
		bestiality: "on",
		namedBeastsAlwaysMonsters: false,
		swarmsEnabled: true,
		slimesEnabled: true,
		voreEnabled: true,
		tentaclesEnabled: true,
		plantsEnabled: true,
		analEnabled: true,
		analDoubleEnabled: true,
		footFetishEnabled: true,
		analingusGivingEnabled: true,
		analingusReceivingEnabled: true,
		vaginalDoubleEnabled: true,
		transformAnimalEnabled: true,
		transformDivineEnabled: true,
		breastFeedingEnabled: true,
		parasitePregnancyEnabled: true,
		watersportsEnabled: true,
		facesitEnabled: true,
		spidersEnabled: true,
		bodyWritingLevel: 3,
		parasitesEnabled: true,
		slugsEnabled: true,
		waspsEnabled: true,
		lurkersEnabled: true,
		beesEnabled: true,
		pregnancySpeechEnabled: true,
		toyDildoEnabled: true,
		toyWhipEnabled: true,
		playerPregnancyHumanEnabled: true,
		playerPregnancyBeastEnabled: true,
		playerPregnancyEggLayingEnabled: true,
		hypnosisEnabled: true,
	},
};

/**
 * Applies a fetish preset
 *
 * @param {"kinkDefault" | "kinkVanilla" | "kinkNoBeasts" | "kinkEverything"} presetName
 */
function applyKinkPreset(presetName) {
	const preset = kinkPresets[presetName];
	if (!preset) return;

	V.genericBeastSettings.bestiality = preset.bestiality;
	setAllBeastsBestialityMode(preset.bestiality);
	if (preset.namedBeastsAlwaysMonsters) {
		C.namedBeasts.forEach(beast => {
			V.settings.namedBeasts[beast].monsterChance = 100;
			V.settings.namedBeasts[beast].hallucinationsOnly = false;
		});
	}

	V.settings.swarmsEnabled = preset.swarmsEnabled;
	V.settings.slimesEnabled = preset.slimesEnabled;
	V.settings.voreEnabled = preset.voreEnabled;
	V.settings.tentaclesEnabled = preset.tentaclesEnabled;
	V.settings.plantsEnabled = preset.plantsEnabled;
	V.settings.analEnabled = preset.analEnabled;
	V.settings.analDoubleEnabled = preset.analDoubleEnabled;
	V.settings.footFetishEnabled = preset.footFetishEnabled;
	V.settings.analingusGivingEnabled = preset.analingusGivingEnabled;
	V.settings.analingusReceivingEnabled = preset.analingusReceivingEnabled;
	V.settings.vaginalDoubleEnabled = preset.vaginalDoubleEnabled;
	V.settings.transformAnimalEnabled = preset.transformAnimalEnabled;
	V.settings.transformDivineEnabled = preset.transformDivineEnabled;
	V.settings.breastFeedingEnabled = preset.breastFeedingEnabled;
	V.settings.parasitePregnancyEnabled = preset.parasitePregnancyEnabled;
	V.settings.watersportsEnabled = preset.watersportsEnabled;
	V.settings.facesitEnabled = preset.facesitEnabled;
	V.settings.spidersEnabled = preset.spidersEnabled;
	V.settings.bodyWritingLevel = preset.bodyWritingLevel;
	V.settings.parasitesEnabled = preset.parasitesEnabled;
	V.settings.slugsEnabled = preset.slugsEnabled;
	V.settings.waspsEnabled = preset.waspsEnabled;
	V.settings.lurkersEnabled = preset.lurkersEnabled;
	V.settings.beesEnabled = preset.beesEnabled;
	V.settings.pregnancySpeechEnabled = preset.pregnancySpeechEnabled;
	V.settings.toyDildoEnabled = preset.toyDildoEnabled;
	V.settings.toyWhipEnabled = preset.toyWhipEnabled;
	V.settings.playerPregnancyHumanEnabled = preset.playerPregnancyHumanEnabled;
	V.settings.playerPregnancyBeastEnabled = preset.playerPregnancyBeastEnabled;
	V.settings.playerPregnancyEggLayingEnabled = preset.playerPregnancyEggLayingEnabled;
	V.settings.hypnosisEnabled = preset.hypnosisEnabled;
}
window.applyKinkPreset = applyKinkPreset;

/**
 * Applies the named NPC gender preset.
 *
 * @param {"namedNpcAllMaleGender" | "namedNpcDefaultGender" | "namedNpcAllFemaleGender"} presetName
 */
function applyNpcGenderPreset(presetName) {
	// The middle option changes nothing. Any NPC still at "none" is rolled by <<initnpcgender>>.
	if (presetName !== "namedNpcAllMaleGender" && presetName !== "namedNpcAllFemaleGender") return;
	const pronoun = presetName === "namedNpcAllMaleGender" ? "m" : "f";

	for (let i = 0; i < V.NPCNameList.length; i++) {
		// The Ivory Wraith is always "it". <<initnpcgender>> would reset its pronoun to "i", but not its gender.
		if (V.NPCNameList[i] === "Ivory Wraith") continue;
		const npc = V.NPCName[i];
		npc.pronoun = pronoun;
		// An NPC with an active pregnancy keeps their gender.
		if (!getActivePregnancies(npc.nam).length) npc.gender = pronoun;
	}
}
window.applyNpcGenderPreset = applyNpcGenderPreset;

/**
 * Sets T.anyBeastOn, which decides whether the button in the settings reads "Enable all beast toggles" or "Disable all beast toggles".
 */
function beastTogglesCheck() {
	T.beastVars = [
		"swarmsEnabled",
		"parasitesEnabled",
		"parasitePregnancyEnabled",
		"tentaclesEnabled",
		"slimesEnabled",
		"voreEnabled",
		"spidersEnabled",
		"slugsEnabled",
		"waspsEnabled",
		"beesEnabled",
		"lurkersEnabled",
		"plantsEnabled",
	];
	T.anyBeastOn = T.beastVars.some(x => V.settings[x] === true) || isBestialityOnForAnyCreature();
}
window.beastTogglesCheck = beastTogglesCheck;

// Checks current settings page for data attributes
// Run only when settings tab is changed (probably in "displaySettings" widget)
// data-target is the target element that needs to be clicked for the value to be updated
// data-disabledif is the conditional statement (e.g. data-disabledif="V.per_npc[T.pNPCId].gender==='f'")
function settingsDisableElement() {
	$(() => {
		$("[data-disabledif]").each(function () {
			const updateButtonsActive = () => {
				$(() => {
					try {
						const evalStr = "'use strict'; return " + disabledif;
						// eslint-disable-next-line no-new-func
						const cond = Function(evalStr)();
						const style = cond ? "var(--500)" : "";
						orig.css("color", style).children().css("color", style);
						orig.find("input").prop("disabled", cond);
						$(document).trigger("rangeslider::update");
					} catch (e) {
						console.log(e);
					}
				});
			};
			const orig = $(this);
			const disabledif = orig.data("disabledif");
			[orig.data("target")].flat().forEach(e => $("[name$='" + Util.slugify(e) + "']").on("click", updateButtonsActive));
			if (disabledif) {
				updateButtonsActive();
			}
		});
	});
}
window.settingsDisableElement = settingsDisableElement;

function setAllBeastsMonsterChance(value) {
	C.beastSettingTypes.forEach(type => {
		V.settings.beastSettings[type].monsterChance = value;
	});
}
window.setAllBeastsMonsterChance = setAllBeastsMonsterChance;

function setAllBeastsMonsterHallucinationsOnly(value) {
	C.beastSettingTypes.forEach(type => {
		V.settings.beastSettings[type].hallucinationsOnly = value;
	});
}
window.setAllBeastsMonsterHallucinationsOnly = setAllBeastsMonsterHallucinationsOnly;

function setAllBeastsVictimsAlwaysMonster(value) {
	C.beastSettingTypes.forEach(type => {
		V.settings.beastSettings[type].victimsAlwaysMonster = value;
	});
}
window.setAllBeastsVictimsAlwaysMonster = setAllBeastsVictimsAlwaysMonster;

function setAllBeastsMaleChance(value) {
	C.beastSettingTypes.forEach(type => {
		V.settings.beastSettings[type].maleChance = value;
	});
}
window.setAllBeastsMaleChance = setAllBeastsMaleChance;

function setAllBeastsMaleChanceMale(value) {
	C.beastSettingTypes.forEach(type => {
		V.settings.beastSettings[type].maleChanceMale = value;
	});
}
window.setAllBeastsMaleChanceMale = setAllBeastsMaleChanceMale;

function setAllBeastsMaleChanceFemale(value) {
	C.beastSettingTypes.forEach(type => {
		V.settings.beastSettings[type].maleChanceFemale = value;
	});
}
window.setAllBeastsMaleChanceFemale = setAllBeastsMaleChanceFemale;

function setAllBeastsMaleChanceSplit(value) {
	C.beastSettingTypes.forEach(type => {
		V.settings.beastSettings[type].maleChanceSplit = value;
	});
}
window.setAllBeastsMaleChanceSplit = setAllBeastsMaleChanceSplit;

function setAllBeastsBestialityMode(mode) {
	C.beastSettingTypes.forEach(type => {
		V.settings.beastSettings[type].bestiality = mode;
	});
}
window.setAllBeastsBestialityMode = setAllBeastsBestialityMode;
