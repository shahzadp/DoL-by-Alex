const DoLSave = ((Story, Save) => {
	"use strict";

	const DEFAULT_DETAILS = Object.freeze({
		id: Story.domId,
		autosave: null,
		slots: [null, null, null, null, null, null, null, null],
	});
	const KEY_DETAILS = "dolSaveDetails";

	// Compressed saves are indicated by {jsoncompressed:1} in their metadata
	// The '1' can act as a compression algorithm id.

	// see game/00-framework-tools/03-compression/dictionaries.js
	const COMPRESSOR_DICTIONARIES = DoLCompressorDictionaries;
	// id of the dictionary to use for saving
	const COMPRESSOR_CURRENT_DICTIONARY_ID = "v3";
	/**
	 * When saving, decompress and compare with the original.
	 * If results differ, report an error and save the uncompressed version instead.
	 */
	function shouldVerifyCompression() {
		return true;
	}

	/* Place somewhere to expose globally. */
	function isObject(obj) {
		return typeof obj === "object" && obj != null;
	}

	/* Can also call from backcomp in the future? */
	function getSaveVersion(variables) {
		if (isObject(variables)) {
			if (!variables.saveVersions) {
				return -1;
			}
			return variables.saveVersions.last();
		}
		return -2;
	}

	function marshalVersion(version) {
		return typeof version === "string"
			? version
					.replace(/[^0-9.]+/g, "")
					.split(".")
					.map(v => parseInt(v))
			: [0, 0, 0, 0];
	}

	function parseVersion(version) {
		version = marshalVersion(version);
		return version ? version[0] * 1000000 + version[1] * 10000 + version[2] * 100 + version[3] * 1 : 0;
	}

	/**
	 * The handler which the load button should call.
	 * Contains checks to determine whether the save loads or pops up a confirmation window.
	 *
	 * @param {any} slot The slot ID to get the save from. 0 to 9, or 'auto'.
	 * @param {boolean} confirm Bypass the load confirmation.
	 * @returns {void}
	 */
	function loadHandler(slot, confirm) {
		if (V.ironmanmode === true && V.passage !== "Start") {
			Wikifier.wikifyEval(`<<loadIronmanSafetyCancel ${slot}>>`);
			return;
		}
		if (V.confirmLoad === true && confirm === undefined) {
			Wikifier.wikifyEval(`<<loadConfirm ${slot}>>`);
			return;
		}
		const save = slot === "auto" ? Save.autosave.get() : Save.slots.get(slot);
		// an empty slot gives back null, which is not the same as an empty save. JavaScript treats null as an object.
		// so checking the type alone would let an empty slot through and crash - isObject rules out null
		if (!isObject(save)) {
			Errors.report("Could not find a valid save at that slot.", {});
			return;
		}
		const currVersion = parseVersion(StartConfig.version);
		/* Assume the save->variables is valid if an object. */
		const saveVersion = parseVersion(getSaveVersion(save.state.delta[0].variables));
		if (currVersion < saveVersion) {
			Wikifier.wikifyEval(`<<loadconfirmcompat ${slot}>>`);
			return;
		}
		load(slot, save);
	}

	/**
	 * Loads the given saveobj, or the save from the given slot.
	 *
	 * @param {number|string} slot The slot ID to get the save from. 0 to 9, or 'auto'.
	 * @param {object} saveObj The save object if already possessed by the callee.
	 * @param {boolean} overrides
	 * @returns {void}
	 */
	function load(slot, saveObj, overrides) {
		const save = saveObj == null ? (slot === "auto" ? Save.autosave.get() : Save.slots.get(slot)) : saveObj;
		// the details record can be missing (storage cleared) or lack this slot's row, so default to safe empties and don't crash
		const saveDetails = JSON.parse(localStorage.getItem(KEY_DETAILS)) ?? { autosave: null, slots: [] };
		const details = slot === "auto" ? saveDetails.autosave : saveDetails.slots[slot];
		const metadata = details?.metadata ?? {};
		/* Check if metadata for save matches the save's computed md5 hash. If it matches, the ironman save was not tampered with.
			Bypass this check if on a mobile, because they are notoriously difficult to grab saves from in the event of issues. */
		if (metadata.ironman && !Browser.isMobile.any()) {
			IronMan.update(save, metadata);
			// (if ironman mode enabled) following checks md5 signature of the save to see if the variables have been modified
			if (!IronMan.compare(metadata, save)) {
				Wikifier.wikifyEval(`<<loadIronmanCheater ${slot}>>`);
				return;
			}
		}
		const loaded = slot === "auto" ? Save.autosave.load() : Save.slots.load(slot);
		// if the load failed, stop here so ironman mode doesn't delete the player's other saves for nothing
		if (!loaded) return;
		if (V.ironmanmode) {
			// (ironman) remove all saves(except auto-save) with the same saveId than loaded save
			[0, 1, 2, 3, 4, 5, 6, 7].forEach(id => {
				const saveDetail = saveDetails.slots[id];
				if (saveDetail == null) return;
				if (saveDetail.metadata.saveId === metadata.saveId) {
					Save.slots.delete(id);
					deleteSaveDetails(id);
				}
			});
		}
	}

	function save(saveSlot, confirm, saveId, saveName) {
		if (saveId == null) {
			Wikifier.wikifyEval(`<<saveConfirm ${saveSlot}>>`);
		} else if ((V.confirmSave === true && confirm !== true) || (V.saveId !== saveId && saveId != null)) {
			Wikifier.wikifyEval(`<<saveConfirm ${saveSlot}>>`);
		} else {
			if (saveSlot != null) {
				const success = Save.slots.save(saveSlot, null, {
					saveId,
					saveName,
					ironman: V.ironmanmode,
				});
				if (success) {
					const save = Save.slots.get(saveSlot);
					// Copy save metadata (it includes the jsoncompressed indicator)
					const metadata = { ...save.metadata, saveId, saveName };
					if (V.ironmanmode) {
						Object.assign(metadata, {
							ironman: V.ironmanmode,
							signature: V.ironmanmode ? IronMan.getSignature(save) : false,
							schema: IronMan.schema,
						});
					}
					setSaveDetail(saveSlot, metadata);
					delete T.currentOverlay;
					// todo: find a better solution
					closeOverlay();
					if (V.ironmanmode === true) Engine.restart();
				}
			}
		}
	}

	function deleteSave(saveSlot, confirm) {
		if (saveSlot === "all") {
			if (confirm === undefined) {
				Wikifier.wikifyEval("<<clearSaveMenu>>");
				return;
			} else if (confirm === true) {
				Save.clear();
				deleteAllSaveDetails();
			}
		} else if (saveSlot === "auto") {
			if (V.confirmDelete === true && confirm === undefined) {
				Wikifier.wikifyEval(`<<deleteConfirm ${saveSlot}>>`);
				return;
			} else {
				Save.autosave.delete();
				deleteSaveDetails("autosave");
			}
		} else {
			if (V.confirmDelete === true && confirm === undefined) {
				Wikifier.wikifyEval(`<<deleteConfirm ${saveSlot}>>`);
				return;
			} else {
				Save.slots.delete(saveSlot);
				deleteSaveDetails(saveSlot);
			}
		}
		Wikifier.wikifyEval("<<resetSaveMenu>>");
	}

	function importSave(saveFile) {
		if (!window.FileReader) return; // Browser is not compatible

		const reader = new FileReader();

		reader.onloadend = function () {
			DeserializeGame(this.result);
		};

		reader.readAsText(saveFile[0]);
	}

	function prepareSaveDetails(forceRun) {
		const saveDetails = getSaveDetails();
		if (saveDetails == null || saveDetails.id !== Story.domId || forceRun) {
			const scSaveDetails = Save.get();
			// clone so we don't fill in the shared template and leave ghost saves
			const dolSaveDetails = clone(DEFAULT_DETAILS);
			/* Search SugarCube's autosave property, if it exists, reflect this in the save details. */
			if (scSaveDetails.autosave != null) {
				dolSaveDetails.autosave = {
					title: scSaveDetails.autosave.title,
					date: scSaveDetails.autosave.date,
					metadata: scSaveDetails.autosave.metadata,
				};
				if (dolSaveDetails.autosave.metadata === undefined) {
					dolSaveDetails.autosave.metadata = { saveName: "" };
				}
				if (dolSaveDetails.autosave.metadata.saveName === undefined) {
					dolSaveDetails.autosave.metadata.saveName = "";
				}
			}
			/* Check whether SugarCube's save slots exist and populate save details with them. */
			for (let i = 0; i < scSaveDetails.slots.length; i++) {
				if (scSaveDetails.slots[i] !== null) {
					dolSaveDetails.slots[i] = {
						title: scSaveDetails.slots[i].title,
						date: scSaveDetails.slots[i].date,
						metadata: scSaveDetails.slots[i].metadata,
					};
					if (dolSaveDetails.slots[i].metadata === undefined) {
						dolSaveDetails.slots[i].metadata = { saveName: "old save", saveId: 0 };
					}
					if (dolSaveDetails.slots[i].metadata.saveName === undefined) {
						dolSaveDetails.slots[i].metadata.saveName = "old save";
					}
				} else {
					dolSaveDetails.slots[i] = null;
				}
			}

			localStorage.setItem(KEY_DETAILS, JSON.stringify(dolSaveDetails));
			return true;
		}
		return false;
	}

	function setSaveDetail(saveSlot, metadata, story) {
		const saveDetails = JSON.parse(localStorage.getItem(KEY_DETAILS));
		if (saveSlot === "autosave") {
			saveDetails.autosave = {
				id: Story.domId,
				title: Story.get(V.passage).description(),
				date: Date.now(),
				metadata,
			};
		} else {
			const slot = parseInt(saveSlot);
			saveDetails.slots[slot] = {
				id: Story.domId,
				title: Story.get(V.passage).description(),
				date: Date.now(),
				metadata,
			};
		}
		localStorage.setItem(KEY_DETAILS, JSON.stringify(saveDetails));
	}

	function getSaveDetails(saveSlot) {
		if (Object.hasOwn(localStorage, KEY_DETAILS)) {
			const saveDetails = JSON.parse(localStorage.getItem(KEY_DETAILS));
			if (typeof saveSlot === "number") {
				if (saveDetails != null) {
					return saveDetails.slots[saveSlot];
				}
			} else {
				return saveDetails;
			}
		}
		return null;
	}

	function deleteSaveDetails(saveSlot) {
		const saveDetails = JSON.parse(localStorage.getItem(KEY_DETAILS));
		if (saveSlot === "autosave") {
			saveDetails.autosave = null;
		} else {
			const slot = parseInt(saveSlot);
			saveDetails.slots[slot] = null;
		}
		localStorage.setItem(KEY_DETAILS, JSON.stringify(saveDetails));
	}

	function deleteAllSaveDetails() {
		localStorage.setItem(KEY_DETAILS, JSON.stringify(DEFAULT_DETAILS));
	}

	function returnSaveData() {
		return Save.get();
	}

	function resetSaveMenu() {
		Wikifier.wikifyEval("<<resetSaveMenu>>");
	}

	function ironmanAutoSave() {
		const saveSlot = 8;
		const success = Save.slots.save(saveSlot, null, {
			saveId: V.saveId,
			saveName: V.saveName,
			ironman: V.ironmanmode,
		});
		if (success) {
			const save = Save.slots.get(saveSlot);
			const metadata = { saveId: V.saveId, saveName: V.saveName };
			if (V.ironmanmode) {
				Object.assign(metadata, {
					ironman: V.ironmanmode,
					signature: V.ironmanmode ? IronMan.getSignature(save) : false,
					schema: IronMan.schema,
				});
			}
			setSaveDetail(saveSlot, metadata);
		}
	}

	Macro.add("incrementautosave", {
		handler() {
			if (!V.ironmanmode) V.saveDetails.auto.count++;
		},
	});

	/**
	 * Compress a game state (not delta-encoded: {title, variables, prng, pull}) using most recent dictionary.
	 * Can throw an error.
	 *
	 * @param {object} state
	 */
	function compressState(state) {
		const dictionary = COMPRESSOR_DICTIONARIES[COMPRESSOR_CURRENT_DICTIONARY_ID];
		const compressor = new JsonCompressor(dictionary);
		const zstate = compressor.compress(state);
		zstate.dictionary = COMPRESSOR_CURRENT_DICTIONARY_ID;
		zstate.title =
			"This save is compressed and is not compatible with old versions of Degrees of Lewdity. If you want to load this save in an older game build, use exporting.";
		zstate.variables = {};
		if (shouldVerifyCompression()) {
			// Sanity check
			const uzstate = decompressState(zstate);
			if (JSON.stringify(state) !== JSON.stringify(uzstate)) {
				throw new Error("Decompression check failed");
			}
		}
		return zstate;
	}

	/**
	 * Decompress the saved state using the dictionary it was compressed with.
	 * Can throw an error.
	 *
	 * @param {object} zstate
	 */
	function decompressState(zstate) {
		if (!("dictionary" in zstate)) throw new Error("Unable to load - compressed save has no dictionary");
		const dicid = zstate.dictionary;
		if (!(dicid in COMPRESSOR_DICTIONARIES))
			throw new Error(
				"Unable to decompress the save - the dictionary " +
					JSON.stringify(dicid) +
					" is unknown to this game version (trying to load newer save from older game?)"
			);
		const dictionary = COMPRESSOR_DICTIONARIES[dicid];
		const decompressor = new JsonDecompressor(dictionary);
		return decompressor.decompress(zstate);
	}
	function enableCompression() {
		V.compressSave = true;
	}
	function disableCompression() {
		V.compressSave = false;
	}
	function isCompressionEnabled() {
		// for now, save compressor and delta-encoder work against each other, leading to bigger saves when both are active
		// todo: make them friends?
		return V.compressSave && State.history.length === 1;
	}

	/**
	 * Compress a SaveObject (the one with metadata and delta-encoded history), if the compression is enabled.
	 * If compression fails, report and error and do nothing.
	 * This function returns nothing, it modifies the saveObj parameter.
	 *
	 * @param {object} saveObj
	 */
	function compressIfNeeded(saveObj) {
		if (!saveObj.metadata) saveObj.metadata = {};
		saveObj.metadata.jsoncompressed = 0;
		if (!isCompressionEnabled()) return;
		try {
			saveObj.state.history = saveObj.state.history.map(state => compressState(state));
			saveObj.metadata.jsoncompressed = 1;
		} catch (e) {
			DOL.Errors.report("Unable to compress - " + e);
			console.error(e);
			// Just return, the saveObj won't be modified
		}
	}
	function looksLikeCompressedSave(state) {
		return state.compressed === 1 && Array.isArray(state.values) && typeof state.values === "object" && typeof state.dictionary === "string";
	}
	/**
	 * Decompress a SaveObject (the one with metadata and delta-encoded history), if it is compressed.
	 *
	 * @param {object} saveObj
	 */
	function decompressIfNeeded(saveObj) {
		const isCompressed = (saveObj.metadata && saveObj.metadata.jsoncompressed === 1) || looksLikeCompressedSave(saveObj.state.history[0]);
		if (!isCompressed) return;
		let dictOverride = saveObj.state.history[0].dictionary;
		saveObj.state.history = saveObj.state.history.map(state => {
			state.dictionary = dictOverride;
			if (JsonDecompressor.isCompressed(state)) {
				// decompressing with the wrong dictionary can throw or produce nonsense, treat both as a failed attempt
				const tryDecompress = () => {
					try {
						const result = decompressState(state);
						return result.variables && result.variables.saveVersions ? result : null;
					} catch {
						return null;
					}
				};
				let decompressed = tryDecompress();
				// if that failed, the dictionary might be mislabeled, so try the others until one works
				const otherDicts = Object.keys(COMPRESSOR_DICTIONARIES).filter(d => d !== dictOverride);
				for (let k = 0; k < otherDicts.length && !decompressed; k++) {
					state.dictionary = otherDicts[k];
					decompressed = tryDecompress();
					if (decompressed) dictOverride = otherDicts[k];
				}
				if (!decompressed)
					throw new Error("Unable to decompress the save with any of the game's dictionaries (save is labeled " + JSON.stringify(dictOverride) + ")");
				return decompressed;
			} else return state;
		});
	}

	return Object.freeze({
		save,
		load,
		delete: deleteSave,
		import: importSave,
		getSaves: returnSaveData,
		resetMenu: resetSaveMenu,
		getVersion: getSaveVersion,
		loadHandler,
		enableCompression,
		disableCompression,
		isCompressionEnabled,
		compressState,
		decompressState,
		compressIfNeeded,
		decompressIfNeeded,
		SaveDetails: Object.freeze({
			prepare: prepareSaveDetails,
			set: setSaveDetail,
			get: getSaveDetails,
			delete: deleteSaveDetails,
			deleteAll: deleteAllSaveDetails,
		}),
		IronMan: Object.freeze({
			autoSave: ironmanAutoSave,
		}),
		Utils: Object.freeze({
			parseVer: parseVersion,
		}),
	});
})(Story, Save);
window.DoLSave = DoLSave;

