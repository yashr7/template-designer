Alright! Let's convert this to Angular. This will be a complete rewrite. Here's the step-by-step process:

## Step 1: Create New Angular Project

```bash
# Navigate to your parent directory
cd ~/Projects/template-designer

# Create new Angular project
ng new dynamic-template-editor-angular --style=scss --routing=false --skip-git

# Navigate into the project
cd dynamic-template-editor-angular

# Install Tailwind CSS
npm install -D tailwindcss postcss autoprefixer

# Initialize Tailwind
npx tailwindcss init
```

## Step 2: Configure Tailwind CSS

**Update `tailwind.config.js`:**
```bash
code tailwind.config.js
```

Replace with:
```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

**Update `src/styles.scss`:**
```bash
code src/styles.scss
```

Replace with:
```scss
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
  width: 100%;
}
```

## Step 3: Install Lucide Icons for Angular

```bash
npm install lucide-angular
```

## Step 4: Create the Models

```bash
# Create models directory
mkdir -p src/app/models

# Create model files
code src/app/models/placeholder.model.ts
code src/app/models/rule.model.ts
```

**`src/app/models/placeholder.model.ts`:**
```typescript
export interface Placeholder {
  name: string;
  marker: string;
  index: number;
}
```

**`src/app/models/rule.model.ts`:**
```typescript
export interface Rule {
  type: 'javascript' | 'prompt' | 'static';
  code?: string;
  prompt?: string;
  value?: string;
}

export interface RuleSet {
  [fieldName: string]: Rule;
}
```

## Step 5: Create Services

```bash
# Generate services
ng generate service services/template-parser
ng generate service services/rule-manager
```

**`src/app/services/template-parser.service.ts`:**
```typescript
import { Injectable } from '@angular/core';
import { Placeholder } from '../models/placeholder.model';

@Injectable({
  providedIn: 'root'
})
export class TemplateParserService {

  parseTemplate(html: string): Placeholder[] {
    const regex = /\/\*(\w+)\*\//g;
    const found: Placeholder[] = [];
    let match;
    
    while ((match = regex.exec(html)) !== null) {
      if (!found.some(p => p.name === match[1])) {
        found.push({
          name: match[1],
          marker: match[0],
          index: found.length
        });
      }
    }
    
    return found;
  }

  renderEditableHTML(html: string, placeholders: Placeholder[], rules: any): string {
    if (!html) return '';
    
    let processedHTML = html;
    placeholders.forEach((placeholder) => {
      const hasRule = rules[placeholder.name];
      const replacement = `<span class="placeholder ${hasRule ? 'has-rule' : ''}" data-field="${placeholder.name}">${placeholder.marker}</span>`;
      const escapedMarker = placeholder.marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      processedHTML = processedHTML.replace(new RegExp(escapedMarker, 'g'), replacement);
    });
    
    return processedHTML;
  }

  generatePreview(html: string, placeholders: Placeholder[], rules: any): string {
    let preview = html;
    
    placeholders.forEach((placeholder) => {
      const rule = rules[placeholder.name];
      let value = `/*${placeholder.name}*/`;
      
      if (rule) {
        if (rule.type === 'static') {
          value = rule.value;
        } else if (rule.type === 'javascript') {
          try {
            value = eval(`(function() { ${rule.code} })()`);
          } catch (e: any) {
            value = `[Error: ${e.message}]`;
          }
        } else if (rule.type === 'prompt') {
          value = `[AI Generated from: "${rule.prompt}"]`;
        }
      }
      
      const escapedMarker = placeholder.marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      preview = preview.replace(new RegExp(escapedMarker, 'g'), value);
    });
    
    return preview;
  }
}
```

**`src/app/services/rule-manager.service.ts`:**
```typescript
import { Injectable } from '@angular/core';
import { Rule, RuleSet } from '../models/rule.model';

@Injectable({
  providedIn: 'root'
})
export class RuleManagerService {
  private rules: RuleSet = {};

  getRules(): RuleSet {
    return this.rules;
  }

  getRule(fieldName: string): Rule | undefined {
    return this.rules[fieldName];
  }

  saveRule(fieldName: string, rule: Rule): void {
    this.rules[fieldName] = rule;
  }

  deleteRule(fieldName: string): void {
    delete this.rules[fieldName];
  }

  generateCode(): string {
    let code = '// Auto-generated template fill functions\n\n';
    
    Object.entries(this.rules).forEach(([fieldName, rule]) => {
      code += `// Rule for field: ${fieldName}\n`;
      if (rule.type === 'javascript') {
        code += `function generate_${fieldName}() {\n  ${rule.code}\n}\n\n`;
      } else if (rule.type === 'prompt') {
        code += `// AI Prompt: "${rule.prompt}"\n`;
        code += `async function generate_${fieldName}() {\n  // Call AI API with prompt\n  const result = await callAI("${rule.prompt}");\n  return result;\n}\n\n`;
      } else if (rule.type === 'static') {
        code += `function generate_${fieldName}() {\n  return "${rule.value}";\n}\n\n`;
      }
    });
    
    return code;
  }

