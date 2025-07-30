# Sidepanel Test Guide

This guide will help you verify that your Chrome extension sidepanel is working correctly.

## ✅ **Quick Test Steps**

### 1. **Check Chrome Version**
```
1. Open Chrome
2. Go to chrome://version/
3. Verify version is 114 or higher
```

### 2. **Load Extension**
```
1. Go to chrome://extensions/
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select your extension folder
5. Look for your extension in the list
```

### 3. **Test Sidepanel Opening**
```
1. Look for your extension icon in Chrome toolbar
2. Click the extension icon
3. Sidepanel should open on the right side
4. You should see "AI Page Translator" interface
```

## 🔧 **If Sidepanel Doesn't Open**

### Check 1: Manifest Configuration
Your `manifest.json` should have:
```json
{
  "side_panel": {
    "default_path": "sidepanel/sidepanel.html",
    "openPanelOnActionClick": true
  }
}
```

### Check 2: File Structure
Verify these files exist:
```
your-extension/
├── manifest.json
├── sidepanel/
│   ├── sidepanel.html
│   ├── sidepanel.js
│   └── sidepanel.css
├── background/
│   └── background.js
└── assets/
    └── icons/
```

### Check 3: Console Errors
```
1. Go to chrome://extensions/
2. Find your extension
3. Click "Details"
4. Click "Inspect views: service worker"
5. Look for errors in console
```

### Check 4: Extension Permissions
Verify your extension has these permissions in manifest:
```json
{
  "permissions": [
    "activeTab",
    "sidePanel",
    "storage",
    "clipboardWrite"
  ]
}
```

## ⚡ **Test Results**

### ✅ **Success Indicators**
- Extension icon appears in toolbar
- Clicking icon opens sidepanel on right side
- Sidepanel shows language selector and translate button
- No console errors

### ❌ **Failure Indicators**
- Icon doesn't appear
- Clicking icon does nothing
- Console shows "Cannot read properties of undefined"
- "Extension failed to load" error

## 🚨 **Common Issues & Fixes**

### Issue: "Extension failed to load"
**Fix**: Check manifest.json syntax with JSON validator

### Issue: Sidepanel opens but is blank
**Fix**: Check sidepanel.html path in manifest

### Issue: Extension icon shows but clicking does nothing
**Fix**: Verify `openPanelOnActionClick: true` in manifest

### Issue: Console error "Cannot access chrome.sidePanel"
**Fix**: Add "sidePanel" to permissions array

## 📞 **Still Having Issues?**

1. **Restart Chrome** completely
2. **Try in Incognito Mode** (if extension is enabled there)
3. **Create a minimal test extension** with just:
   ```json
   {
     "manifest_version": 3,
     "name": "Test Sidepanel",
     "version": "1.0",
     "side_panel": {
       "default_path": "test.html",
       "openPanelOnActionClick": true
     },
     "permissions": ["sidePanel"]
   }
   ```
   And a simple `test.html`:
   ```html
   <!DOCTYPE html>
   <html><body><h1>Test Sidepanel Works!</h1></body></html>
   ```

4. **Check GitHub Issues** for similar problems
5. **Report a bug** if all else fails

---

**Remember**: Google changed sidepanel behavior in May 2024, so older tutorials may not work! 