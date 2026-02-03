declare module "twine-sugarcube" {
	export interface SugarCubeStoryVariables {}

	export interface SugarCubeSetupObject {
		plants: Dict<PlantSetup>;
		tending: {
			plot_base: Plot;
			plot_sizes: string[];
			wateringTimes: {
				[key: PlotSize]: number;
			};
		};
	}
}

declare global {
	export type Season = "spring" | "summer" | "autumn" | "winter";

	export type PlotSize = "small" | "medium" | "large";

	export interface PlantSetup {
		index: number;
		name: string;
		plural: string;
		singular?: string; // *
		/* true if separate image is used when gifting food (e.g. pizza-gift.png vs pizza.png since you are presumably not gifting an entire large pizza for your LI to immediately consume) */
		handheld_gift?: boolean;
		recipe_name?: string; // *
		seed_name?: string; // *
		plant_cost: number;
		difficulty: number;
		bed: string;
		type: string;
		days: number;
		multiplier: number;
		special: any[];
		season: Season[];
		ingredients: any[];
		ingredientIcon?: string;
		icon: string;
		shop?: any[];
		boughtInBulk?: number;
	}

	export interface Plot {
		plant: string;
		stage: number;
		days: number;
		water: number;
		till: number;
	}
}

export {};
