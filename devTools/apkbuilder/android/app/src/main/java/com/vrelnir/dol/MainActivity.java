package com.vrelnir.dol;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
	@Override
	public void onCreate(Bundle savedInstanceState) {
		// local plugin: opens the system save-as dialog
		registerPlugin(io.github.amphiluke.SaveDialog.class);
		super.onCreate(savedInstanceState);
	}
}