/* Legacy references, references to the global namespace should be avoided, and thus this is considered deprecated usage. */
window.prepareSaveDetails = DoLSave.SaveDetails.prepare;
window.setSaveDetail = DoLSave.SaveDetails.set;
window.getSaveDetails = DoLSave.SaveDetails.get;
window.deleteSaveDetails = DoLSave.SaveDetails.delete;
window.deleteAllSaveDetails = DoLSave.SaveDetails.deleteAll;
window.returnSaveDetails = DoLSave.getSaves;
window.resetSaveMenu = DoLSave.resetMenu;
window.ironmanAutoSave = DoLSave.IronMan.autoSave;
window.loadSave = DoLSave.load;
window.save = DoLSave.save;
window.deleteSave = DoLSave.delete;
window.importSave = DoLSave.import;
window.SerializeGame = Save.serialize;
window.DeserializeGame = Save.deserialize;

window.getSaveData = function () {
	const compressionWasEnabled = DoLSave.isCompressionEnabled();
	DoLSave.disableCompression();
	const input = document.getElementById("saveDataInput");
	input.value = Save.serialize();
	if (compressionWasEnabled) DoLSave.enableCompression();
};

window.loadSaveData = function () {
	const input = document.getElementById("saveDataInput");
	const result = Save.deserialize(input.value);
	if (result === null) {
		input.value = "Invalid Save.";
	}
};

window.clearTextBox = function (id) {
	document.getElementById(id).value = "";
};

window.topTextArea = function (id) {
	const textArea = document.getElementById(id);
	textArea.scroll(0, 0);
};

window.bottomTextArea = function (id) {
	const textArea = document.getElementById(id);
	textArea.scroll(0, textArea.scrollHeight);
};

window.copySavedata = function (id) {
	const saveData = document.getElementById(id);
	saveData.focus();
	saveData.select();

	try {
		document.execCommand("copy");
	} catch (err) {
		const copyTextArea = document.getElementById("CopyTextArea");
		copyTextArea.value = "Copying Error";
		console.log("Unable to copy: ", err);
	}
};

window.importSettings = function (data, type) {
	let reader;
	switch (type) {
		case "text":
			V.importString = document.getElementById("settingsDataInput").value;
			Wikifier.wikifyEval('<<displaySettings "importConfirmDetails">>');
			break;
		case "file":
			reader = new FileReader();
			reader.addEventListener("load", event => {
				V.importString = event.target.result;
				Wikifier.wikifyEval('<<displaySettings "importConfirmDetails">>');
			});
			reader.readAsBinaryString(data[0]);
			break;
		case "function":
			importSettingsData(data);
			break;
	}
};

/**
 * Convert the retired binary dark skin percentage into skin tone scale settings.
 *
 * @param {number} darkChance the retired $settings.darkSkinChance, 0-100
 * @returns {{skinToneMin: number, skinToneMode: number, skinToneMax: number}}
 */
function skinToneSettingsFromDarkChance(darkChance) {
	const dark = Math.clamp(darkChance, 0, 100);
	if (dark <= 0) return { skinToneMin: 0, skinToneMode: 0, skinToneMax: 0 };
	if (dark >= 100) return { skinToneMin: 70, skinToneMode: 70, skinToneMax: 70 };
	if (dark <= 51) {
		const mode = dark <= 30 ? 100 - 900 / dark : 4900 / (100 - dark);
		return { skinToneMin: 0, skinToneMode: Math.clamp(Math.round(mode), 0, 100), skinToneMax: 100 };
	}
	return { skinToneMin: Math.round((70 * (dark - 51)) / 49), skinToneMode: 100, skinToneMax: 100 };
}
window.skinToneSettingsFromDarkChance = skinToneSettingsFromDarkChance;

function importSettingsData(data) {
	const imported = JSON.parse(data);
	delete V.importString;

	if (V.passage === "Start") applyStartingSettings(imported.starting);
	applyGeneralSettings(imported.general);
	applyNpcSettings(imported.npc);
}
window.importSettingsData = importSettingsData;

function applyGeneralSettings(general) {
	V.breastsizemin = general.breastsizemin ?? V.breastsizemin;
	V.breastsizemax = general.breastsizemax ?? V.breastsizemax;
	V.bottomsizemin = general.bottomsizemin ?? V.bottomsizemin;
	V.bottomsizemax = general.bottomsizemax ?? V.bottomsizemax;
	V.penissizemin = general.penissizemin ?? V.penissizemin;
	V.penissizemax = general.penissizemax ?? V.penissizemax;
	V.confirmSave = general.confirmSave ?? V.confirmSave;
	V.confirmLoad = general.confirmLoad ?? V.confirmLoad;
	V.confirmDelete = general.confirmDelete ?? V.confirmDelete;
	V.reducedLineHeight = general.reducedLineHeight ?? V.reducedLineHeight;
	V.outfitEditorPerPage = general.outfitEditorPerPage ?? V.outfitEditorPerPage;

	applyGameplaySettings(general.settings);
	applyBeastSettings(general.settings);
	applyOptions(general.options);
	applyShopDefaults(general.shopDefaults);
	applyWardrobeDefaults(general.wardrobeDefaults);
}

function applyBeastSettings(settings) {
	C.beastSettingTypes.forEach(type => {
		const incoming = settings.beastSettings[type];
		const target = V.settings.beastSettings[type];
		target.monsterChance = incoming.monsterChance ?? target.monsterChance;
		target.hallucinationsOnly = incoming.hallucinationsOnly ?? target.hallucinationsOnly;
		target.maleChance = incoming.maleChance ?? target.maleChance;
		target.maleChanceMale = incoming.maleChanceMale ?? target.maleChanceMale;
		target.maleChanceFemale = incoming.maleChanceFemale ?? target.maleChanceFemale;
		target.maleChanceSplit = incoming.maleChanceSplit ?? target.maleChanceSplit;
		target.bestiality = incoming.bestiality ?? target.bestiality;
		target.victimsAlwaysMonster = incoming.victimsAlwaysMonster ?? target.victimsAlwaysMonster;
	});

	C.namedBeasts.forEach(beast => {
		const incoming = settings.namedBeasts[beast];
		const target = V.settings.namedBeasts[beast];
		target.monsterChance = incoming.monsterChance ?? target.monsterChance;
		target.hallucinationsOnly = incoming.hallucinationsOnly ?? target.hallucinationsOnly;
	});
}

