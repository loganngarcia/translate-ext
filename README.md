# AI Page Translator - Chrome Extension

A Chrome sidepanel extension that translates web pages using AWS Nova-lite 1.0, featuring real-time translation overlay, AI-powered summaries, and text-to-speech functionality.

![Extension Preview](screenshot.png)

## Features

### 🌍 **Real-time Page Translation**
- Translate entire web pages with one click
- Preserves original layout and formatting
- In-place text replacement with visual feedback
- Support for 50+ languages

### 🤖 **AI-Powered Summaries**
- Automatic page content summarization
- 3-5 key points with relevant emojis
- Customized summaries based on content type
- Multi-language summary generation

### 🎯 **Smart Language Detection**
- Automatic source language detection
- Remember user language preferences
- Browser language integration
- Manual language override options

### 🔊 **Text-to-Speech**
- Read summaries aloud
- Language-appropriate pronunciation
- Play/pause/stop controls
- Adjustable speech settings

### 📋 **Copy & Share**
- One-click summary copying
- Clean text formatting (no markdown)
- Visual feedback for successful actions
- Clipboard integration

## Technology Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: AWS Lambda + AWS Bedrock with Nova-lite 1.0
- **Chrome APIs**: Extension APIs v3, sidepanel, activeTab, storage
- **Styling**: Inter font, responsive design
- **AI**: AWS Nova-lite 1.0 with structured tool/function calling via Bedrock

## Requirements

- **Chrome**: Version 114+ (for sidepanel support)
- **Manifest**: V3 only
- **Node.js**: 18.x for AWS Lambda
- **AWS Bedrock**: Access to Nova-lite 1.0 model in us-east-1 region

## Installation

### 1. Clone Repository
```bash
git clone https://github.com/your-username/ai-page-translator.git
cd ai-page-translator
```

### 2. Set Up AWS Lambda
1. Create an AWS Lambda function with Node.js 18.x runtime
2. Copy the code from `aws/lambda.js`
3. Install dependencies:
   ```bash
   npm install @aws-sdk/client-bedrock-runtime
   ```
4. Set up API Gateway endpoints for `/translate` and `/summarize`
5. Configure Lambda execution role with Bedrock permissions for Nova-lite model access
6. Set AWS region environment variable: `AWS_REGION=us-east-1`
7. Update `AWS_ENDPOINT` in `background/background.js`

### 3. Create Extension Icons
Follow instructions in `assets/icons/create-icons.md` to create required icon files:
- `icon16.png` (16x16)
- `icon32.png` (32x32)  
- `icon48.png` (48x48)
- `icon128.png` (128x128)

### 4. Load Extension in Chrome
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the extension directory
4. The extension icon should appear in the toolbar

### 5. Test the Extension
1. Navigate to any webpage
2. **Click the extension icon** to open the sidepanel
3. Select your target language
4. Click "Translate" to see the magic happen!

## Project Structure

```
/
├── manifest.json              # Extension manifest v3
├── sidepanel/
│   ├── sidepanel.html        # Main UI (360x670px)
│   ├── sidepanel.js          # Core application logic
│   └── sidepanel.css         # Styling with Inter font
├── content/
│   ├── content.js            # Page content extraction & overlay
│   └── overlay.css           # Translation overlay styles
├── background/
│   └── background.js         # Service worker coordination
├── aws/
│   └── lambda.js             # AWS Lambda function (OpenAI v4+)
├── assets/
│   └── icons/                # Extension icons
└── README.md
```

## Configuration

### AWS Setup
1. **Create Lambda Function**:
   - Runtime: Node.js 18.x
   - Configure execution role with Bedrock permissions
   - Install dependencies: `npm install @aws-sdk/client-bedrock-runtime`

2. **Bedrock Access**:
   - Enable access to Nova-lite 1.0 model in us-east-1 region
   - Ensure Lambda execution role has `bedrock:InvokeModel` permissions

3. **API Gateway Setup**:
   - Create REST API
   - Add `/translate` and `/summarize` endpoints
   - Enable CORS for extension origins
   - Deploy to production stage

4. **Environment Variables**:
   ```
   AWS_REGION=us-east-1
   ```

### Extension Configuration
Update `background/background.js`:
```javascript
const AWS_ENDPOINT = 'https://your-api-gateway-url.amazonaws.com/prod';
```

## Usage

### Basic Translation
1. Open any webpage
2. **Click the extension icon** in Chrome toolbar (sidepanel opens automatically)
3. Sidepanel shows current page summary
4. Select target language from dropdown
5. Click "Translate" button
6. Page content translates in real-time with visual overlay

### Advanced Features
- **Copy Summary**: Click copy icon to copy summary text
- **Text-to-Speech**: Click speaker icon to hear summary
- **Language Memory**: Extension remembers your preferred language
- **Cache**: Translations are cached for faster repeat access

## AWS Nova-lite Integration

This extension uses AWS Nova-lite 1.0 through Amazon Bedrock with structured tool calling:

### Translation Tool
```javascript
{
  toolSpec: {
    name: "provide_translation",
    description: "Provide translations for text segments",
    inputSchema: {
      json: {
        type: "object",
        properties: {
          translations: {
            type: "object",
            description: "Object mapping original text to translated text"
          }
        }
      }
    }
  }
}
```

