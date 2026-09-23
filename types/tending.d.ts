declare module "twine-sugarcube" {
	export interface SugarCubeSetupObject {
		tending: {
			plot_base: Plot;
			plot_sizes: PlotSize[];
			wateringTimes: Record<PlotSize, number>;
		};
	}

	export interface SugarCubeStoryVariables {
		plots: Record<PlotLocation, GardenPlot[]>;
	}
}

declare global {
	export type PlotSize = "small" | "medium" | "large";
	export type PlotLocation = "garden" | "farm" | "wolf" | "eden" | "asylum";

	export interface Plot {
		plant: string;
		stage: number;
		days: number;
		water: number;
		till: number;
	}

	export interface GardenPlot extends Plot {
		bed: FoodstuffPlantingBed; // Ground type
		quality: 1 | 2 | 3 | 4;
		size: PlotSize;
		baseQuality?: number; // The unfertilised quality that fertiliser quality boost moves towards.
		fertiliserDecay?: number; // Time before plot quality decays
	}
}

export {};
