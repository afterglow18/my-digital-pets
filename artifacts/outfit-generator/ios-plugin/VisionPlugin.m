// VisionPlugin.m — ObjC bridge required by Capacitor plugin registration.
// Add this file to the Xcode project (App/App target, "Compile Sources" phase).

#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(VisionPlugin, "Vision",
    CAP_PLUGIN_METHOD(analyze, CAPPluginReturnPromise);
)
