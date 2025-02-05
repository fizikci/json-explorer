import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import axios from "axios";

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('jsonExplorer.openWith', async (uri: vscode.Uri) => {
            // Read the JSON file content
            const filePath = uri.fsPath;
            let jsonContent: string;
            try {
                jsonContent = await fs.promises.readFile(filePath, 'utf8');
            } catch (err: any) {
                vscode.window.showErrorMessage(`Could not read the selected JSON file. Error: ${err.message}`);
                return;
            }

            const panel = vscode.window.createWebviewPanel(
                'jsonExplorer',
                path.basename(filePath),
                vscode.ViewColumn.One,
                {
                    enableScripts: true
                }
            );

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
        })
    );
}

export function deactivate() { }

// Helper to generate webview HTML
function getWebviewContent(extensionPath: string, webview: vscode.Webview, jsonContent: string): string {
    const angularUri = webview.asWebviewUri(
        vscode.Uri.file(path.join(extensionPath, 'media', 'angular.min.js'))
    );

    const indexHtmlPath = path.join(extensionPath, 'media', 'index.html');
    const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

    return htmlContent
        .replace('ANGULAR_URI', angularUri.toString())
        .replace('JSON_CONTENT', jsonContent);
}

// Helper to generate code
async function generateCode(panel: vscode.WebviewPanel, input: string, output: string, language: string) {
    // Send the OpenAI streaming request
    try {
        const apiKey = process.env.OPENAI_API_KEY;

        const system = `You are a code generator. You don't talk. You just output code. So, you will generate code for mapping one input object to another (output). You will read each field of the input and try to set it to a proper field on the other object. Assume that we have perfect ${language} classes for both sides. Don't worry about them. Do not create them. They are already created. You just generate the mapping code from input to output.`;
        console.log("system: " + system);
        const user = `Here is the input structure:\n\n${input}\n\nHere is the output structure:\n\n${output}`;
        console.log("user: " + user);

        const response = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
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
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                responseType: "stream",
            }
        );

        // Handle streaming response
        response.data.on("data", (chunk: any) => {
            const lines = chunk
                .toString()
                .split("\n")
                .filter((line: string) => line.trim().startsWith("data:"));

            for (const line of lines) {
                const content = line.slice(5).trim();
                if (content === "[DONE]") {
                    //panel.webview.postMessage({ content: "\n\n[Stream ended]" });
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
            //panel.webview.postMessage({ content: "\n\n[Stream ended]" });
        });

        response.data.on("error", (err: any) => {
            vscode.window.showErrorMessage("Stream error: " + err.message);
        });
    } catch (error: any) {
        vscode.window.showErrorMessage("Failed to fetch code: " + error.message);
    }
}