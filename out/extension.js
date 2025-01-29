"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const axios_1 = __importDefault(require("axios"));
function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand('jsonExplorer.openWith', async (uri) => {
        // Read the JSON file content
        const filePath = uri.fsPath;
        let jsonContent;
        try {
            jsonContent = await fs.promises.readFile(filePath, 'utf8');
        }
        catch (err) {
            vscode.window.showErrorMessage(`Could not read the selected JSON file. Error: ${err.message}`);
            return;
        }
        const panel = vscode.window.createWebviewPanel('jsonExplorer', path.basename(filePath), vscode.ViewColumn.One, {
            enableScripts: true
        });
        // Send the JSON content to the webview
        panel.webview.html = getWebviewContent(context.extensionPath, panel.webview, jsonContent);
        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'toast') {
                vscode.window.showInformationMessage(message.msg);
            }
            if (message.command === 'generateCode') {
                await generateCode(panel, message.input, message.output, message.language);
            }
        });
    }));
}
function deactivate() { }
// Helper to generate webview HTML
function getWebviewContent(extensionPath, webview, jsonContent) {
    const angularUri = webview.asWebviewUri(vscode.Uri.file(path.join(extensionPath, 'media', 'angular.min.js')));
    const indexHtmlPath = path.join(extensionPath, 'media', 'index.html');
    const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
    return htmlContent
        .replace('ANGULAR_URI', angularUri.toString())
        .replace('JSON_CONTENT', jsonContent.replace(/`/g, '\\`').replace(/\\/g, '\\\\'));
}
// Helper to generate code
async function generateCode(panel, input, output, language) {
    // Send the OpenAI streaming request
    try {
        const apiKey = process.env.OPENAI_API_KEY; // Replace with your OpenAI API key
        const system = `You are a code generator. You don't talk. You just output code. So, you will generate code for mapping one input object to another (output). You will read each field of the input and try to set it to a proper field on the other object. Assume that we have perfect ${language} classes for both sides. Don't worry about them. Do not create them. They are already created. You just generate the mapping code from input to output.`;
        console.log("system: " + system);
        const user = `Here is the input structure:\n\n${input}\n\nHere is the output structure:\n\n${output}`;
        console.log("user: " + user);
        const response = await axios_1.default.post("https://api.openai.com/v1/chat/completions", {
            model: "gpt-4o",
            messages: [
                { role: "system", content: system },
                { role: "user", content: user }
            ],
            temperature: 0.5,
            max_completion_tokens: 8192,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
            stream: true
        }, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            responseType: "stream",
        });
        // Handle streaming response
        response.data.on("data", (chunk) => {
            const lines = chunk
                .toString()
                .split("\n")
                .filter((line) => line.trim().startsWith("data:"));
            for (const line of lines) {
                const content = line.slice(5).trim(); // Remove "data: " prefix
                if (content === "[DONE]") {
                    panel.webview.postMessage({ content: "\n\n[Stream ended]" });
                    return;
                }
                const json = JSON.parse(content);
                const delta = json.choices[0]?.delta?.content;
                if (delta) {
                    panel.webview.postMessage({ content: delta });
                }
            }
        });
        response.data.on("end", () => {
            panel.webview.postMessage({ content: "\n\n[Stream ended]" });
        });
        response.data.on("error", (err) => {
            vscode.window.showErrorMessage("Stream error: " + err.message);
        });
    }
    catch (error) {
        vscode.window.showErrorMessage("Failed to fetch code: " + error.message);
    }
}
//# sourceMappingURL=extension.js.map