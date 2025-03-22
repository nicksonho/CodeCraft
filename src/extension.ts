import * as vscode from "vscode"

export function activate(context: vscode.ExtensionContext) {
  console.log("AI Coding Mentor is now active!")

  // Register the main command to open the AI Coding Mentor
  const disposable = vscode.commands.registerCommand("codecraft.openAIMentor", () => {
    AIMentorPanel.createOrShow(context.extensionUri)
  })

  // Register the command to explain errors
  const explainErrorDisposable = vscode.commands.registerCommand("codecraft.explainError", () => {
    if (AIMentorPanel.currentPanel) {
      AIMentorPanel.currentPanel.explainCurrentError()
    } else {
      AIMentorPanel.createOrShow(context.extensionUri)
      // Wait for panel to initialize
      setTimeout(() => {
        if (AIMentorPanel.currentPanel) {
          AIMentorPanel.currentPanel.explainCurrentError()
        }
      }, 1000)
    }
  })

  context.subscriptions.push(disposable, explainErrorDisposable)

  // If the webview panel already exists, reveal it
  if (AIMentorPanel.currentPanel) {
    AIMentorPanel.currentPanel.reveal()
  }

  // Track diagnostics changes to show/hide the "Explain This Error" button
  vscode.languages.onDidChangeDiagnostics((e) => {
    if (AIMentorPanel.currentPanel) {
      AIMentorPanel.currentPanel.updateDiagnostics()
    }
  })
}

/**
 * Manages the webview panel for the AI Coding Mentor
 */
class AIMentorPanel {
  public static currentPanel: AIMentorPanel | undefined
  private static readonly viewType = "aiMentor"
  private readonly _panel: vscode.WebviewPanel
  private readonly _extensionUri: vscode.Uri
  private _disposables: vscode.Disposable[] = []

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined

    // If we already have a panel, show it
    if (AIMentorPanel.currentPanel) {
      AIMentorPanel.currentPanel._panel.reveal(column)
      return
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      AIMentorPanel.viewType,
      "AI Coding Mentor",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media"), vscode.Uri.joinPath(extensionUri, "dist")],
        retainContextWhenHidden: true,
      },
    )

    AIMentorPanel.currentPanel = new AIMentorPanel(panel, extensionUri)
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel
    this._extensionUri = extensionUri

    // Set the webview's initial html content
    this._update()

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables)

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case "sendMessage":
            this._handleUserMessage(message.text)
            return
          case "toggleMode":
            this._toggleMode(message.mode)
            return
          case "openLearningJournal":
            this._showLearningJournal()
            return
        }
      },
      null,
      this._disposables,
    )
  }

  public reveal() {
    this._panel.reveal()
  }

  public explainCurrentError() {
    // Get current diagnostics and send to webview
    const editor = vscode.window.activeTextEditor
    if (editor) {
      const document = editor.document
      const diagnostics = vscode.languages.getDiagnostics(document.uri)

      if (diagnostics.length > 0) {
        const error = diagnostics[0]
        const errorMessage = error.message
        const errorRange = error.range
        const errorCode = error.code
        const lineText = document.lineAt(errorRange.start.line).text

        this._panel.webview.postMessage({
          command: "explainError",
          error: {
            message: errorMessage,
            code: errorCode,
            line: errorRange.start.line + 1,
            column: errorRange.start.character + 1,
            text: lineText,
          },
        })
      }
    }
  }

  public updateDiagnostics() {
    const editor = vscode.window.activeTextEditor
    if (editor) {
      const document = editor.document
      const diagnostics = vscode.languages.getDiagnostics(document.uri)

      this._panel.webview.postMessage({
        command: "updateDiagnostics",
        hasErrors: diagnostics.length > 0,
      })
    }
  }

  private _handleUserMessage(text: string) {
    // In a real extension, this would send the message to an AI service
    // For now, we'll just echo it back with a mock response
    setTimeout(() => {
      this._panel.webview.postMessage({
        command: "receiveMessage",
        message: {
          text: `I understand you're asking about "${text}". Let me help you with that...`,
          isUser: false,
          timestamp: new Date().toISOString(),
        },
      })
    }, 1000)
  }

  private _toggleMode(mode: string) {
    // Handle mode toggle (Text Guide vs Visual Metaphor)
    vscode.window.showInformationMessage(`Switched to ${mode} mode`)
  }

  private _showLearningJournal() {
    // Switch to learning journal tab
    this._panel.webview.postMessage({
      command: "showLearningJournal",
    })
  }

  private _update() {
    const webview = this._panel.webview
    this._panel.title = "AI Coding Mentor"
    this._panel.webview.html = this._getHtmlForWebview(webview)
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Get path to media files
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "main.js"))

    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "styles.css"))

    const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "codicon.css"))

    // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce()

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https:;">
      <link href="${styleUri}" rel="stylesheet">
      <link href="${codiconsUri}" rel="stylesheet">
      <title>AI Coding Mentor</title>
    </head>
    <body>
      <div class="app-container">
        <!-- Sidebar with badges -->
        <aside class="sidebar">
          <div class="sidebar-header">
            <h2>Your Badges</h2>
          </div>
          <div class="badges-container">
            <div class="badge">
              <div class="badge-icon">
                <i class="codicon codicon-debug"></i>
              </div>
              <span class="badge-name">Debug Hero</span>
            </div>
            <div class="badge">
              <div class="badge-icon">
                <i class="codicon codicon-symbol-loop"></i>
              </div>
              <span class="badge-name">Loop Ninja</span>
            </div>
            <div class="badge">
              <div class="badge-icon">
                <i class="codicon codicon-symbol-method"></i>
              </div>
              <span class="badge-name">API Master</span>
            </div>
            <div class="badge">
              <div class="badge-icon">
                <i class="codicon codicon-symbol-class"></i>
              </div>
              <span class="badge-name">OOP Wizard</span>
            </div>
            <div class="badge locked">
              <div class="badge-icon">
                <i class="codicon codicon-lock"></i>
              </div>
              <span class="badge-name">Test Champion</span>
            </div>
          </div>
          <div class="progress-container">
            <h3>Weekly Goals</h3>
            <div class="progress-label">
              <span>Learning Progress</span>
              <span>70%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: 70%"></div>
            </div>
            <div class="progress-label">
              <span>Challenges Completed</span>
              <span>3/5</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: 60%"></div>
            </div>
          </div>
        </aside>

        <!-- Main content area -->
        <main class="main-content">
          <div class="tabs">
            <button class="tab-button active" data-tab="chat">Chat</button>
            <button class="tab-button" data-tab="journal">Learning Journal</button>
          </div>

          <!-- Chat tab content -->
          <div class="tab-content active" id="chat-tab">
            <div class="chat-container">
              <div class="messages">
                <div class="message ai">
                  <div class="message-content">
                    <p>Hello! I'm your AI coding mentor. How can I help you today?</p>
                  </div>
                  <div class="message-time">10:30 AM</div>
                </div>
                <div class="message user">
                  <div class="message-content">
                    <p>I'm having trouble with async/await in JavaScript. Can you explain it?</p>
                  </div>
                  <div class="message-time">10:31 AM</div>
                </div>
                <div class="message ai">
                  <div class="message-content">
                    <p>Async/await is a way to handle asynchronous operations in JavaScript. The <code>async</code> keyword defines an asynchronous function, which returns a Promise. The <code>await</code> keyword makes JavaScript wait until that Promise settles and returns its result.</p>
                    <p>Here's a simple example:</p>
                    <pre><code>async function fetchData() {
  try {
    const response = await fetch('https://api.example.com/data');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}</code></pre>
                  </div>
                  <div class="message-time">10:32 AM</div>
                </div>
              </div>
              
              <div class="error-explainer hidden">
                <button id="explain-error-btn">
                  <i class="codicon codicon-debug"></i>
                  Explain This Error
                </button>
              </div>

              <div class="mode-toggle">
                <span>Response Mode:</span>
                <div class="toggle-container">
                  <button class="toggle-button active" data-mode="text">Text Guide</button>
                  <button class="toggle-button" data-mode="visual">Visual Metaphor</button>
                </div>
              </div>

              <div class="input-container">
                <textarea id="message-input" placeholder="Ask me anything about coding..."></textarea>
                <div class="input-actions">
                  <button id="mic-button" title="Voice input">
                    <i class="codicon codicon-mic"></i>
                  </button>
                  <button id="camera-button" title="Upload screenshot">
                    <i class="codicon codicon-device-camera"></i>
                  </button>
                  <button id="send-button" title="Send message">
                    <i class="codicon codicon-send"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Learning Journal tab content -->
          <div class="tab-content" id="journal-tab">
            <div class="journal-container">
              <div class="journal-header">
                <h2>Your Learning Journey</h2>
                <div class="time-filter">
                  <select id="time-filter">
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="all">All Time</option>
                  </select>
                </div>
              </div>

              <div class="metrics-grid">
                <div class="metric-card">
                  <div class="metric-title">Errors Resolved</div>
                  <div class="metric-value">12 <span class="trend up">↑ 40%</span></div>
                </div>
                <div class="metric-card">
                  <div class="metric-title">Concepts Learned</div>
                  <div class="metric-value">8 <span class="trend up">↑ 25%</span></div>
                </div>
                <div class="metric-card">
                  <div class="metric-title">Practice Time</div>
                  <div class="metric-value">5.2h <span class="trend up">↑ 15%</span></div>
                </div>
                <div class="metric-card">
                  <div class="metric-title">Code Quality</div>
                  <div class="metric-value">B+ <span class="trend up">↑ 10%</span></div>
                </div>
              </div>

              <div class="timeline">
                <h3>Recent Activity</h3>
                <div class="timeline-item">
                  <div class="timeline-date">Today, 10:32 AM</div>
                  <div class="timeline-content">
                    <div class="timeline-title">Learned about Async/Await</div>
                    <div class="timeline-description">Discussed JavaScript asynchronous programming patterns</div>
                  </div>
                </div>
                <div class="timeline-item">
                  <div class="timeline-date">Yesterday, 3:45 PM</div>
                  <div class="timeline-content">
                    <div class="timeline-title">Fixed TypeError in React Component</div>
                    <div class="timeline-description">Resolved issue with props validation in functional component</div>
                  </div>
                </div>
                <div class="timeline-item">
                  <div class="timeline-date">May 15, 2:20 PM</div>
                  <div class="timeline-content">
                    <div class="timeline-title">Completed Array Methods Challenge</div>
                    <div class="timeline-description">Successfully implemented map, filter, and reduce functions</div>
                  </div>
                </div>
              </div>

              <div class="study-plan">
                <h3>Recommended Study Plan</h3>
                <div class="checklist">
                  <div class="checklist-item">
                    <input type="checkbox" id="item1">
                    <label for="item1">Review Promise chaining vs async/await</label>
                  </div>
                  <div class="checklist-item">
                    <input type="checkbox" id="item2">
                    <label for="item2">Practice error handling in asynchronous code</label>
                  </div>
                  <div class="checklist-item">
                    <input type="checkbox" id="item3" checked>
                    <label for="item3">Complete the loop optimization exercise</label>
                  </div>
                  <div class="checklist-item">
                    <input type="checkbox" id="item4">
                    <label for="item4">Learn about React useEffect cleanup functions</label>
                  </div>
                  <div class="checklist-item">
                    <input type="checkbox" id="item5">
                    <label for="item5">Implement a basic unit test for your current project</label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <script nonce="${nonce}">
        (function() {
          const vscode = acquireVsCodeApi();
          
          // DOM Elements
          const messageInput = document.getElementById('message-input');
          const sendButton = document.getElementById('send-button');
          const messagesContainer = document.querySelector('.messages');
          const explainErrorBtn = document.getElementById('explain-error-btn');
          const errorExplainer = document.querySelector('.error-explainer');
          const tabButtons = document.querySelectorAll('.tab-button');
          const tabContents = document.querySelectorAll('.tab-content');
          const toggleButtons = document.querySelectorAll('.toggle-button');
          
          // Initialize with stored state
          const state = vscode.getState() || { 
            messages: [],
            activeTab: 'chat',
            responseMode: 'text'
          };
          
          // Handle sending messages
          function sendMessage() {
            const text = messageInput.value.trim();
            if (!text) return;
            
            // Add message to UI
            addMessageToUI(text, true);
            
            // Send to extension
            vscode.postMessage({
              command: 'sendMessage',
              text: text
            });
            
            // Clear input
            messageInput.value = '';
          }
          
          // Add message to UI
          function addMessageToUI(text, isUser) {
            const messageDiv = document.createElement('div');
            messageDiv.className = isUser ? 'message user' : 'message ai';
            
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            messageDiv.innerHTML = \`
              <div class="message-content">
                <p>\${text}</p>
              </div>
              <div class="message-time">\${time}</div>
            \`;
            
            messagesContainer.appendChild(messageDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
            // Update state
            state.messages.push({
              text,
              isUser,
              timestamp: new Date().toISOString()
            });
            vscode.setState(state);
          }
          
          // Event Listeners
          sendButton.addEventListener('click', sendMessage);
          
          messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          });
          
          explainErrorBtn.addEventListener('click', () => {
            vscode.postMessage({
              command: 'explainError'
            });
          });
          
          // Tab switching
          tabButtons.forEach(button => {
            button.addEventListener('click', () => {
              const tab = button.dataset.tab;
              
              // Update active tab
              tabButtons.forEach(btn => btn.classList.remove('active'));
              button.classList.add('active');
              
              // Show corresponding content
              tabContents.forEach(content => content.classList.remove('active'));
              document.getElementById(\`\${tab}-tab\`).classList.add('active');
              
              // Update state
              state.activeTab = tab;
              vscode.setState(state);
              
              // Notify extension if switching to learning journal
              if (tab === 'journal') {
                vscode.postMessage({
                  command: 'openLearningJournal'
                });
              }
            });
          });
          
          // Toggle response mode
          toggleButtons.forEach(button => {
            button.addEventListener('click', () => {
              const mode = button.dataset.mode;
              
              // Update active button
              toggleButtons.forEach(btn => btn.classList.remove('active'));
              button.classList.add('active');
              
              // Update state
              state.responseMode = mode;
              vscode.setState(state);
              
              // Notify extension
              vscode.postMessage({
                command: 'toggleMode',
                mode: mode
              });
            });
          });
          
          // Handle messages from extension
          window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
              case 'receiveMessage':
                addMessageToUI(message.message.text, message.message.isUser);
                break;
                
              case 'updateDiagnostics':
                if (message.hasErrors) {
                  errorExplainer.classList.remove('hidden');
                } else {
                  errorExplainer.classList.add('hidden');
                }
                break;
                
              case 'explainError':
                // Add the error explanation as an AI message
                const errorText = \`I noticed an error in your code: "\${message.error.message}" at line \${message.error.line}, column \${message.error.column}. Let me explain what's happening...\`;
                addMessageToUI(errorText, false);
                break;
                
              case 'showLearningJournal':
                // Switch to learning journal tab
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                document.querySelector('[data-tab="journal"]').classList.add('active');
                document.getElementById('journal-tab').classList.add('active');
                break;
            }
          });
        })();
      </script>
    </body>
    </html>`
  }

  private dispose() {
    AIMentorPanel.currentPanel = undefined

    // Clean up our resources
    this._panel.dispose()

    while (this._disposables.length) {
      const disposable = this._disposables.pop()
      if (disposable) {
        disposable.dispose()
      }
    }
  }
}

function getNonce() {
  let text = ""
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}

export function deactivate() {}

