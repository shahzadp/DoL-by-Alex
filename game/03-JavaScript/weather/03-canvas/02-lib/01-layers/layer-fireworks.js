Weather.Renderer.Layers.add({
	name: "fireworks",
	animation: { updateRate: 33 },
	zIndex: 8,
	blur: null,
	effects: [
		{
			effect: "fireworks",
			// Not used yet! You can test it in the Sky Testing debug passage
			drawCondition() {
				return !this.renderInstance.sidebarSkyDisabled && V.debug && V.debugFireworks;
			},
			compositeOperation: "lighter",
			params: {},
		},
	],
});