function applyNpcSettings(npc) {
	V.NPCNameList.forEach((name, i) => {
		const incoming = npc[name];
		const target = V.NPCName[i];

		// An NPC carrying a pregnancy keeps the gender it conceived with, regardless of the setting.
		const lockedGender = getActivePregnancies(target.nam).length ? target.gender : undefined;

		target.pronoun = incoming.pronoun ?? target.pronoun;
		target.gender = incoming.gender ?? target.gender;
		target.skincolour = incoming.skincolour ?? target.skincolour;
		target.skinType = incoming.skinType ?? target.skinType;
		target.penissize = incoming.penissize ?? target.penissize;
		target.breastsize = incoming.breastsize ?? target.breastsize;

		if (lockedGender) target.gender = lockedGender;
	});
}

function applyStartingSettings(starting) {
	const player = starting.player;

	V.bodysize = starting.bodysize ?? V.bodysize;
	V.facevariant = starting.facevariant ?? V.facevariant;
	V.breastsensitivity = starting.breastsensitivity ?? V.breastsensitivity;
	V.genitalsensitivity = starting.genitalsensitivity ?? V.genitalsensitivity;
	V.mouthsensitivity = starting.mouthsensitivity ?? V.mouthsensitivity;
	V.bottomsensitivity = starting.bottomsensitivity ?? V.bottomsensitivity;
	V.drunkSensitivity = starting.drunkSensitivity ?? V.drunkSensitivity;
	V.eyeselect = starting.eyeselect ?? V.eyeselect;
	V.hairselect = starting.hairselect ?? V.hairselect;
	V.hairlength = starting.hairlength ?? V.hairlength;
	V.awareselect = starting.awareselect ?? V.awareselect;
	V.background = starting.background ?? V.background;
	V.startingseason = starting.startingseason ?? V.startingseason;
	V.gamemode = starting.gamemode ?? V.gamemode;
	V.ironmanmode = starting.ironmanmode ?? V.ironmanmode;

	V.player.gender = player.gender ?? V.player.gender;
	V.player.sex = player.sex ?? V.player.sex;
	V.player.gender_body = player.gender_body ?? V.player.gender_body;
	V.player.bodyshape = player.bodyshape ?? V.player.bodyshape;
	V.player.skin.color = player.skinColour ?? V.player.skin.color;
	V.player.ballsExist = player.ballsExist ?? V.player.ballsExist;
	V.player.freckles = player.freckles ?? V.player.freckles;
	V.player.breastsize = player.breastsize ?? V.player.breastsize;
	V.player.penissize = player.penissize ?? V.player.penissize;
	V.player.bottomsize = player.bottomsize ?? V.player.bottomsize;
}

function applyGameplaySettings(settings) {
	V.settings.analEnabled = settings.analEnabled ?? V.settings.analEnabled;
	V.settings.analingusGivingEnabled = settings.analingusGivingEnabled ?? V.settings.analingusGivingEnabled;
	V.settings.analingusReceivingEnabled = settings.analingusReceivingEnabled ?? V.settings.analingusReceivingEnabled;
	V.settings.transformAnimalEnabled = settings.transformAnimalEnabled ?? V.settings.transformAnimalEnabled;
	V.settings.asphyxiaLevel = settings.asphyxiaLevel ?? V.settings.asphyxiaLevel;
	V.settings.penisModifier = settings.penisModifier ?? V.settings.penisModifier;
	V.settings.breastModifier = settings.breastModifier ?? V.settings.breastModifier;
	V.settings.rentCostModifier = settings.rentCostModifier ?? V.settings.rentCostModifier;
	V.settings.baseNpcPregnancyChance = settings.baseNpcPregnancyChance ?? V.settings.baseNpcPregnancyChance;
	V.settings.basePlayerPregnancyChance = settings.basePlayerPregnancyChance ?? V.settings.basePlayerPregnancyChance;
	V.settings.beesEnabled = settings.beesEnabled ?? V.settings.beesEnabled;
	V.settings.blindStatsEnabled = settings.blindStatsEnabled ?? V.settings.blindStatsEnabled;
	V.settings.bodyWritingLevel = settings.bodyWritingLevel ?? V.settings.bodyWritingLevel;
	V.settings.breastFeedingEnabled = settings.breastFeedingEnabled ?? V.settings.breastFeedingEnabled;
	V.settings.cheatsEnabledToggle = settings.cheatsEnabledToggle ?? V.settings.cheatsEnabledToggle;
	V.settings.condomLevel = settings.condomLevel ?? V.settings.condomLevel;
	V.settings.clothingCostModifier = settings.clothingCostModifier ?? V.settings.clothingCostModifier;
	V.settings.furnitureCostModifier = settings.furnitureCostModifier ?? V.settings.furnitureCostModifier;
	V.settings.lewdClothingCostModifier = settings.lewdClothingCostModifier ?? V.settings.lewdClothingCostModifier;
	V.settings.schoolClothingCostModifier = settings.schoolClothingCostModifier ?? V.settings.schoolClothingCostModifier;
	V.settings.underwearCostModifier = settings.underwearCostModifier ?? V.settings.underwearCostModifier;
	V.settings.tendingYieldModifier = settings.tendingYieldModifier ?? V.settings.tendingYieldModifier;
	V.settings.toyDildoEnabled = settings.toyDildoEnabled ?? V.settings.toyDildoEnabled;
	V.settings.transformDivineEnabled = settings.transformDivineEnabled ?? V.settings.transformDivineEnabled;
	V.settings.analDoubleEnabled = settings.analDoubleEnabled ?? V.settings.analDoubleEnabled;
	V.settings.vaginalDoubleEnabled = settings.vaginalDoubleEnabled ?? V.settings.vaginalDoubleEnabled;
	V.settings.allureModifier = settings.allureModifier ?? V.settings.allureModifier;
	V.settings.facesitEnabled = settings.facesitEnabled ?? V.settings.facesitEnabled;
	V.settings.pregnancySpeechEnabled = settings.pregnancySpeechEnabled ?? V.settings.pregnancySpeechEnabled;
	V.settings.footFetishEnabled = settings.footFetishEnabled ?? V.settings.footFetishEnabled;
	V.settings.forcedCrossdressingEnabled = settings.forcedCrossdressingEnabled ?? V.settings.forcedCrossdressingEnabled;
	V.settings.granularBeastControl = settings.granularBeastControl ?? V.settings.granularBeastControl;
	V.settings.humanPregnancyMonths = settings.humanPregnancyMonths ?? V.settings.humanPregnancyMonths;
	V.settings.hypnosisEnabled = settings.hypnosisEnabled ?? V.settings.hypnosisEnabled;
	V.settings.npcVirginChanceAdult = settings.npcVirginChanceAdult ?? V.settings.npcVirginChanceAdult;
	V.settings.npcVirginChanceStudent = settings.npcVirginChanceStudent ?? V.settings.npcVirginChanceStudent;
	V.settings.skinToneMin = settings.skinToneMin ?? V.settings.skinToneMin;
	V.settings.skinToneMode = settings.skinToneMode ?? V.settings.skinToneMode;
	V.settings.skinToneMax = settings.skinToneMax ?? V.settings.skinToneMax;
	V.settings.lurkersEnabled = settings.lurkersEnabled ?? V.settings.lurkersEnabled;
	V.settings.fertilityCycleEnabled = settings.fertilityCycleEnabled ?? V.settings.fertilityCycleEnabled;
	V.settings.toyMultiplePenetrationEnabled = settings.toyMultiplePenetrationEnabled ?? V.settings.toyMultiplePenetrationEnabled;
	V.settings.multipleWardrobes = settings.multipleWardrobes ?? V.settings.multipleWardrobes;
	V.settings.maleChanceSplit = settings.maleChanceSplit ?? V.settings.maleChanceSplit;
	V.settings.npcPregnancyEnabled = settings.npcPregnancyEnabled ?? V.settings.npcPregnancyEnabled;
	V.settings.nnpcPregnancyEnabled = settings.nnpcPregnancyEnabled ?? V.settings.nnpcPregnancyEnabled;
	V.settings.analPregnancy = settings.analPregnancy ?? V.settings.analPregnancy;
	V.settings.npcAnalPregnancyEnabled = settings.npcAnalPregnancyEnabled ?? V.settings.npcAnalPregnancyEnabled;
	V.settings.maleChanceMale = settings.maleChanceMale ?? V.settings.maleChanceMale;
	V.settings.maleChanceFemale = settings.maleChanceFemale ?? V.settings.maleChanceFemale;
	V.settings.nudeGenderPerception = settings.nudeGenderPerception ?? V.settings.nudeGenderPerception;
	V.settings.parasitePregnancyEnabled = settings.parasitePregnancyEnabled ?? V.settings.parasitePregnancyEnabled;
	V.settings.parasitesEnabled = settings.parasitesEnabled ?? V.settings.parasitesEnabled;
	V.settings.maleNPCVaginaChance = settings.maleNPCVaginaChance ?? V.settings.maleNPCVaginaChance;
	V.settings.maleVictimChance = settings.maleVictimChance ?? V.settings.maleVictimChance;
	V.settings.maleChance = settings.maleChance ?? V.settings.maleChance;
	V.settings.femaleNPCPenisChance = settings.femaleNPCPenisChance ?? V.settings.femaleNPCPenisChance;
	V.settings.straponChance = settings.straponChance ?? V.settings.straponChance;
	V.settings.plantsEnabled = settings.plantsEnabled ?? V.settings.plantsEnabled;
	V.settings.playerPregnancyEggLayingEnabled = settings.playerPregnancyEggLayingEnabled ?? V.settings.playerPregnancyEggLayingEnabled;
	V.settings.playerPregnancyBeastEnabled = settings.playerPregnancyBeastEnabled ?? V.settings.playerPregnancyBeastEnabled;
	V.settings.playerPregnancyHumanEnabled = settings.playerPregnancyHumanEnabled ?? V.settings.playerPregnancyHumanEnabled;
	V.settings.pregnancyType = settings.pregnancyType ?? V.settings.pregnancyType;
	V.settings.pubicHairEnabled = settings.pubicHairEnabled ?? V.settings.pubicHairEnabled;
	V.settings.ruinedOrgasmEnabled = settings.ruinedOrgasmEnabled ?? V.settings.ruinedOrgasmEnabled;
	V.settings.skillCheckStyle = settings.skillCheckStyle ?? V.settings.skillCheckStyle;
	V.settings.slimesEnabled = settings.slimesEnabled ?? V.settings.slimesEnabled;
	V.settings.slugsEnabled = settings.slugsEnabled ?? V.settings.slugsEnabled;
	V.settings.spidersEnabled = settings.spidersEnabled ?? V.settings.spidersEnabled;
	V.settings.swarmsEnabled = settings.swarmsEnabled ?? V.settings.swarmsEnabled;
	V.settings.tentaclesEnabled = settings.tentaclesEnabled ?? V.settings.tentaclesEnabled;
	V.settings.voreEnabled = settings.voreEnabled ?? V.settings.voreEnabled;
	V.settings.waspsEnabled = settings.waspsEnabled ?? V.settings.waspsEnabled;
	V.settings.watersportsEnabled = settings.watersportsEnabled ?? V.settings.watersportsEnabled;
	V.settings.toyWhipEnabled = settings.toyWhipEnabled ?? V.settings.toyWhipEnabled;
	V.settings.wolfPregnancyWeeks = settings.wolfPregnancyWeeks ?? V.settings.wolfPregnancyWeeks;
	V.settings.condomChance = settings.condomChance ?? V.settings.condomChance;
	V.settings.condomUseChanceRape = settings.condomUseChanceRape ?? V.settings.condomUseChanceRape;
	V.settings.condomUseChanceConsensual = settings.condomUseChanceConsensual ?? V.settings.condomUseChanceConsensual;
	V.settings.incompletePregnancyEnabled = settings.incompletePregnancyEnabled ?? V.settings.incompletePregnancyEnabled;
}

