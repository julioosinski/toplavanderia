# Capacitor / bridge
-keepattributes *Annotation*,InnerClasses,EnclosingMethod
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod <methods>;
}
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class com.getcapacitor.** { *; }
-keep public class * extends com.getcapacitor.Plugin
-keep class org.apache.cordova.** { *; }

# Gson (PayGO / serialização)
-keepattributes Signature
-keep class com.google.gson.** { *; }
-keep class * implements com.google.gson.TypeAdapter
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# Plugins e integrações nativas do app
-keep class app.lovable.toplavanderia.** { *; }

# PayGO InterfaceAutomacao (.aar)
-keep class br.com.setis.interfaceautomacao.** { *; }
-keep class org.apache.commons.** { *; }

# JNI
-keepclasseswithmembernames class * {
    native <methods>;
}

# Evitar ofuscar enums e Parcelables usados por libs
-keepclassmembers enum * { *; }
