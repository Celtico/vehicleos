/*
 * Módulo de la app: servicio Android sin UI que expone el Vehicle Bridge.
 */
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "os.vehicle.bridge"
    compileSdk = 34

    defaultConfig {
        applicationId = "os.vehicle.bridge"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0"
    }

    buildTypes {
        release {
            // Sin ofuscación por ahora: el APK ya es minúsculo.
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        // App sin UI: no necesitamos BuildConfig ni view binding.
        buildConfig = false
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    // Servidor WebSocket local (ws://127.0.0.1:8722)
    implementation("org.java-websocket:Java-WebSocket:1.5.6")

    // Adaptadores OBD por USB (CDC-ACM, FTDI, CH340, CP210x…)
    implementation("com.github.mik3y:usb-serial-for-android:3.7.0")

    // Tests JVM puros (decodificación ELM327/DTC, sin Android)
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1")
}