function applyOptions(options) {
	V.options.neverNudeMenus = options.neverNudeMenus ?? V.options.neverNudeMenus;
	V.options.showCaptionText = options.showCaptionText ?? V.options.showCaptionText;
	V.options.clothingCaption = options.clothingCaption ?? V.options.clothingCaption;
	V.options.clothingReplacementWarning = options.clothingReplacementWarning ?? V.options.clothingReplacementWarning;
	V.options.sidebarStats = options.sidebarStats ?? V.options.sidebarStats;
	V.options.sidebarTime = options.sidebarTime ?? V.options.sidebarTime;
	V.options.combatControls = options.combatControls ?? V.options.combatControls;
	V.options.mapMovement = options.mapMovement ?? V.options.mapMovement;
	V.options.mapTop = options.mapTop ?? V.options.mapTop;
	V.options.mapMarkers = options.mapMarkers ?? V.options.mapMarkers;
	V.options.images = options.images ?? V.options.images;
	V.options.combatImages = options.combatImages ?? V.options.combatImages;
	V.options.bodywritingImages = options.bodywritingImages ?? V.options.bodywritingImages;
	V.options.silhouetteEnabled = options.silhouetteEnabled ?? V.options.silhouetteEnabled;
	V.options.sidebarAnimations = options.sidebarAnimations ?? V.options.sidebarAnimations;
	V.options.blinkingEnabled = options.blinkingEnabled ?? V.options.blinkingEnabled;
	V.options.combatAnimations = options.combatAnimations ?? V.options.combatAnimations;
	V.options.halfClosedEnabled = options.halfClosedEnabled ?? V.options.halfClosedEnabled;
	V.options.characterLightEnabled = options.characterLightEnabled ?? V.options.characterLightEnabled;
	V.options.lightSpotlight = options.lightSpotlight ?? V.options.lightSpotlight;
	V.options.lightGradient = options.lightGradient ?? V.options.lightGradient;
	V.options.lightGlow = options.lightGlow ?? V.options.lightGlow;
	V.options.lightFlat = options.lightFlat ?? V.options.lightFlat;
	V.options.lightTFColor = options.lightTFColor ?? V.options.lightTFColor;
	V.options.combatLightEnabled = options.combatLightEnabled ?? V.options.combatLightEnabled;
	V.options.combatLightOffsetY = options.combatLightOffsetY ?? V.options.combatLightOffsetY;
	V.options.combatLightSpotlight = options.combatLightSpotlight ?? V.options.combatLightSpotlight;
	V.options.combatLightSpotlightX = options.combatLightSpotlightX ?? V.options.combatLightSpotlightX;
	V.options.combatLightSpotlightY = options.combatLightSpotlightY ?? V.options.combatLightSpotlightY;
	V.options.combatLightGradient = options.combatLightGradient ?? V.options.combatLightGradient;
	V.options.combatLightGlow = options.combatLightGlow ?? V.options.combatLightGlow;
	V.options.combatLightFlat = options.combatLightFlat ?? V.options.combatLightFlat;
	V.options.combatLightTFColor = options.combatLightTFColor ?? V.options.combatLightTFColor;
	V.options.maxStates = options.maxStates ?? V.options.maxStates;
	V.options.historyControls = options.historyControls ?? V.options.historyControls;
	V.options.useNarrowMarket = options.useNarrowMarket ?? V.options.useNarrowMarket;
	V.options.skipStatisticsConfirmation = options.skipStatisticsConfirmation ?? V.options.skipStatisticsConfirmation;
	V.options.passageCount = options.passageCount ?? V.options.passageCount;
	V.options.playtime = options.playtime ?? V.options.playtime;
	V.options.numberify_enabled = options.numberify_enabled ?? V.options.numberify_enabled;
	V.options.timestyle = options.timestyle ?? V.options.timestyle;
	V.options.tipdisable = options.tipdisable ?? V.options.tipdisable;
	V.options.pepperSprayDisplay = options.pepperSprayDisplay ?? V.options.pepperSprayDisplay;
	V.options.condomsDisplay = options.condomsDisplay ?? V.options.condomsDisplay;
	V.options.closeButtonMobile = options.closeButtonMobile ?? V.options.closeButtonMobile;
	V.options.showDebugRenderer = options.showDebugRenderer ?? V.options.showDebugRenderer;
	V.options.showCombatTools = options.showCombatTools ?? V.options.showCombatTools;
	V.options.numpad = options.numpad ?? V.options.numpad;
	V.options.traitOverlayFormat = options.traitOverlayFormat ?? V.options.traitOverlayFormat;
	V.options.font = options.font ?? V.options.font;
	V.options.passageLineHeight = options.passageLineHeight ?? V.options.passageLineHeight;
	V.options.overlayLineHeight = options.overlayLineHeight ?? V.options.overlayLineHeight;
	V.options.sidebarLineHeight = options.sidebarLineHeight ?? V.options.sidebarLineHeight;
	V.options.passageFontSize = options.passageFontSize ?? V.options.passageFontSize;
	V.options.overlayFontSize = options.overlayFontSize ?? V.options.overlayFontSize;
	V.options.sidebarFontSize = options.sidebarFontSize ?? V.options.sidebarFontSize;
	V.options.genderBody = options.genderBody ?? V.options.genderBody;
	V.options.notesAutoSave = options.notesAutoSave ?? V.options.notesAutoSave;
	V.options.dateFormat = options.dateFormat ?? V.options.dateFormat;
}

function applyShopDefaults(shopDefaults) {
	V.shopDefaults.alwaysBackToShopButton = shopDefaults.alwaysBackToShopButton ?? V.shopDefaults.alwaysBackToShopButton;
	V.shopDefaults.color = shopDefaults.color ?? V.shopDefaults.color;
	V.shopDefaults.colourItems = shopDefaults.colourItems ?? V.shopDefaults.colourItems;
	V.shopDefaults.compactMode = shopDefaults.compactMode ?? V.shopDefaults.compactMode;
	V.shopDefaults.disableReturn = shopDefaults.disableReturn ?? V.shopDefaults.disableReturn;
	V.shopDefaults.highContrast = shopDefaults.highContrast ?? V.shopDefaults.highContrast;
	V.shopDefaults.mannequinGender = shopDefaults.mannequinGender ?? V.shopDefaults.mannequinGender;
	V.shopDefaults.mannequinGenderFromClothes = shopDefaults.mannequinGenderFromClothes ?? V.shopDefaults.mannequinGenderFromClothes;
	V.shopDefaults.noHelp = shopDefaults.noHelp ?? V.shopDefaults.noHelp;
	V.shopDefaults.noTraits = shopDefaults.noTraits ?? V.shopDefaults.noTraits;
	V.shopDefaults.secColor = shopDefaults.secColor ?? V.shopDefaults.secColor;
}

function applyWardrobeDefaults(wardrobeDefaults) {
	V.wardrobeDefaults.showTraits = wardrobeDefaults.showTraits ?? V.wardrobeDefaults.showTraits;
	V.wardrobeDefaults.extraInfo = wardrobeDefaults.extraInfo ?? V.wardrobeDefaults.extraInfo;
}

/**
 * @param {"text" | "file"} type "text" to fill the textarea, "file" to download.
 */
function exportSettings(type) {
	const result = JSON.stringify(settingsToExportObject());
	if (type === "text") {
		document.getElementById("settingsDataInput").value = result;
	} else if (type === "file") {
		saveAs(new Blob([result], { type: "text/plain;charset=utf-8" }), "DolSettingsExport.txt");
	}
}
window.exportSettings = exportSettings;

