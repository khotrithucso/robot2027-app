package vn.io.khotrithucso.robot2027;

import android.content.Context;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "LocalLLM")
public class LocalLLMPlugin extends Plugin {

    static {
        System.loadLibrary("robot_llama");
    }

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private int currentCtx = 512;
    private int currentThreads = 4;

    private native boolean nativeLoadModel(String modelPath);
    private native String nativeGenerate(String prompt, int maxTokens, int nCtx, int nThreads);

    @PluginMethod
    public void loadModel(PluginCall call) {
        String assetPath = call.getString("assetPath", "models/brain_local.gguf");
        currentCtx = call.getInt("nCtx", 512);
        currentThreads = call.getInt("nThreads", 4);

        executor.execute(() -> {
            try {
                File outFile = copyAssetIfNeeded(getContext(), assetPath);
                boolean ok = nativeLoadModel(outFile.getAbsolutePath());
                if (ok) {
                    JSObject ret = new JSObject();
                    ret.put("status", "loaded");
                    ret.put("modelPath", outFile.getAbsolutePath());
                    call.resolve(ret);
                } else {
                    call.reject("Không thể nạp file GGUF vào llama.cpp");
                }
            } catch (Exception e) {
                call.reject("Lỗi copy/nạp model: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void generate(PluginCall call) {
        String prompt = call.getString("prompt", "");
        int maxTokens = call.getInt("maxTokens", 60);

        if (prompt.isEmpty()) {
            call.reject("Prompt trống");
            return;
        }

        executor.execute(() -> {
            try {
                String result = nativeGenerate(prompt, maxTokens, currentCtx, currentThreads);
                JSObject ret = new JSObject();
                ret.put("text", result);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Lỗi suy luận C++: " + e.getMessage());
            }
        });
    }

    private File copyAssetIfNeeded(Context context, String assetPath) throws Exception {
        File outFile = new File(context.getFilesDir(), "brain_local.gguf");
        if (outFile.exists() && outFile.length() > 10 * 1024 * 1024) {
            return outFile;
        }

        try (InputStream is = context.getAssets().open(assetPath);
             FileOutputStream fos = new FileOutputStream(outFile)) {
            byte[] buffer = new byte[65536];
            int read;
            while ((read = is.read(buffer)) != -1) {
                fos.write(buffer, 0, read);
            }
            fos.flush();
        }
        return outFile;
    }
}
