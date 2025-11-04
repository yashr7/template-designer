import React, { useState, useRef } from ‘react’;
import { Upload, Code, Play, Save, FileText, Sparkles, X, Loader2 } from ‘lucide-react’;

const DynamicTemplateEditor = () => {
const [htmlContent, setHtmlContent] = useState(’’);
const [placeholders, setPlaceholders] = useState([]);
const [selectedField, setSelectedField] = useState(null);
const [rules, setRules] = useState({});
const [showPreview, setShowPreview] = useState(false);
const fileInputRef = useRef(null);

const parseTemplate = (html) => {
const regex = //*(\w+)*//g;
const found = [];
let match;

```
while ((match = regex.exec(html)) !== null) {
  if (!found.some(p => p.name === match[1])) {
    found.push({
      name: match[1],
      marker: match[0],
      index: found.length
    });
  }
}

setPlaceholders(found);
return found;
```

};

const handleFileUpload = (e) => {
const file = e.target.files[0];
if (file) {
const reader = new FileReader();
reader.onload = (event) => {
const content = event.target.result;
setHtmlContent(content);
parseTemplate(content);
};
reader.readAsText(file);
}
};

const renderEditableHTML = () => {
if (!htmlContent) return null;

```
let processedHTML = htmlContent;
placeholders.forEach((placeholder) => {
  const hasRule = rules[placeholder.name];
  const replacement = `<span class="placeholder ${hasRule ? 'has-rule' : ''}" data-field="${placeholder.name}">${placeholder.marker}</span>`;
  processedHTML = processedHTML.replace(new RegExp(placeholder.marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
});

return processedHTML;
```

};

const handlePlaceholderClick = (e) => {
const fieldName = e.target.getAttribute(‘data-field’);
if (fieldName) {
setSelectedField(fieldName);
}
};

const saveRule = (fieldName, ruleData) => {
setRules(prev => ({
…prev,
[fieldName]: ruleData
}));
};

const generateCode = () => {
let code = ‘// Auto-generated template fill functions\n\n’;

```
Object.entries(rules).forEach(([fieldName, rule]) => {
  code += `// Rule for field: ${fieldName}\n`;
  if (rule.ruleType === 'static') {
    code += `// Static mapping from THML tag: ${rule.thmlTag}\n`;
    code += `function generate_${fieldName}() {\n  // Fetch value from THML file\n  return fetchFromTHML("${rule.thmlTag}");\n}\n\n`;
  } else if (rule.ruleType === 'dynamic') {
    code += `// AI Generated from prompt: "${rule.prompt}"\n`;
    code += `${rule.generatedCode || '// Code not yet generated'}\n\n`;
  }
});

return code;
```

};

const generatePreview = () => {
let preview = htmlContent;

```
placeholders.forEach((placeholder) => {
  const rule = rules[placeholder.name];
  let value = `/*${placeholder.name}*/`;
  
  if (rule) {
    if (rule.ruleType === 'static') {
      value = `[THML:${rule.thmlTag}]`;
    } else if (rule.ruleType === 'dynamic' && rule.generatedCode) {
      try {
        value = eval(`(function() { ${rule.generatedCode}; return generate_${placeholder.name}(); })()`);
      } catch (e) {
        value = `[Error: ${e.message}]`;
      }
    }
  }
  
  preview = preview.replace(new RegExp(placeholder.marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
});

return preview;
```

};

return (
<div className="flex h-screen bg-gray-50">
<div className="flex-1 flex flex-col">
<div className="bg-white border-b px-4 py-3 flex items-center gap-3">
<input
ref={fileInputRef}
type="file"
accept=".html,.htm"
onChange={handleFileUpload}
className="hidden"
/>
<button
onClick={() => fileInputRef.current?.click()}
className=“flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700”
>
<Upload className="w-4 h-4" />
Upload Template
</button>

```
      <button
        onClick={() => setShowPreview(!showPreview)}
        className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        disabled={!htmlContent}
      >
        <FileText className="w-4 h-4" />
        {showPreview ? 'Edit Mode' : 'Preview'}
      </button>
      
      <button
        onClick={() => {
          const code = generateCode();
          navigator.clipboard.writeText(code);
          alert('Code copied to clipboard!');
        }}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        disabled={Object.keys(rules).length === 0}
      >
        <Code className="w-4 h-4" />
        Export Code
      </button>
      
      <div className="ml-auto text-sm text-gray-600">
        {placeholders.length} fields • {Object.keys(rules).length} rules defined
      </div>
    </div>

    <div className="flex-1 overflow-auto p-6">
      {!htmlContent ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-gray-400">
            <Upload className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Upload an HTML template to get started</p>
            <p className="text-sm mt-2">Use /*FieldName*/ syntax for dynamic fields</p>
          </div>
        </div>
      ) : showPreview ? (
        <div className="bg-white rounded-lg shadow-lg p-8 w-full">
          <h3 className="text-lg font-semibold mb-4">Preview Output</h3>
          <div 
            className="w-full"
            dangerouslySetInnerHTML={{ __html: generatePreview() }}
          />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-lg p-8 w-full">
          <style dangerouslySetInnerHTML={{
            __html: `
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
            `
          }} />
          <div 
            onClick={handlePlaceholderClick}
            className="w-full"
            dangerouslySetInnerHTML={{ __html: renderEditableHTML() }}
          />
        </div>
      )}
    </div>
  </div>

  {selectedField && (
    <RuleEditor
      fieldName={selectedField}
      currentRule={rules[selectedField]}
      onSave={(ruleData) => saveRule(selectedField, ruleData)}
      onClose={() => setSelectedField(null)}
    />
  )}
</div>
```

);
};

const RuleEditor = ({ fieldName, currentRule, onSave, onClose }) => {
const [ruleType, setRuleType] = useState(currentRule?.ruleType || ‘static’);
const [thmlTag, setThmlTag] = useState(currentRule?.thmlTag || ‘’);
const [prompt, setPrompt] = useState(currentRule?.prompt || ‘’);
const [generatedCode, setGeneratedCode] = useState(currentRule?.generatedCode || ‘’);
const [testResult, setTestResult] = useState(’’);
const [isGenerating, setIsGenerating] = useState(false);

const handleGenerate = async () => {
if (!prompt.trim()) {
alert(‘Please enter a prompt’);
return;
}

```
setIsGenerating(true);
setTestResult('');

try {
  const response = await fetch('http://localhost:8000/api/rules/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: prompt,
      field_name: fieldName,
      context: null
    })
  });

  if (!response.ok) {
    throw new Error('Failed to generate code');
  }

  const data = await response.json();
  setGeneratedCode(data.generated_code);
  alert('Code generated successfully!');
} catch (error) {
  console.error('Error generating code:', error);
  alert(`Error: ${error.message}`);
} finally {
  setIsGenerating(false);
}
```

};

const handleTest = () => {
if (ruleType === ‘static’) {
if (!thmlTag.trim()) {
alert(‘Please enter a THML tag’);
return;
}
setTestResult(`[Would fetch from THML tag: ${thmlTag}]`);
} else if (ruleType === ‘dynamic’) {
if (!generatedCode) {
alert(‘Please generate code first’);
return;
}
try {
const result = eval(`(function() { ${generatedCode}; return generate_${fieldName}(); })()`);
setTestResult(String(result));
} catch (e) {
setTestResult(`Error: ${e.message}`);
}
}
};

const handleSave = () => {
const ruleData = { ruleType };

```
if (ruleType === 'static') {
  if (!thmlTag.trim()) {
    alert('Please enter a THML tag');
    return;
  }
  ruleData.thmlTag = thmlTag;
} else if (ruleType === 'dynamic') {
  if (!generatedCode) {
    alert('Please generate code first');
    return;
  }
  ruleData.prompt = prompt;
  ruleData.generatedCode = generatedCode;
}

