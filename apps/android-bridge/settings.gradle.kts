/*
 * VehicleOS Android Bridge — proyecto Gradle independiente.
 *
 * NOTA: esta app vive en apps/android-bridge pero NO participa en el
 * workspace pnpm/turbo del monorepo; se compila solo con Gradle.
 */
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // usb-serial-for-android se publica en JitPack
        maven("https://jitpack.io")
    }
}

rootProject.name = "vehicle-bridge"
include(":app")