function settingsToExportObject() {
	const data = {
		starting: {
			bodysize: V.bodysize,
			facevariant: V.facevariant,
			breastsensitivity: V.breastsensitivity,
			genitalsensitivity: V.genitalsensitivity,
			mouthsensitivity: V.mouthsensitivity,
			bottomsensitivity: V.bottomsensitivity,
			drunkSensitivity: V.drunkSensitivity,
			eyeselect: V.eyeselect,
			hairselect: V.hairselect,
			hairlength: V.hairlength,
			awareselect: V.awareselect,
			background: V.background,
			startingseason: V.startingseason,
			gamemode: V.gamemode,
			ironmanmode: V.ironmanmode,
			player: {
				gender: V.player.gender,
				sex: V.player.sex,
				gender_body: V.player.gender_body,
				bodyshape: V.player.bodyshape,
				skinColour: V.player.skin.color,
				ballsExist: V.player.ballsExist,
				freckles: V.player.freckles,
				breastsize: V.player.breastsize,
				penissize: V.player.penissize,
				bottomsize: V.player.bottomsize,
			},
		},
		general: {
			breastsizemin: V.breastsizemin,
			breastsizemax: V.breastsizemax,
			bottomsizemin: V.bottomsizemin,
			bottomsizemax: V.bottomsizemax,
			penissizemin: V.penissizemin,
			penissizemax: V.penissizemax,
			confirmSave: V.confirmSave,
			confirmLoad: V.confirmLoad,
			confirmDelete: V.confirmDelete,
			reducedLineHeight: V.reducedLineHeight,
			outfitEditorPerPage: V.outfitEditorPerPage,
			settings: {
				analEnabled: V.settings.analEnabled,
				analingusGivingEnabled: V.settings.analingusGivingEnabled,
				analingusReceivingEnabled: V.settings.analingusReceivingEnabled,
				transformAnimalEnabled: V.settings.transformAnimalEnabled,
				asphyxiaLevel: V.settings.asphyxiaLevel,
				penisModifier: V.settings.penisModifier,
				breastModifier: V.settings.breastModifier,
				rentCostModifier: V.settings.rentCostModifier,
				baseNpcPregnancyChance: V.settings.baseNpcPregnancyChance,
				basePlayerPregnancyChance: V.settings.basePlayerPregnancyChance,
				beesEnabled: V.settings.beesEnabled,
				blindStatsEnabled: V.settings.blindStatsEnabled,
				bodyWritingLevel: V.settings.bodyWritingLevel,
				breastFeedingEnabled: V.settings.breastFeedingEnabled,
				cheatsEnabledToggle: V.settings.cheatsEnabledToggle,
				condomLevel: V.settings.condomLevel,
				clothingCostModifier: V.settings.clothingCostModifier,
				furnitureCostModifier: V.settings.furnitureCostModifier,
				lewdClothingCostModifier: V.settings.lewdClothingCostModifier,
				schoolClothingCostModifier: V.settings.schoolClothingCostModifier,
				underwearCostModifier: V.settings.underwearCostModifier,
				tendingYieldModifier: V.settings.tendingYieldModifier,
				toyDildoEnabled: V.settings.toyDildoEnabled,
				transformDivineEnabled: V.settings.transformDivineEnabled,
				analDoubleEnabled: V.settings.analDoubleEnabled,
				vaginalDoubleEnabled: V.settings.vaginalDoubleEnabled,
				allureModifier: V.settings.allureModifier,
				facesitEnabled: V.settings.facesitEnabled,
				pregnancySpeechEnabled: V.settings.pregnancySpeechEnabled,
				footFetishEnabled: V.settings.footFetishEnabled,
				forcedCrossdressingEnabled: V.settings.forcedCrossdressingEnabled,
				granularBeastControl: V.settings.granularBeastControl,
				humanPregnancyMonths: V.settings.humanPregnancyMonths,
				hypnosisEnabled: V.settings.hypnosisEnabled,
				npcVirginChanceAdult: V.settings.npcVirginChanceAdult,
				npcVirginChanceStudent: V.settings.npcVirginChanceStudent,
				skinToneMin: V.settings.skinToneMin,
				skinToneMode: V.settings.skinToneMode,
				skinToneMax: V.settings.skinToneMax,
				lurkersEnabled: V.settings.lurkersEnabled,
				fertilityCycleEnabled: V.settings.fertilityCycleEnabled,
				toyMultiplePenetrationEnabled: V.settings.toyMultiplePenetrationEnabled,
				multipleWardrobes: V.settings.multipleWardrobes,
				maleChanceSplit: V.settings.maleChanceSplit,
				npcPregnancyEnabled: V.settings.npcPregnancyEnabled,
				nnpcPregnancyEnabled: V.settings.nnpcPregnancyEnabled,
				analPregnancy: V.settings.analPregnancy,
				npcAnalPregnancyEnabled: V.settings.npcAnalPregnancyEnabled,
				maleChanceMale: V.settings.maleChanceMale,
				maleChanceFemale: V.settings.maleChanceFemale,
				nudeGenderPerception: V.settings.nudeGenderPerception,
				parasitePregnancyEnabled: V.settings.parasitePregnancyEnabled,
				parasitesEnabled: V.settings.parasitesEnabled,
				maleNPCVaginaChance: V.settings.maleNPCVaginaChance,
				maleVictimChance: V.settings.maleVictimChance,
				maleChance: V.settings.maleChance,
				femaleNPCPenisChance: V.settings.femaleNPCPenisChance,
				straponChance: V.settings.straponChance,
				plantsEnabled: V.settings.plantsEnabled,
				playerPregnancyEggLayingEnabled: V.settings.playerPregnancyEggLayingEnabled,
				playerPregnancyBeastEnabled: V.settings.playerPregnancyBeastEnabled,
				playerPregnancyHumanEnabled: V.settings.playerPregnancyHumanEnabled,
				pregnancyType: V.settings.pregnancyType,
				pubicHairEnabled: V.settings.pubicHairEnabled,
				ruinedOrgasmEnabled: V.settings.ruinedOrgasmEnabled,
				skillCheckStyle: V.settings.skillCheckStyle,
				slimesEnabled: V.settings.slimesEnabled,
				slugsEnabled: V.settings.slugsEnabled,
				spidersEnabled: V.settings.spidersEnabled,
				swarmsEnabled: V.settings.swarmsEnabled,
				tentaclesEnabled: V.settings.tentaclesEnabled,
				voreEnabled: V.settings.voreEnabled,
				waspsEnabled: V.settings.waspsEnabled,
				watersportsEnabled: V.settings.watersportsEnabled,
				toyWhipEnabled: V.settings.toyWhipEnabled,
				wolfPregnancyWeeks: V.settings.wolfPregnancyWeeks,
				condomChance: V.settings.condomChance,
				condomUseChanceRape: V.settings.condomUseChanceRape,
				condomUseChanceConsensual: V.settings.condomUseChanceConsensual,
				incompletePregnancyEnabled: V.settings.incompletePregnancyEnabled,
				beastSettings: {},
				namedBeasts: {},
			},
			options: {
				neverNudeMenus: V.options.neverNudeMenus,
				showCaptionText: V.options.showCaptionText,
				clothingCaption: V.options.clothingCaption,
				clothingReplacementWarning: V.options.clothingReplacementWarning,
				sidebarStats: V.options.sidebarStats,
				sidebarTime: V.options.sidebarTime,
				combatControls: V.options.combatControls,
				mapMovement: V.options.mapMovement,
				mapTop: V.options.mapTop,
				mapMarkers: V.options.mapMarkers,
				images: V.options.images,
				combatImages: V.options.combatImages,
				bodywritingImages: V.options.bodywritingImages,
				silhouetteEnabled: V.options.silhouetteEnabled,
				sidebarAnimations: V.options.sidebarAnimations,
				blinkingEnabled: V.options.blinkingEnabled,
				combatAnimations: V.options.combatAnimations,
				halfClosedEnabled: V.options.halfClosedEnabled,
				characterLightEnabled: V.options.characterLightEnabled,
				lightSpotlight: V.options.lightSpotlight,
				lightGradient: V.options.lightGradient,
				lightGlow: V.options.lightGlow,
				lightFlat: V.options.lightFlat,
				lightTFColor: V.options.lightTFColor,
				combatLightEnabled: V.options.combatLightEnabled,
				combatLightOffsetY: V.options.combatLightOffsetY,
				combatLightSpotlight: V.options.combatLightSpotlight,
				combatLightSpotlightX: V.options.combatLightSpotlightX,
				combatLightSpotlightY: V.options.combatLightSpotlightY,
				combatLightGradient: V.options.combatLightGradient,
				combatLightGlow: V.options.combatLightGlow,
				combatLightFlat: V.options.combatLightFlat,
				combatLightTFColor: V.options.combatLightTFColor,
				maxStates: V.options.maxStates,
				historyControls: V.options.historyControls,
				useNarrowMarket: V.options.useNarrowMarket,
				skipStatisticsConfirmation: V.options.skipStatisticsConfirmation,
				passageCount: V.options.passageCount,
				playtime: V.options.playtime,
				numberify_enabled: V.options.numberify_enabled,
				timestyle: V.options.timestyle,
				tipdisable: V.options.tipdisable,
				pepperSprayDisplay: V.options.pepperSprayDisplay,
				condomsDisplay: V.options.condomsDisplay,
				closeButtonMobile: V.options.closeButtonMobile,
				showDebugRenderer: V.options.showDebugRenderer,
				showCombatTools: V.options.showCombatTools,
				numpad: V.options.numpad,
				traitOverlayFormat: V.options.traitOverlayFormat,
				font: V.options.font,
				passageLineHeight: V.options.passageLineHeight,
				overlayLineHeight: V.options.overlayLineHeight,
				sidebarLineHeight: V.options.sidebarLineHeight,
				passageFontSize: V.options.passageFontSize,
				overlayFontSize: V.options.overlayFontSize,
				sidebarFontSize: V.options.sidebarFontSize,
				genderBody: V.options.genderBody,
				notesAutoSave: V.options.notesAutoSave,
				dateFormat: V.options.dateFormat,
			},
			shopDefaults: {
				alwaysBackToShopButton: V.shopDefaults.alwaysBackToShopButton,
				color: V.shopDefaults.color,
				colourItems: V.shopDefaults.colourItems,
				compactMode: V.shopDefaults.compactMode,
				disableReturn: V.shopDefaults.disableReturn,
				highContrast: V.shopDefaults.highContrast,
				mannequinGender: V.shopDefaults.mannequinGender,
				mannequinGenderFromClothes: V.shopDefaults.mannequinGenderFromClothes,
				noHelp: V.shopDefaults.noHelp,
				noTraits: V.shopDefaults.noTraits,
				secColor: V.shopDefaults.secColor,
			},
			wardrobeDefaults: {
				showTraits: V.wardrobeDefaults.showTraits,
				extraInfo: V.wardrobeDefaults.extraInfo,
			},
		},
		npc: {},
	};

	C.beastSettingTypes.forEach(type => {
		data.general.settings.beastSettings[type] = {
			monsterChance: V.settings.beastSettings[type].monsterChance,
			hallucinationsOnly: V.settings.beastSettings[type].hallucinationsOnly,
			maleChance: V.settings.beastSettings[type].maleChance,
			maleChanceMale: V.settings.beastSettings[type].maleChanceMale,
			maleChanceFemale: V.settings.beastSettings[type].maleChanceFemale,
			maleChanceSplit: V.settings.beastSettings[type].maleChanceSplit,
			bestiality: V.settings.beastSettings[type].bestiality,
			victimsAlwaysMonster: V.settings.beastSettings[type].victimsAlwaysMonster,
		};
	});

	C.namedBeasts.forEach(beast => {
		data.general.settings.namedBeasts[beast] = {
			monsterChance: V.settings.namedBeasts[beast].monsterChance,
			hallucinationsOnly: V.settings.namedBeasts[beast].hallucinationsOnly,
		};
	});

	V.NPCNameList.forEach((name, i) => {
		data.npc[name] = {
			pronoun: V.NPCName[i].pronoun,
			gender: V.NPCName[i].gender,
			skincolour: V.NPCName[i].skincolour,
			skinType: V.NPCName[i].skinType,
			penissize: V.NPCName[i].penissize,
			breastsize: V.NPCName[i].breastsize,
		};
	});

	return data;
}

/**
 * @param {string} varName The setting's variable name.
 * @returns {string} The name to show.
 */
