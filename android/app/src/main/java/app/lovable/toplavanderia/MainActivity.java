package app.lovable.toplavanderia;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Register PayGO plugin
        registerPlugin(PayGOPlugin.class);
    }
}