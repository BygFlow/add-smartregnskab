# ProGuard rules for ADD SmartRegnskab

# Capacitor core
-keep class com.getcapacitor.** { *; }
-keep class com.getcapacitor.community.** { *; }

# Capacitor plugins
-keep class com.capacitorjs.camera.** { *; }
-keep class com.capacitorjs.geolocation.** { *; }
-keep class com.capacitorjs.pushnotifications.** { *; }
-keep class com.capacitorjs.localnotifications.** { *; }
-keep class com.capacitorjs.haptics.** { *; }
-keep class com.capacitorjs.network.** { *; }
-keep class com.capacitorjs.statusbar.** { *; }
-keep class com.capacitorjs.splashscreen.** { *; }
-keep class com.capacitorjs.app.** { *; }
-keep class com.capacitorjs.keyboard.** { *; }
-keep class com.capacitorjs.share.** { *; }
-keep class com.capacitorjs.preferences.** { *; }
-keep class com.capacitorjs.filesystem.** { *; }

# Keep WebView JavaScript interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep all classes with @CapacitorPlugin annotation
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }

# Cordova plugins
-keep class org.apache.cordova.** { *; }

# Keep model classes
-keep class dk.smartregnskab.app.** { *; }

# Google Services
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# AndroidX
-keep class androidx.** { *; }
-dontwarn androidx.**
