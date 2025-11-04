Perfect! Let's update the Angular frontend to connect to the Python backend.

## Step 1: Create Environment Configuration

Navigate to your Angular project:

```bash
cd ~/Projects/template-designer/dynamic-template-editor-angular
```

**Create/Update `src/environments/environment.ts`:**
```bash
mkdir -p src/environments
code src/environments/environment.ts
```

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000/api'
};
```

**Create `src/environments/environment.prod.ts`:**
```bash
code src/environments/environment.prod.ts
```

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://your-production-api.com/api'
};
```

## Step 2: Update Models

**Update `src/app/models/rule.model.ts`:**
```bash
code src/app/models/rule.model.ts
```

```typescript
export interface Rule {
  prompt: string;
  generated_code: string;
  ai_response: string;
  updated_at?: string;
}

export interface RuleSet {
  [fieldName: string]: Rule;
}

export interface AIPromptRequest {
  prompt: string;
  field_name: string;
  context?: string;
}

export interface RuleResponse {
  field_name: string;
  generated_code: string;
  ai_response: string;
}

export interface SaveRuleRequest {
  template_id: string;
  field_name: string;
  prompt: string;
  generated_code: string;
  ai_response: string;
}

export interface TemplateMetadata {
  name: string;
  description: string;
  created_at: string;
}
```

## Step 3: Create API Service

```bash
ng generate service services/api --skip-tests
```