onSave(ruleData);
alert('Rule saved successfully!');
```

};

return (
<div className="w-96 bg-white border-l shadow-lg flex flex-col h-full">
<div className="p-4 border-b bg-gray-50 flex items-center justify-between">
<div>
<h3 className="font-semibold text-lg">Edit Field</h3>
<p className="text-sm text-gray-600">/*{fieldName}*/</p>
</div>
<button
onClick={onClose}
className="p-1 hover:bg-gray-200 rounded"
>
<X className="w-5 h-5" />
</button>
</div>

```
  <div className="flex-1 flex flex-col p-4 overflow-auto">
    {/* Rule Type Selector */}
    <div className="mb-4">
      <label className="block text-sm font-medium mb-3">Rule Type</label>
      <div className="space-y-2">
        <label className="flex items-center p-3 border rounded cursor-pointer hover:bg-gray-50">
          <input
            type="radio"
            name="ruleType"
            value="static"
            checked={ruleType === 'static'}
            onChange={(e) => setRuleType(e.target.value)}
            className="mr-3"
          />
          <div className="flex-1">
            <div className="font-medium flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Static Mapping
            </div>
            <div className="text-xs text-gray-500">Map directly to a THML tag</div>
          </div>
        </label>

        <label className="flex items-center p-3 border rounded cursor-pointer hover:bg-gray-50">
          <input
            type="radio"
            name="ruleType"
            value="dynamic"
            checked={ruleType === 'dynamic'}
            onChange={(e) => setRuleType(e.target.value)}
            className="mr-3"
          />
          <div className="flex-1">
            <div className="font-medium flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Dynamic Generation
            </div>
            <div className="text-xs text-gray-500">Generate with AI from prompt</div>
          </div>
        </label>
      </div>
    </div>

    {/* Rule Input */}
    <div className="flex-1 mb-4">
      {ruleType === 'static' && (
        <div>
          <label className="block text-sm font-medium mb-2">
            THML Tag Name
          </label>
          <input
            type="text"
            value={thmlTag}
            onChange={(e) => setThmlTag(e.target.value)}
            className="w-full p-3 border rounded"
            placeholder="e.g., CompanyName, Salary, etc."
          />
          <p className="text-xs text-gray-500 mt-2">
            This will fetch the value from the corresponding THML file tag.
          </p>
        </div>
      )}

      {ruleType === 'dynamic' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              AI Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isGenerating}
              className="w-full h-32 p-3 border rounded text-sm resize-none"
              placeholder="Example: Write a JS function to fetch annual salary from THML using 'Salary' tag and multiply by 12"
            />
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate with AI
                </>
              )}
            </button>
          </div>

          {generatedCode && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Generated Code
              </label>
              <textarea
                value={generatedCode}
                onChange={(e) => setGeneratedCode(e.target.value)}
                className="w-full h-48 p-3 border rounded font-mono text-xs resize-none bg-gray-50"
              />
            </div>
          )}
        </div>
      )}
    </div>

    {/* Test Result */}
    {testResult && (
      <div className="mb-4 p-3 bg-gray-50 rounded border">
        <div className="text-xs font-medium text-gray-600 mb-1">Test Result:</div>
        <div className="text-sm font-mono break-all">{testResult}</div>
      </div>
    )}

    {/* Actions */}
    <div className="flex gap-2">
      <button
        onClick={handleTest}
        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
      >
        <Play className="w-4 h-4" />
        Test
      </button>
      <button
        onClick={handleSave}
        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        <Save className="w-4 h-4" />
        Save Rule
      </button>
    </div>
  </div>
</div>
```

);
};

export default DynamicTemplateEditor;