### Summary Tool
```javascript
{
  toolSpec: {
    name: "provide_summary", 
    description: "Provide a structured summary of web content",
    inputSchema: {
      json: {
        type: "object",
        properties: {
          title: { type: "string" },
          points: {
            type: "array",
            items: {
              type: "object",
              properties: {
                emoji: { type: "string" },
                text: { type: "string" }
              }
            }
          }
        }
      }
    }
  }
}
```

## Development

### Local Development
```bash
# Load extension in Chrome developer mode
# Changes to content/background scripts require extension reload
# Changes to sidepanel files auto-refresh when sidepanel reopens
```

### Sidepanel Behavior
- Extension icon click opens sidepanel automatically via `openPanelOnActionClick: true` in manifest
- Sidepanel persists across page navigation
- Background service worker handles coordination
- Content scripts inject translation overlay

### Code Style
- Use modern ES6+ features
- Follow Chrome extension best practices
- Implement proper error handling
- Add comprehensive logging

### Testing
- Test sidepanel opening on extension icon click
- Verify translation accuracy across languages
- Check performance with large pages
- Test offline behavior

## Troubleshooting

### Sidepanel Not Opening
**🚨 Common Issue**: Google removed the global sidepanel dropdown in May 2024

**✅ Solutions**:
1. **Check Chrome Version**: Requires Chrome 114+ for sidepanel support
2. **Verify Manifest Configuration**: Ensure `openPanelOnActionClick: true` is set:
   ```json
   {
     "side_panel": {
       "default_path": "sidepanel/sidepanel.html",
       "openPanelOnActionClick": true
     }
   }
   ```
3. **Reload Extension**: Go to `chrome://extensions/` and click reload
4. **Check Browser Console**: Look for errors in extension details
5. **Pin Extension**: Right-click extension icon and pin to toolbar
6. **Developer Mode**: Ensure developer mode is enabled for unpacked extensions

### Translation Failures
1. **Verify AWS Endpoint**: Check AWS_ENDPOINT configuration in background.js
2. **Check OpenAI API Key**: Verify API key in Lambda environment variables
3. **Monitor CloudWatch Logs**: Check AWS Lambda logs for errors
4. **Test API Gateway**: Test endpoints directly in AWS console
5. **Network Issues**: Check browser network tab for failed requests

### Common Errors
- **"Extension could not load"**: Missing manifest fields or invalid JSON
- **"Sidepanel not found"**: Incorrect path in manifest or missing HTML file
- **"Permission denied"**: Missing required permissions in manifest
- **"API Error"**: Check AWS configuration and OpenAI API key

### Debug Mode
1. Go to `chrome://extensions/`
2. Click "Details" on your extension
3. Click "Inspect views: service worker" to see background logs
4. Right-click in sidepanel and select "Inspect" for sidepanel logs

## API Costs

### AWS Nova-lite 1.0 Usage
- **Input Tokens**: $0.06 per 1M tokens
- **Output Tokens**: $0.24 per 1M tokens
- **Translation**: ~$0.0008 per page (average, 75% cheaper than competitors)
- **Summarization**: ~$0.0004 per page
- **Language Detection**: ~$0.0002 per request
- **Tool Calls**: Included in token usage

### AWS Infrastructure Costs
- **Lambda**: First 1M requests free, then $0.20 per 1M
- **API Gateway**: $3.50 per million requests
- **Bedrock**: Pay-per-use, no base fees

## Security & Privacy

- ✅ No API keys required - uses AWS IAM roles
- ✅ Content processed securely through AWS Bedrock
- ✅ No user data persistence beyond session
- ✅ Proper input sanitization
- ✅ CORS and CSP implementation
- ✅ Structured tool calling prevents injection

## Browser Support

- **Chrome**: 114+ (Sidepanel support)
- **Edge**: 114+ (Chromium-based)
- **Brave**: 114+

## Recent Updates

### v2.0.0 (Current)
- ✅ Migrated from OpenAI to AWS Nova-lite 1.0 for 75% cost reduction
- ✅ Improved performance with AWS Bedrock integration
- ✅ Enhanced tool calling with Nova-lite structured outputs
- ✅ Reduced API costs while maintaining quality
- ✅ Free usage during hackathons with AWS credits

## Contributing

1. Fork the repository
2. Create a feature branch
3. Follow existing code style
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- 📧 Email: support@example.com
- 🐛 Issues: [GitHub Issues](https://github.com/your-username/ai-page-translator/issues)
- 📖 Docs: [Extension Documentation](https://docs.example.com)

## Roadmap

### Version 1.1
- [ ] Translation history
- [ ] Custom language pairs
- [ ] Offline translation cache
- [ ] Translation confidence scores

### Version 1.2
- [ ] PDF translation support
- [ ] Bulk page translation
- [ ] Team collaboration features
- [ ] Translation export options

### Version 2.0
- [ ] Custom AI model support
- [ ] Enterprise SSO integration
- [ ] Advanced translation memory
- [ ] Real-time collaborative translation

## Acknowledgments

- AWS for Nova-lite 1.0 model and Bedrock platform
- Chrome Extensions team for excellent APIs
- Inter font family for beautiful typography
- AWS for reliable cloud infrastructure and free hackathon credits 