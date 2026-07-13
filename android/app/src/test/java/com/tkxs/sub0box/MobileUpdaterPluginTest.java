package com.tkxs.sub0box;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import org.junit.Test;

public class MobileUpdaterPluginTest {
    @Test
    public void parsesDownloadIdsAcrossTheJavascriptBridge() {
        assertEquals(Long.valueOf(42L), MobileUpdaterPlugin.parseDownloadId(42));
        assertEquals(Long.valueOf(42L), MobileUpdaterPlugin.parseDownloadId(42L));
        assertEquals(Long.valueOf(42L), MobileUpdaterPlugin.parseDownloadId("42"));
    }

    @Test
    public void rejectsInvalidDownloadIds() {
        assertNull(MobileUpdaterPlugin.parseDownloadId(null));
        assertNull(MobileUpdaterPlugin.parseDownloadId("not-a-number"));
        assertNull(MobileUpdaterPlugin.parseDownloadId(-1));
        assertNull(MobileUpdaterPlugin.parseDownloadId(1.5));
    }
}
