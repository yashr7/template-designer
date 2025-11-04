Perfect! Let's build a Python backend with FastAPI that handles AI-powered rule generation and storage. Here's the complete backend setup:

## Step 1: Create Backend Directory Structure

```bash
# Navigate to your project root
cd ~/Projects/template-designer

# Create backend directory
mkdir dynamic-template-backend
cd dynamic-template-backend

# Create project structure
mkdir -p app/{models,routes,services,storage}
touch app/__init__.py
touch app/main.py
touch app/models/__init__.py
touch app/routes/__init__.py
touch app/services/__init__.py
```

## Step 2: Create Requirements File

```bash
code requirements.txt
```

Add this content:

```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
openai==1.3.5
python-dotenv==1.0.0
python-multipart==0.0.6
```

## Step 3: Install Dependencies

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

## Step 4: Create Environment File

```bash
code .env
```

Add:

```env
OPENAI_API_KEY=sk-your-openai-api-key-here
STORAGE_PATH=./storage
```

## Step 5: Create Pydantic Models

**`app/models/rule.py`:**
```bash
code app/models/rule.py
```

```python
from pydantic import BaseModel
from typing import Optional

class AIPromptRequest(BaseModel):
    prompt: str
    field_name: str
    context: Optional[str] = None

class RuleResponse(BaseModel):
    field_name: str
    generated_code: str
    ai_response: str
    
class SaveRuleRequest(BaseModel):
    template_id: str
    field_name: str
    prompt: str
    generated_code: str
    ai_response: str

class TemplateRule(BaseModel):
    field_name: str
    prompt: str
    generated_code: str
    ai_response: str
```

**`app/models/__init__.py`:**
```python
from .rule import AIPromptRequest, RuleResponse, SaveRuleRequest, TemplateRule
```

## Step 6: Create OpenAI Service

**`app/services/openai_service.py`:**
```bash
code app/services/openai_service.py
```

```python
import os
from openai import OpenAI
from typing import Dict

class OpenAIService:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
    def generate_rule_code(self, prompt: str, field_name: str, context: str = None) -> Dict[str, str]:
        """
        Generate JavaScript code based on AI prompt for a specific field.
        """
        system_message = """You are a code generation assistant. Generate JavaScript code based on user prompts.
        The code should be a function that returns a value for a template field.
        
        Rules:
        1. Always return a function that can be executed
        2. If the prompt asks to fetch from a file, generate code with fetch() or file reading logic
        3. If the prompt asks to generate data, use appropriate logic (dates, random values, etc.)
        4. Keep code clean and well-commented
        5. Return ONLY the JavaScript code, no explanations
        6. The function should be named generate_{field_name}
        """
        
        user_message = f"""Field name: {field_name}
        
Prompt: {prompt}

{f'Additional context: {context}' if context else ''}

Generate a JavaScript function that fulfills this requirement."""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": user_message}
                ],
                temperature=0.7,
                max_tokens=500
            )
            
            generated_code = response.choices[0].message.content.strip()
            
            # Clean up code (remove markdown code blocks if present)
            if generated_code.startswith("```javascript"):
                generated_code = generated_code[13:]
            if generated_code.startswith("```"):
                generated_code = generated_code[3:]
            if generated_code.endswith("```"):
                generated_code = generated_code[:-3]
            
            generated_code = generated_code.strip()
            
            return {
                "generated_code": generated_code,
                "ai_response": response.choices[0].message.content
            }
            
        except Exception as e:
            raise Exception(f"OpenAI API error: {str(e)}")
    
    def generate_simple_value(self, prompt: str, field_name: str) -> Dict[str, str]:
        """
        Generate a simple value (not code) based on prompt.
        Useful for generating content like names, descriptions, etc.
        """
        system_message = """You are a content generation assistant. Generate content based on user prompts.
        Keep responses concise and relevant to the field context."""
        
        user_message = f"""Field: {field_name}
        
Prompt: {prompt}

Generate appropriate content for this field."""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": user_message}
                ],
                temperature=0.8,
                max_tokens=200
            )
            
            content = response.choices[0].message.content.strip()
            
            # Wrap in a simple return function
            generated_code = f"function generate_{field_name}() {{\n  return `{content}`;\n}}"
            
            return {
                "generated_code": generated_code,
                "ai_response": content
            }
            
        except Exception as e:
            raise Exception(f"OpenAI API error: {str(e)}")
