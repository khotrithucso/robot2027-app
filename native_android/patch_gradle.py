import pathlib

gradle_path = pathlib.Path("android/app/build.gradle")
content = gradle_path.read_text(encoding="utf-8")

extra_blocks = '''
    defaultConfig {
        ndk {
            abiFilters "arm64-v8a"
        }
    }
    externalNativeBuild {
        cmake {
            path "src/main/cpp/CMakeLists.txt"
        }
    }
    androidResources {
        noCompress += ["gguf", "bin"]
    }
'''

if "externalNativeBuild" not in content:
    content = content.replace("android {", "android {" + extra_blocks, 1)
    gradle_path.write_text(content, encoding="utf-8")
    print("Patched android/app/build.gradle successfully!")
