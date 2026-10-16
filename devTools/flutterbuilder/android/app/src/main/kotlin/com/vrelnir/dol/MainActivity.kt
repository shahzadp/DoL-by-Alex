package com.vrelnir.dol

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Base64
import android.util.Log
import android.widget.Toast
import androidx.activity.result.ActivityResult
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.io.FileOutputStream

/**
 * Flutter host for Degrees of Lewdity.
 *
 * The game itself is the bundled web app running in a WebView; this class only
 * supplies the handful of things a web app genuinely cannot do for itself. The
 * save dialog is the important one: it opens the real system save-as picker
 * (Storage Access Framework), the same ACTION_CREATE_DOCUMENT dialog the Cordova
 * and Capacitor builds used, so export behaviour is unchanged. Its mirror image
 * -- ACTION_OPEN_DOCUMENT, for the story's two "Load from file" inputs -- was
 * missing entirely until now: a WebView has no file picker of its own, and
 * without a host callback the input does nothing at all.
 *
 * Extends FlutterFragmentActivity rather than FlutterActivity purely for the
 * AndroidX Activity APIs: FlutterActivity extends plain android.app.Activity
 * and so has no registerForActivityResult, which is how the save dialog result
 * comes back. The Fragment wrapper costs a few milliseconds of startup, which
 * is noise against a ~3 s load of a 50 MB story.
 */
class MainActivity : FlutterFragmentActivity() {

    private var channel: MethodChannel? = null

    /**
     * The export waiting on the system picker, if any.
     *
     * One at a time, deliberately. The previous builds also held a single
     * in-flight call, and the game only ever exports from a single button, so a
     * queue would be machinery for a case that cannot happen.
     */
    private var pendingSave: PendingSave? = null

    private data class PendingSave(val result: MethodChannel.Result, val payload: ByteArray)