window.settingNameFromVarName = function (varName) {
	switch (varName) {
		case "dog":
			return "Dogs";
		case "cat":
			return "Cats";
		case "pig":
			return "Pigs";
		case "boar":
			return "Boars";
		case "wolf":
			return "Wolves";
		case "bear":
			return "Bears";
		case "dolphin":
			return "Dolphins";
		case "lizard":
			return "Lizards";
		case "cow":
			return "Cattle";
		case "horse":
			return "Horses";
		case "fox":
			return "Foxes";
		case "hawk":
			return "Hawks";
		case "spider":
			return "Spiders";
		case "snake":
			return "Snakes";
		case "blackwolf":
			return "Black Wolf";
		case "greathawk":
			return "Great Hawk";
		case "nightmonster":
			return "Night Monster";
		case "bodysize":
			return "Body size";
		case "facevariant":
			return "Demeanour";
		case "breastsensitivity":
			return "Breast sensitivity";
		case "genitalsensitivity":
			return "Genital sensitivity";
		case "mouthsensitivity":
			return "Mouth sensitivity";
		case "bottomsensitivity":
			return "Bottom sensitivity";
		case "drunkSensitivity":
			return "Alcohol tolerance";
		case "eyeselect":
			return "Eye colour";
		case "hairselect":
			return "Hair colour";
		case "hairlength":
			return "Hair length";
		case "awareselect":
			return "Awareness";
		case "background":
			return "Background";
		case "startingseason":
			return "Starting season";
		case "gamemode":
			return "Game difficulty";
		case "ironmanmode":
			return "Ironman mode";
		case "gender":
			return "Gender";
		case "sex":
			return "Genitals";
		case "gender_body":
			return "Body type";
		case "bodyshape":
			return "Body shape";
		case "skinColour":
			return "Natural Skintone";
		case "ballsExist":
			return "Balls";
		case "freckles":
			return "Freckles";
		case "breastsize":
			return "Breast size";
		case "penissize":
			return "Penis size";
		case "bottomsize":
			return "Bottom size";
		case "breastsizemin":
			return "Minimum breast size";
		case "breastsizemax":
			return "Maximum breast size";
		case "bottomsizemin":
			return "Minimum bottom size";
		case "bottomsizemax":
			return "Maximum bottom size";
		case "penissizemin":
			return "Minimum penis size";
		case "penissizemax":
			return "Maximum penis size";
		case "confirmSave":
			return "Require confirmation on save";
		case "confirmLoad":
			return "Require confirmation on load";
		case "confirmDelete":
			return "Require confirmation on delete";
		case "reducedLineHeight":
			return "Reduced line height";
		case "outfitEditorPerPage":
			return "Items per page";
		case "analEnabled":
			return "Anal";
		case "analingusGivingEnabled":
			return "Analingus (Giving)";
		case "analingusReceivingEnabled":
			return "Analingus (Receiving)";
		case "transformAnimalEnabled":
			return "Animal Transformations";
		case "asphyxiaLevel":
			return "Asphyxiation";
		case "penisModifier":
			return "Average size of NPC penises";
		case "breastModifier":
			return "Average size of women's breasts";
		case "rentCostModifier":
			return "Bailey's rent";
		case "baseNpcPregnancyChance":
			return "Base NPC pregnancy chance";
		case "basePlayerPregnancyChance":
			return "Base player pregnancy chance";
		case "beesEnabled":
			return "Bees";
		case "blindStatsEnabled":
			return "Blind stats mode";
		case "bodyWritingLevel":
			return "Bodywriting";
		case "breastFeedingEnabled":
			return "Breastfeeding";
		case "cheatsEnabledToggle":
			return "Cheat mode";
		case "condomLevel":
			return "Condoms";
		case "clothingCostModifier":
			return "Cost of clothing";
		case "furnitureCostModifier":
			return "Cost of furniture";
		case "lewdClothingCostModifier":
			return "Cost of lewd clothes";
		case "schoolClothingCostModifier":
			return "Cost of school clothes";
		case "underwearCostModifier":
			return "Cost of underwear";
		case "tendingYieldModifier":
			return "Crop yield";
		case "toyDildoEnabled":
			return "Dildos";
		case "transformDivineEnabled":
			return "Divine Transformations";
		case "analDoubleEnabled":
			return "Double Anal";
		case "vaginalDoubleEnabled":
			return "Double Vaginal";
		case "allureModifier":
			return "Encounter rate";
		case "facesitEnabled":
			return "Facesitting";
		case "pregnancySpeechEnabled":
			return "Fertility references";
		case "footFetishEnabled":
			return "Foot fetish";
		case "forcedCrossdressingEnabled":
			return "Forced crossdressing";
		case "granularBeastControl":
			return "Granular beast preferences";
		case "humanPregnancyMonths":
			return "Human pregnancy length";
		case "hypnosisEnabled":
			return "Hypnosis";
		case "npcVirginChanceAdult":
			return "Likelihood of adults being virgins";
		case "npcVirginChanceStudent":
			return "Likelihood of young adults being virgins";
		case "skinToneMin":
			return "Lightest NPC skin";
		case "skinToneMode":
			return "Most common NPC skin";
		case "skinToneMax":
			return "Darkest NPC skin";
		case "lurkersEnabled":
			return "Lurkers";
		case "fertilityCycleEnabled":
			return "Menstrual cycle";
		case "toyMultiplePenetrationEnabled":
			return "Multiple penetration with sex toys";
		case "multipleWardrobes":
			return "Multiple wardrobes";
		case "maleChanceSplit":
			return "NPC attraction split by gender appearance";
		case "npcPregnancyEnabled":
			return "Generic NPC pregnancy";
		case "nnpcPregnancyEnabled":
			return "NNPC/LI pregnancy";
		case "analPregnancy":
			return "PC anal pregnancy";
		case "npcAnalPregnancyEnabled":
			return "NPC anal pregnancy";
		case "maleChanceMale":
			return "NPCs who are attracted to men";
		case "maleChanceFemale":
			return "NPCs who are attracted to women";
		case "nudeGenderPerception":
			return "Nude gender appearance";
		case "parasitePregnancyEnabled":
			return "Parasite pregnancy";
		case "parasitesEnabled":
			return "Parasites";
		case "maleNPCVaginaChance":
			return "Percentage of men that have vaginas";
		case "maleVictimChance":
			return "Percentage of other victims that are male";
		case "maleChance":
			return "Percentage of people attracted to you that are male";
		case "femaleNPCPenisChance":
			return "Percentage of women that have penises";
		case "straponChance":
			return "Percentage of women that have strap-on penises";
		case "plantsEnabled":
			return "Plantpeople";
		case "playerPregnancyEggLayingEnabled":
			return "Player egg laying";
		case "playerPregnancyBeastEnabled":
			return "Player pregnancy with beasts";
		case "playerPregnancyHumanEnabled":
			return "Player pregnancy with humans";
		case "pregnancyType":
			return "Pregnancy mode";
		case "pubicHairEnabled":
			return "Pubic hair";
		case "ruinedOrgasmEnabled":
			return "Ruined orgasms";
		case "skillCheckStyle":
			return "Skill check display";
		case "slimesEnabled":
			return "Slimes";
		case "slugsEnabled":
			return "Slugs";
		case "spidersEnabled":
			return "Spiders";
		case "swarmsEnabled":
			return "Swarms";
		case "tentaclesEnabled":
			return "Tentacles";
		case "voreEnabled":
			return "Vore";
		case "waspsEnabled":
			return "Wasps";
		case "watersportsEnabled":
			return "Watersports";
		case "toyWhipEnabled":
			return "Whips";
		case "wolfPregnancyWeeks":
			return "Wolf pregnancy length";
		case "neverNudeMenus":
			return "Hide player nudity in menus";
		case "showCaptionText":
			return "Show caption text in sidebar";
		case "clothingCaption":
			return "Show clothing description in sidebar";
		case "clothingReplacementWarning":
			return "Enable clothing replacement warning";
		case "sidebarStats":
			return "Closed sidebar stats";
		case "sidebarTime":
			return "Closed sidebar time";
		case "combatControls":
			return "Combat controls";
		case "mapMovement":
			return "Enable movement by clicking on map";
		case "mapTop":
			return "Move the map above the map links";
		case "mapMarkers":
			return "Show clickable areas on maps";
		case "images":
			return "Images";
		case "combatImages":
			return "Combat images";
		case "bodywritingImages":
			return "Bodywriting images";
		case "silhouetteEnabled":
			return "NPC silhouettes";
		case "sidebarAnimations":
			return "Sidebar images";
		case "blinkingEnabled":
			return "Animated blinking";
		case "combatAnimations":
			return "Combat animations";
		case "halfClosedEnabled":
			return "Half-closed eyes";
		case "characterLightEnabled":
			return "Character lighting";
		case "lightSpotlight":
			return "Spotlight";
		case "lightGradient":
			return "Gradient";
		case "lightGlow":
			return "Glow";
		case "lightFlat":
			return "Flat light";
		case "lightTFColor":
			return "Angel/Devil TF colour components";
		case "combatLightEnabled":
			return "Character lighting";
		case "combatLightOffsetY":
			return "Y offset";
		case "combatLightSpotlight":
			return "Spotlight";
		case "combatLightSpotlightX":
			return "Spotlight width";
		case "combatLightSpotlightY":
			return "Spotlight height";
		case "combatLightGradient":
			return "Gradient";
		case "combatLightGlow":
			return "Glow";
		case "combatLightFlat":
			return "Flat light";
		case "combatLightTFColor":
			return "Angel/Devil TF colour components";
		case "maxStates":
			return "History depth";
		case "historyControls":
			return "Show history controls";
		case "useNarrowMarket":
			return "Use 'narrow screen' version of market inventory";
		case "skipStatisticsConfirmation":
			return "Skip confirmation when viewing extra stats";
		case "passageCount":
			return "Display passage count";
		case "playtime":
			return "Display play time";
		case "numberify_enabled":
			return "Enable numbered link navigation";
		case "timestyle":
			return "Time style";
		case "tipdisable":
			return "Sidebar Tips";
		case "pepperSprayDisplay":
			return "Pepper spray display";
		case "condomsDisplay":
			return "Condom display";
		case "closeButtonMobile":
			return "Items per page";
		case "showDebugRenderer":
			return "Enable renderer debugger";
		case "showCombatTools":
			return "Enable combat tools";
		case "numpad":
			return "Enable numpad";
		case "traitOverlayFormat":
			return "Display traits";
		case "font":
			return "Font";
		case "passageLineHeight":
			return "Passage line height";
		case "overlayLineHeight":
			return "Overlay line height";
		case "sidebarLineHeight":
			return "Sidebar line height";
		case "passageFontSize":
			return "Passage font size";
		case "overlayFontSize":
			return "Overlay font size";
		case "sidebarFontSize":
			return "Sidebar font size";
		case "genderBody":
			return "Body type displayed";
		case "notesAutoSave":
			return "Notes auto saving";
		case "dateFormat":
			return "Date format";
		case "alwaysBackToShopButton":
			return "Always show back-to-shop button";
		case "color":
			return "Default clothing colour";
		case "colourItems":
			return "Colour items";
		case "compactMode":
			return "Compact mode";
		case "disableReturn":
			return "Hide return button";
		case "highContrast":
			return "High contrast";
		case "mannequinGender":
			return "Mannequin gender";
		case "mannequinGenderFromClothes":
			return "Mannequin gender from clothes";
		case "noHelp":
			return "Hide help";
		case "noTraits":
			return "Hide traits";
		case "secColor":
			return "Default secondary clothing colour";
		case "showTraits":
			return "Show traits";
		case "extraInfo":
			return "Show extra info";
		case "monsterChance":
			return "Monster person chance";
		case "hallucinationsOnly":
			return "Monster people only while hallucinating";
		case "victimsAlwaysMonster":
			return "Victims are always monster people";
		case "bestiality":
			return "Bestiality";
		case "pronoun":
			return "Pronoun";
		case "skincolour":
			return "Skin tone";
		case "skinType":
			return "Skin type";
		default:
			return varName;
	}
};

/**
 * @param {string} varName The setting's variable name.
 * @param {any} value The value from the settings string.
 * @returns {any} The value to show.
 */
