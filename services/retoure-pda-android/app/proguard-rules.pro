# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.kts.

# kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** { *** Companion; }
-keepclasseswithmembers class kotlinx.serialization.json.** { kotlinx.serialization.KSerializer serializer(...); }
-keep,includedescriptorclasses class de.kfzblitz24.retoure_pda.**$$serializer { *; }
-keepclassmembers class de.kfzblitz24.retoure_pda.** { *** Companion; }
-keepclasseswithmembers class de.kfzblitz24.retoure_pda.** { kotlinx.serialization.KSerializer serializer(...); }