```

## Step 7: Create Storage Service

**`app/services/storage_service.py`:**
```bash
code app/services/storage_service.py
```

```python
import json
import os
from typing import Dict, List, Optional
from datetime import datetime

class StorageService:
    def __init__(self, storage_path: str = "./storage"):
        self.storage_path = storage_path
        self.rules_file = os.path.join(storage_path, "rules.json")
        self.templates_file = os.path.join(storage_path, "templates.json")
        self._ensure_storage_exists()
    
    def _ensure_storage_exists(self):
        """Create storage directory and files if they don't exist"""
        os.makedirs(self.storage_path, exist_ok=True)
        
        if not os.path.exists(self.rules_file):
            with open(self.rules_file, 'w') as f:
                json.dump({}, f)
        
        if not os.path.exists(self.templates_file):
            with open(self.templates_file, 'w') as f:
                json.dump({}, f)
    
    def save_rule(self, template_id: str, field_name: str, rule_data: Dict) -> Dict:
        """Save a rule for a specific template and field"""
        with open(self.rules_file, 'r') as f:
            rules = json.load(f)
        
        if template_id not in rules:
            rules[template_id] = {}
        
        rules[template_id][field_name] = {
            **rule_data,
            "updated_at": datetime.now().isoformat()
        }
        
        with open(self.rules_file, 'w') as f:
            json.dump(rules, f, indent=2)
        
        return rules[template_id][field_name]
    
    def get_rules_for_template(self, template_id: str) -> Dict:
        """Get all rules for a specific template"""
        with open(self.rules_file, 'r') as f:
            rules = json.load(f)
        
        return rules.get(template_id, {})
    
    def get_rule(self, template_id: str, field_name: str) -> Optional[Dict]:
        """Get a specific rule for a template field"""
        rules = self.get_rules_for_template(template_id)
        return rules.get(field_name)
    
    def delete_rule(self, template_id: str, field_name: str) -> bool:
        """Delete a specific rule"""
        with open(self.rules_file, 'r') as f:
            rules = json.load(f)
        
        if template_id in rules and field_name in rules[template_id]:
            del rules[template_id][field_name]
            
            with open(self.rules_file, 'w') as f:
                json.dump(rules, f, indent=2)
            
            return True
        
        return False
    
    def list_templates(self) -> List[str]:
        """List all template IDs that have rules"""
        with open(self.rules_file, 'r') as f:
            rules = json.load(f)
        
        return list(rules.keys())
    
    def save_template_metadata(self, template_id: str, name: str, description: str = "") -> Dict:
        """Save template metadata"""
        with open(self.templates_file, 'r') as f:
            templates = json.load(f)
        
        templates[template_id] = {
            "name": name,
            "description": description,
            "created_at": datetime.now().isoformat()
        }
        
        with open(self.templates_file, 'w') as f:
            json.dump(templates, f, indent=2)
        
        return templates[template_id]
    
    def get_template_metadata(self, template_id: str) -> Optional[Dict]:
        """Get template metadata"""
        with open(self.templates_file, 'r') as f:
            templates = json.load(f)
        
        return templates.get(template_id)
```

## Step 8: Create API Routes

**`app/routes/rules.py`:**
```bash
code app/routes/rules.py
```

```python
from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import Dict, List
import hashlib
from app.models.rule import (
    AIPromptRequest, 
    RuleResponse, 
    SaveRuleRequest,
    TemplateRule
)
from app.services.openai_service import OpenAIService
from app.services.storage_service import StorageService

router = APIRouter(prefix="/api/rules", tags=["rules"])

openai_service = OpenAIService()
storage_service = StorageService()