  testRule(rule: Rule): string {
    if (rule.type === 'javascript') {
      try {
        return String(eval(`(function() { ${rule.code} })()`));
      } catch (e: any) {
        return `Error: ${e.message}`;
      }
    } else if (rule.type === 'prompt') {
      return '[AI would generate result from this prompt]';
    } else {
      return rule.value || '';
    }
  }
}
```

## Step 6: Create Components

```bash
# Generate components
ng generate component components/template-editor --skip-tests
ng generate component components/rule-editor --skip-tests
```

**`src/app/components/rule-editor/rule-editor.component.ts`:**
```typescript
import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Code, Sparkles, FileText, Play, Save } from 'lucide-angular';
import { Rule } from '../../models/rule.model';
import { RuleManagerService } from '../../services/rule-manager.service';

@Component({
  selector: 'app-rule-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './rule-editor.component.html',
  styleUrls: ['./rule-editor.component.scss']
})
export class RuleEditorComponent implements OnInit {
  @Input() fieldName: string = '';
  @Input() currentRule?: Rule;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();

  readonly CodeIcon = Code;
  readonly SparklesIcon = Sparkles;
  readonly FileTextIcon = FileText;
  readonly PlayIcon = Play;
  readonly SaveIcon = Save;

  ruleType: 'javascript' | 'prompt' | 'static' = 'javascript';
  code: string = 'return "Your value here";';
  prompt: string = '';
  staticValue: string = '';
  testResult: string = '';

  constructor(private ruleManager: RuleManagerService) {}

  ngOnInit(): void {
    if (this.currentRule) {
      this.ruleType = this.currentRule.type;
      this.code = this.currentRule.code || 'return "Your value here";';
      this.prompt = this.currentRule.prompt || '';
      this.staticValue = this.currentRule.value || '';
    }
  }

  setRuleType(type: 'javascript' | 'prompt' | 'static'): void {
    this.ruleType = type;
  }

  handleTest(): void {
    const rule: Rule = { type: this.ruleType };
    
    if (this.ruleType === 'javascript') {
      rule.code = this.code;
    } else if (this.ruleType === 'prompt') {
      rule.prompt = this.prompt;
    } else {
      rule.value = this.staticValue;
    }

    this.testResult = this.ruleManager.testRule(rule);
  }

  handleSave(): void {
    const ruleData: Rule = { type: this.ruleType };
    
    if (this.ruleType === 'javascript') {
      ruleData.code = this.code;
    } else if (this.ruleType === 'prompt') {
      ruleData.prompt = this.prompt;
    } else {
      ruleData.value = this.staticValue;
    }
    
    this.ruleManager.saveRule(this.fieldName, ruleData);
    alert('Rule saved successfully!');
    this.save.emit();
  }

