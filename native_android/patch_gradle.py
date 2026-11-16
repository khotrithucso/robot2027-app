import pathlib
import re

# 1. Nâng minSdkVersion lên 24 để Android NDK hỗ trợ đầy đủ POSIX_MADV_* cho llama-mmap.cpp
vars_path = pathlib.Path("android/variables.gradle")
if vars_path.exists():
    vars_content = vars_path.read_text(encoding="utf-8")
    vars_content = re.sub(r"minSdkVersion\s*=\s*\d+", "minSdkVersion = 24", vars_content)
    vars_path.write_text(vars_content, encoding="utf-8")
    print("Updated minSdkVersion to 24 in android/variables.gradle!")

# 2. Cấu hình CMake NDK và tắt nén file .gguf trong android/app/build.gradle
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