**Update `src/app/services/api.service.ts`:**
```typescript
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { 
  AIPromptRequest, 
  RuleResponse, 
  SaveRuleRequest,
  RuleSet,
  TemplateMetadata 
} from '../models/rule.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Generate rule code from AI prompt
  generateRule(request: AIPromptRequest): Observable<RuleResponse> {
    return this.http.post<RuleResponse>(
      `${this.apiUrl}/rules/generate`,
      request
    );
  }

  // Generate simple value (not code)
  generateSimpleValue(request: AIPromptRequest): Observable<RuleResponse> {
    return this.http.post<RuleResponse>(
      `${this.apiUrl}/rules/generate-simple`,
      request
    );
  }

  // Save rule
  saveRule(request: SaveRuleRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/rules/save`, request);
  }

  // Get all rules for a template
  getTemplateRules(templateId: string): Observable<RuleSet> {
    return this.http.get<RuleSet>(
      `${this.apiUrl}/rules/template/${templateId}`
    );
  }

  // Get specific rule
  getRule(templateId: string, fieldName: string): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/rules/template/${templateId}/field/${fieldName}`
    );
  }

  // Delete rule
  deleteRule(templateId: string, fieldName: string): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/rules/template/${templateId}/field/${fieldName}`
    );
  }

  // List all templates
  listTemplates(): Observable<{ templates: string[] }> {
    return this.http.get<{ templates: string[] }>(
      `${this.apiUrl}/rules/templates`
    );
  }

  // Upload template
  uploadTemplate(file: File, templateName?: string): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    if (templateName) {
      formData.append('template_name', templateName);
    }

    return this.http.post(
      `${this.apiUrl}/rules/template/upload`,
      formData
    );
  }

  // Health check
  healthCheck(): Observable<any> {
    return this.http.get('http://localhost:8000/health');
  }
}
```

## Step 4: Update Rule Manager Service

**Update `src/app/services/rule-manager.service.ts`:**
```typescript
import { Injectable } from '@angular/core';
import { Rule, RuleSet } from '../models/rule.model';
import { ApiService } from './api.service';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class RuleManagerService {
  private rules: RuleSet = {};
  private currentTemplateId: string = '';
  private rulesSubject = new BehaviorSubject<RuleSet>({});
  public rules$ = this.rulesSubject.asObservable();

  constructor(private apiService: ApiService) {}

  setTemplateId(templateId: string): void {
    this.currentTemplateId = templateId;
    this.loadRulesFromServer(templateId);
  }

  getCurrentTemplateId(): string {
    return this.currentTemplateId;
  }

  loadRulesFromServer(templateId: string): void {
    this.apiService.getTemplateRules(templateId).subscribe({
      next: (rules) => {
        this.rules = rules;
        this.rulesSubject.next(this.rules);
      },
      error: (error) => {
        console.error('Error loading rules:', error);
        this.rules = {};
        this.rulesSubject.next(this.rules);
      }
    });
  }

  getRules(): RuleSet {
    return this.rules;
  }

  getRule(fieldName: string): Rule | undefined {
    return this.rules[fieldName];
  }

  saveRuleLocally(fieldName: string, rule: Rule): void {
    this.rules[fieldName] = rule;
    this.rulesSubject.next(this.rules);
  }

  saveRuleToServer(fieldName: string, rule: Rule): Observable<any> {
    const request = {
      template_id: this.currentTemplateId,
      field_name: fieldName,
      prompt: rule.prompt,
      generated_code: rule.generated_code,
      ai_response: rule.ai_response
    };

    return this.apiService.saveRule(request).pipe(
      tap(() => {
        this.saveRuleLocally(fieldName, rule);
      })
    );
  }

  deleteRule(fieldName: string): Observable<any> {
    return this.apiService.deleteRule(this.currentTemplateId, fieldName).pipe(
      tap(() => {
        delete this.rules[fieldName];
        this.rulesSubject.next(this.rules);
      })
    );
  }

  generateCode(): string {
    let code = '// Auto-generated template fill functions\n\n';
    
    Object.entries(this.rules).forEach(([fieldName, rule]) => {
      code += `// Rule for field: ${fieldName}\n`;
      code += `// Prompt: "${rule.prompt}"\n`;
      code += `${rule.generated_code}\n\n`;
    });
    
    return code;
  }

  testRule(rule: Rule): string {
    try {
      const result = eval(`(function() { ${rule.generated_code}; return generate_${rule.generated_code.match(/function\s+(\w+)/)?.[1] || 'field'}(); })()`);
      return String(result);
    } catch (e: any) {
      return `Error: ${e.message}`;
    }
  }
}
```

## Step 5: Update Rule Editor Component

**Update `src/app/components/rule-editor/rule-editor.component.ts`:**
```typescript
import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Code, Sparkles, FileText, Play, Save, Loader2, Trash2 } from 'lucide-angular';
import { Rule } from '../../models/rule.model';
import { RuleManagerService } from '../../services/rule-manager.service';
import { ApiService } from '../../services/api.service';

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
  readonly Loader2Icon = Loader2;
  readonly Trash2Icon = Trash2;

  prompt: string = '';
  generatedCode: string = '';
  aiResponse: string = '';
  testResult: string = '';
  isGenerating: boolean = false;
  isSaving: boolean = false;
  isDeleting: boolean = false;
  hasGenerated: boolean = false;

  constructor(
    private ruleManager: RuleManagerService,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    if (this.currentRule) {
      this.prompt = this.currentRule.prompt;
      this.generatedCode = this.currentRule.generated_code;
      this.aiResponse = this.currentRule.ai_response;
      this.hasGenerated = true;
    }
  }

  generateWithAI(): void {
    if (!this.prompt.trim()) {
      alert('Please enter a prompt');
      return;
    }

    this.isGenerating = true;
    this.testResult = '';

    const request = {
      prompt: this.prompt,
      field_name: this.fieldName,
      context: undefined
    };

    this.apiService.generateRule(request).subscribe({
      next: (response) => {
        this.generatedCode = response.generated_code;
        this.aiResponse = response.ai_response;
        this.hasGenerated = true;
        this.isGenerating = false;
      },
      error: (error) => {
        console.error('Error generating rule:', error);
        alert(`Error: ${error.error?.detail || 'Failed to generate rule'}`);
        this.isGenerating = false;
      }
    });
  }

  handleTest(): void {
    if (!this.generatedCode) {
      alert('No code to test. Generate code first.');
      return;
    }

    const rule: Rule = {
      prompt: this.prompt,
      generated_code: this.generatedCode,
      ai_response: this.aiResponse
    };

    this.testResult = this.ruleManager.testRule(rule);
  }

  handleSave(): void {
    if (!this.hasGenerated || !this.generatedCode) {
      alert('Please generate code before saving');
      return;
    }

    this.isSaving = true;

    const rule: Rule = {
      prompt: this.prompt,
      generated_code: this.generatedCode,
      ai_response: this.aiResponse
    };

    this.ruleManager.saveRuleToServer(this.fieldName, rule).subscribe({
      next: () => {
        alert('Rule saved successfully!');
        this.isSaving = false;
        this.save.emit();
      },
      error: (error) => {
        console.error('Error saving rule:', error);
        alert(`Error: ${error.error?.detail || 'Failed to save rule'}`);
        this.isSaving = false;
      }
    });
  }

  handleDelete(): void {
    if (!confirm(`Delete rule for ${this.fieldName}?`)) {
      return;
    }

    this.isDeleting = true;

    this.ruleManager.deleteRule(this.fieldName).subscribe({
      next: () => {
        alert('Rule deleted successfully!');
        this.isDeleting = false;
        this.save.emit();
        this.onClose();
      },
      error: (error) => {
        console.error('Error deleting rule:', error);
        alert(`Error: ${error.error?.detail || 'Failed to delete rule'}`);
        this.isDeleting = false;
      }
    });
  }

  onClose(): void {
    this.close.emit();
  }
}
```

**Update `src/app/components/rule-editor/rule-editor.component.html`:**
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
    <!-- AI Prompt Input -->
    <div class="mb-4">
      <label class="block text-sm font-medium mb-2">
        <lucide-angular [img]="SparklesIcon" [size]="16" class="inline mr-1"></lucide-angular>
        AI Prompt
      </label>
      <textarea
        [(ngModel)]="prompt"
        [disabled]="isGenerating"
        class="w-full h-32 p-3 border rounded text-sm resize-none"
        placeholder="Example: Generate current date in MM/DD/YYYY format&#10;or: Fetch company name from config.json file&#10;or: Generate a random 8-character document ID"
      ></textarea>
      <button
        (click)="generateWithAI()"
        [disabled]="isGenerating || !prompt.trim()"
        class="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <lucide-angular 
          [img]="isGenerating ? Loader2Icon : SparklesIcon" 
          [size]="16"
          [class.animate-spin]="isGenerating"
        ></lucide-angular>
        {{ isGenerating ? 'Generating...' : 'Generate with AI' }}
      </button>
    </div>

    <!-- Generated Code Display -->
    <div *ngIf="hasGenerated" class="mb-4 flex-1">
      <label class="block text-sm font-medium mb-2">
        <lucide-angular [img]="CodeIcon" [size]="16" class="inline mr-1"></lucide-angular>
        Generated Code
      </label>
      <textarea
        [(ngModel)]="generatedCode"
        class="w-full h-48 p-3 border rounded font-mono text-xs resize-none bg-gray-50"
        readonly
      ></textarea>
      
      <div *ngIf="aiResponse" class="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
        <strong>AI Note:</strong> {{ aiResponse }}
      </div>
    </div>

    <!-- Test Result -->
    <div *ngIf="testResult" class="mb-4 p-3 bg-gray-50 rounded border">
      <div class="text-xs font-medium text-gray-600 mb-1">Test Result:</div>
      <div class="text-sm font-mono break-all">{{testResult}}</div>
    </div>

    <!-- Actions -->
    <div class="flex gap-2 mt-auto">
      <button
        (click)="handleTest()"
        [disabled]="!hasGenerated || isGenerating"
        class="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <lucide-angular [img]="PlayIcon" [size]="16"></lucide-angular>
        Test
      </button>
      <button
        (click)="handleSave()"
        [disabled]="!hasGenerated || isGenerating || isSaving"
        class="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <lucide-angular 
          [img]="isSaving ? Loader2Icon : SaveIcon" 
          [size]="16"
          [class.animate-spin]="isSaving"
        ></lucide-angular>
        {{ isSaving ? 'Saving...' : 'Save' }}
      </button>
    </div>

    <!-- Delete Button -->
    <button
      *ngIf="currentRule"
      (click)="handleDelete()"
      [disabled]="isDeleting"
      class="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <lucide-angular 
        [img]="isDeleting ? Loader2Icon : Trash2Icon" 
        [size]="16"
        [class.animate-spin]="isDeleting"
      ></lucide-angular>
      {{ isDeleting ? 'Deleting...' : 'Delete Rule' }}
    </button>
  </div>
</div>
```

