declare module "twine-sugarcube" {
	export interface SugarCubeStoryVariables {
		debug: 0 | 1;
		debugLines?: boolean;
		debugEnableHerms?: 0 | 1;
		debug_favourite?: DebugMenuEvent[];
		debug_custom_events?: {
			Main: DebugMenuEvent[];
			Character: DebugMenuEvent[];
			Events: DebugMenuEvent[];
		};
		debugFireworks?: boolean;
		debugWeatherBandBounds?: boolean;
		debugSkyTestingTemperature?: number;
		event?: {
			buffer: EventNpc[];
			schema: number;
		};
		/** @deprecated */
		eventslot?: number;
		/** @deprecated */
		eventtime?: number;
	}
}

declare global {
	export interface Window {
		EventSystem: EventData;
		ExecutionContext: {
			instance: {
				callStack: any;
			};
		};
	}

	export interface EventNpc {
		slot: number;
		time: number;
		area: string[];
	}

	export interface DebugMenuEvent {
		link: [string | (() => string), string | (() => string)];
		widgets: (string | (() => string))[];
		condition?: (() => boolean) | 1;
	}
}

export {};
