# Android annotations/reflection
-keepattributes *Annotation*,InnerClasses,EnclosingMethod

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

# JNI / libs nativas (PayGo .aar)
-keepclasseswithmembernames class * {
    native <methods>;
}
-keep class br.com.setis.** { *; }

# Evitar ofuscar enums e Parcelables usados por libs
-keepclassmembers enum * { *; }
