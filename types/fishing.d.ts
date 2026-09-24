type FishingLocationKey = "fishingBeach" | "fishingPier" | "fishingCoastPath" | "fishingForestLake" | "fishingMoor";

type FishingFishKey =
	| "haddock"
	| "salmon"
	| "trout"
	| "cod"
	| "herring"
	| "whiting"
	| "mackerel"
	| "flounder"
	| "sole"
	| "bass"
	| "roach"
	| "perch"
	| "chub"
	| "pike"
	| "eel"
	| "grayling"
	| "minnow"
	| "sprat";
type FishingFishPreferredTime = "dawn" | "day" | "dusk" | "night" | "bloodMoon";

declare module "twine-sugarcube" {
	export interface SugarCubeSetupObject {
		fishing: FishingSetup;
	}
}

declare global {
	interface FishingSetup {
		lootTables: FishingLootTables;
		reelFightMinSize: number;
	}

	interface FishingLootTables {
		fish: Record<FishingFishKey, FishConfig>;
		fishingTrash: Record<string, TrashConfig>;
		fishingClothing: Record<string, ClothingConfig>;
	}

	interface FishConfig {
		minSize: number;
		maxSize: number;
		// Preferred params are where/how to catch the largest size of the fish, and does not affect catch frequency.
		preferredSeason: Season[];
		preferredTime: FishingFishPreferredTime[];
		preferredLocation: FishingLocationKey[];
		locations: Partial<Record<FishingLocationKey, number>>;
		requiresBaitFish?: true;
		isBaitFish?: true;
		cookable: boolean;
		icon: string;
		preferredBait?: string; // Fish that aren't batfish and don't require batfish to catch have a preferred bait, which increases the odds of the fish being rolled if you're using it.
	}

	interface TrashConfig {
		weight: number;
		isLitter?: boolean;
		locations?: FishingLocationKey[];
	}

	interface ClothingConfig {
		weight: number;
		locations?: FishingLocationKey[];
	}
}

export {};
