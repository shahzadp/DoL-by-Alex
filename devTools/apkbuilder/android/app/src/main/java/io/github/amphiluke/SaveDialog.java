package io.github.amphiluke;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.FileOutputStream;

/**
 * Opens the system "save as" dialog (Storage Access Framework) and writes the
 * supplied bytes to wherever the user chooses.
 *
 * Adapted from cordova-plugin-save-dialog, which did the same thing over
 * Cordova's bridge. The original had to stream the payload in 1MB chunks
 * because Cordova's bridge could not carry a large ArrayBuffer in one call and
 * kept the bytes in a field, which lost them if the activity was destroyed
 * while the picker was open. Here the payload rides along inside the saved
 * PluginCall, so it survives both a large file and process death.
 */
@CapacitorPlugin(name = "SaveDialog")
public class SaveDialog extends Plugin {

	/**
	 * Guards against a save large enough to blow up the bridge. Compressed game
	 * saves are text and land far below this; the limit is a safety net, not a
	 * design constraint.
	 */
	private static final int MAX_BASE64_BYTES = 24 * 1024 * 1024;

	@PluginMethod
	public void saveFile(PluginCall call) {
		String name = call.getString("name", "save.txt");
		String type = call.getString("type", "application/octet-stream");
		String data = call.getString("data");

		if (data == null) {
			call.reject("saveFile: no data provided");
			return;
		}

		// accept either a bare base64 string or a full data: URI
		int comma = data.indexOf(',');
		if (data.startsWith("data:") && comma >= 0) {
			data = data.substring(comma + 1);
		}

		if (data.length() > MAX_BASE64_BYTES) {
			call.reject("saveFile: file is too large to export (" + data.length() + " bytes of base64)");
			return;
		}

		Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
		intent.addCategory(Intent.CATEGORY_OPENABLE);
		intent.setType(type);
		intent.putExtra(Intent.EXTRA_TITLE, name);

		// keep the call (and therefore the payload) alive across the picker,
		// including if Android destroys the activity to reclaim memory
		bridge.saveCall(call);
		startActivityForResult(call, intent, "handleSaveResult");
	}

	@ActivityCallback
	private void handleSaveResult(PluginCall call, ActivityResult result) {
		if (call == null) {
			return;
		}

		if (result.getResultCode() != Activity.RESULT_OK) {
			call.reject("cancelled");
			return;
		}

		Intent data = result.getData();
		if (data == null || data.getData() == null) {
			call.reject("no location was chosen");
			return;
		}

		String payload = call.getString("data");
		if (payload == null) {
			call.reject("saveFile: the file contents were lost before the save completed");
			return;
		}
		int comma = payload.indexOf(',');
		if (payload.startsWith("data:") && comma >= 0) {
			payload = payload.substring(comma + 1);
		}

		Uri uri = data.getData();
		ParcelFileDescriptor pfd = null;
		FileOutputStream out = null;
		try {
			byte[] raw = Base64.decode(payload, Base64.DEFAULT);
			pfd = getActivity().getContentResolver().openFileDescriptor(uri, "w");
			if (pfd == null) {
				call.reject("saveFile: could not open " + uri);
				return;
			}
			out = new FileOutputStream(pfd.getFileDescriptor());
			out.write(raw);
			out.flush();

			JSObject ret = new JSObject();
			ret.put("uri", uri.toString());
			call.resolve(ret);
		} catch (Exception e) {
			call.reject("saveFile: " + e.getMessage(), e);
		} finally {
			closeQuietly(out);
			closeQuietly(pfd);
		}
	}

	private void closeQuietly(java.io.Closeable c) {
		if (c != null) {
			try {
				c.close();
			} catch (Exception ignored) {
				// nothing useful to do while closing
			}
		}
	}
}