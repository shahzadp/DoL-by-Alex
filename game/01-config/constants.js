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
};

/* Hoist Constants to the top (For statevars.js) */
// eslint-disable-next-line no-var
var Constants = ConstantsLoader.init(constants);
window.Constants = Constants;