function settingValueNameFromValue(varName, value) {
	switch (varName) {
		case "bodysize":
			switch (value) {
				case 0:
					return "Tiny";
				case 1:
					return "Small";
				case 2:
					return "Normal";
				case 3:
					return "Large";
			}
			break;
		case "facevariant":
			switch (value) {
				case "default":
					return "Default";
				case "catty":
					return "Catty";
				case "aloof":
					return "Aloof";
				case "sweet":
					return "Sweet";
				case "foxy":
					return "Foxy";
				case "gloomy":
					return "Gloomy";
			}
			break;
		case "breastsensitivity":
			switch (value) {
				case 1:
					return "Normal";
				case 2:
					return "Sensitive";
				case 3:
					return "Very Sensitive";
			}
			break;
		case "genitalsensitivity":
			switch (value) {
				case 1:
					return "Normal";
				case 2:
					return "Sensitive";
				case 3:
					return "Very Sensitive";
			}
			break;
		case "mouthsensitivity":
			switch (value) {
				case 1:
					return "Normal";
				case 2:
					return "Sensitive";
				case 3:
					return "Very Sensitive";
			}
			break;
		case "bottomsensitivity":
			switch (value) {
				case 1:
					return "Normal";
				case 2:
					return "Sensitive";
				case 3:
					return "Very Sensitive";
			}
			break;
		case "drunkSensitivity":
			switch (value) {
				case 1:
					return "Normal";
				case 0.5:
					return "Heavyweight";
				case 1.5:
					return "Lightweight";
			}
			break;
		case "eyeselect":
			switch (value) {
				case "purple":
					return "Purple";
				case "dark blue":
					return "Dark blue";
				case "light blue":
					return "Light blue";
				case "amber":
					return "Amber";
				case "hazel":
					return "Hazel";
				case "brown":
					return "Brown";
				case "green":
					return "Green";
				case "lime green":
					return "Lime green";
				case "red":
					return "Red";
				case "pink":
					return "Pink";
				case "black":
					return "Black";
				case "grey":
					return "Grey";
				case "light grey":
					return "Light grey";
				case "random":
					return "Random";
			}
			break;
		case "hairselect":
			switch (value) {
				case "red":
					return "Red";
				case "jetblack":
					return "Jet black";
				case "black":
					return "Black";
				case "darkbrown":
					return "Dark brown";
				case "brown":
					return "Brown";
				case "copperbrown":
					return "Copper brown";
				case "softbrown":
					return "Soft brown";
				case "lightbrown":
					return "Light brown";
				case "burntorange":
					return "Burnt orange";
				case "blond":
					return "Blond";
				case "softblond":
					return "Soft blond";
				case "platinumblond":
					return "Platinum blond";
				case "ashyblond":
					return "Ashy blond";
				case "strawberryblond":
					return "Strawberry blond";
				case "ginger":
					return "Ginger";
				case "white":
					return "White";
				case "snowwhite":
					return "Snow white";
				case "random":
					return "Random";
			}
			break;
		case "awareselect":
			switch (value) {
				case "innocent":
					return "Innocent";
				case "knowledgeable":
					return "Knowledgeable";
			}
			break;
		case "background":
			switch (value) {
				case "waif":
					return "Waif";
				case "nerd":
					return "Nerd";
				case "athlete":
					return "Athlete";
				case "delinquent":
					return "Delinquent";
				case "promiscuous":
					return "Promiscuous";
				case "exhibitionist":
					return "Exhibitionist";
				case "deviant":
					return "Deviant";
				case "beautiful":
					return "Beautiful";
				case "crossdresser":
					return "Crossdresser";
				case "lustful":
					return "Lustful";
				case "plantlover":
					return "Plant lover";
			}
			break;
		case "startingseason":
			switch (value) {
				case "spring":
					return "Spring";
				case "summer":
					return "Summer";
				case "autumn":
					return "Autumn";
				case "winter":
					return "Winter";
				case "random":
					return "Random";
			}
			break;
		case "gamemode":
			switch (value) {
				case "normal":
					return "Normal";
				case "soft":
					return "Soft";
				case "hard":
					return "Hard";
			}
			break;
		case "gender":
			switch (value) {
				case "m":
					return "Male";
				case "f":
					return "Female";
				case "n":
					return "Neither";
			}
			break;
		case "sex":
			switch (value) {
				case "m":
					return "Penis";
				case "f":
					return "Vagina";
				case "h":
					return "Hermaphrodite";
			}
			break;
		case "gender_body":
			switch (value) {
				case "m":
					return "Masculine";
				case "f":
					return "Feminine";
				case "a":
					return "Androgynous";
			}
			break;
		case "bodyshape":
			switch (value) {
				case "classic":
					return "Classic";
				case "slender":
					return "Slender";
				case "curvy":
					return "Curvy";
				case "soft":
					return "Soft";
			}
			break;
		case "skinColour":
			switch (value) {
				case "light":
					return "Neutral Light";
				case "medium":
					return "Neutral Medium";
				case "dark":
					return "Neutral Dark";
				case "gyaru":
					return "Neutral Gyaru";
				case "rlight":
					return "Warm Light";
				case "rmedium":
					return "Warm Medium";
				case "rdark":
					return "Warm Dark";
				case "rgyaru":
					return "Warm Gyaru";
				case "glight":
					return "Golden Light";
				case "gmedium":
					return "Golden Medium";
				case "gdark":
					return "Golden Dark";
				case "ggyaru":
					return "Golden Gyaru";
				case "ylight":
					return "Olive Light";
				case "ymedium":
					return "Olive Medium";
				case "ydark":
					return "Olive Dark";
				case "ygyaru":
					return "Olive Gyaru";
				case "blight":
					return "Cool Light";
				case "bmedium":
					return "Cool Medium";
				case "bdark":
					return "Cool Dark";
				case "bgyaru":
					return "Cool Gyaru";
			}
			break;
		case "ballsExist":
			switch (value) {
				case true:
					return "Existent";
				case false:
					return "Nonexistent";
			}
			break;
		case "freckles":
			switch (value) {
				case true:
					return "Existent";
				case false:
					return "Nonexistent";
				case "random":
					return "Random";
			}
			break;
		case "breastsize":
			switch (value) {
				case 0:
					return "Flat";
				case 1:
					return "Budding";
				case 2:
					return "Tiny";
				case 3:
					return "Small";
				case 4:
					return "Pert";
			}
			break;
		case "penissize":
			switch (value) {
				case 0:
					return "Tiny";
				case 1:
					return "Small";
				case 2:
					return "Normal";
			}
			break;
		case "bottomsize":
			switch (value) {
				case 0:
					return "Slender";
				case 1:
					return "Slim";
				case 2:
					return "Modest";
				case 3:
					return "Cushioned";
			}
			break;
		case "breastsizemin":
			switch (value) {
				case 0:
					return "Flat";
				case 1:
					return "Budding";
				case 2:
					return "Tiny";
				case 3:
					return "Small";
				case 4:
					return "Pert";
			}
			break;
		case "breastsizemax":
			switch (value) {
				case 0:
					return "Flat";
				case 1:
					return "Budding";
				case 2:
					return "Tiny";
				case 3:
					return "Small";
				case 4:
					return "Pert";
				case 5:
					return "Modest";
				case 6:
					return "Full";
				case 7:
					return "Large";
				case 8:
					return "Ample";
				case 9:
					return "Massive";
				case 10:
					return "Huge";
				case 11:
					return "Gigantic";
				case 12:
					return "Enormous";
			}
			break;
		case "bottomsizemin":
			switch (value) {
				case 0:
					return "Slender";
				case 1:
					return "Slim";
				case 2:
					return "Modest";
				case 3:
					return "Cushioned";
			}
			break;
		case "bottomsizemax":
			switch (value) {
				case 0:
					return "Slender";
				case 1:
					return "Slim";
				case 2:
					return "Modest";
				case 3:
					return "Cushioned";
				case 4:
					return "Soft";
				case 5:
					return "Round";
				case 6:
					return "Plump";
				case 7:
					return "Large";
				case 8:
					return "Huge";
			}
			break;
		case "penissizemin":
			switch (value) {
				case 0:
					return "Micro";
				case 1:
					return "Mini";
				case 2:
					return "Tiny";
			}
			break;
		case "penissizemax":
			switch (value) {
				case 0:
					return "Micro";
				case 1:
					return "Mini";
				case 2:
					return "Tiny";
				case 3:
					return "Small";
				case 4:
					return "Normal";
				case 5:
					return "Large";
				case 6:
					return "Enormous";
			}
			break;
		case "asphyxiaLevel":
			switch (value) {
				case 0:
					return "NPCs will not touch your neck";
				case 1:
					return "NPCs may grab you by the neck without impeding breathing";
				case 2:
					return "NPCs may try to choke you during consensual encounters";
				case 3:
					return "NPCs may try to strangle you during non-consensual encounters";
			}
			break;
		case "bodyWritingLevel":
			switch (value) {
				case 0:
					return "NPCs will not write on you";
				case 1:
					return "NPCs may ask to write on you";
				case 2:
					return "NPCs may forcibly write on you";
				case 3:
					return "NPCs may forcibly write on and tattoo you";
			}
			break;
		case "condomLevel":
			switch (value) {
				case 0:
					return "Everyone is allergic to latex and safe sex";
				case 1:
					return "Only you may use condoms, but you may give NPCs condoms";
				case 2:
					return "NPCs will only have condoms if pregnancy between them and the player is possible";
				case 3:
					return "NPCs may have and use condoms whenever they please";
			}
			break;
		case "multipleWardrobes":
			switch (value) {
				case false:
					return "One shared wardrobe";
				case "isolated":
					return "Separate per location";
			}
			break;
		case "analPregnancy":
			switch (value) {
				case false:
					return "Disabled";
				case "exceptional":
					return "Exceptional circumstances only";
				case "always":
					return "Always";
			}
			break;
		case "nudeGenderPerception":
			switch (value) {
				case 0:
					return "NPCs will ignore genitals when perceiving gender";
				case 1:
					return "NPCs will consider your genitals when perceiving your gender";
				case 2:
					return "NPCs will judge your gender based on your genitals";
				case -1:
					return "NPCs will ignore genitals when perceiving gender, and crossdressing warnings will not be displayed";
			}
			break;
		case "pregnancyType":
			switch (value) {
				case "realistic":
					return "Realistic";
				case "fetish":
					return "Fetishised";
			}
			break;
		case "skillCheckStyle":
			switch (value) {
				case "percentage":
					return "Exact chance of success";
				case "words":
					return "General chance of success";
				case "skillname":
					return "Skill name only";
			}
			break;
		case "sidebarStats":
			switch (value) {
				case "disabled":
					return "Disabled";
				case "limited":
					return "Limited";
				case "all":
					return "All";
			}
			break;
		case "sidebarTime":
			switch (value) {
				case "disabled":
					return "Disabled";
				case "top":
					return "Top";
				case "bottom":
					return "Bottom";
			}
			break;
		case "combatControls":
			switch (value) {
				case "radio":
					return "Radio buttons";
				case "columnRadio":
					return "Radio buttons in columns";
				case "lists":
					return "Lists";
				case "limitedLists":
					return "Limited lists";
			}
			break;
		case "passageCount":
			switch (value) {
				case "disabled":
					return "Disabled";
				case "changes":
					return "Passage changes count";
				case "total":
					return "Passage count";
			}
			break;
		case "numberify_enabled":
		case "images":
		case "combatImages":
		case "lightFlat":
		case "combatLightGradient":
		case "combatLightFlat":
			switch (value) {
				case 0:
					return "Disabled";
				case 1:
					return "Enabled";
			}
			break;
		case "timestyle":
			switch (value) {
				case "military":
					return "Military (24-Hour)";
				case "ampm":
					return "AM/PM (12-Hour)";
			}
			break;
		case "tipdisable":
			return value ? "Disabled" : "Enabled";
		case "pepperSprayDisplay":
			switch (value) {
				case "none":
					return "Hidden";
				case "sprays":
					return "Sprays";
				case "compact":
					return "Compact";
			}
			break;
		case "condomsDisplay":
			switch (value) {
				case "none":
					return "Hidden";
				case "standard":
					return "Standard";
			}
			break;
		case "traitOverlayFormat":
			switch (value) {
				case "table":
					return "Table";
				case "reducedTable":
					return "Reduced table";
				case "list":
					return "List";
			}
			break;
		case "font":
			switch (value) {
				case "":
					return "Default";
				case "Arial":
					return "Arial";
				case "Verdana":
					return "Verdana";
				case "TimesNewRoman":
					return "Times New Roman";
				case "Georgia":
					return "Georgia";
				case "Garamond":
					return "Garamond";
				case "CourierNew":
					return "Courier New";
				case "LucidaConsole":
					return "Lucida Console";
				case "Monaco":
					return "Monaco";
				case "ComicSans":
					return "Comic Sans";
			}
			break;
		case "passageLineHeight":
			switch (value) {
				case 0:
					return "Default";
			}
			break;
		case "overlayLineHeight":
			switch (value) {
				case 0:
					return "Default";
			}
			break;
		case "sidebarLineHeight":
			switch (value) {
				case 0:
					return "Default";
			}
			break;
		case "passageFontSize":
			switch (value) {
				case 0:
					return "Default";
			}
			break;
		case "overlayFontSize":
			switch (value) {
				case 0:
					return "Default";
			}
			break;
		case "sidebarFontSize":
			switch (value) {
				case 0:
					return "Default";
			}
			break;
		case "genderBody":
			switch (value) {
				case "default":
					return "Default";
				case "m":
					return "Masculine";
				case "a":
					return "Androgynous";
				case "f":
					return "Feminine";
			}
			break;
		case "dateFormat":
			switch (value) {
				case "en-GB":
					return "Day/Month/Year";
				case "en-US":
					return "Month/Day/Year";
				case "zh-CN":
					return "Year/Month/Day";
			}
			break;
		case "color":
			switch (value) {
				case "black":
					return "Black";
				case "blue":
					return "Blue";
				case "brown":
					return "Brown";
				case "green":
					return "Green";
				case "pink":
					return "Pink";
				case "purple":
					return "Purple";
				case "red":
					return "Red";
				case "tangerine":
					return "Tangerine";
				case "teal":
					return "Teal";
				case "white":
					return "White";
				case "yellow":
					return "Yellow";
				case "custom":
					return "Custom";
				case "random":
					return "Random";
			}
			break;
		case "colourItems":
			switch (value) {
				case "disable":
					return "Disabled";
				case "random":
					return "Random";
				case "default":
					return "Default";
			}
			break;
		case "mannequinGender":
			switch (value) {
				case "same":
					return "Same as player";
				case "opposite":
					return "Opposite of player";
				case "male":
					return "Male";
				case "female":
					return "Female";
			}
			break;
		case "secColor":
			switch (value) {
				case "black":
					return "Black";
				case "blue":
					return "Blue";
				case "brown":
					return "Brown";
				case "green":
					return "Green";
				case "pink":
					return "Pink";
				case "purple":
					return "Purple";
				case "red":
					return "Red";
				case "tangerine":
					return "Tangerine";
				case "teal":
					return "Teal";
				case "white":
					return "White";
				case "yellow":
					return "Yellow";
				case "custom":
					return "Custom";
				case "random":
					return "Random";
			}
			break;
		case "bestiality":
			switch (value) {
				case "on":
					return "Enabled";
				case "off":
					return "Disabled";
				case "monsterOnly":
					return "Only as monster people";
			}
			break;
		case "pronoun":
			switch (value) {
				case "none":
					return "N/A";
				case "m":
					return "Male";
				case "f":
					return "Female";
			}
			break;
		case "skinType":
			switch (value) {
				case "ghost":
					return "Ghostly Pale";
			}
			break;
		case "skincolour":
			return setup.colours.getSkinToneLabel(value);
		case "skinToneMin":
		case "skinToneMode":
		case "skinToneMax":
			return `${value} (${setup.colours.getSkinToneLabel(value)})`;
	}

	switch (varName) {
		case "rentCostModifier":
		case "clothingCostModifier":
		case "furnitureCostModifier":
		case "lewdClothingCostModifier":
		case "schoolClothingCostModifier":
		case "underwearCostModifier":
		case "tendingYieldModifier":
		case "allureModifier":
			return Math.round(value * 100) + "%";
		case "maleChance":
		case "maleChanceMale":
		case "maleChanceFemale":
		case "femaleNPCPenisChance":
		case "maleNPCVaginaChance":
		case "maleVictimChance":
		case "npcVirginChanceStudent":
		case "npcVirginChanceAdult":
		case "straponChance":
		case "monsterChance":
		case "basePlayerPregnancyChance":
		case "baseNpcPregnancyChance":
			return value + "%";
		case "humanPregnancyMonths":
			return value + (value === 1 ? " month" : " months");
		case "wolfPregnancyWeeks":
			return value + (value === 1 ? " week" : " weeks");
	}

	switch (value) {
		case true:
			return "Enabled";
		case false:
			return "Disabled";
		default:
			return value;
	}
}
window.settingValueNameFromValue = settingValueNameFromValue;