## Step 6: Update Template Editor Component

**Update `src/app/components/template-editor/template-editor.component.ts`:**
```typescript
import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { LucideAngularModule, Upload, Code, FileText, X, Loader2 } from 'lucide-angular';
import { Placeholder } from '../../models/placeholder.model';
import { TemplateParserService } from '../../services/template-parser.service';
import { RuleManagerService } from '../../services/rule-manager.service';
import { ApiService } from '../../services/api.service';
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
  readonly Loader2Icon = Loader2;

  htmlContent: string = '';
  placeholders: Placeholder[] = [];
  selectedField: string | null = null;
  showPreview: boolean = false;
  isUploading: boolean = false;
  templateId: string = '';
  templateName: string = '';

  constructor(
    private templateParser: TemplateParserService,
    public ruleManager: RuleManagerService,
    private apiService: ApiService,
    private sanitizer: DomSanitizer
  ) {}

  get rulesCount(): number {
    return Object.keys(this.ruleManager.getRules()).length;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.isUploading = true;

      // First, upload to backend
      this.apiService.uploadTemplate(file, file.name).subscribe({
        next: (response) => {
          this.templateId = response.template_id;
          this.templateName = response.template_name;
          
          // Set template ID in rule manager
          this.ruleManager.setTemplateId(this.templateId);

          // Then read and parse the file
          const reader = new FileReader();
          reader.onload = (e) => {
            this.htmlContent = e.target?.result as string;
            this.placeholders = this.templateParser.parseTemplate(this.htmlContent);
            this.isUploading = false;
          };
          reader.readAsText(file);
        },
        error: (error) => {
          console.error('Error uploading template:', error);
          alert(`Error uploading template: ${error.error?.detail || 'Unknown error'}`);
          this.isUploading = false;
        }
      });
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
    this.selectedField = null;
  }
}
```

