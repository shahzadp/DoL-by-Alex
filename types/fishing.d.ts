import { ClothedSlots, ClothesItem } from "twine-sugarcube";

declare module "twine-sugarcube" {
	export interface SugarCubeSetupObject {
		fishing: FishingSetup;
	}
}

declare global {
	type FishingLocationKey = "fishingBeach" | "fishingPier" | "fishingCoastPath" | "fishingForestLake" | "fishingMoor";

	type FishingFishKey =
		| "haddock"
		| "salmon"
		| "trout"
		| "herring"
		| "whiting"
		| "mackerel"
		| "flounder"
		| "bass"
		| "roach"
		| "perch"
		| "chub"
		| "grayling"
		| "cod"
		| "pike"
		| "eel"
		| "baitfish";

	type FishingMinigameBehaviorKey = "runner" | "darter" | "panicked" | "anchor" | "thrasher" | "slipper";

	interface FishingSetup {
		lootTables: FishingLootTables;
	}

	interface FishingLootTables {
		fish: Record<FishingFishKey, FishConfig>;
		fishingTrash: Record<string, FishingTrashConfig>;
		fishingClothing: Record<string, FishingClothingConfig>;
	}

	interface FishConfig {
		minSize: number;
		maxSize: number;
		// Preferred params are where/how to catch the largest size of the fish, and does not affect catch frequency.
		preferredSeason: Season[];
		preferredLocation: FishingLocationKey[];
		locations: Partial<Record<FishingLocationKey, number>>;
		requiresBaitFish?: true;
		isBaitFish?: true;
		cookable: boolean;
		minigame?: FishMinigameConfig; // Fish without a minigame config are always reeled in without the minigame.
		icon: string;
		preferredBait?: string; // Fish that aren't batfish and don't require batfish to catch have a preferred bait, which increases the odds of the fish being rolled if you're using it.
	}

	interface FishMinigameConfig {
		behavior: FishingMinigameBehaviorKey;
		maxStamina: number;
		armFatigueDifficulty: number;
	}

	interface FishingTrashConfig {
		weight: number;
		isLitter?: boolean;
		locations?: FishingLocationKey[];
	}

	interface FishingClothingConfig {
		weight: number;
		locations?: FishingLocationKey[];
	}

	interface FishingHookedFish {
		type: FishingFishKey;
		size: number;
	}

	interface FishingCaughtClothing {
		slot: ClothedSlots;
		item: ClothesItem;
		colour: string;
	}
}

export {};