  onClose(): void {
    this.close.emit();
  }
}
```

**`src/app/components/rule-editor/rule-editor.component.html`:**
```html
<div class="w-96 bg-white border-l shadow-lg flex flex-col h-full">
  <div class="p-4 border-b bg-gray-50 flex items-center justify-between">
    <div>
      <h3 class="font-semibold text-lg">Edit Field</h3>
      <p class="text-sm text-gray-600">/*{{fieldName}}*/</p>
    </div>
    <button
      (click)="onClose()"
      class="p-1 hover:bg-gray-200 rounded"
    >
      <lucide-icon name="x" [size]="20"></lucide-icon>
    </button>
  </div>

  <div class="flex-1 flex flex-col p-4 overflow-auto">
    <!-- Rule Type Selector -->
    <div class="mb-4">
      <label class="block text-sm font-medium mb-2">Rule Type</label>
      <div class="flex gap-2">
        <button
          (click)="setRuleType('javascript')"
          [class]="ruleType === 'javascript' ? 'flex-1 py-2 px-3 rounded flex items-center justify-center gap-2 text-sm bg-blue-600 text-white' : 'flex-1 py-2 px-3 rounded flex items-center justify-center gap-2 text-sm bg-gray-100 hover:bg-gray-200'"
        >
          <lucide-angular [img]="CodeIcon" [size]="16"></lucide-angular>
          JavaScript
        </button>
        <button
          (click)="setRuleType('prompt')"
          [class]="ruleType === 'prompt' ? 'flex-1 py-2 px-3 rounded flex items-center justify-center gap-2 text-sm bg-blue-600 text-white' : 'flex-1 py-2 px-3 rounded flex items-center justify-center gap-2 text-sm bg-gray-100 hover:bg-gray-200'"
        >
          <lucide-angular [img]="SparklesIcon" [size]="16"></lucide-angular>
          AI Prompt
        </button>
        <button
          (click)="setRuleType('static')"
          [class]="ruleType === 'static' ? 'flex-1 py-2 px-3 rounded flex items-center justify-center gap-2 text-sm bg-blue-600 text-white' : 'flex-1 py-2 px-3 rounded flex items-center justify-center gap-2 text-sm bg-gray-100 hover:bg-gray-200'"
        >
          <lucide-angular [img]="FileTextIcon" [size]="16"></lucide-angular>
          Static
        </button>
      </div>
    </div>

    <!-- Rule Input -->
    <div class="flex-1 mb-4">
      <div *ngIf="ruleType === 'javascript'">
        <label class="block text-sm font-medium mb-2">JavaScript Code</label>
        <textarea
          [(ngModel)]="code"
          class="w-full h-64 p-3 border rounded font-mono text-sm"
          placeholder="return new Date().toLocaleDateString();"
        ></textarea>
      </div>

      <div *ngIf="ruleType === 'prompt'">
        <label class="block text-sm font-medium mb-2">AI Prompt</label>
        <textarea
          [(ngModel)]="prompt"
          class="w-full h-64 p-3 border rounded text-sm"
          placeholder="Generate a professional summary..."
        ></textarea>
      </div>

      <div *ngIf="ruleType === 'static'">
        <label class="block text-sm font-medium mb-2">Static Value</label>
        <input
          type="text"
          [(ngModel)]="staticValue"
          class="w-full p-3 border rounded"
          placeholder="Enter static value..."
        />
      </div>
    </div>

    <!-- Test Result -->
    <div *ngIf="testResult" class="mb-4 p-3 bg-gray-50 rounded border">
      <div class="text-xs font-medium text-gray-600 mb-1">Test Result:</div>
      <div class="text-sm font-mono">{{testResult}}</div>
    </div>

    <!-- Actions -->
    <div class="flex gap-2">
      <button
        (click)="handleTest()"
        class="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
      >
        <lucide-angular [img]="PlayIcon" [size]="16"></lucide-angular>
        Test
      </button>
      <button
        (click)="handleSave()"
        class="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        <lucide-angular [img]="SaveIcon" [size]="16"></lucide-angular>
        Save Rule
      </button>
    </div>
  </div>
</div>
```

**`src/app/components/rule-editor/rule-editor.component.scss`:**
```scss
// Component-specific styles if needed
```

## Step 7: Create Template Editor Component

**`src/app/components/template-editor/template-editor.component.ts`:**
```typescript
import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { LucideAngularModule, Upload, Code, FileText, X } from 'lucide-angular';
import { Placeholder } from '../../models/placeholder.model';
import { TemplateParserService } from '../../services/template-parser.service';
import { RuleManagerService } from '../../services/rule-manager.service';
import { RuleEditorComponent } from '../rule-editor/rule-editor.component';

@Component({
  selector: 'app-template-editor',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, RuleEditorComponent],
  templateUrl: './template-editor.component.html',
  styleUrls: ['./template-editor.component.scss']
})
export class TemplateEditorComponent {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  readonly UploadIcon = Upload;
  readonly CodeIcon = Code;
  readonly FileTextIcon = FileText;
  readonly XIcon = X;

  htmlContent: string = '';
  placeholders: Placeholder[] = [];
  selectedField: string | null = null;
  showPreview: boolean = false;

  constructor(
    private templateParser: TemplateParserService,
    public ruleManager: RuleManagerService,
    private sanitizer: DomSanitizer
  ) {}

