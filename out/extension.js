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
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
    }));
}
function deactivate() { }
// Helper to generate webview HTML
function getWebviewContent(extensionPath, webview, jsonContent) {
    const angularUri = webview.asWebviewUri(vscode.Uri.file(path.join(extensionPath, 'media', 'angular.min.js')));
    return `
<!DOCTYPE html>
<html lang="en" ng-app="jsonViewerApp">
<head>
    <meta charset="UTF-8">
    <script src="${angularUri}"></script>
	<script>
const vscode = acquireVsCodeApi();
vscode.setState(vscode.getState() || []);
var jsonContent = \`${jsonContent.replace(/`/g, '\\`').replace(/\\/g, '\\\\')}\`;
angular.module('jsonViewerApp', [])
    .controller('jsonViewerController', function ($scope, $timeout) {
        $scope.parsedJSON = {};

        $scope.initialize = function () {
            try {
                $scope.parsedJSON = JSON.parse(jsonContent);
            } catch (e) {
                $scope.error = 'Invalid JSON format.';
            }
        };

		$timeout(function() {
			let state = vscode.getState();
			vscode.setState([]);
			for(let i = 0; i < state.length; i++){
				let key = state[i];
				let q = key ? '[data-key="' + key.split('.').join('"] [data-key="') + '"]' : '';
				let cmd = document.querySelector(q + ' .cmd');
				if(cmd) cmd.click();
			}
		});
    })
    .directive('jsonGrid', function () {
        return {
            restrict: 'E',
            scope: {
                data: '='
            },
            template: \`
                <div>
                    <!-- Error display -->
                    <div ng-if="error" class="error-banner">{{ error }}</div>

                    <!-- Collapsible object display -->
                    <div ng-if="isObject(data) && !error">
                        <div class="label field cmd" ng-click="toggleVisibility($event)">
                            {{ count(data) }} fields
                            <span ng-if="!isVisible">[+]</span>
                            <span ng-if="isVisible">[-]</span>
                        </div>
                        <div ng-show="isVisible">
                            <table>
                                <tbody>
                                    <tr ng-repeat="(key, value) in data track by key">
                                        <td class="key">{{ key }}</td>
                                        <td data-key="{{key}}">
                                            <div ng-if="isValue(value)">{{ value }}</div>
                                            <json-grid ng-if="isArray(value) || isObject(value)" data="value"></json-grid>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <!-- Collapsible array display -->
                    <div ng-if="isArray(data) && data.length && isValue(data[0]) && !error">
                        <div class="label row cmd" ng-click="toggleVisibility($event)">
                            {{ data.length }} rows 
                            <span ng-if="!isVisible">[+]</span>
                            <span ng-if="isVisible">[-]</span>
                        </div>
                        <div ng-show="isVisible">
                            <table>
                                <tbody>
                                    <tr ng-repeat="row in data" data-key="{{$index}}">
                                        <td>{{$index}}</td>
                                        <td>
                                            {{ row }}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Collapsible array display -->
                    <div ng-if="isArray(data) && data.length && isObject(data[0]) && !error">
                        <div class="label row cmd" ng-click="toggleVisibility($event)">
                            {{ data.length }} rows 
                            <span ng-if="!isVisible">[+]</span>
                            <span ng-if="isVisible">[-]</span>
                        </div>
                        <a class="hidden-column" ng-repeat="hiddenColumn in hiddenColumns track by hiddenColumn" href="" ng-click="restoreColumn($event, hiddenColumn)" data-key="{{hiddenColumn}}">{{ hiddenColumn }}</a>
                        <div ng-show="isVisible">
                            <table>
                                <thead>
                                    <tr>
                                        <th></th>
                                        <th ng-repeat="(field, val) in data[0] track by field" ng-if="visibleColumns[field]" data-key="{{field}}">
										<span ng-click="sortBy(field)">{{ field }}</span>
										<span class="hide-btn cmd" ng-click="hideColumn($event, field)">[-]</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr ng-repeat="row in data | orderBy:sortField:reverseSort" data-key="{{$index}}">
                                        <td>{{$index}}</td>
                                        <td ng-show="visibleColumns[field] && isValue(row)">
                                            {{ row }}
                                        </td>
                                        <td ng-repeat="(field, val) in row track by field" ng-show="visibleColumns[field] && isObject(row)" data-key="{{field}}">
                                            <div ng-if="isValue(val)">{{ val }}</div>
                                            <json-grid ng-if="isArray(val) || isObject(val)" data="val"></json-grid>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            \`,
            link: function (scope) {
                scope.isVisible = false; // Initially hidden
                scope.hiddenColumns = []; // Track hidden columns

                // Helper to get key path from the clicked element
                function getKeyPath(element) {
                    let keyPath = '';
                    let currentElement = element;

                    while (currentElement) {
                        let key = currentElement.getAttribute('data-key');
                        if (key) {
                            keyPath = key + (keyPath ? '.' : '') + keyPath;
                        }
                        currentElement = currentElement.parentElement;
                    }

                    return keyPath;
                }

                scope.toggleVisibility = function (event) {
                    const keyPath = getKeyPath(event.target);
					if(scope.isVisible) vscode.setState(vscode.getState().filter(k => !k.startsWith(keyPath)));
					else vscode.setState([...vscode.getState(), keyPath]);

					scope.isVisible = !scope.isVisible;
                };

                scope.sortField = null;
                scope.reverseSort = false;
                scope.visibleColumns = {};

                scope.isValue = function (val) {
                    return typeof val == 'number' || typeof val == 'string' || typeof val == 'boolean' || val === null;
                };

                scope.isArray = function (val) {
                    return Array.isArray(val);
                };

                scope.isObject = function (val) {
                    return !scope.isValue(val) && !Array.isArray(val);
                };

                scope.count = function (val) {
                    return Object.keys(val).length;
                };

                scope.sortBy = function (field) {
                    if (scope.sortField === field) {
                        scope.reverseSort = !scope.reverseSort;
                    } else {
                        scope.sortField = field;
                        scope.reverseSort = false;
                    }
                };

                scope.hideColumn = function (event, field) {
                    const keyPath = getKeyPath(event.target);
					vscode.setState([...vscode.getState(), keyPath]);

                    if (scope.visibleColumns[field]) {
                        scope.visibleColumns[field] = false;
                        scope.hiddenColumns.push(field);
                    }
                };

                scope.restoreColumn = function (event, field) {
                    const keyPath = getKeyPath(event.target);
					vscode.setState(vscode.getState().filter(k => !k.startsWith(keyPath)));

                    const index = scope.hiddenColumns.indexOf(field);
                    if (index > -1) {
                        scope.hiddenColumns.splice(index, 1);
                        scope.visibleColumns[field] = true;
                    }
                };

                scope.initializeColumns = function (data) {
                    if (Array.isArray(data) && data.length > 0) {
                        for (const key in data[0]) {
                            scope.visibleColumns[key] = true;
                        }
                    }
                };
                
                scope.$watch('data', function (newValue) {
                    scope.initializeColumns(newValue);
                });
            }
        };
    });
	</script>
    <style>
        .label, a.hidden-column {
            cursor:pointer;
            border-radius: 10px;
            display:inline-block;
            color: white;
            padding: 1px 10px;
            font-family: 'Lucida Sans', 'Lucida Sans Regular', 'Lucida Grande', 'Lucida Sans Unicode', Geneva, Verdana, sans-serif;
            white-space: nowrap;
            text-decoration: none;
        }
        .row {
            background: #179fff
        }
        .field {
            background: #cc6d2e
        }
        .error-banner {
            color: white;
            background-color: red;
            padding: 10px;
            margin-bottom: 10px;
            border-radius: 5px;
            font-family: Arial, sans-serif;
        }
        table {
            border-collapse: collapse;
        }

        th, td {
            border: 1px solid #ddd;
			color:#999;
            padding: 2px;
            text-align: left;
            vertical-align: top;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        th span {
            cursor: pointer;
            font-weight: normal;
        }

        .key, th {
            color: #45a3dc
        }

        a.hidden-column {
            background: rgb(126, 126, 126);
            font-size: smaller;
        }
    </style>
</head>
<body ng-controller="jsonViewerController">
    <div ng-init="initialize()">
        <json-grid data="parsedJSON"></json-grid>
    </div>
</body>
</html>
    `;
}
//# sourceMappingURL=extension.js.map