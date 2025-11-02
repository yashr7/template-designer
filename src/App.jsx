import React, { useState, useRef } from 'react';
import { Upload, Code, Play, Save, FileText, Sparkles, X } from 'lucide-react';

const DynamicTemplateEditor = () => {
  const [htmlContent, setHtmlContent] = useState('');
  const [placeholders, setPlaceholders] = useState([]);
  const [selectedField, setSelectedField] = useState(null);
  const [rules, setRules] = useState({});
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef(null);

  const parseTemplate = (html) => {
    const regex = /\/\*(\w+)\*\//g;
    const found = [];
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
    
    setPlaceholders(found);
    return found;
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
    
    let processedHTML = htmlContent;
    placeholders.forEach((placeholder) => {
      const hasRule = rules[placeholder.name];
      const replacement = `<span class="placeholder ${hasRule ? 'has-rule' : ''}" data-field="${placeholder.name}">${placeholder.marker}</span>`;
      processedHTML = processedHTML.replace(new RegExp(placeholder.marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
    });
    
    return processedHTML;
  };

  const handlePlaceholderClick = (e) => {
    const fieldName = e.target.getAttribute('data-field');
    if (fieldName) {
      setSelectedField(fieldName);
    }
  };

  const saveRule = (fieldName, ruleData) => {
    setRules(prev => ({
      ...prev,
      [fieldName]: ruleData
    }));
  };

  const generateCode = () => {
    let code = '// Auto-generated template fill functions\n\n';
    
    Object.entries(rules).forEach(([fieldName, rule]) => {
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
  };

  const generatePreview = () => {
    let preview = htmlContent;
    
    placeholders.forEach((placeholder) => {
      const rule = rules[placeholder.name];
      let value = `/*${placeholder.name}*/`;
      
      if (rule) {
        if (rule.type === 'static') {
          value = rule.value;
        } else if (rule.type === 'javascript') {
          try {
            value = eval(`(function() { ${rule.code} })()`);
          } catch (e) {
            value = `[Error: ${e.message}]`;
          }
        } else if (rule.type === 'prompt') {
          value = `[AI Generated from: "${rule.prompt}"]`;
        }
      }
      
      preview = preview.replace(new RegExp(placeholder.marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    });
    
    return preview;
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
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Upload className="w-4 h-4" />
            Upload Template
          </button>
          
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
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Preview Output</h3>
              <div 
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ __html: generatePreview() }}
              />
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <style dangerouslySetInnerHTML={{
                __html: `
                  .placeholder {
                    background: #fef3c7;
                    padding: 2px 6px;
                    border-radius: 4px;
                    cursor: pointer;
                    border: 2px solid #fbbf24;
                    transition: all 0.2s;
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
                `
              }} />
              <div 
                onClick={handlePlaceholderClick}
                dangerouslySetInnerHTML={{ __html: renderEditableHTML() }}
              />
            </div>
          )}
        </div>
      </div>

      {selectedField && (
        <div className="w-96 bg-white border-l shadow-lg flex flex-col">
          <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Edit Field</h3>
              <p className="text-sm text-gray-600">/*{selectedField}*/</p>
            </div>
            <button
              onClick={() => setSelectedField(null)}
              className="p-1 hover:bg-gray-200 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <RuleEditor
            fieldName={selectedField}
            currentRule={rules[selectedField]}
            onSave={(ruleData) => saveRule(selectedField, ruleData)}
          />
        </div>
      )}
    </div>
  );
};

const RuleEditor = ({ fieldName, currentRule, onSave }) => {
  const [ruleType, setRuleType] = useState(currentRule?.type || 'javascript');
  const [code, setCode] = useState(currentRule?.code || 'return "Your value here";');
  const [prompt, setPrompt] = useState(currentRule?.prompt || '');
  const [staticValue, setStaticValue] = useState(currentRule?.value || '');
  const [testResult, setTestResult] = useState('');

  const handleSave = () => {
    const ruleData = { type: ruleType };
    
    if (ruleType === 'javascript') {
      ruleData.code = code;
    } else if (ruleType === 'prompt') {
      ruleData.prompt = prompt;
    } else if (ruleType === 'static') {
      ruleData.value = staticValue;
    }
    
    onSave(ruleData);
    alert('Rule saved successfully!');
  };

  const handleTest = () => {
    if (ruleType === 'javascript') {
      try {
        const result = eval(`(function() { ${code} })()`);
        setTestResult(String(result));
      } catch (e) {
        setTestResult(`Error: ${e.message}`);
      }
    } else if (ruleType === 'prompt') {
      setTestResult('[AI would generate result from this prompt]');
    } else {
      setTestResult(staticValue);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 overflow-auto">
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Rule Type</label>
        <div className="flex gap-2">
          {[
            { type: 'javascript', label: 'JavaScript', icon: Code },
            { type: 'prompt', label: 'AI Prompt', icon: Sparkles },
            { type: 'static', label: 'Static', icon: FileText }
          ].map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              onClick={() => setRuleType(type)}
              className={`flex-1 py-2 px-3 rounded flex items-center justify-center gap-2 text-sm ${
                ruleType === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 mb-4">
        {ruleType === 'javascript' && (
          <div>
            <label className="block text-sm font-medium mb-2">JavaScript Code</label>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-64 p-3 border rounded font-mono text-sm"
              placeholder="return new Date().toLocaleDateString();"
            />
          </div>
        )}

        {ruleType === 'prompt' && (
          <div>
            <label className="block text-sm font-medium mb-2">AI Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full h-64 p-3 border rounded text-sm"
              placeholder="Generate a professional summary for a software engineer with 5 years experience..."
            />
          </div>
        )}

        {ruleType === 'static' && (
          <div>
            <label className="block text-sm font-medium mb-2">Static Value</label>
            <input
              type="text"
              value={staticValue}
              onChange={(e) => setStaticValue(e.target.value)}
              className="w-full p-3 border rounded"
              placeholder="Enter static value..."
            />
          </div>
        )}
      </div>

      {testResult && (
        <div className="mb-4 p-3 bg-gray-50 rounded border">
          <div className="text-xs font-medium text-gray-600 mb-1">Test Result:</div>
          <div className="text-sm font-mono">{testResult}</div>
        </div>
      )}

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
  );
};

export default DynamicTemplateEditor;