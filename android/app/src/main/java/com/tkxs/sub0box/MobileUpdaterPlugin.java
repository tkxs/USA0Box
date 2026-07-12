package com.tkxs.sub0box;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

@CapacitorPlugin(name = "MobileUpdater")
public class MobileUpdaterPlugin extends Plugin {
    private static final String UPDATE_HOST = "github.com";
    private static final String UPDATE_PATH = "/tkxs/USA0Box/releases/latest/download/ZeroBox-android-update.apk";

    @PluginMethod
    public void startDownload(PluginCall call) {
        String url = call.getString("url");
        String fileName = call.getString("fileName");
        if (url == null || fileName == null || !isAllowedUpdateUrl(url) || !isAllowedFileName(fileName)) {
            call.reject("Invalid ZeroBox update package");
            return;
        }

        File directory = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (directory == null) {
            call.reject("Update directory is unavailable");
            return;
        }
        File destination = new File(directory, fileName);
        if (destination.exists() && !destination.delete()) {
            call.reject("Unable to replace the previous update package");
            return;
        }

        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url))
            .setTitle("ZeroBox update")
            .setDescription("Downloading the latest ZeroBox version")
            .setMimeType("application/vnd.android.package-archive")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalFilesDir(getContext(), Environment.DIRECTORY_DOWNLOADS, fileName);

        DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        long downloadId = manager.enqueue(request);
        JSObject result = new JSObject();
        result.put("downloadId", downloadId);
        call.resolve(result);
    }

    @PluginMethod
    public void getDownloadStatus(PluginCall call) {
        Long downloadId = call.getLong("downloadId");
        if (downloadId == null) {
            call.reject("Missing download id");
            return;
        }

        DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        try (android.database.Cursor cursor = manager.query(new DownloadManager.Query().setFilterById(downloadId))) {
            if (!cursor.moveToFirst()) {
                call.reject("Update download was not found");
                return;
            }
            int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            long downloaded = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
            long total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
            int reason = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON));

            JSObject result = new JSObject();
            result.put("status", mapStatus(status));
            result.put("downloaded", downloaded);
            result.put("total", total);
            result.put("reason", reason);
            call.resolve(result);
        }
    }

    @PluginMethod
    public void install(PluginCall call) {
        String fileName = call.getString("fileName");
        if (fileName == null || !isAllowedFileName(fileName)) {
            call.reject("Invalid ZeroBox update package");
            return;
        }

        File directory = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        File apk = directory == null ? null : new File(directory, fileName);
        if (apk == null || !apk.isFile()) {
            call.reject("The downloaded update package is unavailable");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent settingsIntent = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName())
            );
            getActivity().startActivity(settingsIntent);
            JSObject result = new JSObject();
            result.put("permissionRequired", true);
            call.resolve(result);
            return;
        }

        Uri apkUri = FileProvider.getUriForFile(
            getContext(),
            getContext().getPackageName() + ".fileprovider",
            apk
        );
        Intent installIntent = new Intent(Intent.ACTION_VIEW)
            .setDataAndType(apkUri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        getActivity().startActivity(installIntent);
        JSObject result = new JSObject();
        result.put("permissionRequired", false);
        call.resolve(result);
    }

    private boolean isAllowedUpdateUrl(String value) {
        try {
            Uri uri = Uri.parse(value);
            return "https".equals(uri.getScheme()) && UPDATE_HOST.equals(uri.getHost()) && UPDATE_PATH.equals(uri.getPath());
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean isAllowedFileName(String value) {
        return value.matches("ZeroBox-[0-9A-Za-z._-]+-android-update\\.apk");
    }

    private String mapStatus(int status) {
        switch (status) {
            case DownloadManager.STATUS_PENDING:
                return "pending";
            case DownloadManager.STATUS_RUNNING:
                return "running";
            case DownloadManager.STATUS_PAUSED:
                return "paused";
            case DownloadManager.STATUS_SUCCESSFUL:
                return "successful";
            case DownloadManager.STATUS_FAILED:
                return "failed";
            default:
                return "unknown";
        }
    }
}