function randomiseCharacterAppearance() {
	V.bodysize = random(0, 3);
	V.facevariant = either("default", "catty", "aloof", "sweet", "foxy", "gloomy");
	V.eyeselect = either(
		"purple",
		"dark blue",
		"light blue",
		"amber",
		"hazel",
		"brown",
		"green",
		"lime green",
		"red",
		"pink",
		"black",
		"grey",
		"light grey",
		"random"
	);
	V.hairselect = either(
		"red",
		"jetblack",
		"black",
		"darkbrown",
		"brown",
		"copperbrown",
		"softbrown",
		"lightbrown",
		"burntorange",
		"blond",
		"softblond",
		"platinumblond",
		"ashyblond",
		"strawberryblond",
		"ginger",
		"white",
		"snowwhite",
		"random"
	);
	V.hairlength = random(0, 400);
	V.player.gender = either("m", "f", "n");
	V.player.sex = either("m", "f", "h");
	V.player.bodyshape = either("classic", "slender", "curvy", "soft");
	V.player.skin.color = either(
		"light",
		"medium",
		"dark",
		"gyaru",
		"rlight",
		"rmedium",
		"rdark",
		"rgyaru",
		"ylight",
		"ymedium",
		"ydark",
		"ygyaru",
		"glight",
		"gmedium",
		"gdark",
		"ggyaru",
		"blight",
		"bmedium",
		"bdark",
		"bgyaru"
	);
	V.player.ballsExist = either(true, false);
	V.player.freckles = either(true, false);
	V.player.breastsize = random(0, 4);
	V.player.penissize = random(0, 2);
	V.player.bottomsize = random(0, 3);
}

function randomiseCharacterTrait() {
	V.breastsensitivity = random(1, 3);
	V.genitalsensitivity = random(1, 3);
	V.mouthsensitivity = random(1, 3);
	V.bottomsensitivity = random(1, 3);
	V.drunkSensitivity = Math.round(randomFloat(0.5, 1.5) * 10) / 10;
	V.awareselect = either("innocent", "knowledgeable");
	V.background = either(
		"waif",
		"nerd",
		"athlete",
		"delinquent",
		"promiscuous",
		"exhibitionist",
		"deviant",
		"beautiful",
		"crossdresser",
		"lustful",
		"plantlover"
	);
}

function randomiseEncounterSettings() {
	V.settings.penisModifier = random(-8, 8);
	V.settings.breastModifier = random(-12, 12);
	V.settings.npcVirginChanceAdult = random(0, 100);
	V.settings.npcVirginChanceStudent = random(0, 100);
	const skinTones = [random(0, 100), random(0, 100), random(0, 100)].sort((a, b) => a - b);
	V.settings.skinToneMin = skinTones[0];
	V.settings.skinToneMode = skinTones[1];
	V.settings.skinToneMax = skinTones[2];
	V.settings.maleChanceMale = random(0, 100);
	V.settings.maleChanceFemale = random(0, 100);
	V.settings.maleNPCVaginaChance = random(0, 100);
	V.settings.maleVictimChance = random(0, 100);
	V.settings.maleChance = random(0, 100);
	V.settings.femaleNPCPenisChance = random(0, 100);
	V.settings.straponChance = random(0, 100);

	V.genericBeastSettings.beastMaleChance = random(0, 100);
	V.genericBeastSettings.beastMaleChanceMale = random(0, 100);
	V.genericBeastSettings.beastMaleChanceFemale = random(0, 100);
	V.genericBeastSettings.monsterChance = random(0, 100);
	V.genericBeastSettings.monsterHallucinationsOnly = either(true, false);
	V.genericBeastSettings.victimsAlwaysMonster = either(true, false);
	setAllBeastsMaleChance(V.genericBeastSettings.beastMaleChance);
	setAllBeastsMaleChanceMale(V.genericBeastSettings.beastMaleChanceMale);
	setAllBeastsMaleChanceFemale(V.genericBeastSettings.beastMaleChanceFemale);
	setAllBeastsMonsterChance(V.genericBeastSettings.monsterChance);
	setAllBeastsMonsterHallucinationsOnly(V.genericBeastSettings.monsterHallucinationsOnly);
	setAllBeastsVictimsAlwaysMonster(V.genericBeastSettings.victimsAlwaysMonster);

	C.namedBeasts.forEach(beast => {
		V.settings.namedBeasts[beast].monsterChance = random(0, 100);
		V.settings.namedBeasts[beast].hallucinationsOnly = either(true, false);
	});
}

function randomiseGameplaySettings() {
	V.settings.rentCostModifier = Math.round(randomFloat(0.1, 3) * 10) / 10;
	V.settings.baseNpcPregnancyChance = random(0, 100);
	V.settings.basePlayerPregnancyChance = random(0, 100);
	V.settings.condomLevel = random(0, 3);
	V.settings.clothingCostModifier = Math.round(randomFloat(1, 10) * 10) / 10;
	V.settings.furnitureCostModifier = Math.round(randomFloat(0.6, 5) * 10) / 10;
	V.settings.lewdClothingCostModifier = Math.round(randomFloat(0.1, 2) * 10) / 10;
	V.settings.schoolClothingCostModifier = Math.round(randomFloat(1, 2) * 10) / 10;
	V.settings.underwearCostModifier = Math.round(randomFloat(1, 2) * 10) / 10;
	V.settings.tendingYieldModifier = Math.round(randomFloat(1, 10) * 10) / 10;
	V.settings.allureModifier = Math.round(randomFloat(0.2, 2) * 10) / 10;
	V.settings.skillCheckStyle = either("percentage", "words", "skillname");
}

/**
 * Randomises one category of settings, or everything when given no category.
 *
 * @param {string} category One of the randomise categories, or undefined for all of them.
 */
function randomiseSettings(category) {
	switch (category) {
		case "characterAppearance":
			randomiseCharacterAppearance();
			break;
		case "characterTrait":
			randomiseCharacterTrait();
			break;
		case "encounter":
			randomiseEncounterSettings();
			break;
		case "gameplay":
			randomiseGameplaySettings();
			break;
		default:
			if (V.passage === "Start") {
				randomiseCharacterAppearance();
				randomiseCharacterTrait();
			}
			randomiseEncounterSettings();
			randomiseGameplaySettings();
	}
}
window.randomiseSettings = randomiseSettings;

window.loadExternalExportFile = function () {
	importScripts("DolSettingsExport.js")
		.then(function () {
			const textArea = document.getElementById("settingsDataInput");
			textArea.value = JSON.stringify(DolSettingsExport);
		})
		.catch(function () {
			const button = document.getElementById("LoadExternalExportFile");
			button.value = "Error Loading";
		});
};

/**
 * instantly moves changes made in the passage into save data without changing the passage
 * WARNING: the game __will__ re-apply passage effects after reload, be sure to account for that or avoid using it
 */
function updateMoment() {
	State.history[State.activeIndex].variables = JSON.parse(JSON.stringify(V));
}
window.updateMoment = updateMoment;

window.isJsonString = function (s) {
	try {
		JSON.parse(s);
	} catch (e) {
		return false;
	}
	return true;
};

/**
 * Recursively traverses an object, reporting an error for any NaN values or null objects or functions\
 * Example: `let result = recurseNaN(a, "a");`.
 *
 * @param {object} obj The head of the object tree.
 * @param {string} path A string to indicate the path, put the object name in quotes.
 * @param {object} result An object to store the results in. - leave blank.
 * @param {Set} hist A set used for Cycle history. - leave blank.
 */

function recurseNaN(obj, path, result = null, hist = null) {
	result = Object.assign({ nulls: [], nan: [], functions: [], cycle: [] }, result);
	if (hist == null) hist = new Set([obj]);
	/* let result = {"nulls" : [], "nan" : [], "cycle" : []}; */
	for (const [key, val] of Object.entries(obj)) {
		const newPath = `${path}.${key}`;
		if (Number.isNaN(val)) {
			result.nan.push(newPath);
			continue;
		}
		if (typeof val === "function") result.functions.push(newPath);
		if (typeof val === "object") {
			if (val === null) {
				result.nulls.push(newPath);
				continue;
			}
		} else {
			continue;
		}
		if (hist.has(val)) {
			result.cycle.push(newPath);
			continue;
		}
		hist.add(val);
		recurseNaN(val, `${newPath}`, result, hist);
	}
	return result;
}
window.recurseNaN = recurseNaN;

/**
 * Recursively traverse target object, finding and returning an object containing all the NaN vars inside.
 *
 * Use with nukeNaNs to re-assign 0 to all bad NaN'd vars.	Use with caution.
 *
 * @param {object} target The object to traverse.	Defaults to V ($).
 * @returns {object} An object containing all the properties/sub-props that were NaN.
 */
function scanNaNs(target = V) {
	// If this gets set to true during function, a NaN was hit within scope.
	let isMutated = false;
	const current = Object.create({});
	// Loop through all properties of the target for NaNs and objects to scan.
	for (const [key, value] of Object.entries(target)) {
		// If value is an object, scan that property.
		if (value && typeof value === "object") {
			const resp = scanNaNs(value);
			// If scanNaNs returns a non-null object, there was a NaN somewhere, so make sure to update current obj.
			if (resp && typeof resp === "object") {
				current[key] = resp;
				isMutated = true;
			}
		} else if (typeof value === "number") {
			// Does what it says on the tin, make sure you only test numbers.
			if (isNaN(value)) {
				// Set property to a default value, likely zero.
				current[key] = 0;
				isMutated = true;
			}
		}
	}
	// Return a fully realised object, indicating there were NaNs, or null, which can be ignored.
	// isMutated controls whether we have encountered NaNs, remember to update where necessary.
	return isMutated ? current : null;
}
window.scanNaNs = scanNaNs;

function nukeNaNs(target = V) {
	for (const key in target) {
		const value = target[key];
		if (typeof value === "object" && value !== null) nukeNaNs(value);
		else if (Number.isNaN(value)) target[key] = 0;
	}
}
window.nukeNaNs = nukeNaNs;