    /**
     * ACTION_CREATE_DOCUMENT via the generic launcher rather than
     * ActivityResultContracts.CreateDocument: the contract binds the mime type
     * at construction time, and we do not know it until the game asks.
     */
    private val documentPicker: ActivityResultLauncher<Intent> =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result: ActivityResult ->
            completeSave(result)
        }

    /**
     * The import waiting on the system picker, if any.
     *
     * Kept apart from [pendingSave] and launched from its own launcher, so a late
     * result cannot be delivered to the wrong pending call.
     */
    private var pendingOpen: MethodChannel.Result? = null

    private val documentOpener: ActivityResultLauncher<Intent> =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result: ActivityResult ->
            val pending = pendingOpen
            pendingOpen = null
            if (pending == null) return@registerForActivityResult

            val uri = result.data?.data
            if (result.resultCode != Activity.RESULT_OK || uri == null) {
                // A cancellation. null is what the page reads as "player said no",
                // and it must say nothing: nagging about a cancel makes players
                // stop trusting the button.
                Log.i(LOG_TAG, "openDocument: cancelled")
                pending.success(null)
                return@registerForActivityResult
            }

            // A plain read grant, not a persistable one: the bytes are read
            // immediately and nothing holds a permission on the player's save
            // afterwards.
            Log.i(LOG_TAG, "openDocument: reading $uri")
            readDocument(uri, pending)
        }

    /**
     * Open the system "open document" picker and return the file's *contents*.
     *
     * The story has two `<input type="file">` elements -- "Load from file" in the
     * saves overlay and in the settings -- and a WebView has no file picker of
     * its own.
     *
     * This deliberately does not go through the plugin's `onShowFileChooser`.
     * That callback is gated behind its own `useOnShowFileChooser` setting
     * (`InAppWebViewChromeClient.java:866`) and never fired, silently, which is
     * what "Load from file does nothing at all" turned out to be. The page now
     * cancels the input's own click and asks for the file through this channel,
     * so nothing here depends on a gate the app does not control.
     *
     * Returns the bytes rather than a uri. A `content://` uri would have to be
     * read by the WebView, which is exactly the part that cannot be assumed;
     * base64 crosses a method channel reliably and the page builds the File from
     * it. Keys: `name`, `mimeType`, `data`.
     */
    private fun openDocument(call: MethodCall, result: MethodChannel.Result) {
        if (pendingOpen != null) {
            result.error("busy", "A document picker is already open", null)
            return
        }

        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            setType("*/*")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }

        // Only set a MIME list when the input asked for one. Both of the game's
        // inputs leave `accept` empty, and an *empty* EXTRA_MIME_TYPES is not
        // the same as no array: the picker builds its filter from it, and a
        // filter with nothing in it selects nothing.
        val acceptTypes = call.argument<List<String>>("acceptTypes").orEmpty()
            .filter { it.isNotBlank() && it.contains('/') }
        if (acceptTypes.isNotEmpty()) {
            intent.putExtra(Intent.EXTRA_MIME_TYPES, acceptTypes.toTypedArray())
        }

        pendingOpen = result
        Log.i(LOG_TAG, "openDocument: acceptTypes=$acceptTypes")

        try {
            documentOpener.launch(intent)
        } catch (e: Exception) {
            // No device can resolve the intent. Leaving pendingOpen set would make
            // every later attempt fail as "busy" for the rest of the session, so
            // it is cleared and the failure is reported the same way as any other.
            pendingOpen = null
            result.error("noPicker", "no document picker is available on this device", null)
        }
    }

    /**
     * Read the chosen uri and answer with its name, type and bytes.
     *
     * Runs on the platform thread, which is why the read is capped. Saves are
     * LZString text and land orders of magnitude below the limit.
     */
    private fun readDocument(uri: Uri, result: MethodChannel.Result) {
        var name = "save.txt"
        var bytes: ByteArray? = null

        contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val nameColumn = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (nameColumn >= 0 && cursor.moveToFirst()) {
                name = cursor.getString(nameColumn) ?: name
            }
        }
        val type = contentResolver.getType(uri)

        try {
            bytes = contentResolver.openInputStream(uri)?.use { it.readBytes() }
        } catch (e: Exception) {
            Log.w(LOG_TAG, "openDocument: could not read $uri", e)
        }

        if (bytes == null) {
            result.error("unreadable", "the chosen file could not be read", null)
            return
        }
        if (bytes.size > MAX_IMPORT_BYTES) {
            result.error(
                "tooLarge",
                "that file is too large to import (${bytes.size} bytes)",
                null
            )
            return
        }

        result.success(
            mapOf(
                "name" to name,
                "mimeType" to (type ?: "application/octet-stream"),
                "data" to Base64.encodeToString(bytes, Base64.NO_WRAP)
            )
        )
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        channel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).also { ch ->
            ch.setMethodCallHandler { call, result -> onMethodCall(call, result) }
        }
    }

    override fun cleanUpFlutterEngine(flutterEngine: FlutterEngine) {
        channel?.setMethodCallHandler(null)
        channel = null
        super.cleanUpFlutterEngine(flutterEngine)
    }

    private fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "saveFile" -> saveFile(call, result)
            "openDocument" -> openDocument(call, result)
            "toast" -> toast(call, result)
            "exitApp" -> {
                result.success(null)
                finish()
            }
            else -> result.notImplemented()
        }
    }

    /**
     * Open the system save-as dialog for the payload the game exported.
     *
     * The bytes arrive as base64 and are decoded only once the player has
     * actually chosen a destination, so a cancelled export costs no allocation.
     */
    private fun saveFile(call: MethodCall, result: MethodChannel.Result) {
        if (pendingSave != null) {
            result.error("busy", "A save dialog is already open", null)
            return
        }

        val name = call.argument<String>("name") ?: "save.txt"
        val type = call.argument<String>("mimeType") ?: "application/octet-stream"
        val data = call.argument<String>("data")

        if (data == null) {
            result.error("noData", "saveFile: no data provided", null)
            return
        }

        // The same safety net the Capacitor SaveDialog plugin used. Compressed
        // game saves are text and land orders of magnitude below this.
        if (data.length > MAX_BASE64_CHARS) {
            result.error(
                "tooLarge",
                "saveFile: file is too large to export (${data.length} bytes of base64)",
                null
            )
            return
        }

        pendingSave = PendingSave(result, decodeBase64(data) ?: run {
            // decodeBase64 only returns null on something that is not base64 at
            // all, which is worth distinguishing from a cancel.
            result.error("badEncoding", "saveFile: payload was not valid base64", null)
            return
        })

        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            setType(mimeType(type))
            putExtra(Intent.EXTRA_TITLE, name)
        }
        documentPicker.launch(intent)
    }

    /**
     * Reduce a MIME type to something Intent.setType will accept.
     *
     * The game builds its export blob as `text/plain;charset=UTF-8`, so the
     * charset rides along in the type. That is not a MIME type, and it is not
     * merely sloppy: ACTION_CREATE_DOCUMENT matches its intent filters against
     * this string, and a parameterised type matches no document provider. The
     * picker either fails to resolve or opens with nothing selectable.
     *
     * Parameters are dropped rather than rejected, which is the correct reading
     * of intent -- a charset says how to interpret the bytes, and the file is
     * written as bytes either way.
     */
    private fun mimeType(type: String): String {
        val bare = type.substringBefore(';').trim().lowercase()
        return bare.ifEmpty { "application/octet-stream" }
    }

    private fun completeSave(result: ActivityResult) {
        val pending = pendingSave
        pendingSave = null
        if (pending == null) return

        if (result.resultCode != Activity.RESULT_OK) {
            pending.result.success(null)
            return
        }

        val uri: Uri? = result.data?.data
        if (uri == null) {
            pending.result.error("noLocation", "no location was chosen", null)
            return
        }

        var out: FileOutputStream? = null
        try {
            out = FileOutputStream(contentResolver.openFileDescriptor(uri, "w")!!.fileDescriptor)
            out.write(pending.payload)
            out.flush()
            pending.result.success(uri.toString())
        } catch (e: Exception) {
            pending.result.error("writeFailed", "saveFile: ${e.message}", null)
        } finally {
            try {
                out?.close()
            } catch (ignored: Exception) {
                // nothing useful to do while closing
            }
        }
    }

    private fun toast(call: MethodCall, result: MethodChannel.Result) {
        val message = call.argument<String>("message") ?: ""
        val long = call.argument<Boolean>("long") ?: false
        if (message.isNotEmpty()) {
            Toast.makeText(this, message, if (long) Toast.LENGTH_LONG else Toast.LENGTH_SHORT).show()
        }
        result.success(null)
    }

    /**
     * Accepts either a bare base64 string or a full data: URI, so the JS side
     * does not have to strip the prefix itself.
     */
    private fun decodeBase64(data: String): ByteArray? {
        var payload = data
        if (payload.startsWith("data:")) {
            val comma = payload.indexOf(',')
            if (comma < 0) return null
            payload = payload.substring(comma + 1)
        }
        return try {
            Base64.decode(payload, Base64.DEFAULT)
        } catch (e: IllegalArgumentException) {
            null
        }
    }

    companion object {
        private const val CHANNEL = "com.vrelnir.dol/native"

        /**
         * So the import path is traceable in logcat. "Load from file" does
         * nothing visible at all when any one of four separate things is wrong,
         * and the only way to tell them apart is to watch which step is reached.
         */
        private const val LOG_TAG = "DoLNative"

        /**
         * Guard against a payload large enough to blow up the bridge. 24M base64
         * characters is roughly 18M decoded; game saves are text and land far
         * below this, so it is a safety net rather than a real constraint.
         */
        private const val MAX_BASE64_CHARS = 24 * 1024 * 1024

        /**
         * Guard on an imported file. Same reasoning as [MAX_BASE64_CHARS]: saves
         * are text and land orders of magnitude below this, so this is a safety
         * net against someone picking their entire downloads folder.
         */
        private const val MAX_IMPORT_BYTES = 32 * 1024 * 1024
    }
}