  get rulesCount(): number {
    return Object.keys(this.ruleManager.getRules()).length;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      
      reader.onload = (e) => {
        this.htmlContent = e.target?.result as string;
        this.placeholders = this.templateParser.parseTemplate(this.htmlContent);
      };
      
      reader.readAsText(file);
    }
  }

  triggerFileInput(): void {
    this.fileInput.nativeElement.click();
  }

  getRenderedHTML(): SafeHtml {
    const html = this.templateParser.renderEditableHTML(
      this.htmlContent,
      this.placeholders,
      this.ruleManager.getRules()
    );
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  getPreviewHTML(): SafeHtml {
    const html = this.templateParser.generatePreview(
      this.htmlContent,
      this.placeholders,
      this.ruleManager.getRules()
    );
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  onTemplateClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const fieldName = target.getAttribute('data-field');
    if (fieldName) {
      this.selectedField = fieldName;
    }
  }

  togglePreview(): void {
    this.showPreview = !this.showPreview;
  }

  exportCode(): void {
    const code = this.ruleManager.generateCode();
    navigator.clipboard.writeText(code);
    alert('Code copied to clipboard!');
  }

  closeRuleEditor(): void {
    this.selectedField = null;
  }

  onRuleSaved(): void {
    // Refresh view if needed
  }
}
```

**`src/app/components/template-editor/template-editor.component.html`:**
```html
<div class="flex h-screen bg-gray-50">
  <!-- Main Editor Area -->
  <div class="flex-1 flex flex-col">
    <!-- Toolbar -->
    <div class="bg-white border-b px-4 py-3 flex items-center gap-3">
      <input
        #fileInput
        type="file"
        accept=".html,.htm"
        (change)="onFileSelected($event)"
        class="hidden"
      />
      <button
        (click)="triggerFileInput()"
        class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        <lucide-angular [img]="UploadIcon" [size]="16"></lucide-angular>
        Upload Template
      </button>
      
      <button
        (click)="togglePreview()"
        [disabled]="!htmlContent"
        class="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <lucide-angular [img]="FileTextIcon" [size]="16"></lucide-angular>
        {{ showPreview ? 'Edit Mode' : 'Preview' }}
      </button>
      
      <button
        (click)="exportCode()"
        [disabled]="rulesCount === 0"
        class="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <lucide-angular [img]="CodeIcon" [size]="16"></lucide-angular>
        Export Code
      </button>
      
      <div class="ml-auto text-sm text-gray-600">
        {{ placeholders.length }} fields • {{ rulesCount }} rules defined
      </div>
    </div>

    <!-- Template Display -->
    <div class="flex-1 overflow-auto p-6">
      <!-- Empty State -->
      <div *ngIf="!htmlContent" class="flex items-center justify-center h-full">
        <div class="text-center text-gray-400">
          <lucide-angular [img]="UploadIcon" [size]="64" class="mx-auto mb-4 opacity-50"></lucide-angular>
          <p class="text-lg">Upload an HTML template to get started</p>
          <p class="text-sm mt-2">Use /*FieldName*/ syntax for dynamic fields</p>
        </div>
      </div>

      <!-- Preview Mode -->
      <div *ngIf="htmlContent && showPreview" class="bg-white rounded-lg shadow-lg p-8 w-full">
        <h3 class="text-lg font-semibold mb-4">Preview Output</h3>
        <div 
          class="w-full"
          [innerHTML]="getPreviewHTML()"
        ></div>
      </div>

      <!-- Edit Mode -->
      <div *ngIf="htmlContent && !showPreview" class="bg-white rounded-lg shadow-lg p-8 w-full">
        <style>
          .placeholder {
            background: #fef3c7;
            padding: 2px 6px;
            border-radius: 4px;
            cursor: pointer;
            border: 2px solid #fbbf24;
            transition: all 0.2s;
            display: inline-block;
          }
          .placeholder:hover {
            background: #fcd34d;
            border-color: #f59e0b;
          }
          .placeholder.has-rule {
            background: #d1fae5;
            border-color: #10b981;
          }
          .placeholder.has-rule:hover {
            background: #a7f3d0;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
          }
        </style>
        <div 
          (click)="onTemplateClick($event)"
          class="w-full"
          [innerHTML]="getRenderedHTML()"
        ></div>
      </div>
    </div>
  </div>

  <!-- Rule Editor Panel -->
  <app-rule-editor
    *ngIf="selectedField"
    [fieldName]="selectedField"
    [currentRule]="ruleManager.getRule(selectedField)"
    (close)="closeRuleEditor()"
    (save)="onRuleSaved()"
  ></app-rule-editor>
</div>
```

**`src/app/components/template-editor/template-editor.component.scss`:**
```scss
// Component-specific styles
```

## Step 8: Update App Component

**`src/app/app.component.ts`:**
```typescript
import { Component } from '@angular/core';
import { TemplateEditorComponent } from './components/template-editor/template-editor.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [TemplateEditorComponent],
  template: '<app-template-editor></app-template-editor>',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'dynamic-template-editor-angular';
}
```

## Step 9: Update Main Configuration

**`src/main.ts`:**
```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent)
  .catch(err => console.error(err));
```

## Step 10: Run the Application

```bash
# Start development server
ng serve

# Or specify port
ng serve --port 4200
```

Open browser at `http://localhost:4200`

---

## Key Differences from React:

1. **TypeScript Required** - Everything must be typed
2. **Dependency Injection** - Services are injected via constructor
3. **Two-way Binding** - `[(ngModel)]` for forms
4. **Separate Files** - `.ts`, `.html`, `.scss` files per component
5. **Decorators** - `@Component`, `@Injectable`, etc.
6. **Standalone Components** - Modern Angular approach (no modules needed)

---

Let me know if you hit any errors during setup! The Angular version is now functionally equivalent to your React version. 🚀