@router.post("/generate", response_model=RuleResponse)
async def generate_rule(request: AIPromptRequest):
    """
    Generate JavaScript code using AI based on the prompt.
    """
    try:
        result = openai_service.generate_rule_code(
            prompt=request.prompt,
            field_name=request.field_name,
            context=request.context
        )
        
        return RuleResponse(
            field_name=request.field_name,
            generated_code=result["generated_code"],
            ai_response=result["ai_response"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-simple", response_model=RuleResponse)
async def generate_simple_value(request: AIPromptRequest):
    """
    Generate a simple value (not code) using AI.
    """
    try:
        result = openai_service.generate_simple_value(
            prompt=request.prompt,
            field_name=request.field_name
        )
        
        return RuleResponse(
            field_name=request.field_name,
            generated_code=result["generated_code"],
            ai_response=result["ai_response"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/save")
async def save_rule(request: SaveRuleRequest):
    """
    Save a generated rule for a specific template and field.
    """
    try:
        rule_data = {
            "prompt": request.prompt,
            "generated_code": request.generated_code,
            "ai_response": request.ai_response
        }
        
        saved_rule = storage_service.save_rule(
            template_id=request.template_id,
            field_name=request.field_name,
            rule_data=rule_data
        )
        
        return {
            "message": "Rule saved successfully",
            "template_id": request.template_id,
            "field_name": request.field_name,
            "rule": saved_rule
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/template/{template_id}", response_model=Dict[str, TemplateRule])
async def get_template_rules(template_id: str):
    """
    Get all rules for a specific template.
    """
    try:
        rules = storage_service.get_rules_for_template(template_id)
        return rules
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/template/{template_id}/field/{field_name}")
async def get_specific_rule(template_id: str, field_name: str):
    """
    Get a specific rule for a template field.
    """
    try:
        rule = storage_service.get_rule(template_id, field_name)
        
        if rule is None:
            raise HTTPException(
                status_code=404, 
                detail=f"Rule not found for field '{field_name}' in template '{template_id}'"
            )
        
        return rule
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/template/{template_id}/field/{field_name}")
async def delete_rule(template_id: str, field_name: str):
    """
    Delete a specific rule.
    """
    try:
        success = storage_service.delete_rule(template_id, field_name)
        
        if not success:
            raise HTTPException(
                status_code=404,
                detail=f"Rule not found for field '{field_name}' in template '{template_id}'"
            )
        
        return {"message": "Rule deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/templates")
async def list_templates():
    """
    List all templates that have rules defined.
    """
    try:
        templates = storage_service.list_templates()
        return {"templates": templates}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/template/upload")
async def upload_template(
    file: UploadFile = File(...),
    template_name: str = None
):
    """
    Upload an HTML template and generate a unique template ID.
    """
    try:
        # Read file content
        content = await file.read()
        
        # Generate template ID from content hash
        template_id = hashlib.md5(content).hexdigest()[:12]
        
        # Save template file
        template_path = f"./storage/template_{template_id}.html"
        with open(template_path, 'wb') as f:
            f.write(content)
        
        # Save metadata
        name = template_name or file.filename
        storage_service.save_template_metadata(
            template_id=template_id,
            name=name,
            description=f"Uploaded: {file.filename}"
        )
        
        return {
            "message": "Template uploaded successfully",
            "template_id": template_id,
            "template_name": name,
            "file_path": template_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

## Step 9: Create Main Application

**`app/main.py`:**
```bash
code app/main.py
```

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

from app.routes import rules

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="Dynamic Template Editor API",
    description="Backend API for AI-powered template rule generation",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(rules.router)

@app.get("/")
async def root():
    return {
        "message": "Dynamic Template Editor API",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "openai_key_configured": bool(os.getenv("OPENAI_API_KEY"))
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

## Step 10: Run the Backend

```bash
# Make sure virtual environment is activated
source venv/bin/activate

# Run the server
uvicorn app.main:app --reload --port 8000
```

Visit:
- API: `http://localhost:8000`
- Swagger Docs: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/health`

---

## Project Structure:

```
dynamic-template-backend/
├── venv/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── models/
│   │   ├── __init__.py
│   │   └── rule.py
│   ├── routes/
│   │   ├── __init__.py
│   │   └── rules.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── openai_service.py
│   │   └── storage_service.py
│   └── storage/
├── .env
└── requirements.txt
```

---

## API Endpoints:

1. **POST** `/api/rules/generate` - Generate JS code from AI prompt
2. **POST** `/api/rules/generate-simple` - Generate simple value
3. **POST** `/api/rules/save` - Save rule for template
4. **GET** `/api/rules/template/{template_id}` - Get all rules
5. **GET** `/api/rules/template/{template_id}/field/{field_name}` - Get specific rule
6. **DELETE** `/api/rules/template/{template_id}/field/{field_name}` - Delete rule
7. **GET** `/api/rules/templates` - List all templates
8. **POST** `/api/rules/template/upload` - Upload HTML template

---

## Testing the API:

```bash
# Test health check
curl http://localhost:8000/health

# Test rule generation
curl -X POST http://localhost:8000/api/rules/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Generate current date in MM/DD/YYYY format",
    "field_name": "CurrentDate"
  }'
```

Now you have a fully functional Python backend! Next, we need to update the Angular frontend to connect to this API. Want me to do that? 🚀