## Step 7: Configure HttpClient in App

**Update `src/app/app.config.ts` (create if doesn't exist):**
```bash
code src/app/app.config.ts
```

```typescript
import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient()
  ]
};
```

**Update `src/main.ts`:**
```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient()
  ]
}).catch(err => console.error(err));
```

## Step 8: Update Template Editor HTML (add loading state)

**Update `src/app/components/template-editor/template-editor.component.html`:**

Find the upload button section and update it to show loading state:

```html
<button
  (click)="triggerFileInput()"
  [disabled]="isUploading"
  class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
>
  <lucide-angular 
    [img]="isUploading ? Loader2Icon : UploadIcon" 
    [size]="16"
    [class.animate-spin]="isUploading"
  ></lucide-angular>
  {{ isUploading ? 'Uploading...' : 'Upload Template' }}
</button>
```

Also add template info display after the toolbar stats:

```html
<div class="ml-auto text-sm text-gray-600">
  <span *ngIf="templateName" class="mr-4">
    <strong>Template:</strong> {{ templateName }} ({{ templateId }})
  </span>
  {{ placeholders.length }} fields • {{ rulesCount }} rules defined
</div>
```

## Step 9: Run Both Services

**Terminal 1 - Backend:**
```bash
cd ~/Projects/template-designer/dynamic-template-backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd ~/Projects/template-designer/dynamic-template-editor-angular
ng serve --port 4200
```

## Step 10: Test the Integration

1. **Open browser**: `http://localhost:4200`
2. **Upload HTML template** - It will automatically upload to backend and get a template ID
3. **Click on a placeholder** (e.g., `/*CurrentDate*/`)
4. **Enter AI prompt**: "Generate current date in MM/DD/YYYY format"
5. **Click "Generate with AI"** - It calls the Python backend with OpenAI
6. **Review generated code**
7. **Click "Test"** to test the code
8. **Click "Save"** to save to backend
9. **The placeholder turns green** (has rule)
10. **Click "Preview"** to see the final result

---

## Features Now Working:

✅ Upload HTML template to backend
✅ Generate unique template ID
✅ AI-powered rule generation via OpenAI
✅ Save rules per template per field
✅ Load existing rules from backend
✅ Test generated code
✅ Delete rules
✅ Export all rules as code
✅ Persistent storage in JSON files
✅ Full Angular + Python integration

---

Your full-stack application is now complete! The Angular frontend talks to the Python backend, which uses OpenAI to generate JavaScript code based on natural language prompts. All rules are saved persistently on the backend. 🎉